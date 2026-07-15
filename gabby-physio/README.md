# Gabby's Physio Adventure

Kid-friendly physio exercise app with user accounts and session tracking.

## Run

```bash
npm install
npm start
```

Open http://localhost:3210. Other devices on the same network can connect via
`http://<this-computer-ip>:3210` — log in with the same account to see the same
progress everywhere.

## Features

- **Accounts**: register with a username + PIN, log in from any device.
- **Exercise scheme per user**: each account gets its own copy of the exercise
  configuration (seeded from `exercises.json`), stored in the database and
  editable via `PUT /api/scheme`.
- **Session tracking**: every workout is recorded live. The start screen shows
  how many sessions you've done today and how many are left toward your daily
  goal (configurable per account on the start screen).
- **History**: a session calendar/table with a star for each completed session,
  plus a cute animation stamping the new star when you finish one.

## Data

SQLite database at `data/gabby.db` (created automatically). Schema:

- `users` — username, display name, PIN hash, daily goal
- `auth_tokens` — long-lived device login tokens
- `schemes` — exercise configuration per user (JSON), `is_active` flag allows
  multiple schemes per user later
- `sessions` — one row per workout: status (`in_progress` / `completed` /
  `abandoned`), local date, exercises completed/total, timestamps

## Maintenance

`npm run sync` regenerates `exercises.js` / `bonus-videos.js` from
`exercises.json` and the bonus video folder (used only as offline fallback and
for seeding new accounts).
