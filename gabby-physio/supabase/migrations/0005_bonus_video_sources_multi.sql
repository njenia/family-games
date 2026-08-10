-- Allow selecting multiple simultaneous bonus video sources (was a single choice).
alter table public.profiles
  add column if not exists bonus_video_sources text[] not null default array['custom'];

update public.profiles
  set bonus_video_sources = array['raccoon']
  where bonus_video_source = 'raccoon'
    and bonus_video_sources = array['custom'];

alter table public.profiles
  add constraint bonus_video_sources_valid check (
    cardinality(bonus_video_sources) > 0
    and bonus_video_sources <@ array['custom', 'raccoon', 'bunny']
  );

alter table public.profiles drop column if exists bonus_video_source;
