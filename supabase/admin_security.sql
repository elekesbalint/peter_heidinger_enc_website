create table if not exists admin_login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ip text not null,
  user_agent text not null default '',
  success boolean not null default false,
  reason text not null default '',
  alert_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_login_attempts_created_at
  on admin_login_attempts(created_at desc);

create index if not exists idx_admin_login_attempts_email_created
  on admin_login_attempts(email, created_at desc);

create index if not exists idx_admin_login_attempts_ip_created
  on admin_login_attempts(ip, created_at desc);

alter table admin_login_attempts enable row level security;
