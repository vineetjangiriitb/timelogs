const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/health
router.get('/health', (req, res) => {
  res.json({ ok: true });
});

// GET /api/tasks
router.get('/tasks', (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY id ASC').all(req.userId);
  res.json({ tasks });
});

// POST /api/tasks
router.post('/tasks', (req, res) => {
  const { name, color, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const result = db.prepare('INSERT INTO tasks (user_id, name, color, icon) VALUES (?, ?, ?, ?)').run(req.userId, name, color || '#7c3aed', icon || '📌');
  res.json({ id: result.lastInsertRowid, user_id: req.userId, name, color: color || '#7c3aed', icon: icon || '📌' });
});

// DELETE /api/tasks/:id
router.delete('/tasks/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ deleted: true });
});

// POST /api/tasks/:id/log — manually log an activity with start & end time
router.post('/tasks/:id/log', (req, res) => {
  const taskId = req.params.id;
  const { start_time, end_time, notes } = req.body;
  if (!start_time || !end_time) return res.status(400).json({ error: 'start_time and end_time required' });

  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(taskId, req.userId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const startMs = new Date(start_time).getTime();
  const endMs = new Date(end_time).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return res.status(400).json({ error: 'Invalid time' });
  if (endMs <= startMs) return res.status(400).json({ error: 'End time must be after start time' });

  const toSql = ms => new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
  const duration = (endMs - startMs) / 60000;

  const result = db.prepare(
    'INSERT INTO task_logs (user_id, task_id, start_time, end_time, duration_minutes, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.userId, taskId, toSql(startMs), toSql(endMs), duration, notes || null);

  res.status(201).json({ id: result.lastInsertRowid, task_id: taskId, start_time: toSql(startMs), end_time: toSql(endMs), duration_minutes: duration, notes: notes || null });
});

// GET /api/records
router.get('/records', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 19).replace('T', ' ');

  const records = db.prepare(`
    SELECT l.*, t.name as task_name, t.color, t.icon
    FROM task_logs l
    JOIN tasks t ON l.task_id = t.id
    WHERE l.user_id = ? AND l.end_time IS NOT NULL AND l.start_time >= ?
    ORDER BY l.start_time DESC
  `).all(req.userId, cutoff);

  res.json({ records, total: records.length });
});

// DELETE /api/records/:id
router.delete('/records/:id', (req, res) => {
  const result = db.prepare('DELETE FROM task_logs WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Record not found' });
  res.json({ deleted: true });
});

// GET /api/stats
router.get('/stats', (req, res) => {
  const days = parseInt(req.query.days) || 365;
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 19).replace('T', ' ');

  const total = db.prepare("SELECT COUNT(*) as count, IFNULL(SUM(duration_minutes), 0) as mins FROM task_logs WHERE user_id=? AND end_time IS NOT NULL AND start_time >= ?").get(req.userId, cutoff);
  const daily = db.prepare("SELECT DATE(start_time) as date, SUM(duration_minutes) as duration_minutes FROM task_logs WHERE user_id=? AND end_time IS NOT NULL AND start_time >= ? GROUP BY DATE(start_time) ORDER BY date ASC").all(req.userId, cutoff);

  res.json({ total_records: total.count, total_minutes: total.mins, daily });
});

module.exports = router;
