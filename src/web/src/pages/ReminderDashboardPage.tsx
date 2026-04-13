import { useState, useMemo } from "react";
import { semantic as t } from "@4lt7ab/ui/core";
import {
  Card, Badge, Button, Stack, Skeleton, EmptyState,
  Textarea, ModalShell, ConfirmDialog, Field, Select, DatePicker,
  PageHeader, ExpandableCard,
} from "@4lt7ab/ui/ui";
import type { ReminderSummary, Recurrence } from "@domain/entities";
import { useReminders } from "../hooks";
import { createReminders, dismissReminders, updateReminders, deleteReminders } from "../api";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function getTodayBounds(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function getWeekBounds(weeksFromNow: number): { start: string; end: string } {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const sunday = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day + weeksFromNow * 7,
  ));
  const saturday = new Date(sunday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  return {
    start: sunday.toISOString(),
    end: saturday.toISOString(),
  };
}

function formatRemindAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/** Convert a Date object to midnight UTC ISO string (date-only precision). */
function dateToDayUtcIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`).toISOString();
}

const RECURRENCE_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

// ---------------------------------------------------------------------------
// CreateReminderOverlay
// ---------------------------------------------------------------------------

function CreateReminderOverlay({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: () => void;
}): React.JSX.Element {
  const [context, setContext] = useState("");
  const [remindAt, setRemindAt] = useState<Date | undefined>(undefined);
  const [recurrence, setRecurrence] = useState<Recurrence | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!context.trim()) { setError("Context is required"); return; }
    if (!remindAt) { setError("Date is required"); return; }
    setError(null);
    setBusy(true);
    try {
      await createReminders([{
        context: context.trim(),
        remind_at: dateToDayUtcIso(remindAt),
        recurrence: recurrence || undefined,
      }]);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create reminder");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h3 style={{ fontSize: t.fontSizeLg, fontWeight: 600, marginBottom: t.spaceLg }}>New Reminder</h3>
        <Stack gap="sm">
          <Field label="Reminder" htmlFor="reminder-context" required>
            <Textarea
              id="reminder-context"
              rows={3}
              placeholder="What do you want to be reminded about?"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Date" required>
            <DatePicker
              value={remindAt}
              onChange={(d) => setRemindAt(d)}
              placeholder="Pick a date"
            />
          </Field>
          <Field label="Recurrence">
            <Select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as Recurrence | "")}
              options={RECURRENCE_OPTIONS}
              placeholder="No recurrence"
            />
          </Field>
        </Stack>
        {error && <div style={{ color: t.colorError, fontSize: t.fontSizeXs, marginTop: t.spaceXs }}>{error}</div>}
        <Stack direction="row" gap="sm" style={{ marginTop: t.spaceLg, justifyContent: "flex-end" }}>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={busy}>{busy ? "Creating..." : "Create"}</Button>
        </Stack>
      </form>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// EditReminderOverlay
// ---------------------------------------------------------------------------

function EditReminderOverlay({ reminder, onClose, onChanged }: {
  reminder: ReminderSummary;
  onClose: () => void;
  onChanged: () => void;
}): React.JSX.Element {
  const [context, setContext] = useState(reminder.context);
  const [remindAt, setRemindAt] = useState<Date | undefined>(new Date(reminder.remind_at));
  const [recurrence, setRecurrence] = useState<Recurrence | "">(reminder.recurrence ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingDismiss, setConfirmingDismiss] = useState(false);

  const isDormant = !reminder.is_active;

  async function handleSave(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!context.trim()) { setError("Context is required"); return; }
    if (!remindAt) { setError("Date is required"); return; }
    setError(null);
    setBusy(true);
    try {
      await updateReminders([{
        id: reminder.id,
        context: context.trim(),
        remind_at: dateToDayUtcIso(remindAt),
        recurrence: recurrence || null,
      }]);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update reminder");
    } finally {
      setBusy(false);
    }
  }

  async function executeDismiss(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await dismissReminders([{ id: reminder.id }]);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dismiss");
    } finally {
      setBusy(false);
    }
  }

  async function executeDelete(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await deleteReminders([reminder.id]);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  const dismissMessage = reminder.recurrence
    ? `Repeats ${reminder.recurrence} — will advance to the next occurrence.`
    : "This is a one-time reminder and will go dormant.";

  return (
    <>
      <ModalShell onClose={onClose}>
        <form onSubmit={handleSave}>
          <h3 style={{ fontSize: t.fontSizeLg, fontWeight: 600, marginBottom: t.spaceLg }}>
            {isDormant ? "Dormant Reminder" : "Edit Reminder"}
          </h3>
          {isDormant && (
            <div style={{
              fontSize: t.fontSizeXs,
              color: t.colorTextMuted,
              background: t.colorSurfaceRaised,
              padding: `${t.spaceXs} ${t.spaceSm}`,
              borderRadius: t.radiusSm,
              marginBottom: t.spaceMd,
            }}>
              This reminder is dormant. Set a future date and save to reactivate it.
            </div>
          )}
          <Stack gap="sm">
            <Field label="Reminder" htmlFor="edit-context" required>
              <Textarea
                id="edit-context"
                rows={4}
                value={context}
                onChange={(e) => setContext(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Date" required>
              <DatePicker
                value={remindAt}
                onChange={(d) => setRemindAt(d)}
                placeholder="Pick a date"
              />
            </Field>
            <Field label="Recurrence">
              <Select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as Recurrence | "")}
                options={RECURRENCE_OPTIONS}
                placeholder="No recurrence"
              />
            </Field>
          </Stack>
          <div style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted, marginTop: t.spaceMd }}>
            Created {new Date(reminder.created_at).toLocaleString()}
            {reminder.dismissed_at && ` · Last dismissed ${new Date(reminder.dismissed_at).toLocaleString()}`}
          </div>
          {error && <div style={{ color: t.colorError, fontSize: t.fontSizeXs, marginTop: t.spaceXs }}>{error}</div>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: t.spaceLg }}>
            <div style={{ display: "flex", gap: t.spaceXs }}>
              <Button variant="destructive" size="sm" type="button" onClick={() => setConfirmingDelete(true)} disabled={busy}>
                Delete
              </Button>
              {!isDormant && (
                <Button variant="ghost" size="sm" type="button" onClick={() => setConfirmingDismiss(true)} disabled={busy}>
                  Dismiss
                </Button>
              )}
            </div>
            <Stack direction="row" gap="sm">
              <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
              <Button variant="primary" type="submit" disabled={busy}>{busy ? "Saving..." : "Save"}</Button>
            </Stack>
          </div>
        </form>
      </ModalShell>
      {confirmingDelete && (
        <ConfirmDialog
          title="Delete this reminder?"
          message={`"${reminder.context_preview}" will be permanently deleted.`}
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={executeDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
      {confirmingDismiss && (
        <ConfirmDialog
          title="Dismiss this reminder?"
          message={`${reminder.context_preview} · ${formatRemindAt(reminder.remind_at)} · ${dismissMessage}`}
          confirmLabel="Dismiss"
          variant="info"
          onConfirm={executeDismiss}
          onCancel={() => setConfirmingDismiss(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// ReminderCard
// ---------------------------------------------------------------------------

function ReminderCard({ reminder, onClick }: {
  reminder: ReminderSummary;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <Card>
      <div
        style={{ cursor: "pointer" }}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      >
        <div style={{ fontSize: t.fontSizeMd, fontWeight: 500 }}>{reminder.context_preview}</div>
        <div style={{ display: "flex", gap: t.spaceXs, marginTop: t.spaceXs, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted }}>
            {formatRemindAt(reminder.remind_at)}
          </div>
          {reminder.recurrence && <Badge variant="secondary">{reminder.recurrence}</Badge>}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// DormantReminderCard
// ---------------------------------------------------------------------------

function DormantReminderCard({ reminder, onClick }: {
  reminder: ReminderSummary;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <Card>
      <div
        style={{ cursor: "pointer" }}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      >
        <div style={{ fontSize: t.fontSizeMd, fontWeight: 500, color: t.colorTextMuted }}>{reminder.context_preview}</div>
        <div style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted, marginTop: t.spaceXs }}>
          was {formatRemindAt(reminder.remind_at)}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ReminderSection
// ---------------------------------------------------------------------------

function ReminderSection({ title, reminders, loading, error, emptyMessage, onEdit }: {
  title: string;
  reminders: ReminderSummary[];
  loading: boolean;
  error: string | null;
  emptyMessage: string;
  onEdit: (r: ReminderSummary) => void;
}): React.JSX.Element {
  return (
    <section style={{ marginBottom: t.spaceXl }}>
      <h2 style={{ fontSize: t.fontSizeLg, fontWeight: 600, marginBottom: t.spaceMd }}>{title}</h2>
      {error && <div style={{ color: t.colorError, fontSize: t.fontSizeSm, marginBottom: t.spaceMd }}>{error}</div>}
      {loading && reminders.length === 0 && (
        <Stack gap="sm">
          <Skeleton height={56} />
          <Skeleton height={56} />
        </Stack>
      )}
      {!loading && reminders.length === 0 && (
        <EmptyState icon="search" message={emptyMessage} />
      )}
      <Stack gap="sm">
        {reminders.map((r) => (
          <ReminderCard key={r.id} reminder={r} onClick={() => onEdit(r)} />
        ))}
      </Stack>
    </section>
  );
}

// ---------------------------------------------------------------------------
// ReminderDashboardPage
// ---------------------------------------------------------------------------

export function ReminderDashboardPage(): React.JSX.Element {
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ReminderSummary | null>(null);

  const today = useMemo(() => getTodayBounds(), []);
  const thisWeek = useMemo(() => getWeekBounds(0), []);
  const nextWeek = useMemo(() => getWeekBounds(1), []);

  const overdueData = useReminders({
    remind_at_to: today.start,
    status: "active",
    limit: 200,
  });

  const todayData = useReminders({
    remind_at_from: today.start,
    remind_at_to: today.end,
    status: "active",
    limit: 200,
  });

  // "This Week" excludes today to avoid duplicates
  const thisWeekData = useReminders({
    remind_at_from: new Date(new Date(today.end).getTime() + 1).toISOString(),
    remind_at_to: thisWeek.end,
    status: "active",
    limit: 200,
  });

  const nextWeekData = useReminders({
    remind_at_from: nextWeek.start,
    remind_at_to: nextWeek.end,
    status: "active",
    limit: 200,
  });

  const dormantData = useReminders({ status: "dormant", limit: 200 });

  function refetchAll(): void {
    overdueData.refetch();
    todayData.refetch();
    thisWeekData.refetch();
    nextWeekData.refetch();
    dormantData.refetch();
  }

  return (
    <div style={{
      maxWidth: 800,
      margin: "0 auto",
      padding: `${t.spaceXl} ${t.spaceLg}`,
    }}>
      <PageHeader
        title="Reminders"
        level={1}
        trailing={<Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>+ New Reminder</Button>}
        style={{ marginBottom: t.spaceLg }}
      />

      {(overdueData.reminders.length > 0 || overdueData.loading) && (
        <ReminderSection
          title="Overdue"
          reminders={overdueData.reminders}
          loading={overdueData.loading}
          error={overdueData.error}
          emptyMessage="No overdue reminders."
          onEdit={setEditing}
        />
      )}

      <ReminderSection
        title="Today"
        reminders={todayData.reminders}
        loading={todayData.loading}
        error={todayData.error}
        emptyMessage="No reminders today."
        onEdit={setEditing}
      />

      <ReminderSection
        title="This Week"
        reminders={thisWeekData.reminders}
        loading={thisWeekData.loading}
        error={thisWeekData.error}
        emptyMessage="No reminders this week."
        onEdit={setEditing}
      />

      <ReminderSection
        title="Next Week"
        reminders={nextWeekData.reminders}
        loading={nextWeekData.loading}
        error={nextWeekData.error}
        emptyMessage="No reminders next week."
        onEdit={setEditing}
      />

      {/* Dormant section */}
      <ExpandableCard
        title={`Dormant Reminders${dormantData.total > 0 ? ` (${dormantData.total})` : ""}`}
        variant="flat"
      >
        {dormantData.error && (
          <div style={{ color: t.colorError, fontSize: t.fontSizeSm, marginBottom: t.spaceMd }}>{dormantData.error}</div>
        )}
        {dormantData.loading && dormantData.reminders.length === 0 && (
          <Stack gap="sm">
            <Skeleton height={56} />
          </Stack>
        )}
        {!dormantData.loading && dormantData.reminders.length === 0 && (
          <EmptyState icon="search" message="No dormant reminders." />
        )}
        <Stack gap="sm">
          {dormantData.reminders.map((r) => (
            <DormantReminderCard
              key={r.id}
              reminder={r}
              onClick={() => setEditing(r)}
            />
          ))}
        </Stack>
      </ExpandableCard>

      {showCreate && (
        <CreateReminderOverlay
          onClose={() => setShowCreate(false)}
          onCreated={refetchAll}
        />
      )}

      {editing && (
        <EditReminderOverlay
          reminder={editing}
          onClose={() => setEditing(null)}
          onChanged={refetchAll}
        />
      )}
    </div>
  );
}
