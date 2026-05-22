"use client";

import { createClient } from "@/lib/supabase/client";
import { Purchase, SaleItem } from "@/types";
import { useQuery } from "@tanstack/react-query";

function nextDay(date: string): string {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export function useSalesByDate(date: string) {
  return useQuery<SaleItem[]>({
    queryKey: ["sale-items", "date", date],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("sale_items")
        .select(`
          *,
          recipe:recipes(id, name),
          sale:sales(id, category:sale_categories(id, name))
        `)
        .gte("created_at", date)
        .lt("created_at", nextDay(date))
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SaleItem[];
    },
    enabled: !!date,
  });
}

export function usePurchasesByDate(date: string) {
  return useQuery<Purchase[]>({
    queryKey: ["purchases", "date", date],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("purchases")
        .select("*, item:items(name, unit, avg_price)")
        .gte("created_at", date)
        .lt("created_at", nextDay(date))
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!date,
  });
}
