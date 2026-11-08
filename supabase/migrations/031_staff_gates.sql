-- 031: perbaikan gate staff (idempotent)
-- 1) 029 menaruh cek staff_feature_ok DI DALAM blok IF Unauthorized, jadi tak pernah jalan.
-- 2) HPP bocor via productions.total_cost & harga purchases. Kolom itu ditutup untuk staff.
-- 3) Biaya produksi oleh staff dihitung server (recipe_hpp), input klien diabaikan.
-- 4) tenant_uid: GUC kosong tidak lagi error cast.

create or replace function public.tenant_uid() returns uuid language sql stable as $$
  select coalesce(c ->> 'owner_id', c ->> 'sub')::uuid
  from (select nullif(current_setting('request.jwt.claims', true), '')::jsonb c) x
$$;

create or replace function public.is_staff() returns boolean language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'staff'
$$;

do $$
declare f regprocedure; d text; n text;
begin
  -- (1) pindahkan gate keluar dari blok Unauthorized
  for f in select p.oid::regprocedure from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('produce_recipe','produce_sub_recipe','update_production','delete_production',
                               'record_purchase','update_purchase','delete_purchase')
  loop
    d := pg_get_functiondef(f);
    n := regexp_replace(d,
      $r$(RAISE EXCEPTION 'Unauthorized';)(\s*IF NOT public\.staff_feature_ok\('\w+'\) THEN\s*RAISE EXCEPTION '[^']*';\s*END IF;)(\s*END IF;)$r$,
      '\1\3\2');
    if n <> d then execute n; end if;
  end loop;

  -- (3) biaya produksi staff = HPP server
  for f in select p.oid::regprocedure from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.proname in ('produce_recipe','produce_sub_recipe')
  loop
    d := pg_get_functiondef(f);
    if strpos(d, 'is_staff()') = 0 then
      n := regexp_replace(d, $r$(RAISE EXCEPTION 'Fitur produksi tidak aktif';\s*END IF;)$r$,
        E'\\1\n  IF public.is_staff() THEN p_total_cost := public.recipe_hpp(p_recipe_id, p_user_id) * p_batches; END IF;');
      execute n;
    end if;
  end loop;
  d := pg_get_functiondef('public.update_production(uuid,uuid,numeric,numeric)'::regprocedure);
  if strpos(d, 'is_staff()') = 0 then
    execute regexp_replace(d, $r$(RAISE EXCEPTION 'Production not found';\s*END IF;)$r$,
      E'\\1\n  IF public.is_staff() THEN p_total_cost := public.recipe_hpp(v_recipe_id, p_user_id) * p_batches; END IF;');
  end if;

  -- gate stok untuk penyesuaian stok manual
  d := pg_get_functiondef('public.adjust_item_stock(uuid,uuid,numeric)'::regprocedure);
  if strpos(d, 'staff_feature_ok') = 0 then
    execute regexp_replace(d, $r$(RAISE EXCEPTION 'Unauthorized';\s*END IF;)$r$,
      E'\\1\n  IF NOT public.staff_feature_ok(''stok'') THEN RAISE EXCEPTION ''Fitur stok tidak aktif''; END IF;');
  end if;
end $$;

-- (2) tutup kolom harga untuk staff
revoke select on public.productions, public.purchases from staff;
grant select (id, user_id, recipe_id, batches, created_at, created_by) on public.productions to staff;
grant select (id, user_id, item_id, quantity, purchased_at, created_at, pkg_type_id, pkg_qty, size_per_pkg, transaction_id)
  on public.purchases to staff;

-- verifikasi: 0 gate salah tempat, 3 fungsi produksi pakai is_staff, adjust ter-gate
-- (tanpa $r$: tools/run_mig.py hanya paham $$ saat memecah statement)
-- hasil prod 2026-11-08: 0 | is_staff,produce_recipe,produce_sub_recipe,update_production | 8 | f | f
select
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
     and pg_get_functiondef(oid) ~ 'Unauthorized.;\s*IF NOT public.staff_feature_ok') as gate_salah,
  (select string_agg(proname, ',') from pg_proc where pronamespace = 'public'::regnamespace
     and strpos(pg_get_functiondef(oid), 'is_staff()') > 0) as cost_server,
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
     and strpos(pg_get_functiondef(oid), 'staff_feature_ok(') > 0 and proname <> 'staff_feature_ok') as gated,
  has_column_privilege('staff', 'public.productions', 'total_cost', 'SELECT') as staff_lihat_cost,
  has_column_privilege('staff', 'public.purchases', 'total_price', 'SELECT') as staff_lihat_harga;
