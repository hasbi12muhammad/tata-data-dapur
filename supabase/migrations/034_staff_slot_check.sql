-- 034: kuota slot ditegakkan DB (aman dari race / bypass API). Kunci baris settings owner agar insert paralel antre.
create or replace function public.staff_slot_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_slots int;
begin
  select staff_slots into v_slots from staff_settings where owner_id = new.owner_id for update;
  if (select count(*) from staff_accounts where owner_id = new.owner_id) >= coalesce(v_slots, 0) then
    raise exception 'Slot karyawan penuh (%)', coalesce(v_slots, 0);
  end if;
  return new;
end $$;

drop trigger if exists staff_slot_check on public.staff_accounts;
create trigger staff_slot_check before insert on public.staff_accounts
  for each row execute function public.staff_slot_check();

select count(*) as trigger_ada from pg_trigger where tgname = 'staff_slot_check';
