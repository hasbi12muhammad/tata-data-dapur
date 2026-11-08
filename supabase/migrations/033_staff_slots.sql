-- 033: kuota slot karyawan. Owner boleh ubah toggle, TIDAK boleh ubah staff_slots (hanya webhook/service_role).
alter table public.staff_settings add column if not exists staff_slots int not null default 1 check (staff_slots >= 0);

revoke insert, update on public.staff_settings from authenticated, anon;
grant insert (owner_id, fitur_stok, fitur_produksi, fitur_pembelian, updated_at) on public.staff_settings to authenticated;
grant update (owner_id, fitur_stok, fitur_produksi, fitur_pembelian, updated_at) on public.staff_settings to authenticated;

-- akun karyawan dibuat/dihapus lewat API server (service_role), owner cuma baca & ganti nama tampilan
revoke insert, update, delete on public.staff_accounts from authenticated, anon;
grant update (display_name) on public.staff_accounts to authenticated;

select has_column_privilege('authenticated', 'public.staff_settings', 'staff_slots', 'UPDATE') as owner_ubah_slot,
       has_column_privilege('authenticated', 'public.staff_settings', 'fitur_pembelian', 'UPDATE') as owner_ubah_toggle,
       has_table_privilege('authenticated', 'public.staff_accounts', 'INSERT') as owner_insert_akun;
