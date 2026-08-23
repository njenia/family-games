-- Gabby Dash mini-game (3-lane runner) personal best per profile.
alter table public.profiles
  add column if not exists gabby_dash_high_score integer not null default 0
    check (gabby_dash_high_score >= 0);
