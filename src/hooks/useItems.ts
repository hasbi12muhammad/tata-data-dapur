"use client";

import { createClient } from "@/lib/supabase/client";
import { Item } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { getTenantId } from "@/lib/tenant";
import { isStaffSession } from "@/hooks/useAuth";

export function useItems() {
  return useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: async () => {
      const supabase = createClient();
      const staff = await isStaffSession(supabase);
      // staff: tanpa avg_price/prev_avg_price (dikunci DB); owner: penuh
      const { data, error } = await supabase
        .from("items")
        .select((
          staff
            ? "id,user_id,name,unit,current_price,created_at,stock,is_addon,avg_price_updated_at,selling_price"
            : "*"
          ) as "*"
        )
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (
      item: Omit<
        Item,
        | "id"
        | "user_id"
        | "created_at"
        | "avg_price"
        | "prev_avg_price"
        | "stock"
      >,
    ) => {
      const supabase = createClient();
      const tenantId = await getTenantId(supabase);
      const { error } = await supabase
        .from("items")
        .insert({ ...item, user_id: tenantId, avg_price: 0, stock: 0 });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("Item created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...update }: Partial<Item> & { id: string }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("items")
        .update(update)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("Item updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddonItems() {
  return useQuery<Item[]>({
    queryKey: ["items", "addon"],
    queryFn: async () => {
      const supabase = createClient();
      const staff = await isStaffSession(supabase);
      const { data, error } = await supabase
        .from("items")
        .select((
          staff
            ? "id,user_id,name,unit,current_price,created_at,stock,is_addon,avg_price_updated_at,selling_price"
            : "*"
          ) as "*"
        )
        .eq("is_addon", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("Item deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
