-- AdriaGo initial schema
-- Run this in Supabase SQL Editor.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('user', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'user_type') then
    create type user_type as enum ('private', 'company');
  end if;
  if not exists (select 1 from pg_type where typname = 'device_category') then
    create type device_category as enum ('ia', 'i', 'ii', 'iii', 'iv');
  end if;
  if not exists (select 1 from pg_type where typname = 'device_status') then
    create type device_status as enum ('available', 'assigned', 'sold', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type order_status as enum ('pending', 'paid', 'shipped', 'archived', 'cancelled');
  end if;
end $$;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  role user_role not null default 'user',
  type user_type not null default 'private',
  email text not null unique,
  password_hash text not null,
  name text not null,
  phone text,
  billing_address text,
  shipping_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  identifier text not null unique,
  category device_category not null,
  status device_status not null default 'available',
  assigned_at timestamptz,
  sold_at timestamptz,
  user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  status order_status not null default 'pending',
  total_amount numeric(12,2) not null,
  currency text not null default 'HUF',
  user_id uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_user_created
  on orders(user_id, created_at);

create table if not exists destinations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price_ia numeric(10,2) not null,
  price_i numeric(10,2) not null,
  price_ii numeric(10,2) not null,
  price_iii numeric(10,2) not null,
  price_iv numeric(10,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists route_records (
  id uuid primary key default gen_random_uuid(),
  relation_label text not null,
  gate_path text not null,
  executed_at timestamptz not null,
  entry_at timestamptz,
  exit_at timestamptz,
  device_number_raw text not null,
  license_plate text,
  amount numeric(10,2) not null,
  currency text not null,
  source_file_name text,
  source_line_number integer,
  dedupe_key text not null unique,
  device_id uuid references devices(id) on delete set null,
  imported_at timestamptz not null default now()
);

create index if not exists idx_route_records_device_number_raw
  on route_records(device_number_raw);
create index if not exists idx_route_records_executed_at
  on route_records(executed_at);

create table if not exists settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
