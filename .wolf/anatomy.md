# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-04-24T03:21:51.535Z
> Files: 62 tracked | Anatomy hits: 0 | Misses: 0

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

- `manifest.json` (~183 tok)
- `sw.js` — Declares CACHE (~338 tok)

## src/

- `middleware.ts` — Exports middleware, config (~831 tok)

## src/app/

- `globals.css` — Styles: 3 rules, 12 vars, 1 media queries (~330 tok)
- `layout.tsx` — metadata (~244 tok)
- `page.tsx` — Redirected by middleware to /dashboard or /login (~30 tok)

## src/app/dashboard/

- `page.tsx` — dynamic — uses useState (~3896 tok)

## src/app/expenses/

- `page.tsx` — dynamic — renders table — uses useState, useMemo (~4980 tok)

## src/app/items/

- `page.tsx` — dynamic — renders form, table, modal — uses useState, useMemo (~3815 tok)

## src/app/login/

- `page.tsx` — dynamic — renders form — uses useState (~771 tok)

## src/app/offline/

- `page.tsx` — dynamic (~309 tok)

## src/app/purchases/

- `page.tsx` — dynamic — renders table (~5048 tok)

## src/app/recipes/

- `page.tsx` — dynamic — renders form, modal — uses useState (~4125 tok)

## src/app/reports/

- `page.tsx` — dynamic (~14880 tok)

## src/app/sales/

- `page.tsx` — dynamic — renders table (~5656 tok)

## src/app/settings/

- `page.tsx` — dynamic — renders form — uses useRouter, useSearchParams, useEffect, useState (~1508 tok)

## src/app/unauthorized/

- `page.tsx` — UnauthorizedPage (~428 tok)

## src/components/

- `ServiceWorkerRegister.tsx` — ServiceWorkerRegister — uses useEffect (~72 tok)

## src/components/layout/

- `AppLayout.tsx` — AppLayout — uses useState (~477 tok)
- `Sidebar.tsx` — ALL_NAV — renders chart (~1083 tok)

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
- `useDailyData.ts` — Exports useSalesByDate, usePurchasesByDate (~396 tok)
- `useExpenses.ts` — Exports useExpenses, useExpensesByDate, useExpenseCategories, useReportExpenses + 4 more (~1368 tok)
- `useItems.ts` — Exports useItems, useCreateItem, useUpdateItem, useDeleteItem (~658 tok)
- `usePurchases.ts` — Exports usePurchases, useUpdatePurchase, useCreatePurchase (~731 tok)
- `useRecipes.ts` — Exports useRecipes, useCreateRecipe, useUpdateRecipe, useDeleteRecipe (~986 tok)
- `useSales.ts` — All sales (no limit) for reports — includes created_at for date filtering (~1196 tok)

## src/lib/

- `providers.tsx` — Providers — uses useState (~272 tok)
- `utils.ts` — Exports cn, formatCurrency, formatNumber, calcProfitMargin (~211 tok)

## src/lib/supabase/

- `client.ts` — Exports createClient (~62 tok)
- `server.ts` — Exports createClient (~176 tok)

## src/types/

- `index.ts` — Exports Item, Purchase, Recipe, RecipeItem + 5 more (~447 tok)

## supabase/migrations/

- `001_initial_schema.sql` — Enable UUID extension (~1686 tok)
- `002_fix_record_purchase_generated_col.sql` — Fix: price_per_unit is a generated column, cannot be inserted explicitly. (~429 tok)
- `002_prev_avg_price.sql` — Add prev_avg_price to items (stores avg_price before last purchase update) (~468 tok)
- `003_update_purchase.sql` — Update an existing purchase: adjusts stock delta and recalculates weighted avg price. (~432 tok)
- `004_purchase_created_at.sql` — Allow record_purchase to accept optional transaction date (~347 tok)
- `005_delete_purchase.sql` — Delete a purchase: reduces stock and recalculates weighted avg price from remaining purchases. (~368 tok)

## supabase/seeds/

- `001_dummy_data.sql` — COSTIFY SEED DATA (~4328 tok)
