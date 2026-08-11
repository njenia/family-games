-- Googoo mini-game timing prefs: how long the animal freezes for "Bingo!",
-- and the typical gap between freezes (ms). Tunable in Settings.
alter table public.profiles
  add column if not exists googoo_pause_ms integer not null default 2200
    check (googoo_pause_ms >= 1000 and googoo_pause_ms <= 5000),
  add column if not exists googoo_gap_ms integer not null default 6500
    check (googoo_gap_ms >= 3000 and googoo_gap_ms <= 15000);
