-- Session mode (full workout vs one-exercise sessions) + per-exercise daily goals.
-- Also store which exercise a session ran (needed for interleaved one-exercise mode).

alter table public.profiles
  add column if not exists session_mode text not null default 'one_exercise'
    check (session_mode in ('full', 'one_exercise'));

alter table public.profiles
  add column if not exists exercise_daily_goals jsonb not null
    default '{"squeeze-sponge":3,"compound-elbow":3}'::jsonb;

alter table public.sessions
  add column if not exists exercise_id text;
