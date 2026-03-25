-- Enable RLS + minimal policies for user-owned data
-- Run AFTER init.sql, device_orders.sql, stripe.sql, phase2_full_spec.sql
--
-- Safety note:
-- - The app's server endpoints mostly use SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
-- - This script is primarily to protect against direct client/anon access.

-- -----------------------------
-- devices (user owns by auth_user_id)
-- -----------------------------
alter table public.devices enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'devices'
      and policyname = 'devices_select_own'
  ) then
    create policy devices_select_own
      on public.devices
      for select
      using (auth_user_id = auth.uid()::text);
  end if;
end $$;

-- -----------------------------
-- profiles (user owns by auth_user_id)
-- -----------------------------
alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_select_own'
  ) then
    create policy profiles_select_own
      on public.profiles
      for select
      using (auth_user_id = auth.uid()::text);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_update_own'
  ) then
    create policy profiles_update_own
      on public.profiles
      for update
      using (auth_user_id = auth.uid()::text)
      with check (auth_user_id = auth.uid()::text);
  end if;
end $$;

-- -----------------------------
-- enc_device_orders (user owns by auth_user_id)
-- -----------------------------
alter table public.enc_device_orders enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'enc_device_orders'
      and policyname = 'enc_device_orders_select_own'
  ) then
    create policy enc_device_orders_select_own
      on public.enc_device_orders
      for select
      using (auth_user_id = auth.uid()::text);
  end if;
end $$;

-- -----------------------------
-- route_records (user owns by device_number_raw -> devices.identifier)
-- -----------------------------
alter table public.route_records enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'route_records'
      and policyname = 'route_records_select_own'
  ) then
    create policy route_records_select_own
      on public.route_records
      for select
      using (
        exists (
          select 1
          from public.devices d
          where d.identifier = route_records.device_number_raw
            and d.auth_user_id = auth.uid()::text
        )
      );
  end if;
end $$;

-- -----------------------------
-- device_wallets (user owns by device_identifier -> devices.identifier)
-- -----------------------------
alter table public.device_wallets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'device_wallets'
      and policyname = 'device_wallets_select_own'
  ) then
    create policy device_wallets_select_own
      on public.device_wallets
      for select
      using (
        exists (
          select 1
          from public.devices d
          where d.identifier = device_wallets.device_identifier
            and d.auth_user_id = auth.uid()::text
        )
      );
  end if;
end $$;

-- -----------------------------
-- wallet_transactions (user owns by device_identifier -> devices.identifier)
-- -----------------------------
alter table public.wallet_transactions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'wallet_transactions'
      and policyname = 'wallet_transactions_select_own'
  ) then
    create policy wallet_transactions_select_own
      on public.wallet_transactions
      for select
      using (
        exists (
          select 1
          from public.devices d
          where d.identifier = wallet_transactions.device_identifier
            and d.auth_user_id = auth.uid()::text
        )
      );
  end if;
end $$;

-- -----------------------------
-- stripe_topups (user owns by user_id)
-- -----------------------------
alter table public.stripe_topups enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'stripe_topups'
      and policyname = 'stripe_topups_select_own'
  ) then
    create policy stripe_topups_select_own
      on public.stripe_topups
      for select
      using (user_id = auth.uid()::text);
  end if;
end $$;

-- -----------------------------
-- device_waitlist (user owns by auth_user_id)
-- -----------------------------
alter table public.device_waitlist enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'device_waitlist'
      and policyname = 'device_waitlist_select_own'
  ) then
    create policy device_waitlist_select_own
      on public.device_waitlist
      for select
      using (auth_user_id = auth.uid()::text);
  end if;
end $$;

-- -----------------------------
-- contract_acceptances (user owns by auth_user_id)
-- -----------------------------
alter table public.contract_acceptances enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'contract_acceptances'
      and policyname = 'contract_acceptances_select_own'
  ) then
    create policy contract_acceptances_select_own
      on public.contract_acceptances
      for select
      using (auth_user_id = auth.uid()::text);
  end if;
end $$;

