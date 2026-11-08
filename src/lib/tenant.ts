import type { SupabaseClient } from "@supabase/supabase-js";

export type Claims = { sub: string; role?: string; owner_id?: string };

// Baca klaim JWT dari sesi lokal (tanpa request jaringan). Validasi tetap di DB (RLS).
export async function getClaims(supabase: SupabaseClient): Promise<Claims> {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  if (!t) throw new Error("Belum login");
  const b = atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0))));
}

// Karyawan menulis ke data owner-nya: owner_id dari hook, selain itu sub.
export async function getTenantId(supabase: SupabaseClient): Promise<string> {
  const c = await getClaims(supabase);
  return c.owner_id ?? c.sub;
}
