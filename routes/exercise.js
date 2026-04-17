const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/exercise/status
router.get('/status', (req, res) => {
  const active = db.prepare(
    'SELECT * FROM exercise_logs WHERE user_id = ? AND session_end IS NULL'
  ).get(req.userId);

  if (active) {
    const elapsed = (Date.now() - new Date(active.session_start + 'Z').getTime()) / 60000;
    res.json({ is_exercising: true, current_session: { ...active, elapsed_minutes: Math.round(elapsed) } });
  } else {
    res.json({ is_exercising: false, current_session: null });
  }
});

// POST /api/exercise/start
router.post('/start', (req, res) => {
  const active = db.prepare(
    'SELECT id FROM exercise_logs WHERE user_id = ? AND session_end IS NULL'
  ).get(req.userId);
  if (active) return res.status(409).json({ error: 'Already exercising' });

  const exercise_type = req.body.exercise_type || 'Gym';
  const now = nowStr();
  const result = db.prepare(
    'INSERT INTO exercise_logs (user_id, exercise_type, session_start) VALUES (?, ?, ?)'
  ).run(req.userId, exercise_type, now);

  res.status(201).json({ id: result.lastInsertRowid, exercise_type, session_start: now, status: 'exercising' });
});

// POST /api/exercise/stop
router.post('/stop', (req, res) => {
  const active = db.prepare(
    'SELECT * FROM exercise_logs WHERE user_id = ? AND session_end IS NULL'
  ).get(req.userId);
  if (!active) return res.status(409).json({ error: 'No active exercise session' });

  const now = nowStr();
  const duration = (new Date(now + 'Z') - new Date(active.session_start + 'Z')) / 60000;

  db.prepare(`
    UPDATE exercise_logs SET session_end = ?, duration_minutes = ?, notes = ?
    WHERE id = ? AND user_id = ?
  `).run(now, duration, req.body.notes || null, active.id, req.userId);

  res.json({ id: active.id, exercise_type: active.exercise_type, session_start: active.session_start,
    session_end: now, duration_minutes: Math.round(duration) });
});

// GET /api/exercise/records?days=30
router.get('/records', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const cutoff = cutoffStr(days);

  const records = db.prepare(`
    SELECT * FROM exercise_logs
    WHERE user_id = ? AND session_end IS NOT NULL AND session_start >= ?
    ORDER BY session_start DESC LIMIT 100
  `).all(req.userId, cutoff);

  res.json({ records });
});

// GET /api/exercise/stats?days=7
router.get('/stats', (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const cutoff = cutoffStr(days);

  const agg = db.prepare(`
    SELECT SUM(duration_minutes) as total_dur, COUNT(*) as total_workouts,
           AVG(duration_minutes) as avg_dur, SUM(calories) as total_calories
    FROM exercise_logs WHERE user_id = ? AND session_end IS NOT NULL AND session_start >= ?
  `).get(req.userId, cutoff);

  const daily = db.prepare(`
    SELECT DATE(session_start) as date, SUM(duration_minutes) as duration_minutes,
           COUNT(*) as workouts, SUM(calories) as calories
    FROM exercise_logs WHERE user_id = ? AND session_end IS NOT NULL AND session_start >= ?
    GROUP BY DATE(session_start) ORDER BY date ASC
  `).all(req.userId, cutoff);

  const byType = db.prepare(`
    SELECT exercise_type, SUM(duration_minutes) as total_minutes, COUNT(*) as workouts
    FROM exercise_logs WHERE user_id = ? AND session_end IS NOT NULL AND session_start >= ?
    GROUP BY exercise_type ORDER BY total_minutes DESC
  `).all(req.userId, cutoff);

  res.json({
    total_duration_minutes: Math.round(agg.total_dur || 0),
    total_workouts: agg.total_workouts || 0,
    avg_duration_minutes: Math.round(agg.avg_dur || 0),
    total_calories: agg.total_calories || 0,
    daily, byType
  });
});

// DELETE /api/exercise/:id
router.delete('/:id', (req, res) => {
  const r = db.prepare('DELETE FROM exercise_logs WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});

function nowStr() {
  return new Date().toISOString().replace('Z', '').replace('T', ' ').slice(0, 19);
}
function cutoffStr(days) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = router;
