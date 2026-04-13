-- Automatikus Google értékeléskérő e-mail támogatás
-- Futtasd Supabase SQL Editorban.

alter table enc_device_orders
  add column if not exists review_request_sent_at timestamptz;

create index if not exists idx_enc_device_orders_review_request_pending
  on enc_device_orders(shipped_at)
  where shipped_at is not null and cancelled_at is null and review_request_sent_at is null;
