-- Referral system (invite link + one-time device discount)
-- Run this after: init.sql, stripe.sql, device_orders.sql, phase2_full_spec.sql

create table if not exists referral_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_auth_user_id text not null,
  inviter_email text,
  invited_email text not null,
  invited_auth_user_id text,
  token text not null unique,
  status text not null default 'sent', -- sent | accepted | discounted
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  discount_used_at timestamptz
);

create index if not exists idx_referral_invites_inviter
  on referral_invites(inviter_auth_user_id, created_at desc);

create index if not exists idx_referral_invites_invited_auth
  on referral_invites(invited_auth_user_id);

insert into settings (key, value, updated_at) values
  ('referral_device_discount_huf', '25000', now())
on conflict (key) do nothing;

