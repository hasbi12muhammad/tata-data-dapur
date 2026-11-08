-- 030: perbaikan pasca-029 (applied prod 2026-11-08 lewat fix2/fix3 + hook)
-- 1) hook: path event benar. 2) tenant_uid tanpa schema auth (staff tak punya USAGE auth).
-- 3) policy users_own_* hanya authenticated, supaya staff tidak evaluasi auth.uid().

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable as $$
declare
  claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  uid uuid := coalesce(nullif(event ->> 'user_id', ''), claims ->> 'sub')::uuid;
  meta jsonb := coalesce(event -> 'metadata' -> 'app_metadata', claims -> 'app_metadata', '{}'::jsonb);
  rec record;
begin
  -- event hook Supabase: {claims, user_id, metadata, authentication_method}; tidak ada key 'user'
  if coalesce(meta ->> 'role', '') = 'staff' then
    select * into rec from public.staff_hook_lookup(uid);
    if rec is null or not rec.active then
      claims := jsonb_set(claims, '{role}', '"anon"'::jsonb);
      return jsonb_set(event, '{claims}', claims);
    end if;
    claims := jsonb_set(claims, '{role}', '"staff"'::jsonb);
    claims := jsonb_set(claims, '{owner_id}', to_jsonb(rec.owner::text));
  end if;
  return jsonb_set(event, '{claims}', claims);
end $$;

create or replace function public.tenant_uid()
returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'owner_id',
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
  )::uuid
$$;

drop policy if exists staff_read_own_account on public.staff_accounts;
create policy staff_read_own_account on public.staff_accounts
  for select to staff
  using (user_id = (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid);


alter policy users_own_custom_units on public.custom_units to authenticated;
alter policy users_own_expense_categories on public.expense_categories to authenticated;
alter policy users_own_expenses on public.expenses to authenticated;
alter policy users_own_items on public.items to authenticated;
alter policy users_own_packaging_types on public.packaging_types to authenticated;
alter policy users_own_production_items on public.production_items to authenticated;
alter policy users_own_productions on public.productions to authenticated;
alter policy users_own_purchases on public.purchases to authenticated;
alter policy users_own_recipe_items on public.recipe_items to authenticated;
alter policy users_own_recipes on public.recipes to authenticated;
alter policy users_own_sale_addons on public.sale_addons to authenticated;
alter policy users_own_sale_categories on public.sale_categories to authenticated;
alter policy users_own_sale_items on public.sale_items to authenticated;
alter policy users_own_sales on public.sales to authenticated;
alter policy users_own_profile on public.user_profiles to authenticated;
