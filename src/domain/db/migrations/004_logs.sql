-- Logs feature: definitions and past-fact entries.
CREATE TABLE logs (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE log_entries (
    id          TEXT PRIMARY KEY,
    log_id      TEXT NOT NULL REFERENCES logs(id) ON DELETE CASCADE,
    occurred_at TEXT NOT NULL,
    note        TEXT,
    metadata    JSONB,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX idx_log_entries_log_id ON log_entries(log_id);
CREATE INDEX idx_log_entries_occurred_at ON log_entries(occurred_at);
