-- Stripe topup transaction table
-- Run this in Supabase SQL Editor after init.sql

create table if not exists stripe_topups (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text not null unique,
  stripe_payment_intent_id text,
  user_id text,
  user_email text,
  device_identifier text,
  amount_huf integer not null,
  currency text not null default 'HUF',
  status text not null,
  paid_at timestamptz,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_stripe_topups_user_email
  on stripe_topups(user_email);

create table if not exists device_wallets (
  id uuid primary key default gen_random_uuid(),
  device_identifier text not null unique,
  balance_huf integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  device_identifier text not null,
  amount_huf integer not null,
  transaction_type text not null,
  stripe_session_id text not null unique,
  user_email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_wallet_transactions_device_identifier
  on wallet_transactions(device_identifier, created_at desc);

create or replace function apply_topup(
  p_device_identifier text,
  p_amount_huf integer,
  p_stripe_session_id text,
  p_user_email text
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_inserted_count integer;
begin
  if p_device_identifier is null or btrim(p_device_identifier) = '' then
    return false;
  end if;

  insert into wallet_transactions (
    device_identifier,
    amount_huf,
    transaction_type,
    stripe_session_id,
    user_email
  )
  values (
    p_device_identifier,
    p_amount_huf,
    'topup',
    p_stripe_session_id,
    p_user_email
  )
  on conflict (stripe_session_id) do nothing;

  get diagnostics v_inserted_count = row_count;
  if v_inserted_count = 0 then
    -- session mar feldolgozva volt
    return false;
  end if;

  insert into device_wallets (device_identifier, balance_huf, updated_at)
  values (p_device_identifier, p_amount_huf, now())
  on conflict (device_identifier)
  do update
    set balance_huf = device_wallets.balance_huf + excluded.balance_huf,
        updated_at = now();

  return true;
end;
$$;
