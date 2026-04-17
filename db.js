const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let dbPath = path.join(__dirname, 'data', 'sleeplogs.db');
if (process.env.RAILWAY_VOLUME_MOUNT_PATH) {
  dbPath = path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'sleeplogs.db');
} else if (process.env.DATABASE_PATH) {
  dbPath = process.env.DATABASE_PATH;
}
const dbDir = path.dirname(dbPath);

fs.mkdirSync(dbDir, { recursive: true });

const preExisting = fs.existsSync(dbPath);
console.log(`[db] path=${dbPath}  existed_before=${preExisting}`);

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
    dob TEXT,
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
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#7c3aed',
    icon TEXT DEFAULT '📌',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS task_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    task_id INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    duration_minutes REAL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_task_logs_start ON task_logs(start_time)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_task_logs_user ON task_logs(user_id)`);

module.exports = db;
