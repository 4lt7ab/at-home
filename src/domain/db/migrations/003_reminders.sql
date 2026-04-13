CREATE TABLE reminders (
    id           TEXT PRIMARY KEY,
    context      TEXT NOT NULL,
    remind_at    TEXT NOT NULL,
    recurrence   TEXT,
    dismissed_at TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);
CREATE INDEX idx_reminders_remind_at ON reminders(remind_at);
CREATE INDEX idx_reminders_dismissed_at ON reminders(dismissed_at);
