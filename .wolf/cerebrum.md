# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-04-20

## User Preferences

<!-- How the user likes things done. Code style, tools, patterns, communication. -->
- **Communication:** User writes in Indonesian (casual). Respond in Indonesian.
- **Penjelasan temuan teknis (2026-08-04):** User sering minta "jelaskan simple". Untuk kerentanan/arsitektur, mulai dengan analogi konkret + rantai serangan langkah-per-langkah, baru istilah teknis. Tabel severity oke untuk ringkasan, tapi selalu sediakan versi bahasa manusia.
- **Product direction (2026-06-13):** Project is becoming a multi-tenant "base app" sold as feature packages. Wants per-client deployment + per-client database, but base updates must auto-propagate to all clients.

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
- **Ekosistem 3 repo (2026-08-04):** (1) `tata-data-dapur` = app (Cloudflare Pages, `app.tatadatadapur.my.id`) — juga host webhook Pakasir di `/api/pakasir/webhook`; (2) `tata-data-dapur-land-page` = Vite statis, insert baris `orders` via anon key lalu redirect ke `app.pakasir.com/pay/<slug>/<amount>`; (3) `tata-data-admin` = React + Cloudflare **Worker** `tata-data-admin-worker` (hono, cron per jam) yang menyimpan SERVICE KEY semua project dan mengelola users/orders/subscription. Perubahan alur order/akun hampir selalu menyentuh lebih dari satu repo.
- **Pakasir (2026-08-04):** TIDAK ada signature/secret di webhook-nya (dikonfirmasi di docs `pakasir.com/p/docs`). Satu-satunya verifikasi yang benar adalah callback `GET https://app.pakasir.com/api/transactiondetail?project&amount&order_id&api_key` lalu cocokkan order_id/amount/status. Host `app.pakasir.com` (bukan pakasir.zone.id). Env: `PAKASIR_API_KEY` di Pages project app.

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->
- [2026-05-16] When appending to buglog.json, inserting after the closing `]` of the bugs array produces invalid JSON. Always append INSIDE the array before `]`.
- [2026-06-11] `delete_production` and `update_production` only iterated `recipe_items WHERE item_id IS NOT NULL`. Sub-recipe rows (`sub_recipe_id IS NOT NULL`) were silently skipped, so sub-recipe stocks were never restored on delete/edit. Always loop BOTH item_id and sub_recipe_id when reversing a production. Guard the sub-recipe loop with `IF NOT v_is_ingredient` because `produce_sub_recipe` does NOT deduct nested sub-recipes — only `produce_recipe` does.
- [2026-07-30] `promo-video/` is a separate subproject with its own `package.json`/`node_modules` (remotion is NOT a root dependency). The root `tsconfig.json` must keep `"promo-video"` in `exclude`, otherwise `next build` type-checks it and the Cloudflare Pages deploy fails with `Cannot find module '@remotion/cli/config'`. Local builds hide this because `promo-video/node_modules` exists. Same rule for any future subfolder with its own `package.json`.
- [2026-07-30] Adding a parameter to an existing Postgres RPC with `CREATE OR REPLACE FUNCTION` does NOT replace it — a changed signature creates a second overload, and 5-arg calls then fail with "Could not choose the best candidate function" because the new param has a DEFAULT. Whenever an RPC's parameter list changes, `DROP FUNCTION IF EXISTS public.fn(oldargtypes...)` in the same migration. Happened with `produce_recipe`/`produce_sub_recipe` (migr. 024/025, fixed by 027).
- [2026-08-04] Endpoint publik yang memakai service role (webhook pembayaran) TIDAK boleh mempercayai isi payload-nya. Payload webhook = petunjuk, bukan otorisasi: selalu verifikasi ke penyedia pembayaran memakai nilai dari DB kita sendiri (bukan dari payload), dan fail-closed kalau key hilang / provider tak bisa dihubungi. Ingat juga `orders` bisa di-INSERT anon dari landing page, jadi isi baris order pun tidak tepercaya.
- [2026-08-04] Tabel yang dibuat lewat dashboard Supabase tanpa file migrasi (`user_profiles` dulu, lalu `expenses`, `expense_categories`, `sale_categories`) bikin status RLS tak bisa diaudit dari repo. Setiap tabel baru HARUS punya migrasi berisi `enable row level security` + policy `auth.uid() = user_id`, karena query app tidak pernah memfilter `user_id` sendiri — RLS satu-satunya pemisah data antar user.
- [2026-06-11] Auto-fill `totalCost` in produksi form was `Math.ceil(hpp * qty)`. User wants precise `hpp * qty` stored (numeric 2dp), rounded only for display. Use `String(hpp * qty)` for auto-fill and `step="0.01"` on the input.

## Decision Log

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->
- [2026-06-13] **Multi-tenant SaaS architecture ("base app + paket fitur").** Chosen model: **per-client deployment + per-client database (Supabase project) + single shared codebase**. Differences between clients live ONLY in env vars (Supabase creds + enabled features + branding) — NEVER in code branches. All client deployments build from the same repo/branch, so pushing to base auto-redeploys every client (Cloudflare Pages git auto-deploy) = "update base → all clients update". Rejected: (a) shared-DB+RLS pool (user wants physical DB isolation), (b) control-plane dynamic DB routing (user wants 1 deployment per client because add-on features differ). Feature gating = env-driven flags (`NEXT_PUBLIC_ENABLED_FEATURES`, `NEXT_PUBLIC_DISABLED_FEATURES`) read by a feature registry/entitlement layer (`src/lib/features/`). First add-on package planned: Kasir/POS. Build order: foundation (registry + entitlement + nav/route gating + provisioning docs) FIRST, then Kasir module.
- [2026-05-16] Security fix for SECURITY DEFINER RPCs: chose Option A (add auth.uid() guard, keep p_user_id param) over Option B (remove param, use auth.uid() directly) to avoid client-side changes. Guard uses `IS DISTINCT FROM` instead of `!=` to handle NULL safely. All 7 affected functions: record_purchase, update_purchase, delete_purchase, produce_sub_recipe, deduct_sub_recipe_stock, delete_production, update_production.
- [2026-05-28] Finished goods inventory: produk jadi (is_ingredient=false) sekarang punya stok via recipes.stock. Sale flow berubah: deduct recipes.stock (via deduct_sub_recipe_stock reused) bukan deduct ingredients langsung. Produksi via produce_recipe RPC baru. Modal konfirmasi muncul jika stok kurang saat jual — opsi "Produksi & Jual" (atomic) atau "Jual Tetap" (stok negatif). Banner peringatan tampil jika ada stok negatif. sub_recipe_deductions dihapus dari ItemInput karena bahan kini dideduct di produksi bukan di penjualan.
