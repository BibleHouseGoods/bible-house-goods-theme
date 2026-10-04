-- Life OS — initial schema
-- Single user today, but every row carries owner_id so strict per-user
-- isolation (RLS on auth.uid()) can be switched on without a data migration.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.area as enum ('life', 'church', 'bible_house', 'liberty');
create type public.content_type as enum ('task', 'note', 'idea', 'project', 'meeting', 'reference');
create type public.recording_status as enum (
  'uploading',    -- row created, audio upload to Drive in progress
  'uploaded',     -- audio safely in Drive, waiting for processing
  'transcribing',
  'cleaning',
  'classifying',
  'ready',        -- items generated and waiting in the review inbox
  'private',      -- do-not-AI: stored only, never sent to any AI service
  'error'
);
create type public.item_status as enum ('pending', 'approved', 'rejected');
create type public.action_kind as enum ('todoist', 'calendar', 'email_draft');

-- ---------------------------------------------------------------------------
-- Owners (one row today)
-- ---------------------------------------------------------------------------
create table public.owners (
  id uuid primary key,
  display_name text not null,
  created_at timestamptz not null default now()
);
insert into public.owners (id, display_name)
values ('00000000-0000-0000-0000-000000000001', 'Owner');

-- ---------------------------------------------------------------------------
-- Recordings
-- ---------------------------------------------------------------------------
create table public.recordings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  title text,
  recorded_at timestamptz,
  source text not null check (source in ('recorder', 'import')),
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  duration_seconds numeric,

  is_private boolean not null default false,
  area public.area,                 -- optional manual routing (used for private recordings)
  notes text,                       -- manual notes; the only text a private recording has
  status public.recording_status not null default 'uploading',
  error text,
  processing_lock timestamptz,      -- prevents concurrent pipeline runs

  -- Google Drive (long-term storage)
  upload_session text,              -- encrypted resumable-upload URI, cleared when done
  upload_offset bigint not null default 0,
  drive_folder_id text,
  drive_folder_url text,
  drive_audio_file_id text,
  drive_audio_url text,
  drive_verbatim_file_id text,
  drive_verbatim_url text,
  drive_clean_file_id text,
  drive_clean_url text,

  -- Verbatim transcript: exactly as spoken, write-once (see trigger below)
  verbatim_transcript text,
  verbatim_segments jsonb,
  transcription_model text,
  transcribed_at timestamptz,

  -- Clean transcript: fillers/false starts removed, meaning and voice preserved
  clean_transcript text,
  clean_model text,
  cleaned_at timestamptz,
  cleaning_warning text,

  classified_at timestamptz,

  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(notes, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(clean_transcript, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(verbatim_transcript, '')), 'D')
  ) stored
);
create index recordings_owner_created_idx on public.recordings (owner_id, created_at desc);
create index recordings_search_idx on public.recordings using gin (search);

-- The verbatim transcript, its segments and the original audio reference can be
-- written once and never changed. This is enforced in the database, not just
-- in application code.
create or replace function public.protect_verbatim() returns trigger
language plpgsql as $$
begin
  if old.verbatim_transcript is not null
     and new.verbatim_transcript is distinct from old.verbatim_transcript then
    raise exception 'verbatim_transcript is immutable once written';
  end if;
  if old.verbatim_segments is not null
     and new.verbatim_segments is distinct from old.verbatim_segments then
    raise exception 'verbatim_segments is immutable once written';
  end if;
  if old.drive_audio_file_id is not null
     and new.drive_audio_file_id is distinct from old.drive_audio_file_id then
    raise exception 'drive_audio_file_id is immutable once written';
  end if;
  if new.original_filename is distinct from old.original_filename
     or new.size_bytes is distinct from old.size_bytes then
    raise exception 'original audio metadata is immutable';
  end if;
  new.updated_at = now();
  return new;
end $$;

create trigger recordings_protect_verbatim
before update on public.recordings
for each row execute function public.protect_verbatim();

-- ---------------------------------------------------------------------------
-- Items (one recording -> many items, split by meaning)
-- ---------------------------------------------------------------------------
create table public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners (id) on delete cascade,
  recording_id uuid not null references public.recordings (id) on delete cascade,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  title text not null,
  body text not null,               -- exact excerpt of the clean transcript
  area public.area not null,
  content_type public.content_type not null,
  tags text[] not null default '{}',
  explicit_cue text,                -- the spoken cue that forced this split, if any
  confidence real,

  status public.item_status not null default 'pending',
  approved_at timestamptz,

  -- Proposed external actions (nothing runs until approval)
  task jsonb,                       -- { due_string, priority }
  event jsonb,                      -- { title, start, end, all_day, location }
  email jsonb,                      -- { to, subject, body }
  actions jsonb not null default '{"todoist": false, "calendar": false, "email_draft": false}',

  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'C')
  ) stored
);
create index items_owner_status_idx on public.items (owner_id, status, created_at desc);
create index items_owner_area_idx on public.items (owner_id, area, content_type);
create index items_recording_idx on public.items (recording_id, position);
create index items_search_idx on public.items using gin (search);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create trigger items_touch before update on public.items
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- External actions executed on approval (idempotency + links back)
-- ---------------------------------------------------------------------------
create table public.item_actions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  kind public.action_kind not null,
  status text not null check (status in ('done', 'error')),
  external_id text,
  external_url text,
  error text,
  created_at timestamptz not null default now()
);
create unique index item_actions_done_once on public.item_actions (item_id, kind) where status = 'done';

-- ---------------------------------------------------------------------------
-- Integrations (encrypted credentials) and settings
-- ---------------------------------------------------------------------------
create table public.integrations (
  owner_id uuid not null references public.owners (id) on delete cascade,
  provider text not null,
  secret text not null,             -- AES-256-GCM ciphertext, key lives only in server env
  meta jsonb not null default '{}', -- non-secret info (connected email, folder ids)
  updated_at timestamptz not null default now(),
  primary key (owner_id, provider)
);

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create table public.audit_events (
  id bigint generated always as identity primary key,
  owner_id uuid references public.owners (id) on delete cascade,
  at timestamptz not null default now(),
  action text not null,
  entity_type text,
  entity_id text,
  detail jsonb not null default '{}',
  ip text
);
create index audit_events_owner_at_idx on public.audit_events (owner_id, at desc);

-- ---------------------------------------------------------------------------
-- Lock everything down.
-- The app talks to Postgres only from the server with the service-role key.
-- anon/authenticated get no grants; RLS is on with owner-scoped policies so a
-- future multi-user (Supabase Auth) setup is isolated from day one.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['owners','recordings','items','item_actions','integrations','audit_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

create policy owner_isolation on public.recordings   for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_isolation on public.items        for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_isolation on public.item_actions for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_isolation on public.integrations for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy owner_isolation on public.audit_events for select to authenticated using (owner_id = auth.uid());
create policy owner_isolation on public.owners       for select to authenticated using (id = auth.uid());
