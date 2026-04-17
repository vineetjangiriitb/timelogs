ALTER TABLE exercise_logs RENAME TO exercise_logs_old;

CREATE TABLE exercise_logs (
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
);

INSERT INTO exercise_logs (id, user_id, exercise_type, session_start, session_end, duration_minutes, intensity, calories, notes, created_at)
SELECT id, user_id, exercise_type, logged_at, datetime(logged_at, '+' || CAST(duration_minutes AS INTEGER) || ' minutes'), duration_minutes, intensity, calories, notes, created_at
FROM exercise_logs_old;

DROP TABLE exercise_logs_old;

CREATE INDEX idx_exercise_user ON exercise_logs(user_id);
