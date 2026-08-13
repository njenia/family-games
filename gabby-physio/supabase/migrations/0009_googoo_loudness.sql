-- Googoo mini-game: how loud a sound must be to zap a falling Gabby (1 = easier / quieter, 10 = louder needed).
alter table public.profiles
  add column if not exists googoo_loudness integer not null default 5
    check (googoo_loudness >= 1 and googoo_loudness <= 10);
