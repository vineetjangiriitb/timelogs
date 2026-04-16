const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/health
router.get('/health', (req, res) => {
  res.json({ ok: true });
});

// GET /api/status - current sleep/awake state
router.get('/status', (req, res) => {
  const active = db.prepare('SELECT * FROM sleep_records WHERE sleep_end IS NULL').get();
  if (active) {
    const elapsed = (Date.now() - new Date(active.sleep_start + 'Z').getTime()) / 60000;
    res.json({
      is_sleeping: true,
      current_session: {
        id: active.id,
        sleep_start: active.sleep_start,
        elapsed_minutes: Math.round(elapsed)
      }
    });
  } else {
    res.json({ is_sleeping: false, current_session: null });
  }
});

// POST /api/sleep - start a sleep session
router.post('/sleep', (req, res) => {
  const active = db.prepare('SELECT id FROM sleep_records WHERE sleep_end IS NULL').get();
  if (active) {
    return res.status(409).json({ error: 'Already in a sleep session' });
  }

  const now = new Date().toISOString().replace('Z', '').replace('T', ' ').slice(0, 19);
  const result = db.prepare('INSERT INTO sleep_records (sleep_start) VALUES (?)').run(now);

  res.status(201).json({
    id: result.lastInsertRowid,
    sleep_start: now,
    sleep_end: null,
    duration_minutes: null,
    status: 'sleeping'
  });
});

// POST /api/wake - end a sleep session
router.post('/wake', (req, res) => {
  const active = db.prepare('SELECT * FROM sleep_records WHERE sleep_end IS NULL').get();
  if (!active) {
    return res.status(409).json({ error: 'No active sleep session' });
  }

  const now = new Date().toISOString().replace('Z', '').replace('T', ' ').slice(0, 19);
  const startTime = new Date(active.sleep_start + 'Z').getTime();
  const endTime = new Date(now + 'Z').getTime();
  const duration = (endTime - startTime) / 60000;

  const quality = req.body.quality || null;
  const notes = req.body.notes || null;

  db.prepare(`
    UPDATE sleep_records
    SET sleep_end = ?, duration_minutes = ?, quality = ?, notes = ?
    WHERE id = ?
  `).run(now, duration, quality, notes, active.id);

  res.json({
    id: active.id,
    sleep_start: active.sleep_start,
    sleep_end: now,
    duration_minutes: Math.round(duration),
    quality,
    status: 'awake'
  });
});

// GET /api/records?days=30&limit=50&offset=0
router.get('/records', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 19).replace('T', ' ');

  const records = db.prepare(`
    SELECT * FROM sleep_records
    WHERE sleep_end IS NOT NULL AND sleep_start >= ?
    ORDER BY sleep_start DESC
    LIMIT ? OFFSET ?
  `).all(cutoff, limit, offset);

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM sleep_records
    WHERE sleep_end IS NOT NULL AND sleep_start >= ?
  `).get(cutoff);

  res.json({ records, total: total.count });
});

// GET /api/stats?days=7
router.get('/stats', (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 19).replace('T', ' ');

  const agg = db.prepare(`
    SELECT
      AVG(duration_minutes) as avg_duration,
      MIN(duration_minutes) as min_duration,
      MAX(duration_minutes) as max_duration,
      COUNT(*) as total_records,
      AVG(quality) as avg_quality
    FROM sleep_records
    WHERE sleep_end IS NOT NULL AND sleep_start >= ?
  `).get(cutoff);

  const daily = db.prepare(`
    SELECT
      DATE(sleep_start) as date,
      SUM(duration_minutes) as duration_minutes,
      AVG(quality) as quality
    FROM sleep_records
    WHERE sleep_end IS NOT NULL AND sleep_start >= ?
    GROUP BY DATE(sleep_start)
    ORDER BY date ASC
  `).all(cutoff);

  // Calculate streak
  const allDays = db.prepare(`
    SELECT DISTINCT DATE(sleep_start) as date
    FROM sleep_records
    WHERE sleep_end IS NOT NULL
    ORDER BY date DESC
  `).all();

  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  let checkDate = new Date(today);

  for (const row of allDays) {
    const expected = checkDate.toISOString().slice(0, 10);
    if (row.date === expected) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (streak === 0 && row.date === new Date(checkDate.getTime() - 86400000).toISOString().slice(0, 10)) {
      // Allow streak to start from yesterday if no entry today yet
      checkDate.setDate(checkDate.getDate() - 1);
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  res.json({
    period_days: days,
    avg_duration_minutes: Math.round(agg.avg_duration || 0),
    min_duration_minutes: Math.round(agg.min_duration || 0),
    max_duration_minutes: Math.round(agg.max_duration || 0),
    total_records: agg.total_records,
    avg_quality: agg.avg_quality ? parseFloat(agg.avg_quality.toFixed(1)) : null,
    daily,
    current_streak: streak
  });
});

// DELETE /api/records/:id
router.delete('/records/:id', (req, res) => {
  const result = db.prepare('DELETE FROM sleep_records WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Record not found' });
  }
  res.json({ deleted: true });
});

module.exports = router;
