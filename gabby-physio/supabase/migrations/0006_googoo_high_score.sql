-- Googoo mini-game (bottom rep-parade picture) session high score per profile.
alter table public.profiles
  add column if not exists googoo_high_score integer not null default 0
  check (googoo_high_score >= 0);
