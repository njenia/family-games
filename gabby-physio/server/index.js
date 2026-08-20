'use strict';
const path = require('path');
const fs = require('fs');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const root = path.join(__dirname, '..');
try { process.loadEnvFile(path.join(root, '.env')); } catch (_) { /* no .env file — fine on Render */ }

const {
  SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  SUPABASE_PUBLISHABLE_KEY,
  GIPHY_API_KEY,
} = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('Missing environment variables. Required:');
  console.error('  SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY');
  console.error('Locally: copy .env.example to .env and fill in your Supabase project values.');
  process.exit(1);
}
if (!GIPHY_API_KEY) {
  console.warn('GIPHY_API_KEY is not set — cute-animal bonus GIFs will be unavailable.');
}

// Server-side client with the secret key: full DB access, bypasses RLS.
const sb = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PORT = process.env.PORT || 3210;
const AVATAR_BUCKET = 'avatars';
const app = express();
app.use(express.json({ limit: '3mb' }));

/* ============================== helpers ============================== */

// Usernames are mapped to synthetic emails for Supabase Auth; no mail is ever sent.
const EMAIL_DOMAIN = 'gabby.example.com';
const emailFor = (username) => `${String(username).trim().toLowerCase()}@${EMAIL_DOMAIN}`;

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function defaultSchemeConfig() {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'exercises.json'), 'utf8'));
  delete cfg.bonusVideos;
  return cfg;
}

const BONUS_VIDEO_SOURCE_VALUES = ['custom', 'raccoon', 'bunny'];
const GOOGOO_WORD_DEFAULT = 'bingo';
const GOOGOO_LOUDNESS_DEFAULT = 5;

function normalizeBonusVideoSources(list) {
  const clean = Array.isArray(list)
    ? [...new Set(list.filter((s) => BONUS_VIDEO_SOURCE_VALUES.includes(s)))]
    : [];
  return clean.length ? clean : ['custom'];
}

/** Lowercase letters only, 2–24 chars. Falls back to the default trigger word. */
function normalizeGoogooWord(word) {
  const clean = String(word || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  return clean.length >= 2 && clean.length <= 24 ? clean : GOOGOO_WORD_DEFAULT;
}

function normalizeGoogooLoudness(n) {
  const v = parseInt(n, 10);
  if (!(Number.isFinite(v) && v >= 1 && v <= 10)) return GOOGOO_LOUDNESS_DEFAULT;
  return v;
}

function publicUser(profile) {
  return {
    id: profile.user_id,
    username: profile.username,
    displayName: profile.display_name,
    dailyGoal: profile.daily_goal,
    avatarUrl: profile.avatar_url || null,
    catchGabbyHighScore: profile.catch_gabby_high_score || 0,
    googooHighScore: profile.googoo_high_score || 0,
    skipExercisePreview: !!profile.skip_exercise_preview,
    bonusVideoSources: normalizeBonusVideoSources(profile.bonus_video_sources),
    googooPauseMs: profile.googoo_pause_ms == null ? 2200 : profile.googoo_pause_ms,
    googooGapMs: profile.googoo_gap_ms == null ? 6500 : profile.googoo_gap_ms,
    googooWord: normalizeGoogooWord(profile.googoo_word),
    googooLoudness: normalizeGoogooLoudness(profile.googoo_loudness),
    // Only include when the column is present — missing column must not mean "on".
    ...(Object.prototype.hasOwnProperty.call(profile, 'googoo_enabled')
      ? { googooEnabled: !!profile.googoo_enabled }
      : {}),
  };
}

function isValidLocalDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Format a Date as YYYY-MM-DD in local calendar fields already set on the Date. */
function formatLocalYmd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Monday→Sunday week containing `localDate` (YYYY-MM-DD). */
function weekDateList(localDate) {
  const d = new Date(`${localDate}T12:00:00`);
  const day = d.getDay(); // 0 = Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    days.push(formatLocalYmd(x));
  }
  return days;
}

async function activeScheme(userId) {
  const { data, error } = await sb.from('schemes')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function todayStats(userId, localDate) {
  const { count, error } = await sb.from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('local_date', localDate)
    .eq('status', 'completed');
  if (error) throw error;
  return count || 0;
}

async function totalCompletedSessions(userId) {
  const { count, error } = await sb.from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed');
  if (error) throw error;
  return count || 0;
}

async function weekStats(userId, localDate) {
  const days = weekDateList(localDate);
  const { data, error } = await sb.from('sessions')
    .select('local_date')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('local_date', days[0])
    .lte('local_date', days[6]);
  if (error) throw error;
  const counts = Object.create(null);
  for (const row of data || []) {
    counts[row.local_date] = (counts[row.local_date] || 0) + 1;
  }
  return days.map((date) => ({ date, completed: counts[date] || 0 }));
}

async function ensureAvatarBucket() {
  const { data, error } = await sb.storage.listBuckets();
  if (error) throw error;
  if (data && data.some((b) => b.id === AVATAR_BUCKET || b.name === AVATAR_BUCKET)) return;
  const { error: cErr } = await sb.storage.createBucket(AVATAR_BUCKET, {
    public: true,
    fileSizeLimit: 2_097_152,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });
  if (cErr && !/already exists|duplicate/i.test(cErr.message || '')) throw cErr;
}

function parseDataUrl(dataUrl) {
  const m = String(dataUrl || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!m) return null;
  return { mime: m[1], buffer: Buffer.from(m[2].replace(/\s+/g, ''), 'base64') };
}

/* ============================== auth ============================== */

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Not logged in' });

    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Session expired, please log in again' });
    }
    const { data: profile, error: pErr } = await sb.from('profiles')
      .select('*').eq('user_id', data.user.id).single();
    if (pErr || !profile) return res.status(401).json({ error: 'Account profile missing' });

    req.user = profile;
    next();
  } catch (err) {
    next(err);
  }
}

// The browser needs these to create its own Supabase client (login + token refresh)
// and to call the GIPHY JS SDK. Both keys are intended for client-side use.
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: SUPABASE_URL,
    supabasePublishableKey: SUPABASE_PUBLISHABLE_KEY,
    giphyApiKey: GIPHY_API_KEY || null,
  });
});

// Registration is server-side so we can enforce username uniqueness and seed
// the profile + default scheme atomically-ish. Login happens in the browser
// via supabase-js (which then auto-refreshes tokens).
app.post('/api/register', wrap(async (req, res) => {
  const { username, displayName, pin } = req.body || {};
  const name = String(username || '').trim();
  if (!/^[a-zA-Z0-9_-]{2,24}$/.test(name)) {
    return res.status(400).json({ error: 'Username: 2-24 letters, numbers, - or _' });
  }
  if (!pin || String(pin).length < 6) {
    return res.status(400).json({ error: 'PIN must be at least 6 characters' });
  }

  const { data: existing, error: exErr } = await sb.from('profiles')
    .select('user_id').ilike('username', name).maybeSingle();
  if (exErr) throw exErr;
  if (existing) return res.status(409).json({ error: 'That username is taken' });

  const { data: created, error: cErr } = await sb.auth.admin.createUser({
    email: emailFor(name),
    password: String(pin),
    email_confirm: true,
  });
  if (cErr) {
    if (/already|registered|exists/i.test(cErr.message)) {
      return res.status(409).json({ error: 'That username is taken' });
    }
    throw cErr;
  }
  const userId = created.user.id;

  const { error: pErr } = await sb.from('profiles').insert({
    user_id: userId,
    username: name,
    display_name: String(displayName || name).trim() || name,
    daily_goal: 3,
  });
  if (pErr) {
    await sb.auth.admin.deleteUser(userId).catch(() => {});
    throw pErr;
  }
  const { error: sErr } = await sb.from('schemes').insert({
    user_id: userId,
    name: 'My exercises',
    config: defaultSchemeConfig(),
  });
  if (sErr) throw sErr;

  res.json({ ok: true });
}));

/* ============================== account ============================== */

app.get('/api/me', requireAuth, wrap(async (req, res) => {
  const date = isValidLocalDate(req.query.date)
    ? req.query.date
    : new Date().toISOString().slice(0, 10);
  const [completed, totalSessions, week] = await Promise.all([
    todayStats(req.user.user_id, date),
    totalCompletedSessions(req.user.user_id),
    weekStats(req.user.user_id, date),
  ]);
  res.json({
    user: publicUser(req.user),
    today: { date, completed, goal: req.user.daily_goal },
    totalSessions,
    week,
  });
}));

app.patch('/api/me', requireAuth, wrap(async (req, res) => {
  const {
    dailyGoal,
    displayName,
    skipExercisePreview,
    bonusVideoSources,
    googooPauseMs,
    googooGapMs,
    googooWord,
    googooLoudness,
    googooEnabled,
  } = req.body || {};
  const patch = {};
  if (dailyGoal !== undefined) {
    const goal = parseInt(dailyGoal, 10);
    if (!(goal >= 1 && goal <= 20)) return res.status(400).json({ error: 'Daily goal must be 1-20' });
    patch.daily_goal = goal;
  }
  if (displayName !== undefined) {
    const dn = String(displayName).trim();
    if (!dn) return res.status(400).json({ error: 'Display name cannot be empty' });
    patch.display_name = dn;
  }
  if (skipExercisePreview !== undefined) {
    if (typeof skipExercisePreview !== 'boolean') {
      return res.status(400).json({ error: 'skipExercisePreview must be a boolean' });
    }
    patch.skip_exercise_preview = skipExercisePreview;
  }
  if (bonusVideoSources !== undefined) {
    if (!Array.isArray(bonusVideoSources) || !bonusVideoSources.length
      || !bonusVideoSources.every((s) => BONUS_VIDEO_SOURCE_VALUES.includes(s))) {
      return res.status(400).json({
        error: `bonusVideoSources must be a non-empty array of: ${BONUS_VIDEO_SOURCE_VALUES.join(', ')}`,
      });
    }
    patch.bonus_video_sources = normalizeBonusVideoSources(bonusVideoSources);
  }
  if (googooPauseMs !== undefined) {
    const pause = parseInt(googooPauseMs, 10);
    if (!(Number.isFinite(pause) && pause >= 1000 && pause <= 5000)) {
      return res.status(400).json({ error: 'googooPauseMs must be between 1000 and 5000' });
    }
    patch.googoo_pause_ms = pause;
  }
  if (googooGapMs !== undefined) {
    const gap = parseInt(googooGapMs, 10);
    if (!(Number.isFinite(gap) && gap >= 3000 && gap <= 15000)) {
      return res.status(400).json({ error: 'googooGapMs must be between 3000 and 15000' });
    }
    patch.googoo_gap_ms = gap;
  }
  if (googooWord !== undefined) {
    const cleaned = String(googooWord || '').trim().toLowerCase().replace(/[^a-z]/g, '');
    if (!(cleaned.length >= 2 && cleaned.length <= 24)) {
      return res.status(400).json({
        error: 'googooWord must be 2–24 letters (a–z)',
      });
    }
    patch.googoo_word = cleaned;
  }
  if (googooLoudness !== undefined) {
    const loud = parseInt(googooLoudness, 10);
    if (!(Number.isFinite(loud) && loud >= 1 && loud <= 10)) {
      return res.status(400).json({ error: 'googooLoudness must be between 1 and 10' });
    }
    patch.googoo_loudness = loud;
  }
  if (googooEnabled !== undefined) {
    if (typeof googooEnabled !== 'boolean') {
      return res.status(400).json({ error: 'googooEnabled must be a boolean' });
    }
    patch.googoo_enabled = googooEnabled;
  }
  if (!Object.keys(patch).length) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }
  let { data, error } = await sb.from('profiles')
    .update(patch).eq('user_id', req.user.user_id).select().single();
  if (error && patch.googoo_enabled !== undefined
    && /googoo_enabled/i.test(`${error.message || ''} ${error.details || ''} ${error.code || ''}`)) {
    const requestedEnabled = patch.googoo_enabled;
    delete patch.googoo_enabled;
    if (!Object.keys(patch).length) {
      return res.json({ user: { ...publicUser(req.user), googooEnabled: requestedEnabled } });
    }
    ({ data, error } = await sb.from('profiles')
      .update(patch).eq('user_id', req.user.user_id).select().single());
    if (error) throw error;
    return res.json({ user: { ...publicUser(data), googooEnabled: requestedEnabled } });
  }
  if (error) throw error;
  res.json({ user: publicUser(data) });
}));

/** Submit a Catch Gabby score; updates the profile only when it beats the high score. */
app.post('/api/me/catch-gabby', requireAuth, wrap(async (req, res) => {
  const score = parseInt(req.body && req.body.score, 10);
  if (!(Number.isFinite(score) && score >= 0 && score <= 10000)) {
    return res.status(400).json({ error: 'Score must be between 0 and 10000' });
  }
  const current = req.user.catch_gabby_high_score || 0;
  if (score <= current) {
    return res.json({
      highScore: current,
      isNewRecord: false,
      user: publicUser(req.user),
    });
  }
  const { data, error } = await sb.from('profiles')
    .update({ catch_gabby_high_score: score })
    .eq('user_id', req.user.user_id)
    .select()
    .single();
  if (error) throw error;
  res.json({
    highScore: score,
    isNewRecord: true,
    user: publicUser(data),
  });
}));

/** Submit a Googoo game score (falling Gabby invaders); updates the profile only when it beats the high score. */
app.post('/api/me/googoo', requireAuth, wrap(async (req, res) => {
  const score = parseInt(req.body && req.body.score, 10);
  if (!(Number.isFinite(score) && score >= 0 && score <= 100000)) {
    return res.status(400).json({ error: 'Score must be between 0 and 100000' });
  }
  const current = req.user.googoo_high_score || 0;
  if (score <= current) {
    return res.json({
      highScore: current,
      isNewRecord: false,
      user: publicUser(req.user),
    });
  }
  const { data, error } = await sb.from('profiles')
    .update({ googoo_high_score: score })
    .eq('user_id', req.user.user_id)
    .select()
    .single();
  if (error) throw error;
  res.json({
    highScore: score,
    isNewRecord: true,
    user: publicUser(data),
  });
}));

app.post('/api/me/avatar', requireAuth, wrap(async (req, res) => {
  const parsed = parseDataUrl(req.body && req.body.image);
  if (!parsed) {
    return res.status(400).json({ error: 'Send a JPEG, PNG, or WebP data URL in { image }' });
  }
  if (parsed.buffer.length > 2_097_152) {
    return res.status(400).json({ error: 'Image too large (max 2 MB)' });
  }

  await ensureAvatarBucket();

  const ext = parsed.mime === 'image/png' ? 'png' : parsed.mime === 'image/webp' ? 'webp' : 'jpg';
  const objectPath = `${req.user.user_id}/avatar.${ext}`;

  const { error: upErr } = await sb.storage
    .from(AVATAR_BUCKET)
    .upload(objectPath, parsed.buffer, {
      contentType: parsed.mime,
      upsert: true,
      cacheControl: '3600',
    });
  if (upErr) throw upErr;

  const { data: pub } = sb.storage.from(AVATAR_BUCKET).getPublicUrl(objectPath);
  const avatarUrl = `${pub.publicUrl}?v=${Date.now()}`;

  const { data, error } = await sb.from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('user_id', req.user.user_id)
    .select()
    .single();
  if (error) throw error;
  res.json({ user: publicUser(data) });
}));

/* ============================== scheme ============================== */

app.get('/api/scheme', requireAuth, wrap(async (req, res) => {
  const scheme = await activeScheme(req.user.user_id);
  if (!scheme) return res.status(404).json({ error: 'No exercise scheme found' });
  // exercises.json is the live source of truth; keep the DB copy in sync.
  const config = defaultSchemeConfig();
  const { error } = await sb.from('schemes')
    .update({ config, updated_at: new Date().toISOString() })
    .eq('id', scheme.id);
  if (error) throw error;
  res.json({ id: scheme.id, name: scheme.name, config });
}));

app.put('/api/scheme', requireAuth, wrap(async (req, res) => {
  const { config, name } = req.body || {};
  if (!config || !Array.isArray(config.exercises)) {
    return res.status(400).json({ error: 'config.exercises must be an array' });
  }
  const scheme = await activeScheme(req.user.user_id);
  if (!scheme) return res.status(404).json({ error: 'No exercise scheme found' });
  const patch = { config, updated_at: new Date().toISOString() };
  if (name) patch.name = String(name);
  const { error } = await sb.from('schemes').update(patch).eq('id', scheme.id);
  if (error) throw error;
  res.json({ ok: true });
}));

/* ============================== sessions ============================== */

app.post('/api/sessions', requireAuth, wrap(async (req, res) => {
  const { localDate, exercisesTotal } = req.body || {};
  if (!isValidLocalDate(localDate)) {
    return res.status(400).json({ error: 'localDate must be YYYY-MM-DD' });
  }
  // A new session supersedes any still-open one (e.g. browser closed mid-workout)
  const { error: abErr } = await sb.from('sessions')
    .update({ status: 'abandoned', finished_at: new Date().toISOString() })
    .eq('user_id', req.user.user_id)
    .eq('status', 'in_progress');
  if (abErr) throw abErr;

  const scheme = await activeScheme(req.user.user_id);
  const { data, error } = await sb.from('sessions').insert({
    user_id: req.user.user_id,
    scheme_id: scheme ? scheme.id : null,
    local_date: localDate,
    exercises_total: Math.max(0, parseInt(exercisesTotal, 10) || 0),
  }).select('id').single();
  if (error) throw error;
  res.json({ id: data.id });
}));

app.patch('/api/sessions/:id', requireAuth, wrap(async (req, res) => {
  const { data: session, error: gErr } = await sb.from('sessions')
    .select('*').eq('id', req.params.id).eq('user_id', req.user.user_id).maybeSingle();
  if (gErr) throw gErr;
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { exercisesCompleted, status } = req.body || {};
  const patch = {};
  if (exercisesCompleted !== undefined) {
    patch.exercises_completed = Math.max(0, parseInt(exercisesCompleted, 10) || 0);
  }
  if (status !== undefined) {
    if (!['in_progress', 'completed', 'abandoned'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    patch.status = status;
    if (status === 'completed' || status === 'abandoned') {
      patch.finished_at = new Date().toISOString();
    }
  }

  const { data: updated, error: uErr } = await sb.from('sessions')
    .update(patch).eq('id', session.id).select().single();
  if (uErr) throw uErr;

  res.json({
    session: updated,
    today: {
      date: updated.local_date,
      completed: await todayStats(req.user.user_id, updated.local_date),
      goal: req.user.daily_goal,
    },
  });
}));

app.get('/api/sessions', requireAuth, wrap(async (req, res) => {
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));
  const { data, error } = await sb.from('sessions')
    .select('id, status, local_date, exercises_total, exercises_completed, started_at, finished_at')
    .eq('user_id', req.user.user_id)
    .order('started_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);
  if (error) throw error;
  res.json({ sessions: data, goal: req.user.daily_goal });
}));

/* ============================== static app ============================== */

app.use(express.static(root));

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gabby's Physio running at http://localhost:${PORT}`);
});
