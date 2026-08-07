-- ============================================================
-- 028 — RLS for tables that were created outside the migration
-- history (dashboard-made): expenses, expense_categories,
-- sale_categories.
--
-- Every read/write to these tables from the app goes through the
-- PUBLIC anon key with no user_id filter in the query
-- (src/hooks/useExpenses.ts, src/hooks/useSales.ts) — RLS is the
-- ONLY thing separating one user's rows from another's. Their RLS
-- state was never asserted anywhere in the repo, so assert it here.
--
-- Safe to run whether or not RLS is already on: enabling twice is a
-- no-op and the policies are dropped before being recreated.
-- ============================================================

alter table public.expenses           enable row level security;
alter table public.expense_categories enable row level security;
alter table public.sale_categories    enable row level security;

-- Drop existing policies first (idempotent)
drop policy if exists "users_own_expenses"           on public.expenses;
drop policy if exists "users_own_expense_categories" on public.expense_categories;
drop policy if exists "users_own_sale_categories"    on public.sale_categories;

create policy "users_own_expenses"
  on public.expenses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users_own_expense_categories"
  on public.expense_categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users_own_sale_categories"
  on public.sale_categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
