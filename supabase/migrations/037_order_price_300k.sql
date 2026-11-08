-- 037: harga 300rb ditegakkan DB. Terapkan SETELAH landing 300rb live (landing lama 175rb akan ditolak).
-- Landing insert order pakai anon: hanya boleh order baru harga resmi, tanpa field server.
drop policy if exists anon_insert_orders on public.orders;
create policy anon_insert_orders on public.orders for insert to anon
  with check (amount = 300000 and status = 'pending' and order_id like 'TDD-%'
              and supabase_user_id is null and generated_password is null and paid_at is null and account_created_at is null);

select pg_get_expr(polwithcheck, polrelid) as cek from pg_policy where polname = 'anon_insert_orders';
