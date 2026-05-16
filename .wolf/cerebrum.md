# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-04-20

## User Preferences

<!-- How the user likes things done. Code style, tools, patterns, communication. -->

## Key Learnings

- **Security pattern:** All SECURITY DEFINER SQL functions in this project previously accepted `p_user_id` without validating against `auth.uid()`. Fix pattern: `IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;` at the top of each function. Use `IS DISTINCT FROM` not `!=` to safely handle NULL.
- **user_profiles table:** Not tracked in migrations — was created manually in Supabase dashboard. Referenced in middleware.ts for version gating (must be 'v1'). Migration 008 adds it with IF NOT EXISTS + RLS + signup trigger.
- **All SECURITY DEFINER RPCs in this project:** record_purchase, update_purchase, delete_purchase (usePurchases.ts), produce_sub_recipe, deduct_sub_recipe_stock (usePurchases.ts + useSales.ts), delete_production, update_production (usePurchases.ts). Client always passes `user!.id` as `p_user_id`.
- **SET search_path = public:** Should be added to all SECURITY DEFINER functions to prevent search_path injection. Missing from migrations 003-005.

- **Project:** tata-data-dapur
- **HPP badge bug:** `prev_avg_price` di DB bernilai 0 (bukan null) untuk item yang belum pernah diupdate harganya. `??` tidak menangkap 0, jadi kalkulasi prev_hpp menjadi sangat kecil dan persentase kenaikan menjadi misleading. Fix: gunakan `||` agar 0 fallback ke avg_price.
- **Sales page pattern:** Edit modal reuse create modal — `editing: Sale | null` state sebagai flag, `openEdit()` pre-fill form, `closeModal()` clear editing + close, guard `(editing || selectedRecipe)` untuk profit preview.
- **useDeletePurchase:** Delete langsung dari tabel `purchases`, TIDAK via RPC. Tidak me-revert perubahan stock/avg_price — user harus sadar ini.
- **Date filter purchases:** State `filterDateFrom`/`filterDateTo` di-filter di useMemo client-side. Gunakan `setHours(0,0,0,0)` dan `setHours(23,59,59,999)` untuk full-day range.
- **Description:** This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->
- [2026-05-16] When appending to buglog.json, inserting after the closing `]` of the bugs array produces invalid JSON. Always append INSIDE the array before `]`.

## Decision Log

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->
- [2026-05-16] Security fix for SECURITY DEFINER RPCs: chose Option A (add auth.uid() guard, keep p_user_id param) over Option B (remove param, use auth.uid() directly) to avoid client-side changes. Guard uses `IS DISTINCT FROM` instead of `!=` to handle NULL safely. All 7 affected functions: record_purchase, update_purchase, delete_purchase, produce_sub_recipe, deduct_sub_recipe_stock, delete_production, update_production.
