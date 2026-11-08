-- 036: customer lama mulai 0 slot (beli 50rb); paket 300rb dapat 1 slot dari webhook.
-- Slot: default 0 (customer lama beli 50rb). Paket 300rb dapat 1 slot dari webhook.
alter table public.staff_settings alter column staff_slots set default 0;

create or replace function public.grant_staff_slot(p_order_id text) returns int
language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_slots int;
begin
  update orders set status = 'slot_added', paid_at = coalesce(paid_at, now()), account_created_at = now()
   where order_id = p_order_id and order_id like 'TDS-%' and status in ('pending', 'paid')
   returning supabase_user_id into v_owner;
  if v_owner is null then
    return null;
  end if;
  insert into staff_settings (owner_id, staff_slots) values (v_owner, 1)
  on conflict (owner_id) do update set staff_slots = staff_settings.staff_slots + 1, updated_at = now()
  returning staff_slots into v_slots;
  return v_slots;
end $$;

select column_default as default_slot from information_schema.columns where table_name='staff_settings' and column_name='staff_slots';
