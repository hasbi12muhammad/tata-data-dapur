-- 039: ambang stok minimum per bahan. NULL = tidak dipantau (jangan default 0).
alter table public.items add column if not exists min_stock numeric
  check (min_stock is null or min_stock >= 0);
grant select (min_stock) on public.items to staff;
