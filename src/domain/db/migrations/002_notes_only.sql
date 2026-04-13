-- Drop task-related tables
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS activity_log CASCADE;
DROP TABLE IF EXISTS home_tasks CASCADE;

-- Simplify notes table: remove task_id, note_type; rename content to context
ALTER TABLE notes DROP COLUMN IF EXISTS task_id;
ALTER TABLE notes DROP COLUMN IF EXISTS note_type;
ALTER TABLE notes RENAME COLUMN content TO context;

-- Drop stale indexes (task_id and note_type indexes were on dropped columns)
DROP INDEX IF EXISTS idx_notes_task_id;
DROP INDEX IF EXISTS idx_notes_note_type;
