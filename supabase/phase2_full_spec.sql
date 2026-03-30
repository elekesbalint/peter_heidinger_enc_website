-- Fazis 2: teljes spechez kiegeszitesek (futtasd Supabase SQL Editorban device_orders.sql utan)

-- --- Eszkoz: rendszam (vasarlaskor)
alter table devices
  add column if not exists license_plate text;

-- --- Felhasznalo profil (Supabase Auth user id = text)
create table if not exists profiles (
  auth_user_id text primary key,
  user_type text not null default 'private' check (user_type in ('private', 'company')),
  name text,
  phone text,
  billing_address text,
  shipping_address text,
  updated_at timestamptz not null default now()
);

-- --- ENC rendelesek bovites (admin: archiv, kuldes)
alter table enc_device_orders
  add column if not exists archived_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists shipped_at timestamptz,
  add column if not exists tracking_number text,
  add column if not exists mpl_payload jsonb;

create index if not exists idx_enc_device_orders_active
  on enc_device_orders(created_at desc)
  where archived_at is null and cancelled_at is null;

-- --- Kapcsolatfelvetel
create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

-- --- Alapertelmezett beallitasok (admin felulirhatja)
insert into settings (key, value, updated_at) values
  ('min_balance_warning_huf', '5000', now()),
  ('topup_discount_percent', '0', now()),
  ('fx_eur_to_huf', '400', now()),
  ('topup_package_1_huf', '40', now()),
  ('topup_package_2_huf', '60', now()),
  ('topup_package_3_huf', '100', now()),
  ('topup_block_smallest_for_categories', 'ii,iii,iv', now()),
  ('referral_device_discount_huf', '25000', now())
on conflict (key) do nothing;

-- Feltoltes: uticel (Stripe webhook metadata)
alter table stripe_topups
  add column if not exists travel_destination text;

-- --- Utvonal alapu wallet levonas (dedupe: stripe_session_id = 'route:' || dedupe_key)
create or replace function apply_route_debit(
  p_dedupe_key text,
  p_device_identifier text,
  p_amount_huf integer
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_ref text;
  v_inserted integer;
begin
  if p_dedupe_key is null or btrim(p_dedupe_key) = '' then
    return false;
  end if;
  if p_device_identifier is null or btrim(p_device_identifier) = '' then
    return false;
  end if;
  if p_amount_huf is null or p_amount_huf <= 0 then
    return false;
  end if;

  v_ref := 'route:' || p_dedupe_key;

  insert into wallet_transactions (
    device_identifier,
    amount_huf,
    transaction_type,
    stripe_session_id,
    user_email
  )
  values (
    p_device_identifier,
    -p_amount_huf,
    'route_pass',
    v_ref,
    null
  )
  on conflict (stripe_session_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return false;
  end if;

  insert into device_wallets (device_identifier, balance_huf, updated_at)
  values (p_device_identifier, -p_amount_huf, now())
  on conflict (device_identifier)
  do update
    set balance_huf = device_wallets.balance_huf - p_amount_huf,
        updated_at = now();

  return true;
end;
$$;

create or replace function route_record_wallet_after_insert()
returns trigger
language plpgsql
security definer
as $$
declare
  v_fx numeric;
  v_huf integer;
  cur text;
begin
  cur := upper(trim(NEW.currency));
  if cur = 'EUR' then
    select nullif(value, '')::numeric into v_fx from settings where key = 'fx_eur_to_huf';
    v_huf := greatest(1, round(NEW.amount * coalesce(v_fx, 400))::integer);
  else
    raise exception 'Nem támogatott pénznem: %, csak EUR engedélyezett.', NEW.currency;
  end if;

  perform apply_route_debit(NEW.dedupe_key, NEW.device_number_raw, v_huf);
  return NEW;
end;
$$;

drop trigger if exists trg_route_record_wallet on route_records;
create trigger trg_route_record_wallet
  after insert on route_records
  for each row
  execute function route_record_wallet_after_insert();
