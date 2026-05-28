"use client";

import { createClient } from "@/lib/supabase/client";
import { Sale, SaleAddon, SaleCategory, SaleItem } from "@/types";
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
  name_at_sale: string;
};

type ItemInput = {
  recipe_id: string;
  quantity_sold: number;
  selling_price: number;
  hpp_at_sale: number;
  addons?: AddonInput[];
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
      category_id?: string | null;
      date?: string;
      items: ItemInput[];
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const saleDate = p.date
        ? new Date(p.date).toISOString()
        : new Date().toISOString();

      // Create sale header
      const { data: saleData, error: saleError } = await supabase
        .from("sales")
        .insert({
          user_id: user!.id,
          category_id: p.category_id ?? null,
          created_at: saleDate,
        })
        .select("id")
        .single();
      if (saleError) throw saleError;
      const saleId = saleData.id as string;

      // Create each sale_item with its addons
      for (const item of p.items) {
        const hpp_addons_at_sale = (item.addons ?? []).reduce(
          (sum, a) => sum + a.quantity * a.price_per_unit_at_sale,
          0,
        );

        const { data: itemData, error: itemError } = await supabase
          .from("sale_items")
          .insert({
            sale_id: saleId,
            user_id: user!.id,
            recipe_id: item.recipe_id,
            quantity_sold: item.quantity_sold,
            selling_price: item.selling_price,
            hpp_at_sale: item.hpp_at_sale,
            hpp_addons_at_sale,
            created_at: saleDate,
          })
          .select("id")
          .single();
        if (itemError) throw itemError;
        const saleItemId = itemData.id as string;

        // Deduct finished goods stock
        const { error: stockDeductError } = await supabase.rpc("deduct_sub_recipe_stock", {
          p_user_id: user!.id,
          p_recipe_id: item.recipe_id,
          p_quantity: item.quantity_sold,
        });
        if (stockDeductError) throw stockDeductError;

        // Insert addons + deduct addon stock
        if (item.addons?.length) {
          const { error: addonError } = await supabase
            .from("sale_addons")
            .insert(
              item.addons.map((a) => ({
                sale_item_id: saleItemId,
                item_id: a.item_id ?? null,
                sub_recipe_id: a.sub_recipe_id ?? null,
                quantity: a.quantity,
                price_per_unit_at_sale: a.price_per_unit_at_sale,
                name_at_sale: a.name_at_sale,
              })),
            );
          if (addonError) throw addonError;
          await deductAddonStock(supabase, user!.id, item.addons);
        }
      }

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
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Fetch old sale_items + their addons to restore stocks
      const { data: oldItems } = await supabase
        .from("sale_items")
        .select("id, recipe_id, quantity_sold, sale_addons(*)")
        .eq("sale_id", p.id);

      for (const oi of oldItems ?? []) {
        // Restore finished goods stock
        await supabase.rpc("restore_recipe_stock", {
          p_user_id: user!.id,
          p_recipe_id: oi.recipe_id,
          p_quantity: oi.quantity_sold,
        });
        const addons = (oi.sale_addons ?? []) as SaleAddon[];
        if (addons.length) {
          await restoreAddonStock(supabase, user!.id, addons);
        }
      }

      // Delete old sale_items (cascades to sale_addons)
      await supabase.from("sale_items").delete().eq("sale_id", p.id);

      // Update sale header
      const saleDate = p.date ? new Date(p.date).toISOString() : undefined;
      const { error: updateError } = await supabase
        .from("sales")
        .update({
          category_id: p.category_id ?? null,
          ...(saleDate ? { created_at: saleDate } : {}),
        })
        .eq("id", p.id);
      if (updateError) throw updateError;

      const insertDate = saleDate ?? new Date().toISOString();

      // Re-insert sale_items + addons
      for (const item of p.items) {
        const hpp_addons_at_sale = (item.addons ?? []).reduce(
          (sum, a) => sum + a.quantity * a.price_per_unit_at_sale,
          0,
        );

        const { data: itemData, error: itemError } = await supabase
          .from("sale_items")
          .insert({
            sale_id: p.id,
            user_id: user!.id,
            recipe_id: item.recipe_id,
            quantity_sold: item.quantity_sold,
            selling_price: item.selling_price,
            hpp_at_sale: item.hpp_at_sale,
            hpp_addons_at_sale,
            created_at: insertDate,
          })
          .select("id")
          .single();
        if (itemError) throw itemError;
        const saleItemId = itemData.id as string;

        // Deduct finished goods stock
        const { error: stockDeductError } = await supabase.rpc("deduct_sub_recipe_stock", {
          p_user_id: user!.id,
          p_recipe_id: item.recipe_id,
          p_quantity: item.quantity_sold,
        });
        if (stockDeductError) throw stockDeductError;

        if (item.addons?.length) {
          const { error: addonError } = await supabase
            .from("sale_addons")
            .insert(
              item.addons.map((a) => ({
                sale_item_id: saleItemId,
                item_id: a.item_id ?? null,
                sub_recipe_id: a.sub_recipe_id ?? null,
                quantity: a.quantity,
                price_per_unit_at_sale: a.price_per_unit_at_sale,
                name_at_sale: a.name_at_sale,
              })),
            );
          if (addonError) throw addonError;
          await deductAddonStock(supabase, user!.id, item.addons);
        }
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
      const { data: { user } } = await supabase.auth.getUser();

      // Restore finished goods stocks before deleting
      const { data: saleItems } = await supabase
        .from("sale_items")
        .select("recipe_id, quantity_sold")
        .eq("sale_id", id);

      for (const si of saleItems ?? []) {
        await supabase.rpc("restore_recipe_stock", {
          p_user_id: user!.id,
          p_recipe_id: si.recipe_id,
          p_quantity: si.quantity_sold,
        });
      }

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
