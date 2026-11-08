-- ═══════════════════════════════════════════════════════════════════════════
-- 029_staff_accounts.sql — fitur akun karyawan (staff) TataData-Dapur
-- Rollback: supabase/backup/2026-11-08_functions.sql + 2026-11-08_policies.sql
-- Dijalankan statement-per-statement oleh tools/run_mig.py (bukan psql).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. TENANT HELPER ─────────────────────────────────────────────────────
-- Tenant = pemilik data. Owner: dirinya sendiri. Staff: owner_id dari JWT
-- (diisi custom access token hook, bagian 9).
create or replace function public.tenant_uid()
returns uuid language sql stable as $$
  select coalesce(nullif(auth.jwt() ->> 'owner_id', '')::uuid, auth.uid())
$$;

-- ─── 2. ROLE staff ────────────────────────────────────────────────────────
do $$
begin
  if not exists (select from pg_roles where rolname = 'staff') then
    create role staff nologin noinherit;
  end if;
end $$;
grant staff to authenticator;
grant usage on schema public to staff;
revoke all on all tables in schema public from staff;
revoke all on all sequences in schema public from staff;

-- ─── 8. GATE FITUR UNTUK RPC ──────────────────────────────────────────────
create or replace function public.staff_feature_ok(p_feature text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_on boolean;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'staff' then
    return true;  -- owner: selalu boleh
  end if;
  select case p_feature
           when 'stok' then s.fitur_stok
           when 'produksi' then s.fitur_produksi
           when 'pembelian' then s.fitur_pembelian
           else false
         end
    into v_on
    from staff_settings s where s.owner_id = public.tenant_uid();
  return coalesce(v_on, false);
end $$;

-- ─── 3. TABEL STAFF ───────────────────────────────────────────────────────
create table if not exists public.staff_settings (
  owner_id        uuid primary key references auth.users(id) on delete cascade,
  fitur_stok      boolean not null default true,
  fitur_produksi  boolean not null default true,
  fitur_pembelian boolean not null default false,
  updated_at      timestamptz not null default now()
);

create table if not exists public.staff_accounts (
  id           uuid primary key default extensions.gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  user_id      uuid not null unique references auth.users(id) on delete cascade,
  username     text not null unique,
  display_name text not null,
  created_at   timestamptz not null default now()
);

alter table public.staff_settings enable row level security;
alter table public.staff_accounts enable row level security;

-- Owner kelola penuh
drop policy if exists owner_staff_settings on public.staff_settings;
create policy owner_staff_settings on public.staff_settings
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists owner_staff_accounts on public.staff_accounts;
create policy owner_staff_accounts on public.staff_accounts
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- Staff baca setelan + akunnya sendiri (untuk UI)
drop policy if exists staff_read_settings on public.staff_settings;
create policy staff_read_settings on public.staff_settings
  for select to staff using (owner_id = public.tenant_uid());
drop policy if exists staff_read_own_account on public.staff_accounts;
create policy staff_read_own_account on public.staff_accounts
  for select to staff using (user_id = auth.uid());

grant all on public.staff_settings, public.staff_accounts to authenticated;
grant select on public.staff_settings, public.staff_accounts to staff;

-- ─── 4. KOLOM created_by (siapa yang input: owner atau staff) ─────────────
alter table public.sales       add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.productions add column if not exists created_by uuid references auth.users(id) on delete set null;

-- ─── 5. HAPUS POLICY DUPLIKAT ─────────────────────────────────────────────
-- Tiap tabel punya 2 policy identik (OR) → hapus versi lama, sisakan users_own_*.
drop policy if exists user_items on public.items;
drop policy if exists user_purchases on public.purchases;
drop policy if exists user_recipes on public.recipes;
drop policy if exists user_recipe_items on public.recipe_items;
drop policy if exists user_sales on public.sales;
drop policy if exists own_expenses on public.expenses;
drop policy if exists own_expense_categories on public.expense_categories;
drop policy if exists own_sale_categories on public.sale_categories;
drop policy if exists own_profile on public.user_profiles;

-- ─── 6. POLICY staff (hanya SELECT; semua tulis lewat RPC security definer) ──
-- Catatan: kolom harga pokok (avg_price, hpp_*, prev_*) tidak pernah masuk
-- grant kolom di bagian 7, jadi tetap tak terbaca meski tabelnya terbuka.
drop policy if exists staff_read_items on public.items;
create policy staff_read_items on public.items
  for select to staff using (user_id = public.tenant_uid());
drop policy if exists staff_read_recipes on public.recipes;
create policy staff_read_recipes on public.recipes
  for select to staff using (user_id = public.tenant_uid());
drop policy if exists staff_read_recipe_items on public.recipe_items;
create policy staff_read_recipe_items on public.recipe_items
  for select to staff
  using (exists (select 1 from recipes r
                  where r.id = recipe_items.recipe_id and r.user_id = public.tenant_uid()));
drop policy if exists staff_read_sales on public.sales;
create policy staff_read_sales on public.sales
  for select to staff using (user_id = public.tenant_uid());
drop policy if exists staff_read_sale_items on public.sale_items;
create policy staff_read_sale_items on public.sale_items
  for select to staff using (user_id = public.tenant_uid());
drop policy if exists staff_read_sale_addons on public.sale_addons;
create policy staff_read_sale_addons on public.sale_addons
  for select to staff
  using (exists (select 1 from sale_items si
                  where si.id = sale_addons.sale_item_id and si.user_id = public.tenant_uid()));
drop policy if exists staff_read_sale_categories on public.sale_categories;
create policy staff_read_sale_categories on public.sale_categories
  for select to staff using (user_id = public.tenant_uid());
drop policy if exists staff_read_productions on public.productions;
create policy staff_read_productions on public.productions
  for select to staff
  using (user_id = public.tenant_uid() and public.staff_feature_ok('produksi'));
drop policy if exists staff_read_production_items on public.production_items;
create policy staff_read_production_items on public.production_items
  for select to staff
  using (user_id = public.tenant_uid() and public.staff_feature_ok('produksi'));
drop policy if exists staff_read_purchases on public.purchases;
create policy staff_read_purchases on public.purchases
  for select to staff
  using (user_id = public.tenant_uid() and public.staff_feature_ok('pembelian'));
drop policy if exists staff_read_packaging on public.packaging_types;
create policy staff_read_packaging on public.packaging_types
  for select to staff using (user_id = public.tenant_uid());
drop policy if exists staff_read_custom_units on public.custom_units;
create policy staff_read_custom_units on public.custom_units
  for select to staff using (user_id = public.tenant_uid());

-- ─── 7. GRANT KOLOM staff (harga pokok TIDAK diberikan) ───────────────────
grant select (id, user_id, name, unit, current_price, created_at, stock, is_addon, selling_price, avg_price_updated_at)
  on public.items to staff;
grant select (id, user_id, name, selling_price, created_at, is_ingredient, unit, stock, is_addon, batch_yield, waste_pct)
  on public.recipes to staff;
grant select (id, recipe_id, item_id, sub_recipe_id, quantity_used)
  on public.recipe_items to staff;
grant select (id, sale_id, user_id, recipe_id, quantity_sold, selling_price, created_at)
  on public.sale_items to staff;
grant select on public.sales, public.sale_addons, public.sale_categories to staff;
grant select on public.productions, public.production_items, public.purchases to staff;
grant select on public.packaging_types, public.custom_units to staff;

-- ─── 9. HITUNG HPP DI SERVER (menggantikan calcHPP client) ────────────────
-- Identik dengan calcHPP di useRecipes.ts: rekursif sub-resep, batch_yield, waste_pct.
create or replace function public.recipe_hpp(p_recipe_id uuid, p_owner uuid, p_depth int default 0)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare r recipes%rowtype; v_cost numeric := 0; ri record; v_sub numeric;
begin
  if p_depth > 10 then return 0; end if;
  select * into r from recipes where id = p_recipe_id and user_id = p_owner;
  if not found then return 0; end if;
  for ri in select * from recipe_items where recipe_id = p_recipe_id loop
    if ri.sub_recipe_id is not null then
      v_sub := public.recipe_hpp(ri.sub_recipe_id, p_owner, p_depth + 1);
      v_cost := v_cost + coalesce(v_sub, 0) * ri.quantity_used;
    elsif ri.item_id is not null then
      select coalesce(avg_price, 0) into v_sub from items where id = ri.item_id and user_id = p_owner;
      v_cost := v_cost + coalesce(v_sub, 0) * ri.quantity_used;
    end if;
  end loop;
  return v_cost / greatest(r.batch_yield * (1 - coalesce(r.waste_pct, 0) / 100), 0.001);
end $$;

-- ─── 10. RPC PENJUALAN (satu panggilan, atomik, HPP server) ───────────────
create or replace function public.record_sale(
  p_category_id uuid default null,
  p_created_at timestamptz default null,
  p_items jsonb default '[]'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid := public.tenant_uid();
  v_actor uuid := auth.uid();
  v_sale_id uuid;
  v_item jsonb;
  v_recipe recipes%rowtype;
  v_si_id uuid;
  v_qty numeric;
  v_hpp_unit numeric;
  v_addon_hpp numeric;
  a jsonb;
  v_stock numeric;
  v_short numeric;
begin
  if v_owner is null then raise exception 'Unauthorized'; end if;

  insert into sales (user_id, category_id, created_at, sold_at, created_by)
  values (v_owner, p_category_id, coalesce(p_created_at, now()), coalesce(p_created_at, now()), v_actor)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'quantity_sold')::numeric;
    select * into v_recipe from recipes
      where id = (v_item ->> 'recipe_id')::uuid and user_id = v_owner;
    if not found then raise exception 'Produk tidak ditemukan'; end if;

    v_hpp_unit := public.recipe_hpp(v_recipe.id, v_owner);

    -- stok kurang → produksi paksa dulu (perilaku lama client, p_force=true)
    select stock into v_stock from recipes where id = v_recipe.id and user_id = v_owner for update;
    v_short := v_qty - coalesce(v_stock, 0);
    if v_short > 0 then
      perform public.produce_recipe(v_owner, v_recipe.id, v_short,
        v_hpp_unit * v_short, coalesce(p_created_at, now()), true);
    end if;
    update recipes set stock = stock - v_qty where id = v_recipe.id and user_id = v_owner;

    insert into sale_items (sale_id, user_id, recipe_id, quantity_sold, selling_price,
                            hpp_at_sale, hpp_addons_at_sale, created_at)
    values (v_sale_id, v_owner, v_recipe.id, v_qty, (v_item ->> 'selling_price')::numeric,
            v_hpp_unit * v_qty, 0, coalesce(p_created_at, now()))
    returning id into v_si_id;

    v_addon_hpp := 0;
    for a in select * from jsonb_array_elements(coalesce(v_item -> 'addons', '[]'::jsonb)) loop
      declare
        v_ahpp numeric;
        v_aitem uuid := nullif(a ->> 'item_id', '')::uuid;
        v_asub uuid := nullif(a ->> 'sub_recipe_id', '')::uuid;
      begin
        if v_aitem is not null then
          select coalesce(avg_price, 0) into v_ahpp from items where id = v_aitem and user_id = v_owner;
          update items set stock = stock - (a ->> 'quantity')::numeric
            where id = v_aitem and user_id = v_owner;
        else
          v_ahpp := public.recipe_hpp(v_asub, v_owner);
          update recipes set stock = stock - (a ->> 'quantity')::numeric
            where id = v_asub and user_id = v_owner;
        end if;
        v_addon_hpp := v_addon_hpp + coalesce(v_ahpp, 0) * (a ->> 'quantity')::numeric;
        insert into sale_addons (sale_item_id, item_id, sub_recipe_id, quantity,
                                 price_per_unit_at_sale, name_at_sale)
        values (v_si_id, v_aitem, v_asub, (a ->> 'quantity')::numeric,
                (a ->> 'price_per_unit_at_sale')::numeric, a ->> 'name_at_sale');
      end;
    end loop;

    update sale_items set hpp_addons_at_sale = v_addon_hpp where id = v_si_id;
  end loop;

  return v_sale_id;
end $$;

create or replace function public.update_sale_record(
  p_sale_id uuid,
  p_category_id uuid default null,
  p_created_at timestamptz default null,
  p_items jsonb default '[]'::jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid := public.tenant_uid();
  v_old record;
  a record;
  v_si jsonb;
  v_stock numeric;
  v_sale_date timestamptz := coalesce(p_created_at, now());
begin
  if v_owner is null then raise exception 'Unauthorized'; end if;
  if not exists (select 1 from sales where id = p_sale_id and user_id = v_owner) then
    raise exception 'Penjualan tidak ditemukan';
  end if;

  -- kembalikan stok lama
  for v_old in select si.recipe_id, si.quantity_sold from sale_items si
               where si.sale_id = p_sale_id and si.user_id = v_owner loop
    update recipes set stock = stock + v_old.quantity_sold
      where id = v_old.recipe_id and user_id = v_owner;
    for a in select sa.item_id, sa.sub_recipe_id, sa.quantity
               from sale_addons sa join sale_items si2 on si2.id = sa.sale_item_id
              where si2.sale_id = p_sale_id and si2.recipe_id = v_old.recipe_id loop
      if a.item_id is not null then
        update items set stock = stock + a.quantity where id = a.item_id and user_id = v_owner;
      elsif a.sub_recipe_id is not null then
        update recipes set stock = stock + a.quantity where id = a.sub_recipe_id and user_id = v_owner;
      end if;
    end loop;
  end loop;

  delete from sale_items where sale_id = p_sale_id and user_id = v_owner;
  update sales set category_id = p_category_id, created_at = v_sale_date, sold_at = v_sale_date
    where id = p_sale_id and user_id = v_owner;

  -- sisip ulang (logika sama dengan record_sale)
  for v_si in select * from jsonb_array_elements(p_items) loop
    declare
      v_recipe recipes%rowtype;
      v_qty numeric := (v_si ->> 'quantity_sold')::numeric;
      v_hpp_unit numeric; v_si_id uuid; v_addon_hpp numeric; a2 jsonb;
    begin
      select * into v_recipe from recipes
        where id = (v_si ->> 'recipe_id')::uuid and user_id = v_owner;
      if not found then raise exception 'Produk tidak ditemukan'; end if;
      v_hpp_unit := public.recipe_hpp(v_recipe.id, v_owner);

      select stock into v_stock from recipes where id = v_recipe.id and user_id = v_owner for update;
      if v_qty - coalesce(v_stock, 0) > 0 then
        perform public.produce_recipe(v_owner, v_recipe.id, v_qty - coalesce(v_stock, 0),
          v_hpp_unit * (v_qty - coalesce(v_stock, 0)), v_sale_date, true);
      end if;
      update recipes set stock = stock - v_qty where id = v_recipe.id and user_id = v_owner;

      insert into sale_items (sale_id, user_id, recipe_id, quantity_sold, selling_price,
                              hpp_at_sale, hpp_addons_at_sale, created_at)
      values (p_sale_id, v_owner, v_recipe.id, v_qty, (v_si ->> 'selling_price')::numeric,
              v_hpp_unit * v_qty, 0, v_sale_date)
      returning id into v_si_id;

      v_addon_hpp := 0;
      for a2 in select * from jsonb_array_elements(coalesce(v_si -> 'addons', '[]'::jsonb)) loop
        declare
          v_ahpp numeric;
          v_aitem uuid := nullif(a2 ->> 'item_id', '')::uuid;
          v_asub uuid := nullif(a2 ->> 'sub_recipe_id', '')::uuid;
        begin
          if v_aitem is not null then
            select coalesce(avg_price, 0) into v_ahpp from items where id = v_aitem and user_id = v_owner;
            update items set stock = stock - (a2 ->> 'quantity')::numeric where id = v_aitem and user_id = v_owner;
          else
            v_ahpp := public.recipe_hpp(v_asub, v_owner);
            update recipes set stock = stock - (a2 ->> 'quantity')::numeric where id = v_asub and user_id = v_owner;
          end if;
          v_addon_hpp := v_addon_hpp + coalesce(v_ahpp, 0) * (a2 ->> 'quantity')::numeric;
          insert into sale_addons (sale_item_id, item_id, sub_recipe_id, quantity,
                                   price_per_unit_at_sale, name_at_sale)
          values (v_si_id, v_aitem, v_asub, (a2 ->> 'quantity')::numeric,
                  (a2 ->> 'price_per_unit_at_sale')::numeric, a2 ->> 'name_at_sale');
        end;
      end loop;
      update sale_items set hpp_addons_at_sale = v_addon_hpp where id = v_si_id;
    end;
  end loop;
end $$;

create or replace function public.delete_sale_record(p_sale_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid := public.tenant_uid();
  v_old record;
  a record;
begin
  if v_owner is null then raise exception 'Unauthorized'; end if;
  if not exists (select 1 from sales where id = p_sale_id and user_id = v_owner) then
    raise exception 'Penjualan tidak ditemukan';
  end if;

  for v_old in select si.recipe_id, si.quantity_sold from sale_items si
               where si.sale_id = p_sale_id and si.user_id = v_owner loop
    update recipes set stock = stock + v_old.quantity_sold
      where id = v_old.recipe_id and user_id = v_owner;
    for a in select sa.item_id, sa.sub_recipe_id, sa.quantity
               from sale_addons sa join sale_items si2 on si2.id = sa.sale_item_id
              where si2.sale_id = p_sale_id and si2.recipe_id = v_old.recipe_id loop
      if a.item_id is not null then
        update items set stock = stock + a.quantity where id = a.item_id and user_id = v_owner;
      elsif a.sub_recipe_id is not null then
        update recipes set stock = stock + a.quantity where id = a.sub_recipe_id and user_id = v_owner;
      end if;
    end loop;
  end loop;

  delete from sales where id = p_sale_id and user_id = v_owner;
end $$;

-- ─── 11. RPC LAMA: tenant + gate fitur ────────────────────────────────────
-- Ganti auth.uid() → tenant_uid() di semua cek, lalu sisip gate fitur staff.
do $$
declare
  r record; s text;
begin
  for r in
    select p.proname, pg_get_functiondef(p.oid) def
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('produce_recipe','produce_sub_recipe','update_production',
                         'delete_production','delete_purchase','record_purchase',
                         'update_purchase','adjust_item_stock',
                         'deduct_sub_recipe_stock','restore_sub_recipe_stock',
                         'restore_recipe_stock')
  loop
    s := r.def;
    s := replace(s, 'IS DISTINCT FROM auth.uid()', 'IS DISTINCT FROM public.tenant_uid()');
    if r.proname in ('record_purchase','update_purchase','delete_purchase') then
      s := replace(s, 'RAISE EXCEPTION ''Unauthorized'';',
        'RAISE EXCEPTION ''Unauthorized'';' || chr(10) ||
        '  IF NOT public.staff_feature_ok(''pembelian'') THEN' || chr(10) ||
        '    RAISE EXCEPTION ''Fitur pembelian tidak aktif'';' || chr(10) ||
        '  END IF;');
    elsif r.proname in ('produce_recipe','produce_sub_recipe','update_production','delete_production') then
      s := replace(s, 'RAISE EXCEPTION ''Unauthorized'';',
        'RAISE EXCEPTION ''Unauthorized'';' || chr(10) ||
        '  IF NOT public.staff_feature_ok(''produksi'') THEN' || chr(10) ||
        '    RAISE EXCEPTION ''Fitur produksi tidak aktif'';' || chr(10) ||
        '  END IF;');
    end if;
    if s <> r.def then execute s; end if;
  end loop;
end $$;

-- dedup: app hanya pakai record_purchase 9-arg & update_purchase 8-arg
drop function if exists public.record_purchase(uuid, uuid, numeric, numeric, numeric);
drop function if exists public.record_purchase(uuid, uuid, numeric, numeric, numeric, timestamptz);
drop function if exists public.update_purchase(uuid, uuid, numeric, numeric);

-- ─── 12. CUSTOM ACCESS TOKEN HOOK ─────────────────────────────────────────
-- supabase_auth_admin tidak bisa baca tabel ber-RLS → lookup via definer.
create or replace function public.staff_hook_lookup(p_uid uuid)
returns table (owner uuid, active boolean)
language sql stable security definer set search_path = public as $$
  select sa.owner_id,
         exists (select 1 from staff_settings s where s.owner_id = sa.owner_id)
    from staff_accounts sa
   where sa.user_id = p_uid
$$;
revoke all on function public.staff_hook_lookup(uuid) from public;
grant execute on function public.staff_hook_lookup(uuid) to supabase_auth_admin;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable as $$
declare
  claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  uid    uuid  := (event -> 'user' ->> 'id')::uuid;
  meta   jsonb := event -> 'user' -> 'app_metadata';
  rec    record;
begin
  if coalesce(meta ->> 'role', '') = 'staff' then
    select * into rec from public.staff_hook_lookup(uid);
    if rec is null or not rec.active then
      -- akun staff dihapus/dinonaktifkan → role tanpa hak apa pun
      claims := jsonb_set(claims, '{role}', '"anon"'::jsonb);
      return jsonb_set(event, '{claims}', claims);
    end if;
    claims := jsonb_set(claims, '{role}', '"staff"'::jsonb);
    claims := jsonb_set(claims, '{owner_id}', to_jsonb(rec.owner::text));
    return jsonb_set(event, '{claims}', claims);
  end if;
  return event;
end $$;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke all on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
