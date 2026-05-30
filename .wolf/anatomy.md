# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-05-28T03:27:42.323Z
> Files: 71 tracked | Anatomy hits: 0 | Misses: 0

## ../../../../tmp/

- `commitmsg.txt` (~141 tok)

## ../../.claude/plans/

- `oke-sekarang-aku-mau-curious-creek.md` — Feature: Add-On pada Penjualan (~2558 tok)

## ./

- `.gitignore` — Git ignore rules (~128 tok)
- `AGENTS.md` — This is NOT the Next.js you know (~82 tok)
- `CLAUDE.md` — OpenWolf (~60 tok)
- `eslint.config.mjs` — ESLint flat configuration (~109 tok)
- `next-env.d.ts` — / <reference types="next" /> (~71 tok)
- `next.config.ts` — Next.js configuration (~40 tok)
- `package-lock.json` — npm lock file (~118084 tok)
- `package.json` — Node.js package manifest (~287 tok)
- `postcss.config.mjs` — Declares config (~26 tok)
- `README.md` — Project documentation (~363 tok)
- `tsconfig.json` — TypeScript configuration (~206 tok)
- `tsconfig.tsbuildinfo` (~51208 tok)
- `wrangler.toml` (~134 tok)

## .claude/

- `settings.json` (~441 tok)
- `settings.local.json` (~399 tok)

## .claude/rules/

- `openwolf.md` (~313 tok)

## public/

- `manifest.json` (~186 tok)
- `sw.js` — Declares CACHE (~338 tok)

## src/

- `middleware.ts` — Exports middleware, config (~831 tok)

## src/app/

- `globals.css` — Styles: 3 rules, 12 vars, 1 media queries (~330 tok)
- `layout.tsx` — metadata (~244 tok)
- `page.tsx` — Redirected by middleware to /dashboard or /login (~30 tok)

## src/app/dashboard/

- `page.tsx` — dynamic (~3958 tok)

## src/app/expenses/

- `page.tsx` — dynamic — renders table (~6085 tok)

## src/app/items/

- `page.tsx` — dynamic — renders table (~5036 tok)

## src/app/login/

- `page.tsx` — dynamic — renders form — uses useState (~771 tok)

## src/app/offline/

- `page.tsx` — dynamic (~309 tok)

## src/app/purchases/

- `page.tsx` — dynamic (~11771 tok)

## src/app/recipes/

- `page.tsx` — dynamic (~5560 tok)

## src/app/reports/

- `page.tsx` — dynamic (~14892 tok)

## src/app/sales/

- `page.tsx` — dynamic (~19207 tok)

## src/app/settings/

- `page.tsx` — dynamic — renders form (~1942 tok)

## src/app/unauthorized/

- `page.tsx` — UnauthorizedPage (~428 tok)

## src/components/

- `ServiceWorkerRegister.tsx` — ServiceWorkerRegister — uses useEffect (~72 tok)

## src/components/layout/

- `AppLayout.tsx` — AppLayout — uses useState (~477 tok)
- `Sidebar.tsx` — ALL_NAV (~1209 tok)

## src/components/ui/

- `Button.tsx` — variants (~437 tok)
- `Card.tsx` — Card (~230 tok)
- `EmptyState.tsx` — EmptyState (~202 tok)
- `ImportExcelModal.tsx` — ImportExcelModal — renders table, modal — uses useState (~1803 tok)
- `Input.tsx` — Input (~778 tok)
- `Modal.tsx` — sizes — uses useEffect (~562 tok)
- `StatCard.tsx` — accents (~467 tok)

## src/hooks/

- `useAuth.ts` — Exports useCurrentUser, useAuth (~343 tok)
- `useDailyData.ts` — Exports useSalesByDate, usePurchasesByDate (~423 tok)
- `useExpenses.ts` — Exports useExpenses, useExpensesByDate, useExpenseCategories, useReportExpenses + 4 more (~1368 tok)
- `useItems.ts` — Exports useItems, useCreateItem, useUpdateItem, useAddonItems, useDeleteItem (~766 tok)
- `usePurchases.ts` — Exports usePurchases, useUpdatePurchase, useCreatePurchase (~731 tok)
- `useRecipes.ts` — Exports calcHPP, useRecipes, useCreateRecipe, useUpdateRecipe + 3 more (~1806 tok)
- `useSales.ts` — All sale_items (no limit) for reports — includes created_at for date filtering (~3461 tok)

## src/lib/

- `providers.tsx` — Providers — uses useState (~272 tok)
- `utils.ts` — Exports cn, formatCurrency, formatNumber, calcProfitMargin (~211 tok)

## src/lib/supabase/

- `client.ts` — Exports createClient (~62 tok)
- `server.ts` — Exports createClient (~176 tok)

## src/types/

- `index.ts` — Exports CustomUnit, PackagingType, Item, Purchase + 10 more (~793 tok)

## supabase/migrations/

- `001_initial_schema.sql` — Enable UUID extension (~1686 tok)
- `002_fix_record_purchase_generated_col.sql` — Fix: price_per_unit is a generated column, cannot be inserted explicitly. (~429 tok)
- `002_prev_avg_price.sql` — Add prev_avg_price to items (stores avg_price before last purchase update) (~468 tok)
- `003_update_purchase.sql` — Update an existing purchase: adjusts stock delta and recalculates weighted avg price. (~432 tok)
- `004_purchase_created_at.sql` — Allow record_purchase to accept optional transaction date (~347 tok)
- `005_delete_purchase.sql` — Delete a purchase: reduces stock and recalculates weighted avg price from remaining purchases. (~368 tok)
- `005_fix_price_per_unit_generated_col.sql` — Fix: migration 004 re-introduced generated column bug; record_purchase omits price_per_unit from INSERT. (~247 tok)
- `006_sub_recipe.sql` — Extends recipes (is_ingredient/unit/stock/avg_price), recipe_items (sub_recipe_id), creates productions table+RLS, RPCs: produce_sub_recipe + deduct_sub_recipe_stock (~1363 tok)
- `007_production_crud.sql` — RPCs: delete_production + update_production, both SECURITY DEFINER, reverse/adjust stock on recipes and items (~788 tok)
- `008_security_fix_rpc_auth.sql` — Security fix: adds auth.uid() guard to all 7 SECURITY DEFINER RPCs; creates user_profiles table with RLS + signup trigger (~3095 tok)
- `010_sale_addons.sql` — Sale Add-On: is_addon flag on items+recipes, sale_addons table, hpp_addons_at_sale on sales, RPCs: adjust_item_stock + restore_sub_recipe_stock (~623 tok)
- `011_sale_items.sql` — Migration 011: Multi-item sales (~839 tok)
- `016_fix_record_purchase_prev_avg_price.sql` — Root cause: there are two overloaded record_purchase functions. (~675 tok)

## supabase/seeds/

- `001_dummy_data.sql` — COSTIFY SEED DATA (~4328 tok)
