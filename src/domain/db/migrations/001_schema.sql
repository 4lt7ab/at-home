CREATE TABLE home_tasks (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    description TEXT,
    status      TEXT NOT NULL DEFAULT 'active',
    area        TEXT,
    effort      TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
CREATE INDEX idx_home_tasks_status ON home_tasks(status);
CREATE INDEX idx_home_tasks_area ON home_tasks(area);

CREATE TABLE notes (
    id         TEXT PRIMARY KEY,
    task_id    TEXT REFERENCES home_tasks(id) ON DELETE SET NULL,
    title      TEXT NOT NULL,
    content    TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX idx_notes_task_id ON notes(task_id);

CREATE TABLE schedules (
    id              TEXT PRIMARY KEY,
    task_id         TEXT NOT NULL REFERENCES home_tasks(id) ON DELETE CASCADE,
    recurrence_type TEXT NOT NULL,
    recurrence_rule TEXT,
    next_due        TEXT,
    last_completed  TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);
CREATE INDEX idx_schedules_task_id ON schedules(task_id);
CREATE INDEX idx_schedules_next_due ON schedules(next_due);
