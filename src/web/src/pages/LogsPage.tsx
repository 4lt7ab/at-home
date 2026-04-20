import { useState, useCallback } from "react";
import { semantic as t, staggerStyle } from "@4lt7ab/ui/core";
import {
  Card, Button, IconButton, Stack, Skeleton, EmptyState,
  Input, Textarea, ModalShell, ConfirmDialog, Field, DatePicker,
} from "@4lt7ab/ui/ui";
// Retired in @4lt7ab/ui v1.0.0; shimmed locally until task 01KPM3JPWENK4TA2ZHVNSJ4G84
// rewrites these call sites per docs/ui-v1-migration.md Axis 1.
import { PageShell, SectionHeader } from "../components/ui-v1-compat";
import type { LogSummary, LogEntrySummary } from "@domain/entities";
import { useLogs, useLogEntries } from "../hooks";
import {
  createLogs,
  updateLogs,
  deleteLogs,
  createLogEntry,
  updateLogEntry,
  deleteLogEntry,
} from "../api";
import { formatRelativeTime } from "../utils";
import { ReactionStrip } from "../components/ReactionStrip";

// ---------------------------------------------------------------------------
// CreateLogOverlay
// ---------------------------------------------------------------------------

function CreateLogOverlay({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: () => void;
}): React.JSX.Element {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setBusy(true);
    setError(null);
    try {
      await createLogs([{ name: name.trim(), description: description.trim() || null }]);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create log");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h3 style={{ fontSize: t.fontSizeLg, fontWeight: t.fontWeightSemibold, marginBottom: t.spaceLg }}>New Log</h3>
        <Stack gap="sm">
          <Field label="Name" htmlFor="log-name" required>
            <Input
              id="log-name"
              placeholder="e.g. Plant watering"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Description" htmlFor="log-description">
            <Textarea
              id="log-description"
              rows={3}
              placeholder="Optional context about this log"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </Stack>
        {error && <div style={{ color: t.colorError, fontSize: t.fontSizeXs, marginTop: t.spaceXs }}>{error}</div>}
        <div style={{ marginTop: t.spaceLg }}>
          <Stack direction="horizontal" gap="sm" justify="end">
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={busy}>{busy ? "Creating..." : "Create"}</Button>
          </Stack>
        </div>
      </form>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// BackdateEntryOverlay
// ---------------------------------------------------------------------------

function BackdateEntryOverlay({ log, onClose, onCreated }: {
  log: LogSummary;
  onClose: () => void;
  onCreated: () => void;
}): React.JSX.Element {
  const [when, setWhen] = useState<Date | undefined>(new Date());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!when) { setError("Date is required"); return; }
    setBusy(true);
    setError(null);
    try {
      await createLogEntry(log.id, {
        occurred_at: when.toISOString(),
        note: note.trim() || null,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h3 style={{ fontSize: t.fontSizeLg, fontWeight: t.fontWeightSemibold, marginBottom: t.spaceLg }}>
          Log {log.name} — backdate
        </h3>
        <Stack gap="sm">
          <Field label="When" required>
            <DatePicker value={when} onChange={(d) => setWhen(d)} placeholder="Pick a date" />
          </Field>
          <Field label="Note" htmlFor="backdate-note">
            <Textarea
              id="backdate-note"
              rows={3}
              placeholder="Optional note about this entry"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </Stack>
        {error && <div style={{ color: t.colorError, fontSize: t.fontSizeXs, marginTop: t.spaceXs }}>{error}</div>}
        <div style={{ marginTop: t.spaceLg }}>
          <Stack direction="horizontal" gap="sm" justify="end">
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={busy}>{busy ? "Logging..." : "Log it"}</Button>
          </Stack>
        </div>
      </form>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// EditLogOverlay
// ---------------------------------------------------------------------------

function EditLogOverlay({ log, onClose, onChanged }: {
  log: LogSummary;
  onClose: () => void;
  onChanged: () => void;
}): React.JSX.Element {
  const [name, setName] = useState(log.name);
  const [description, setDescription] = useState(log.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSave(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setBusy(true);
    setError(null);
    try {
      await updateLogs([{ id: log.id, name: name.trim(), description: description.trim() || null }]);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update log");
    } finally {
      setBusy(false);
    }
  }

  async function executeDelete(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await deleteLogs([log.id]);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ModalShell onClose={onClose}>
        <form onSubmit={handleSave}>
          <h3 style={{ fontSize: t.fontSizeLg, fontWeight: t.fontWeightSemibold, marginBottom: t.spaceLg }}>Edit Log</h3>
          <Stack gap="sm">
            <Field label="Name" htmlFor="edit-log-name" required>
              <Input
                id="edit-log-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Description" htmlFor="edit-log-description">
              <Textarea
                id="edit-log-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
          </Stack>
          <div style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted, marginTop: t.spaceMd }}>
            {log.entry_count} {log.entry_count === 1 ? "entry" : "entries"}
            {log.last_logged_at && ` · last ${formatRelativeTime(log.last_logged_at)}`}
          </div>
          {error && <div style={{ color: t.colorError, fontSize: t.fontSizeXs, marginTop: t.spaceXs }}>{error}</div>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: t.spaceLg }}>
            <Button variant="destructive" size="sm" type="button" onClick={() => setConfirmingDelete(true)} disabled={busy}>
              Delete
            </Button>
            <Stack direction="horizontal" gap="sm" justify="end">
              <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
              <Button variant="primary" type="submit" disabled={busy}>{busy ? "Saving..." : "Save"}</Button>
            </Stack>
          </div>
        </form>
      </ModalShell>
      {confirmingDelete && (
        <ConfirmDialog
          title={`Delete "${log.name}"?`}
          message={`This will permanently delete the log and all ${log.entry_count} ${log.entry_count === 1 ? "entry" : "entries"}.`}
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={executeDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// EntryRow
// ---------------------------------------------------------------------------

function EntryRow({ entry, onEdit, onDelete, index }: {
  entry: LogEntrySummary;
  onEdit: () => void;
  onDelete: () => void;
  index: number;
}): React.JSX.Element {
  const when = new Date(entry.occurred_at);
  return (
    <div style={staggerStyle(index)}>
      <Card padding="sm">
        <div style={{ display: "flex", alignItems: "flex-start", gap: t.spaceSm }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: t.fontSizeSm, fontWeight: t.fontWeightMedium }}>
              {when.toLocaleString()}
            </div>
            <div style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted }}>
              {formatRelativeTime(entry.occurred_at)}
            </div>
            {entry.note && (
              <div style={{
                fontSize: t.fontSizeSm,
                color: t.colorText,
                marginTop: t.spaceXs,
                whiteSpace: "pre-wrap",
              }}>
                {entry.note}
              </div>
            )}
            {entry.has_metadata && (
              <div style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted, marginTop: t.spaceXs, fontStyle: "italic" }}>
                (has metadata)
              </div>
            )}
            <ReactionStrip
              logId={entry.log_id}
              entryId={entry.id}
              reactions={entry.reactions}
            />
          </div>
          <IconButton
            icon="edit"
            size={16}
            buttonSize="sm"
            onClick={onEdit}
            aria-label={`Edit entry`}
          />
          <IconButton
            icon="trash"
            size={16}
            buttonSize="sm"
            onClick={onDelete}
            aria-label={`Delete entry`}
          />
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditEntryOverlay (full metadata as JSON textarea)
// ---------------------------------------------------------------------------

function EditEntryOverlay({ entry, onClose, onChanged }: {
  entry: LogEntrySummary;
  onClose: () => void;
  onChanged: () => void;
}): React.JSX.Element {
  const [when, setWhen] = useState<Date | undefined>(new Date(entry.occurred_at));
  const [note, setNote] = useState(entry.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!when) { setError("Date is required"); return; }
    setBusy(true);
    setError(null);
    try {
      await updateLogEntry(entry.log_id, entry.id, {
        occurred_at: when.toISOString(),
        note: note.trim() || null,
      });
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update entry");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h3 style={{ fontSize: t.fontSizeLg, fontWeight: t.fontWeightSemibold, marginBottom: t.spaceLg }}>Edit Entry</h3>
        <Stack gap="sm">
          <Field label="When" required>
            <DatePicker value={when} onChange={(d) => setWhen(d)} placeholder="Pick a date" />
          </Field>
          <Field label="Note" htmlFor="edit-entry-note">
            <Textarea
              id="edit-entry-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </Stack>
        {error && <div style={{ color: t.colorError, fontSize: t.fontSizeXs, marginTop: t.spaceXs }}>{error}</div>}
        <div style={{ marginTop: t.spaceLg }}>
          <Stack direction="horizontal" gap="sm" justify="end">
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={busy}>{busy ? "Saving..." : "Save"}</Button>
          </Stack>
        </div>
      </form>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// LogCard — list view; expand to show recent entries and the "Log it" button.
// ---------------------------------------------------------------------------

function LogCard({ log, expanded, onToggle, onEdit, onLogIt, onBackdate, busy, index }: {
  log: LogSummary;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onLogIt: () => void;
  onBackdate: () => void;
  busy: boolean;
  index: number;
}): React.JSX.Element {
  return (
    <div style={staggerStyle(index)}>
      <Card hover padding="md">
        <div style={{ display: "flex", alignItems: "center", gap: t.spaceSm }}>
          <div
            role="button"
            tabIndex={0}
            onClick={onToggle}
            onKeyDown={(e) => { if (e.key === "Enter") onToggle(); }}
            style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
          >
            <div style={{ fontSize: t.fontSizeSm, fontWeight: t.fontWeightSemibold }}>{log.name}</div>
            <div style={{ display: "flex", gap: t.spaceSm, marginTop: t.spaceXs, fontSize: t.fontSizeXs, color: t.colorTextMuted, flexWrap: "wrap" }}>
              <span>
                {log.last_logged_at
                  ? `Last: ${formatRelativeTime(log.last_logged_at)}`
                  : "Never logged"}
              </span>
              <span>·</span>
              <span>{log.entry_count} {log.entry_count === 1 ? "entry" : "entries"}</span>
            </div>
            {log.description && (
              <div style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted, marginTop: t.spaceXs }}>
                {log.description}
              </div>
            )}
          </div>
          <Button
            variant="primary"
            size="sm"
            type="button"
            onClick={(e) => { e.stopPropagation(); onLogIt(); }}
            disabled={busy}
            aria-label={`Log it now for ${log.name}`}
          >
            Log it
          </Button>
          <IconButton
            icon="calendar"
            size={16}
            buttonSize="sm"
            onClick={(e) => { e.stopPropagation(); onBackdate(); }}
            aria-label={`Backdate entry for ${log.name}`}
          />
          <IconButton
            icon="edit"
            size={16}
            buttonSize="sm"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            aria-label={`Edit log ${log.name}`}
          />
        </div>
        {expanded && <LogEntriesList logId={log.id} />}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LogEntriesList — drill-down list of entries for a log.
// ---------------------------------------------------------------------------

function LogEntriesList({ logId }: { logId: string }): React.JSX.Element {
  const { entries, loading, error } = useLogEntries(logId, { limit: 50 });
  const [editing, setEditing] = useState<LogEntrySummary | null>(null);
  const [deleting, setDeleting] = useState<LogEntrySummary | null>(null);

  async function executeDelete(): Promise<void> {
    if (!deleting) return;
    try {
      await deleteLogEntry(deleting.log_id, deleting.id);
    } catch {
      // Surface failures via card-level error? Keep it simple — ignore; next refetch will show state.
    }
    setDeleting(null);
  }

  return (
    <div style={{ marginTop: t.spaceMd, borderTop: `1px solid ${t.colorBorder}`, paddingTop: t.spaceMd }}>
      {error && <div style={{ color: t.colorError, fontSize: t.fontSizeXs }}>{error}</div>}
      {loading && entries.length === 0 && <Skeleton height={40} />}
      {!loading && entries.length === 0 && (
        <div style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted, padding: t.spaceSm }}>
          No entries yet — tap "Log it" to record one.
        </div>
      )}
      <Stack gap="sm">
        {entries.map((entry, i) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            index={i}
            onEdit={() => setEditing(entry)}
            onDelete={() => setDeleting(entry)}
          />
        ))}
      </Stack>
      {editing && (
        <EditEntryOverlay
          entry={editing}
          onClose={() => setEditing(null)}
          onChanged={() => { /* websocket refetch handles it */ }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this entry?"
          message={`Entry from ${new Date(deleting.occurred_at).toLocaleString()} will be permanently deleted.`}
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={executeDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LogsPage
// ---------------------------------------------------------------------------

export function LogsPage(): React.JSX.Element {
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<LogSummary | null>(null);
  const [backdating, setBackdating] = useState<LogSummary | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loggingIds, setLoggingIds] = useState<Set<string>>(new Set());

  const { logs, loading, error, refetch } = useLogs({ limit: 200 });

  const handleLogIt = useCallback(async (log: LogSummary) => {
    setLoggingIds((prev) => new Set(prev).add(log.id));
    try {
      await createLogEntry(log.id);
      // websocket refetch handles refresh of last_logged_at/entry_count
    } catch {
      // On error surface nothing for now — try again
      refetch();
    } finally {
      setLoggingIds((prev) => {
        const next = new Set(prev);
        next.delete(log.id);
        return next;
      });
    }
  }, [refetch]);

  return (
    <PageShell maxWidth={800} gap="lg">
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>+ New Log</Button>
      </div>

      {error && <div style={{ color: t.colorError, fontSize: t.fontSizeSm }}>{error}</div>}

      <section>
        <SectionHeader title="Logs" spacing="sm" />
        {loading && logs.length === 0 && (
          <Stack gap="sm">
            <Skeleton height={72} />
            <Skeleton height={72} />
            <Skeleton height={72} />
          </Stack>
        )}
        {!loading && logs.length === 0 && (
          <EmptyState
            message="No logs yet — create one to track things like 'Plant watering' or 'Trash out'."
          />
        )}
        <Stack gap="sm">
          {logs.map((log, i) => (
            <LogCard
              key={log.id}
              log={log}
              index={i}
              expanded={expandedId === log.id}
              onToggle={() => setExpandedId((id) => (id === log.id ? null : log.id))}
              onEdit={() => setEditing(log)}
              onLogIt={() => handleLogIt(log)}
              onBackdate={() => setBackdating(log)}
              busy={loggingIds.has(log.id)}
            />
          ))}
        </Stack>
      </section>

      {showCreate && (
        <CreateLogOverlay
          onClose={() => setShowCreate(false)}
          onCreated={refetch}
        />
      )}

      {editing && (
        <EditLogOverlay
          log={editing}
          onClose={() => setEditing(null)}
          onChanged={refetch}
        />
      )}

      {backdating && (
        <BackdateEntryOverlay
          log={backdating}
          onClose={() => setBackdating(null)}
          onCreated={refetch}
        />
      )}
    </PageShell>
  );
}
