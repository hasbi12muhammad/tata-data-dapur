-- orders table: tracks purchases from landing page via Pakasir payment gateway
create table public.orders (
  id                  uuid primary key default uuid_generate_v4(),
  order_id            text unique not null,
  full_name           text not null,
  whatsapp            text not null,
  email_notif         text not null,
  email_login         text not null,
  amount              integer not null,
  status              text not null default 'pending',
  pakasir_data        jsonb,
  generated_password  text,
  supabase_user_id    uuid,
  created_at          timestamptz default now(),
  paid_at             timestamptz,
  account_created_at  timestamptz
);

alter table public.orders enable row level security;

-- anon: INSERT only (landing page form creates order before redirect to Pakasir)
create policy "anon_insert_orders"
  on public.orders for insert
  to anon
  with check (true);

-- service role bypasses RLS (used by webhook + admin)
