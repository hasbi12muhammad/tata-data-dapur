-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

create table public.items (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  unit         text not null check (unit in ('gr','ml','pcs','kg','liter')),
  avg_price    numeric(15,4) not null default 0,
  stock        numeric(15,4) not null default 0,
  created_at   timestamptz not null default now()
);

create table public.purchases (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  item_id        uuid not null references public.items(id) on delete restrict,
  quantity       numeric(15,4) not null check (quantity > 0),
  total_price    numeric(15,2) not null check (total_price >= 0),
  price_per_unit numeric(15,4) not null,
  created_at     timestamptz not null default now()
);

create table public.recipes (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create table public.recipe_items (
  id             uuid primary key default uuid_generate_v4(),
  recipe_id      uuid not null references public.recipes(id) on delete cascade,
  item_id        uuid not null references public.items(id) on delete restrict,
  quantity_used  numeric(15,4) not null check (quantity_used > 0),
  unique (recipe_id, item_id)
);

create table public.sales (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  recipe_id     uuid not null references public.recipes(id) on delete restrict,
  quantity_sold numeric(15,4) not null check (quantity_sold > 0),
  selling_price numeric(15,2) not null check (selling_price >= 0),
  hpp_at_sale   numeric(15,4) not null,
  profit        numeric(15,4) not null,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index on public.purchases (user_id, created_at desc);
create index on public.sales (user_id, created_at desc);
create index on public.recipe_items (recipe_id);
create index on public.recipe_items (item_id);

-- ============================================================
-- WEIGHTED AVERAGE PURCHASE FUNCTION
-- ============================================================

create or replace function public.record_purchase(
  p_user_id      uuid,
  p_item_id      uuid,
  p_quantity     numeric,
  p_total_price  numeric,
  p_price_per_unit numeric
) returns void
language plpgsql
security definer
as $$
declare
  v_current_stock     numeric;
  v_current_avg_price numeric;
  v_new_avg_price     numeric;
  v_new_stock         numeric;
begin
  select stock, avg_price
    into v_current_stock, v_current_avg_price
    from public.items
   where id = p_item_id and user_id = p_user_id;

  if not found then
    raise exception 'Item not found';
  end if;

  -- Weighted average: (old_stock * old_price + new_qty * new_price) / (old_stock + new_qty)
  v_new_stock := v_current_stock + p_quantity;
  if v_new_stock > 0 then
    v_new_avg_price := (v_current_stock * v_current_avg_price + p_quantity * p_price_per_unit) / v_new_stock;
  else
    v_new_avg_price := p_price_per_unit;
  end if;

  -- Update item avg_price and stock
  update public.items
     set avg_price = v_new_avg_price,
         stock     = v_new_stock
   where id = p_item_id and user_id = p_user_id;

  -- Insert purchase record
  insert into public.purchases (user_id, item_id, quantity, total_price, price_per_unit)
  values (p_user_id, p_item_id, p_quantity, p_total_price, p_price_per_unit);
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.items        enable row level security;
alter table public.purchases    enable row level security;
alter table public.recipes      enable row level security;
alter table public.recipe_items enable row level security;
alter table public.sales        enable row level security;

-- items
create policy "users_own_items"
  on public.items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- purchases
create policy "users_own_purchases"
  on public.purchases for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- recipes
create policy "users_own_recipes"
  on public.recipes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- recipe_items: access via parent recipe ownership
create policy "users_own_recipe_items"
  on public.recipe_items for all
  using (
    exists (
      select 1 from public.recipes r
       where r.id = recipe_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.recipes r
       where r.id = recipe_id and r.user_id = auth.uid()
    )
  );

-- sales
create policy "users_own_sales"
  on public.sales for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
