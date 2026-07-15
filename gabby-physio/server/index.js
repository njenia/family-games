'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const db = require('./db');

const PORT = process.env.PORT || 3210;
const root = path.join(__dirname, '..');

const app = express();
app.use(express.json());

/* ============================== helpers ============================== */

function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPin(pin, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
}

function defaultSchemeConfig() {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'exercises.json'), 'utf8'));
  delete cfg.bonusVideos;
  return cfg;
}

function publicUser(u) {
  return { id: u.id, username: u.username, displayName: u.display_name, dailyGoal: u.daily_goal };
}

function activeScheme(userId) {
  return db.prepare(
    'SELECT * FROM schemes WHERE user_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 1'
  ).get(userId);
}

function isValidLocalDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function todayStats(userId, localDate) {
  const row = db.prepare(
    "SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND local_date = ? AND status = 'completed'"
  ).get(userId, localDate);
  return row.n;
}

/* ============================== auth ============================== */

function issueToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO auth_tokens (token, user_id) VALUES (?, ?)').run(token, userId);
  return token;
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not logged in' });
  const row = db.prepare(
    `SELECT u.* FROM auth_tokens t JOIN users u ON u.id = t.user_id WHERE t.token = ?`
  ).get(token);
  if (!row) return res.status(401).json({ error: 'Session expired, please log in again' });
  db.prepare("UPDATE auth_tokens SET last_seen_at = datetime('now') WHERE token = ?").run(token);
  req.user = row;
  req.token = token;
  next();
}

app.post('/api/register', (req, res) => {
  const { username, displayName, pin, dailyGoal } = req.body || {};
  const name = String(username || '').trim();
  if (!/^[a-zA-Z0-9_-]{2,24}$/.test(name)) {
    return res.status(400).json({ error: 'Username: 2-24 letters, numbers, - or _' });
  }
  if (!pin || String(pin).length < 4) {
    return res.status(400).json({ error: 'PIN must be at least 4 characters' });
  }
  const goal = Math.min(20, Math.max(1, parseInt(dailyGoal, 10) || 3));
  try {
    const result = db.prepare(
      'INSERT INTO users (username, display_name, pin_hash, daily_goal) VALUES (?, ?, ?, ?)'
    ).run(name, String(displayName || name).trim() || name, hashPin(pin), goal);
    const userId = result.lastInsertRowid;
    db.prepare(
      'INSERT INTO schemes (user_id, name, config_json) VALUES (?, ?, ?)'
    ).run(userId, 'My exercises', JSON.stringify(defaultSchemeConfig()));
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.json({ token: issueToken(userId), user: publicUser(user) });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'That username is taken' });
    }
    throw err;
  }
});

app.post('/api/login', (req, res) => {
  const { username, pin } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || '').trim());
  if (!user || !verifyPin(pin || '', user.pin_hash)) {
    return res.status(401).json({ error: 'Wrong username or PIN' });
  }
  res.json({ token: issueToken(user.id), user: publicUser(user) });
});

app.post('/api/logout', requireAuth, (req, res) => {
  db.prepare('DELETE FROM auth_tokens WHERE token = ?').run(req.token);
  res.json({ ok: true });
});

/* ============================== account ============================== */

app.get('/api/me', requireAuth, (req, res) => {
  const date = isValidLocalDate(req.query.date) ? req.query.date : new Date().toISOString().slice(0, 10);
  res.json({
    user: publicUser(req.user),
    today: { date, completed: todayStats(req.user.id, date), goal: req.user.daily_goal },
  });
});

app.patch('/api/me', requireAuth, (req, res) => {
  const { dailyGoal, displayName } = req.body || {};
  if (dailyGoal !== undefined) {
    const goal = parseInt(dailyGoal, 10);
    if (!(goal >= 1 && goal <= 20)) return res.status(400).json({ error: 'Daily goal must be 1-20' });
    db.prepare('UPDATE users SET daily_goal = ? WHERE id = ?').run(goal, req.user.id);
  }
  if (displayName !== undefined) {
    const dn = String(displayName).trim();
    if (!dn) return res.status(400).json({ error: 'Display name cannot be empty' });
    db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(dn, req.user.id);
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
});

/* ============================== scheme ============================== */

app.get('/api/scheme', requireAuth, (req, res) => {
  const scheme = activeScheme(req.user.id);
  if (!scheme) return res.status(404).json({ error: 'No exercise scheme found' });
  res.json({ id: scheme.id, name: scheme.name, config: JSON.parse(scheme.config_json) });
});

app.put('/api/scheme', requireAuth, (req, res) => {
  const { config, name } = req.body || {};
  if (!config || !Array.isArray(config.exercises)) {
    return res.status(400).json({ error: 'config.exercises must be an array' });
  }
  const scheme = activeScheme(req.user.id);
  if (!scheme) return res.status(404).json({ error: 'No exercise scheme found' });
  db.prepare(
    "UPDATE schemes SET config_json = ?, name = COALESCE(?, name), updated_at = datetime('now') WHERE id = ?"
  ).run(JSON.stringify(config), name ? String(name) : null, scheme.id);
  res.json({ ok: true });
});

/* ============================== sessions ============================== */

app.post('/api/sessions', requireAuth, (req, res) => {
  const { localDate, exercisesTotal } = req.body || {};
  if (!isValidLocalDate(localDate)) return res.status(400).json({ error: 'localDate must be YYYY-MM-DD' });
  // A new session supersedes any still-open one (e.g. browser closed mid-workout)
  db.prepare(
    "UPDATE sessions SET status = 'abandoned', finished_at = datetime('now') WHERE user_id = ? AND status = 'in_progress'"
  ).run(req.user.id);
  const scheme = activeScheme(req.user.id);
  const result = db.prepare(
    'INSERT INTO sessions (user_id, scheme_id, local_date, exercises_total) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, scheme ? scheme.id : null, localDate, Math.max(0, parseInt(exercisesTotal, 10) || 0));
  res.json({ id: result.lastInsertRowid });
});

app.patch('/api/sessions/:id', requireAuth, (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { exercisesCompleted, status } = req.body || {};
  if (exercisesCompleted !== undefined) {
    db.prepare('UPDATE sessions SET exercises_completed = ? WHERE id = ?')
      .run(Math.max(0, parseInt(exercisesCompleted, 10) || 0), session.id);
  }
  if (status !== undefined) {
    if (!['in_progress', 'completed', 'abandoned'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    db.prepare(
      "UPDATE sessions SET status = ?, finished_at = CASE WHEN ? IN ('completed','abandoned') THEN datetime('now') ELSE finished_at END WHERE id = ?"
    ).run(status, status, session.id);
  }

  const updated = db.prepare('SELECT * FROM sessions WHERE id = ?').get(session.id);
  res.json({
    session: updated,
    today: {
      date: updated.local_date,
      completed: todayStats(req.user.id, updated.local_date),
      goal: req.user.daily_goal,
    },
  });
});

app.get('/api/sessions', requireAuth, (req, res) => {
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));
  const rows = db.prepare(
    `SELECT id, status, local_date, exercises_total, exercises_completed, started_at, finished_at
     FROM sessions WHERE user_id = ? ORDER BY started_at DESC, id DESC LIMIT ?`
  ).all(req.user.id, limit);
  res.json({ sessions: rows, goal: req.user.daily_goal });
});

/* ============================== static app ============================== */

app.use(express.static(root));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gabby's Physio running at http://localhost:${PORT}`);
  console.log('Other devices on your network can use http://<this-computer-ip>:' + PORT);
});
