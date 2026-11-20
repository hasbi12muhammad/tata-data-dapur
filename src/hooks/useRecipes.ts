"use client";

import { createClient } from "@/lib/supabase/client";
import { Recipe, RecipeItem } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getTenantId } from "@/lib/tenant";
import { RECIPE_SAFE_COLS } from "@/hooks/useSales";
import { isStaffSession } from "@/hooks/useAuth";

export function calcHPP(
  items: RecipeItem[],
  usePrev: boolean,
  batchYield: number = 1,
  wastePct: number = 0,
): number {
  const rawCost = items.reduce((sum, ri) => {
    if (ri.sub_recipe_id && ri.sub_recipe) {
      const sub = ri.sub_recipe;
      const subHppPerUnit = calcHPP(
        sub.recipe_items ?? [],
        usePrev,
        sub.batch_yield ?? 1,
        sub.waste_pct ?? 0,
      );
      return sum + subHppPerUnit * ri.quantity_used;
    }
    const item = ri.item;
    const price = usePrev
      ? (item?.prev_avg_price || item?.avg_price || 0)
      : (item?.avg_price ?? 0);
    return sum + price * ri.quantity_used;
  }, 0);
  const effectiveYield = Math.max(batchYield * (1 - wastePct / 100), 0.001);
  return rawCost / effectiveYield;
}

export function useRecipes() {
  return useQuery<Recipe[]>({
    queryKey: ["recipes"],
    queryFn: async () => {
      const supabase = createClient();
      const staff = await isStaffSession(supabase);
      // staff: tanpa avg_price/hpp_baseline (dikunci DB); owner: penuh
      const cols = staff ? RECIPE_SAFE_COLS : "*";
      const itemCols = staff
        ? "name, unit, avg_price_updated_at, stock"
        : "name, unit, avg_price, prev_avg_price, avg_price_updated_at, stock";
      const subCols = staff
        ? "id, name, unit, stock, is_ingredient, batch_yield, waste_pct"
        : "id, name, unit, stock, avg_price, is_ingredient, batch_yield, waste_pct";
      const { data, error } = await supabase
        .from("recipes")
        .select(
          `${cols},
          recipe_items!recipe_id(
            id,recipe_id,item_id,sub_recipe_id,quantity_used,
            item:items(${itemCols}),
            sub_recipe:recipes!sub_recipe_id(
              ${subCols},
              recipe_items!recipe_id(
                quantity_used, item_id,
                item:items(${itemCols})
              )
            )
          )` as "*"
        )
        .order("name");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        is_ingredient: r.is_ingredient ?? false,
        stock: r.stock ?? 0,
        avg_price: r.avg_price ?? 0,
        hpp: calcHPP(r.recipe_items ?? [], false, r.batch_yield ?? 1, r.waste_pct ?? 0),
        prev_hpp: calcHPP(r.recipe_items ?? [], true, r.batch_yield ?? 1, r.waste_pct ?? 0),
      }));
    },
  });
}

export function useCreateRecipe() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      name: string;
      is_ingredient?: boolean;
      is_addon?: boolean;
      unit?: string | null;
      batch_yield?: number;
      waste_pct?: number;
      hpp_baseline?: number;
      items: Array<{
        item_id?: string | null;
        sub_recipe_id?: string | null;
        quantity_used: number;
      }>;
    }) => {
      const supabase = createClient();
      const tenantId = await getTenantId(supabase);
      const { data: recipe, error: re } = await supabase
        .from("recipes")
        .insert({
          name: payload.name,
          user_id: tenantId,
          is_ingredient: payload.is_ingredient ?? false,
          is_addon: payload.is_addon ?? false,
          unit: payload.unit ?? null,
          batch_yield: payload.batch_yield ?? 1,
          waste_pct: payload.waste_pct ?? 0,
          hpp_baseline: payload.hpp_baseline ?? null,
        })
        .select()
        .single();
      if (re) throw re;

      const { error: rie } = await supabase.from("recipe_items").insert(
        payload.items.map((i) => ({
          recipe_id: recipe.id,
          item_id: i.item_id ?? null,
          sub_recipe_id: i.sub_recipe_id ?? null,
          quantity_used: i.quantity_used,
        }))
      );
      if (rie) throw rie;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Recipe created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateRecipe() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      name: string;
      is_ingredient?: boolean;
      is_addon?: boolean;
      unit?: string | null;
      batch_yield?: number;
      waste_pct?: number;
      hpp_baseline?: number;
      items: Array<{
        item_id?: string | null;
        sub_recipe_id?: string | null;
        quantity_used: number;
      }>;
    }) => {
      const supabase = createClient();
      const { error: re } = await supabase
        .from("recipes")
        .update({
          name: payload.name,
          is_ingredient: payload.is_ingredient ?? false,
          is_addon: payload.is_addon ?? false,
          unit: payload.unit ?? null,
          batch_yield: payload.batch_yield ?? 1,
          waste_pct: payload.waste_pct ?? 0,
          hpp_baseline: payload.hpp_baseline ?? null,
        })
        .eq("id", payload.id);
      if (re) throw re;

      const { error: de } = await supabase
        .from("recipe_items")
        .delete()
        .eq("recipe_id", payload.id);
      if (de) throw de;

      const { error: ie } = await supabase.from("recipe_items").insert(
        payload.items.map((i) => ({
          recipe_id: payload.id,
          item_id: i.item_id ?? null,
          sub_recipe_id: i.sub_recipe_id ?? null,
          quantity_used: i.quantity_used,
        }))
      );
      if (ie) throw ie;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Recipe updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddonSubRecipes() {
  return useQuery<Recipe[]>({
    queryKey: ["recipes", "addon"],
    queryFn: async () => {
      const supabase = createClient();
      const staff = await isStaffSession(supabase);
      const { data, error } = await supabase
        .from("recipes")
        .select((staff ? RECIPE_SAFE_COLS : "*") as "*")
        .eq("is_ingredient", true)
        .eq("is_addon", true)
        .order("name");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        is_ingredient: r.is_ingredient ?? false,
        is_addon: r.is_addon ?? false,
        stock: r.stock ?? 0,
        avg_price: r.avg_price ?? 0,
        hpp: 0,
        prev_hpp: 0,
      }));
    },
  });
}

export function useAddonFinishedRecipes() {
  return useQuery<Recipe[]>({
    queryKey: ["recipes", "addon-finished"],
    queryFn: async () => {
      const supabase = createClient();
      const staff = await isStaffSession(supabase);
      const { data, error } = await supabase
        .from("recipes")
        .select((staff ? RECIPE_SAFE_COLS : "*") as "*")
        .eq("is_ingredient", false)
        .eq("is_addon", true)
        .order("name");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        is_ingredient: false,
        is_addon: true,
        stock: r.stock ?? 0,
        avg_price: r.avg_price ?? 0,
        hpp: 0,
        prev_hpp: 0,
      }));
    },
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("recipes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Recipe deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
