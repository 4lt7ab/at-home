-- Log entry reactions: emoji reactions on log entries. Count model (never decrements).
-- Palette is fixed and validated at the domain layer, not at the DB level.
CREATE TABLE log_entry_reactions (
    log_entry_id TEXT NOT NULL REFERENCES log_entries(id) ON DELETE CASCADE,
    emoji        TEXT NOT NULL,
    count        INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    UNIQUE (log_entry_id, emoji)
);

CREATE INDEX idx_log_entry_reactions_log_entry_id ON log_entry_reactions(log_entry_id);
