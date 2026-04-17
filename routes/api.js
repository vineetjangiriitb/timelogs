const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/health
router.get('/health', (req, res) => {
  res.json({ ok: true });
});

// GET /api/status - current active task
router.get('/status', (req, res) => {
  const active = db.prepare(
    'SELECT l.*, t.name as task_name, t.icon, t.color FROM task_logs l JOIN tasks t ON l.task_id = t.id WHERE l.user_id = ? AND l.end_time IS NULL'
  ).get(req.userId);

  if (active) {
    const elapsed = (Date.now() - new Date(active.start_time + 'Z').getTime()) / 60000;
    res.json({
      active: true,
      current_session: {
        id: active.id,
        task_id: active.task_id,
        task_name: active.task_name,
        color: active.color,
        icon: active.icon,
        start_time: active.start_time,
        elapsed_minutes: Math.round(elapsed)
      }
    });
  } else {
    res.json({ active: false, current_session: null });
  }
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

// POST /api/tasks/:id/start
router.post('/tasks/:id/start', (req, res) => {
  const taskId = req.params.id;
  const active = db.prepare('SELECT id FROM task_logs WHERE user_id = ? AND end_time IS NULL').get(req.userId);
  if (active) return res.status(409).json({ error: 'A task is already running. Please complete it first.' });

  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(taskId, req.userId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const now = new Date().toISOString().replace('Z', '').replace('T', ' ').slice(0, 19);
  const result = db.prepare('INSERT INTO task_logs (user_id, task_id, start_time) VALUES (?, ?, ?)')
    .run(req.userId, taskId, now);

  res.status(201).json({ id: result.lastInsertRowid, task_id: taskId, start_time: now, active: true });
});

// POST /api/tasks/stop
router.post('/tasks/stop', (req, res) => {
  const active = db.prepare('SELECT * FROM task_logs WHERE user_id = ? AND end_time IS NULL').get(req.userId);
  if (!active) return res.status(409).json({ error: 'No active task' });

  const now = new Date().toISOString().replace('Z', '').replace('T', ' ').slice(0, 19);
  const startTime = new Date(active.start_time + 'Z').getTime();
  const endTime = new Date(now + 'Z').getTime();
  const duration = (endTime - startTime) / 60000;

  db.prepare(`UPDATE task_logs SET end_time = ?, duration_minutes = ? WHERE id = ? AND user_id = ?`)
    .run(now, duration, active.id, req.userId);

  res.json({ id: active.id, end_time: now, duration_minutes: duration });
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
