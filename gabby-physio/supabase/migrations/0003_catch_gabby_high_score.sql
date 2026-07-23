-- Catch Gabby mini-game personal best per profile.
alter table public.profiles
  add column if not exists catch_gabby_high_score integer not null default 0
  check (catch_gabby_high_score >= 0);
