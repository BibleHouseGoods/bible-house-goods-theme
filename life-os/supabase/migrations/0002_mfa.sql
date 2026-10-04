-- Life OS — passphrase + TOTP two-factor credentials.
-- Stored in the database (not env) so setup happens in-app, the passphrase is
-- never shared with anyone, and it can be changed without a redeploy.

create table public.auth_credentials (
  owner_id uuid primary key references public.owners (id) on delete cascade,
  password_hash text not null,          -- scrypt, random salt
  totp_secret text not null,            -- AES-256-GCM ciphertext of the base32 secret
  totp_confirmed_at timestamptz,        -- null until the first code is verified
  totp_last_step bigint not null default -1, -- blocks replay of a used code
  recovery_codes text[] not null default '{}', -- sha256 hashes; each usable once
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger auth_credentials_touch before update on public.auth_credentials
for each row execute function public.touch_updated_at();

alter table public.auth_credentials enable row level security;
alter table public.auth_credentials force row level security;
revoke all on public.auth_credentials from anon, authenticated;
-- Intentionally no policies: credentials are reachable only by the server.

create index audit_events_action_at_idx on public.audit_events (action, at desc);
