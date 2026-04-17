const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'sleeplogs-secret-change-in-production';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// POST /api/auth/google — verify Google ID token, create/find user, return JWT
router.post('/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: 'Missing credential' });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Find or create user
    let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
    if (!user) {
      const result = db.prepare(
        'INSERT INTO users (google_id, email, name, picture, display_name) VALUES (?, ?, ?, ?, ?)'
      ).run(googleId, email, name, picture, name);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    } else {
      // Update Google profile info on each login
      db.prepare('UPDATE users SET email = ?, name = ?, picture = ? WHERE id = ?')
        .run(email, name, picture, user.id);
      user.email = email;
      user.name = name;
      user.picture = picture;
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        display_name: user.display_name,
        onboarding_complete: !!user.onboarding_complete
      }
    });
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

// GET /api/auth/me — get current user profile
router.get('/me', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    display_name: user.display_name,
    dob: user.dob,
    gender: user.gender,
    sleep_goal_hours: user.sleep_goal_hours,
    occupation: user.occupation,
    work_schedule: user.work_schedule,
    exercise_frequency: user.exercise_frequency,
    onboarding_complete: !!user.onboarding_complete
  });
});

// PUT /api/auth/profile — update profile / complete onboarding
router.put('/profile', (req, res) => {
  const { display_name, dob, gender, sleep_goal_hours, occupation, work_schedule, exercise_frequency, onboarding_complete } = req.body;

  db.prepare(`
    UPDATE users SET
      display_name = COALESCE(?, display_name),
      dob = COALESCE(?, dob),
      gender = COALESCE(?, gender),
      sleep_goal_hours = COALESCE(?, sleep_goal_hours),
      occupation = COALESCE(?, occupation),
      work_schedule = COALESCE(?, work_schedule),
      exercise_frequency = COALESCE(?, exercise_frequency),
      onboarding_complete = COALESCE(?, onboarding_complete)
    WHERE id = ?
  `).run(
    display_name ?? null, dob ?? null, gender ?? null,
    sleep_goal_hours ?? null, occupation ?? null,
    work_schedule ?? null, exercise_frequency ?? null,
    onboarding_complete ?? null, req.userId
  );

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  res.json({
    id: user.id,
    display_name: user.display_name,
    dob: user.dob,
    gender: user.gender,
    sleep_goal_hours: user.sleep_goal_hours,
    occupation: user.occupation,
    work_schedule: user.work_schedule,
    exercise_frequency: user.exercise_frequency,
    onboarding_complete: !!user.onboarding_complete
  });
});

// Auth middleware
function authMiddleware(req, res, next) {
  // Skip auth for these paths
  if (req.path === '/auth/google' || req.path === '/health' || req.path === '/auth/client-id') {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// GET /api/auth/client-id — expose Google Client ID to frontend
router.get('/client-id', (req, res) => {
  res.json({ clientId: GOOGLE_CLIENT_ID || null });
});

module.exports = { router, authMiddleware };
