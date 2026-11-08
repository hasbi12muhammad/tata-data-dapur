-- 035: beli slot karyawan. Order slot pakai tabel orders (prefix TDS-), supabase_user_id = owner pembeli.
-- Satu transaksi + idempoten: status order jadi 'slot_added' sekali saja, slot +1 sekali saja.
create or replace function public.grant_staff_slot(p_order_id text) returns int
language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_slots int;
begin
  update orders set status = 'slot_added', paid_at = coalesce(paid_at, now()), account_created_at = now()
   where order_id = p_order_id and order_id like 'TDS-%' and status in ('pending', 'paid')
   returning supabase_user_id into v_owner;
  if v_owner is null then
    return null; -- sudah diproses / bukan order slot
  end if;
  insert into staff_settings (owner_id, staff_slots) values (v_owner, 2)
  on conflict (owner_id) do update set staff_slots = staff_settings.staff_slots + 1, updated_at = now()
  returning staff_slots into v_slots;
  return v_slots;
end $$;

revoke all on function public.grant_staff_slot(text) from public, anon, authenticated, staff;
grant execute on function public.grant_staff_slot(text) to service_role;

select has_function_privilege('authenticated', 'public.grant_staff_slot(text)', 'EXECUTE') as user_bisa,
       has_function_privilege('service_role', 'public.grant_staff_slot(text)', 'EXECUTE') as server_bisa;
