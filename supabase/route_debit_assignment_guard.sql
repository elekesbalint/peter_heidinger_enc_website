-- Migration: skip route wallet deduction if route predates device assignment.
-- Guard timestamp: devices.assigned_at, and legacy fallback: devices.sold_at.

create or replace function route_record_wallet_after_insert()
returns trigger
language plpgsql
security definer
as $$
declare
  v_fx numeric;
  v_huf integer;
  cur text;
  v_assignment_start_at timestamptz;
begin
  -- Ha az útvonal a készülék aktuális kiosztási kezdete előtti, kihagyjuk a levonást.
  -- Régi rekordoknál, ahol assigned_at üres, sold_at a fallback.
  select coalesce(assigned_at, sold_at) into v_assignment_start_at
  from devices
  where identifier = NEW.device_number_raw
  limit 1;

  if v_assignment_start_at is not null and NEW.executed_at < v_assignment_start_at then
    return NEW;
  end if;

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
