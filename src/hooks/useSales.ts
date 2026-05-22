"use client";

import { createClient } from "@/lib/supabase/client";
import { Sale, SaleAddon, SaleCategory } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

export function useSales() {
  return useQuery<Sale[]>({
    queryKey: ["sales"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("sales")
        .select(`
          *,
          recipe:recipes(name),
          category:sale_categories(id, name),
          sale_addons(id, item_id, sub_recipe_id, quantity, price_per_unit_at_sale, name_at_sale, created_at)
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("sale_categories")
        .insert({ name, user_id: user!.id })
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

/** All sales (no limit) for reports — includes created_at for date filtering */
export function useReportSales() {
  return useQuery<Sale[]>({
    queryKey: ["report-sales"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("sales")
        .select("*, recipe:recipes(name), category:sale_categories(id, name)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("sales")
        .select("selling_price, hpp_at_sale, hpp_addons_at_sale, profit, quantity_sold");
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

      return {
        total_revenue,
        total_hpp,
        total_profit,
        profit_margin,
        sales_count: rows.length,
      };
    },
  });
}

type AddonInput = {
  item_id?: string | null;
  sub_recipe_id?: string | null;
  quantity: number;
  price_per_unit_at_sale: number;
  name_at_sale: string;
};

async function deductAddonStock(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  addons: AddonInput[],
) {
  for (const a of addons) {
    if (a.item_id) {
      const { error } = await supabase.rpc("adjust_item_stock", {
        p_user_id: userId,
        p_item_id: a.item_id,
        p_delta: -a.quantity,
      });
      if (error) throw error;
    } else if (a.sub_recipe_id) {
      const { error } = await supabase.rpc("deduct_sub_recipe_stock", {
        p_user_id: userId,
        p_recipe_id: a.sub_recipe_id,
        p_quantity: a.quantity,
      });
      if (error) throw error;
    }
  }
}

async function restoreAddonStock(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  addons: SaleAddon[],
) {
  for (const a of addons) {
    if (a.item_id) {
      const { error } = await supabase.rpc("adjust_item_stock", {
        p_user_id: userId,
        p_item_id: a.item_id,
        p_delta: a.quantity,
      });
      if (error) throw error;
    } else if (a.sub_recipe_id) {
      const { error } = await supabase.rpc("restore_sub_recipe_stock", {
        p_user_id: userId,
        p_recipe_id: a.sub_recipe_id,
        p_quantity: a.quantity,
      });
      if (error) throw error;
    }
  }
}

export function useCreateSale() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (p: {
      recipe_id: string;
      quantity_sold: number;
      selling_price: number;
      hpp_at_sale: number;
      category_id?: string | null;
      date?: string;
      sub_recipe_deductions?: Array<{
        sub_recipe_id: string;
        quantity: number;
      }>;
      addons?: AddonInput[];
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { date, sub_recipe_deductions, addons, ...rest } = p;
      const hpp_addons_at_sale = (addons ?? []).reduce(
        (sum, a) => sum + a.quantity * a.price_per_unit_at_sale,
        0,
      );
      const profit = p.selling_price - p.hpp_at_sale;

      const { data: saleData, error } = await supabase
        .from("sales")
        .insert({
          ...rest,
          profit,
          hpp_addons_at_sale,
          user_id: user!.id,
          ...(date ? { created_at: new Date(date).toISOString() } : {}),
        })
        .select("id")
        .single();
      if (error) throw error;

      const saleId = saleData.id;

      if (sub_recipe_deductions?.length) {
        for (const d of sub_recipe_deductions) {
          const { error: deductError } = await supabase.rpc("deduct_sub_recipe_stock", {
            p_user_id: user!.id,
            p_recipe_id: d.sub_recipe_id,
            p_quantity: d.quantity,
          });
          if (deductError) throw deductError;
        }
      }

      if (addons?.length) {
        const { error: addonError } = await supabase.from("sale_addons").insert(
          addons.map((a) => ({
            sale_id: saleId,
            item_id: a.item_id ?? null,
            sub_recipe_id: a.sub_recipe_id ?? null,
            quantity: a.quantity,
            price_per_unit_at_sale: a.price_per_unit_at_sale,
            name_at_sale: a.name_at_sale,
          })),
        );
        if (addonError) throw addonError;

        await deductAddonStock(supabase, user!.id, addons);
      }

      return saleId as string;
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
      quantity_sold: number;
      selling_price: number;
      hpp_at_sale: number;
      category_id?: string | null;
      date?: string;
      addons?: AddonInput[];
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const hpp_addons_at_sale = (p.addons ?? []).reduce(
        (sum, a) => sum + a.quantity * a.price_per_unit_at_sale,
        0,
      );
      const profit = p.selling_price - p.hpp_at_sale;

      const { error: updateError } = await supabase
        .from("sales")
        .update({
          quantity_sold: p.quantity_sold,
          selling_price: p.selling_price,
          profit,
          hpp_addons_at_sale,
          category_id: p.category_id ?? null,
          ...(p.date ? { created_at: new Date(p.date).toISOString() } : {}),
        })
        .eq("id", p.id);
      if (updateError) throw updateError;

      // Fetch old addons to restore stock
      const { data: oldAddons } = await supabase
        .from("sale_addons")
        .select("*")
        .eq("sale_id", p.id);

      if (oldAddons?.length) {
        await restoreAddonStock(supabase, user!.id, oldAddons as SaleAddon[]);
      }

      // Delete all old addons
      await supabase.from("sale_addons").delete().eq("sale_id", p.id);

      // Insert new addons and deduct stock
      if (p.addons?.length) {
        const { error: addonError } = await supabase.from("sale_addons").insert(
          p.addons.map((a) => ({
            sale_id: p.id,
            item_id: a.item_id ?? null,
            sub_recipe_id: a.sub_recipe_id ?? null,
            quantity: a.quantity,
            price_per_unit_at_sale: a.price_per_unit_at_sale,
            name_at_sale: a.name_at_sale,
          })),
        );
        if (addonError) throw addonError;

        await deductAddonStock(supabase, user!.id, p.addons);
      }
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
      const { error } = await supabase.from("sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["report-sales"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Penjualan dihapus");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
