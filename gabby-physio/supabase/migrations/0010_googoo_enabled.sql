-- Enable/disable the in-session Googoo invaders mini-game per profile.
alter table public.profiles
  add column if not exists googoo_enabled boolean not null default true;
