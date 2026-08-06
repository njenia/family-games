-- Settings-page prefs (exercise preview + bonus video source) on the profile
-- so they sync across devices.
alter table public.profiles
  add column if not exists skip_exercise_preview boolean not null default false,
  add column if not exists bonus_video_source text not null default 'custom'
    check (bonus_video_source in ('custom', 'raccoon'));
