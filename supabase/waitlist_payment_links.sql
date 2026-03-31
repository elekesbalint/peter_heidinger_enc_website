-- Várólistás kiosztás fizetési linkkel (48 órás rezerváció)
-- Futtasd a Supabase SQL Editorban a korábbi SQL fájlok után.

create table if not exists device_payment_reservations (
  id uuid primary key default gen_random_uuid(),
  source_waitlist_id uuid,
  auth_user_id text not null,
  user_email text,
  category device_category not null,
  device_id uuid references devices(id) on delete set null,
  device_identifier text,
  stripe_session_id text not null unique,
  stripe_checkout_url text,
  amount_huf integer not null,
  expires_at timestamptz not null,
  created_by_admin_auth_user_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  cancelled_at timestamptz
);

create index if not exists idx_device_payment_reservations_expires
  on device_payment_reservations(expires_at)
  where paid_at is null and cancelled_at is null;

create index if not exists idx_device_payment_reservations_auth_user
  on device_payment_reservations(auth_user_id, created_at desc);
