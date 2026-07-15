-- Gabby's Physio — initial schema.
-- Run this in the Supabase Dashboard: SQL Editor -> New query -> paste -> Run.
-- (Or with the Supabase CLI: supabase db push)

-- One profile row per auth user (auth itself is handled by Supabase Auth).
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  username     text not null,
  display_name text not null,
  daily_goal   integer not null default 3 check (daily_goal between 1 and 20),
  created_at   timestamptz not null default now()
);
create unique index if not exists idx_profiles_username on public.profiles (lower(username));

-- Exercise schemes. One active scheme per user for now; is_active allows
-- several per user later.
create table if not exists public.schemes (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null default 'My exercises',
  config     jsonb not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_schemes_user on public.schemes (user_id, is_active);

-- One row per workout session.
create table if not exists public.sessions (
  id                  bigint generated always as identity primary key,
  user_id             uuid not null references auth.users(id) on delete cascade,
  scheme_id           bigint references public.schemes(id) on delete set null,
  status              text not null default 'in_progress'
                      check (status in ('in_progress','completed','abandoned')),
  local_date          date not null, -- calendar date on the device that ran the session
  exercises_total     integer not null default 0,
  exercises_completed integer not null default 0,
  started_at          timestamptz not null default now(),
  finished_at         timestamptz
);
create index if not exists idx_sessions_user_date on public.sessions (user_id, local_date);

-- All data access goes through the app server using the secret key (which
-- bypasses RLS). Enabling RLS with no policies means the browser-side
-- publishable key cannot read or write these tables directly.
alter table public.profiles enable row level security;
alter table public.schemes  enable row level security;
alter table public.sessions enable row level security;
