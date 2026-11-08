"use client";

import { createClient } from "@/lib/supabase/client";
import { Sale, SaleCategory, SaleItem } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getTenantId } from "@/lib/tenant";

export function useSales() {
  return useQuery<Sale[]>({
    queryKey: ["sales"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("sales")
        .select(`
          *,
          category:sale_categories(id, name),
          sale_items(
            *,
            recipe:recipes(id, name),
            sale_addons(*)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Sale[];
    },
  });
}

export function useSaleCategories() {
  return useQuery<SaleCategory[]>({
    queryKey: ["sale-categories"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("sale_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateSaleCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const supabase = createClient();
      const tenantId = await getTenantId(supabase);
      const { data, error } = await supabase
        .from("sale_categories")
        .insert({ name, user_id: tenantId })
        .select()
        .single();
      if (error) throw error;
      return data as SaleCategory;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sale-categories"] });
      toast.success("Kategori ditambahkan");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** All sale_items (no limit) for reports — includes created_at for date filtering */
export function useReportSales() {
  return useQuery<SaleItem[]>({
    queryKey: ["report-sales"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("sale_items")
        .select(`
          *,
          recipe:recipes(id, name),
          sale:sales(id, created_at, category:sale_categories(id, name))
        `)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SaleItem[];
    },
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("sale_items")
        .select("selling_price, hpp_at_sale, hpp_addons_at_sale, quantity_sold, sale_id");
      if (error) throw error;

      const rows = data ?? [];
      const total_revenue = rows.reduce(
        (s, r) => s + r.selling_price * r.quantity_sold,
        0,
      );
      const total_hpp = rows.reduce(
        (s, r) => s + r.hpp_at_sale * r.quantity_sold + (r.hpp_addons_at_sale ?? 0),
        0,
      );
      const total_profit = total_revenue - total_hpp;
      const profit_margin =
        total_revenue > 0 ? (total_profit / total_revenue) * 100 : 0;
      const sales_count = new Set(rows.map((r) => r.sale_id)).size;

      return {
        total_revenue,
        total_hpp,
        total_profit,
        profit_margin,
        sales_count,
      };
    },
  });
}

type AddonInput = {
  item_id?: string | null;
  sub_recipe_id?: string | null;
  quantity: number;
  price_per_unit_at_sale: number;
  hpp_per_unit?: number;
  name_at_sale: string;
};

type ItemInput = {
  recipe_id: string;
  quantity_sold: number;
  selling_price: number;
  hpp_at_sale: number;
  addons?: AddonInput[];
};

// HPP dihitung di server (record_sale/update_sale_record) — klien tidak mengirim HPP.
function toRpcItems(items: ItemInput[]) {
  return items.map((i) => ({
    recipe_id: i.recipe_id,
    quantity_sold: i.quantity_sold,
    selling_price: i.selling_price,
    addons: (i.addons ?? []).map((a) => ({
      item_id: a.item_id ?? null,
      sub_recipe_id: a.sub_recipe_id ?? null,
      quantity: a.quantity,
      price_per_unit_at_sale: a.price_per_unit_at_sale,
      name_at_sale: a.name_at_sale,
    })),
  }));
}

async function persistSellingPrices(
  supabase: ReturnType<typeof createClient>,
  items: ItemInput[],
) {
  try {
    for (const item of items) {
      // Only remember standalone price — combo price (with add-ons) is not the base product's price
      if (item.selling_price > 0 && (item.addons ?? []).length === 0) {
        await supabase
          .from("recipes")
          .update({ selling_price: item.selling_price })
          .eq("id", item.recipe_id);
      }
      for (const addon of item.addons ?? []) {
        if (addon.price_per_unit_at_sale > 0) {
          if (addon.item_id) {
            await supabase
              .from("items")
              .update({ selling_price: addon.price_per_unit_at_sale })
              .eq("id", addon.item_id);
          } else if (addon.sub_recipe_id) {
            await supabase
              .from("recipes")
              .update({ selling_price: addon.price_per_unit_at_sale })
              .eq("id", addon.sub_recipe_id);
          }
        }
      }
    }
  } catch {
    // best-effort, ignore errors
  }
}

export function useCreateSale() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (p: {
      category_id?: string | null;
      date?: string;
      items: ItemInput[];
    }) => {
      const supabase = createClient();
      const { data: saleId, error } = await supabase.rpc("record_sale", {
        p_category_id: p.category_id ?? null,
        p_created_at: p.date ? new Date(p.date).toISOString() : null,
        p_items: toRpcItems(p.items),
      });
      if (error) throw error;
      await persistSellingPrices(supabase, p.items);
      return saleId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["recipes"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("Penjualan dicatat");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      id: string;
      category_id?: string | null;
      date?: string;
      items: ItemInput[];
    }) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("update_sale_record", {
        p_sale_id: p.id,
        p_category_id: p.category_id ?? null,
        p_created_at: p.date ? new Date(p.date).toISOString() : null,
        p_items: toRpcItems(p.items),
      });
      if (error) throw error;
      await persistSellingPrices(supabase, p.items);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["report-sales"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Penjualan diperbarui");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.rpc("delete_sale_record", { p_sale_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["report-sales"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Penjualan dihapus");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
