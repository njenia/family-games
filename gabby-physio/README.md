# Gabby's Physio Adventure

Kid-friendly physio exercise app with user accounts (Supabase Auth) and session
tracking (Supabase Postgres).

## Setup

1. **Create the tables**: open your Supabase project → SQL Editor → paste and run,
   in order: `supabase/migrations/0001_init.sql`, then `0002_avatars.sql`
   (adds profile photos + the `avatars` storage bucket), then
   `0003_catch_gabby_high_score.sql` (Catch Gabby personal best), then
   `0004_profile_settings.sql` (exercise preview toggle), then
   `0005_bonus_video_sources_multi.sql` (choose one or more bonus video sources:
   custom clips, raccoons, bunnies), then `0006_googoo_high_score.sql` (Googoo
   game personal best).
2. **Environment**: copy `.env.example` to `.env` and fill in `SUPABASE_URL`,
   `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (Project Settings → API Keys).

## Run locally

```bash
npm install
npm start
```

Open http://localhost:3210. Other devices on the same network can connect via
`http://<this-computer-ip>:3210` — log in with the same account to see the same
progress everywhere.

## Deploy on Render

The repo root has a `render.yaml` blueprint. In Render: **New → Blueprint**,
point it at this repo, and set the three `SUPABASE_*` environment variables when
prompted (they are marked `sync: false`, so they never live in git). Any later
`git push` redeploys automatically. All state lives in Supabase, so redeploys
lose nothing.

## How it works

- **Auth**: Supabase Auth with username + PIN. Usernames are mapped to synthetic
  emails (`<username>@gabby.example.com`); no email is ever sent. The browser
  uses supabase-js with the publishable key for login and automatic token
  refresh; API calls carry the Supabase JWT as a bearer token, which the server
  verifies with the secret key.
- **Registration** happens server-side (`POST /api/register`) so usernames stay
  unique and each new account is seeded with a profile and a default exercise
  scheme from `exercises.json`.
- **Data access**: only the server talks to the tables (secret key bypasses
  RLS). RLS is enabled with no policies, so the publishable key cannot touch
  data directly.

## Database schema

Defined in `supabase/migrations/0001_init.sql`:

- `profiles` — one per auth user: username, display name, daily goal, optional
  `avatar_url`
- `schemes` — exercise configuration per user (JSONB), `is_active` flag allows
  multiple schemes per user later
- `sessions` — one row per workout: status (`in_progress` / `completed` /
  `abandoned`), local date, exercises completed/total, timestamps
- Storage bucket `avatars` — public profile photos uploaded via `POST /api/me/avatar`

## Maintenance

`npm run sync` regenerates `bonus-videos.js` from the bonus video folder and
`repetition-graphics.js` from `graphics/repititions/` (random bottom parade
images on a special rep). Filenames are never hard-coded in app logic.

The bottom parade picture doubles as the **Googoo game**: while it's on screen,
saying "googoo" as it crosses the middle of the screen scores a point (uses the
Web Speech API; silently does nothing on browsers without speech recognition).
Points accumulate for the session and reset next session; the best single
session is shown at the end and tracked historically (`googoo_high_score`),
alongside the Catch Gabby high score on the home screen.
New accounts are seeded from `exercises.json` (the single exercise-config source
of truth) into each user's scheme in the database. `GET /api/scheme` also reloads
that file so existing accounts stay in sync when the scheme changes.

Exercise demo clips are resolved by convention (not listed in JSON):

- timed: `video/<id> work.mov`, `video/<id> rest.mov`
- dual / count: `video/<id> <key>.mov` where `<key>` is the last word of the
  phase label (lowercased), e.g. `Hold Up` → `video/elbow-bending up.mov`
- optional `"key"` on a phase overrides the label-derived suffix
- optional `"video"` on a phase (or `"restVideo"` / `"videos.work|rest"` on the
  exercise) overrides the path entirely — used when a compound exercise reuses
  clips from other exercise ids
