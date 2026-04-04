ALTER TABLE notes ADD COLUMN note_type TEXT NOT NULL DEFAULT 'manual';
UPDATE notes SET note_type = 'completion' WHERE title LIKE 'Completed: %';
CREATE INDEX idx_notes_note_type ON notes(note_type);
