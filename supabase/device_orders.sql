-- ENC eszkoz vasarlas / varolista (futtasd a Supabase SQL Editorban init.sql + stripe.sql utan)

alter table devices
  add column if not exists auth_user_id text;

create index if not exists idx_devices_auth_user_id on devices(auth_user_id);

create table if not exists device_waitlist (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  user_email text,
  category device_category not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_device_waitlist_created
  on device_waitlist(created_at desc);

create table if not exists enc_device_orders (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text not null unique,
  auth_user_id text not null,
  user_email text,
  device_id uuid references devices(id) on delete set null,
  device_identifier text,
  category device_category not null,
  amount_huf integer not null,
  status text not null default 'paid',
  assignment_ok boolean not null default true,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists idx_enc_device_orders_auth_user
  on enc_device_orders(auth_user_id, created_at desc);

create table if not exists contract_acceptances (
  id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  user_email text,
  category device_category not null,
  contract_version text not null default 'v1',
  context text not null default 'device_order',
  accepted_at timestamptz not null default now()
);

create index if not exists idx_contract_acceptances_user_time
  on contract_acceptances(auth_user_id, accepted_at desc);

create table if not exists admin_device_assignments (
  id uuid primary key default gen_random_uuid(),
  admin_auth_user_id text not null,
  admin_email text,
  target_auth_user_id text not null,
  target_user_email text,
  device_id uuid references devices(id) on delete set null,
  device_identifier text,
  category device_category not null,
  source_waitlist_id uuid,
  assigned_at timestamptz not null default now()
);

create index if not exists idx_admin_device_assignments_assigned_at
  on admin_device_assignments(assigned_at desc);
