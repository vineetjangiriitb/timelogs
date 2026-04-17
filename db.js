const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'sleeplogs.db');
const dbDir = path.dirname(dbPath);

fs.mkdirSync(dbDir, { recursive: true });

const preExisting = fs.existsSync(dbPath);
console.log(`[db] path=${dbPath}  existed_before=${preExisting}`);
if (!preExisting) {
  console.warn('[db] WARNING: database file did not exist — a fresh one will be created. If this happens after every deploy, your persistent volume is NOT mounted at this path.');
}

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    name TEXT,
    picture TEXT,
    display_name TEXT,
    age INTEGER,
    gender TEXT,
    sleep_goal_hours REAL DEFAULT 8,
    occupation TEXT,
    work_schedule TEXT,
    exercise_frequency TEXT,
    onboarding_complete INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS sleep_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sleep_start TEXT NOT NULL,
    sleep_end TEXT,
    duration_minutes REAL,
    quality INTEGER,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS study_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject TEXT DEFAULT 'General',
    session_start TEXT NOT NULL,
    session_end TEXT,
    duration_minutes REAL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS exercise_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    exercise_type TEXT NOT NULL,
    session_start TEXT NOT NULL,
    session_end TEXT,
    duration_minutes REAL,
    intensity TEXT DEFAULT 'moderate',
    calories INTEGER,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_sleep_start   ON sleep_records(sleep_start)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sleep_user    ON sleep_records(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_study_user    ON study_sessions(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_exercise_user ON exercise_logs(user_id)`);

module.exports = db;
