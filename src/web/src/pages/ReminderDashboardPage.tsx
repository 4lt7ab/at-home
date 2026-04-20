import { useState, useMemo } from "react";
import { semantic as t, staggerStyle, useDisclosure } from "@4lt7ab/ui/core";
import {
  Card, Badge, Button, IconButton, Stack, Skeleton, EmptyState,
  Select, Textarea, ModalShell, ConfirmDialog, Field, DatePicker,
  Header, IconChevronRight,
} from "@4lt7ab/ui/ui";
import type { ReminderSummary, Recurrence } from "@domain/entities";
import { useReminders } from "../hooks";
import { createReminders, dismissReminders, updateReminders, deleteReminders } from "../api";
import { formatRemindAt, dateToDayUtcIso, utcIsoToLocalDate, getTodayBounds, getWeekBounds } from "../utils";

const RECURRENCE_OPTIONS = [
  { value: "", label: "No recurrence" },
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
        <h3 style={{ fontSize: t.fontSizeLg, fontWeight: t.fontWeightSemibold, marginBottom: t.spaceLg }}>New Reminder</h3>
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
            <Select.Root
              value={recurrence}
              onValueChange={(v) => setRecurrence(v as Recurrence | "")}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {RECURRENCE_OPTIONS.map((o) => (
                  <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
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
// EditReminderOverlay
// ---------------------------------------------------------------------------

function EditReminderOverlay({ reminder, onClose, onChanged }: {
  reminder: ReminderSummary;
  onClose: () => void;
  onChanged: () => void;
}): React.JSX.Element {
  const [context, setContext] = useState(reminder.context);
  const [remindAt, setRemindAt] = useState<Date | undefined>(utcIsoToLocalDate(reminder.remind_at));
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
          <h3 style={{ fontSize: t.fontSizeLg, fontWeight: t.fontWeightSemibold, marginBottom: t.spaceLg }}>
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
              <Select.Root
                value={recurrence}
                onValueChange={(v) => setRecurrence(v as Recurrence | "")}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {RECURRENCE_OPTIONS.map((o) => (
                    <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
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
            <Stack direction="horizontal" gap="sm" justify="end">
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
// DismissConfirmOverlay — one-big-button confirmation, backdrop/Esc cancels
// ---------------------------------------------------------------------------

function DismissConfirmOverlay({ reminder, onClose, onDismissed }: {
  reminder: ReminderSummary;
  onClose: () => void;
  onDismissed: () => void;
}): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDismiss(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await dismissReminders([{ id: reminder.id }]);
      onDismissed();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dismiss");
      setBusy(false);
    }
  }

  const fate = reminder.recurrence
    ? `Advances to the next ${reminder.recurrence} occurrence.`
    : "This reminder will be removed.";

  return (
    <ModalShell onClose={onClose} maxWidth={420} role="alertdialog" aria-label="Confirm dismiss">
      <div style={{ textAlign: "center" }}>
        <div aria-hidden="true" style={{ fontSize: "2.5rem", lineHeight: 1, marginBottom: t.spaceSm }}>
          ✨
        </div>
        <h3 style={{ fontSize: t.fontSizeLg, fontWeight: t.fontWeightSemibold, margin: 0, marginBottom: t.spaceSm }}>
          Dismiss this reminder?
        </h3>
        <div style={{ fontSize: t.fontSizeSm, color: t.colorTextMuted, marginBottom: t.spaceLg }}>
          <div style={{ fontWeight: t.fontWeightMedium, color: t.colorText, marginBottom: t.spaceXs }}>
            {reminder.context_preview}
          </div>
          <div>{formatRemindAt(reminder.remind_at)}</div>
          <div style={{ marginTop: t.spaceXs }}>{fate}</div>
        </div>
        <Button
          variant="primary"
          size="lg"
          type="button"
          onClick={handleDismiss}
          disabled={busy}
          autoFocus
          aria-label="Confirm dismiss"
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: t.spaceXs, fontWeight: t.fontWeightSemibold, padding: `${t.spaceSm} ${t.spaceXl}`, fontSize: t.fontSizeBase }}>
            {busy ? "Dismissing…" : "Done! 🎉"}
          </span>
        </Button>
        {error && (
          <div role="alert" style={{ color: t.colorError, fontSize: t.fontSizeSm, marginTop: t.spaceSm }}>
            {error}
          </div>
        )}
        <div style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted, marginTop: t.spaceMd }}>
          Press Esc or click outside to cancel.
        </div>
      </div>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// ReminderCard
// ---------------------------------------------------------------------------

function ReminderCard({ reminder, onClick, onDismiss, index }: {
  reminder: ReminderSummary;
  onClick: () => void;
  onDismiss: () => void;
  index: number;
}): React.JSX.Element {
  return (
    <div style={staggerStyle(index)}>
      <Card hover padding="md">
        <div style={{ display: "flex", alignItems: "flex-start", gap: t.spaceSm }}>
          <div
            style={{ cursor: "pointer", flex: 1, minWidth: 0 }}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
          >
            <div style={{ fontSize: t.fontSizeSm, fontWeight: t.fontWeightMedium }}>{reminder.context_preview}</div>
            <div style={{ display: "flex", gap: t.spaceXs, marginTop: t.spaceXs, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted }}>
                {formatRemindAt(reminder.remind_at)}
              </div>
              {reminder.recurrence && <Badge variant="info">{reminder.recurrence}</Badge>}
            </div>
          </div>
          <IconButton
            icon="check"
            size={16}
            buttonSize="sm"
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            aria-label={`Dismiss "${reminder.context_preview}"`}
          />
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DormantReminderCard
// ---------------------------------------------------------------------------

function DormantReminderCard({ reminder, onClick, index }: {
  reminder: ReminderSummary;
  onClick: () => void;
  index: number;
}): React.JSX.Element {
  return (
    <div style={staggerStyle(index)}>
      <Card variant="flat" hover padding="md">
        <div
          style={{ cursor: "pointer" }}
          onClick={onClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
        >
          <div style={{ fontSize: t.fontSizeSm, fontWeight: t.fontWeightMedium, color: t.colorTextMuted }}>{reminder.context_preview}</div>
          <div style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted, marginTop: t.spaceXs }}>
            was {formatRemindAt(reminder.remind_at)}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReminderSection — only renders when it has content (or is loading)
// ---------------------------------------------------------------------------

function ReminderSection({ title, reminders, loading, error, onEdit, onDismiss, alwaysShow }: {
  title: string;
  reminders: ReminderSummary[];
  loading: boolean;
  error: string | null;
  onEdit: (r: ReminderSummary) => void;
  onDismiss: (r: ReminderSummary) => void;
  /** Show even when empty (e.g. "Today" as the anchor section). */
  alwaysShow?: boolean;
}): React.JSX.Element | null {
  const hasContent = reminders.length > 0 || loading;
  if (!hasContent && !alwaysShow) return null;

  return (
    <section>
      <Stack gap="sm">
        <Header title={title} />
        {error && <div style={{ color: t.colorError, fontSize: t.fontSizeSm, marginBottom: t.spaceMd }}>{error}</div>}
        {loading && reminders.length === 0 && (
          <Stack gap="sm">
            <Skeleton height={56} />
            <Skeleton height={56} />
          </Stack>
        )}
        {!loading && reminders.length === 0 && alwaysShow && (
          <div style={{
            padding: `${t.spaceLg} 0`,
            textAlign: "center",
            color: t.colorTextMuted,
            fontSize: t.fontSizeSm,
          }}>
            Nothing due today — you're all clear.
          </div>
        )}
        <Stack gap="sm">
          {reminders.map((r, i) => (
            <ReminderCard key={r.id} reminder={r} index={i} onClick={() => onEdit(r)} onDismiss={() => onDismiss(r)} />
          ))}
        </Stack>
      </Stack>
    </section>
  );
}

// ---------------------------------------------------------------------------
// DisclosureCard — local composition using useDisclosure() from @4lt7ab/core
// per docs/ui-v1-migration.md §4. The hook owns open state + ARIA wiring
// (aria-expanded, aria-controls, hidden); this component owns the
// chevron-and-title trigger layout. Collapsed by default via useDisclosure's
// defaultOpen=false.
// ---------------------------------------------------------------------------

function DisclosureCard({ title, children, defaultOpen }: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}): React.JSX.Element {
  const { open, triggerProps, contentProps } = useDisclosure({ defaultOpen });
  return (
    <Card variant="flat" padding="xs">
      <button
        type="button"
        {...triggerProps}
        style={{
          display: "flex",
          alignItems: "center",
          gap: t.spaceSm,
          padding: `${t.spaceSm} ${t.spaceMd}`,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "inherit",
          font: "inherit",
          width: "100%",
          textAlign: "left",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            transition: "transform 150ms",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          <IconChevronRight size={20} />
        </span>
        <span style={{ fontWeight: t.fontWeightSemibold, fontSize: t.fontSizeSm }}>{title}</span>
      </button>
      <div {...contentProps} style={{ padding: `${t.spaceSm} ${t.spaceMd} ${t.spaceMd}` }}>
        {children}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ReminderDashboardPage
// ---------------------------------------------------------------------------

export function ReminderDashboardPage(): React.JSX.Element {
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ReminderSummary | null>(null);
  const [dismissing, setDismissing] = useState<ReminderSummary | null>(null);

  const today = useMemo(() => getTodayBounds(), []);
  const thisWeek = useMemo(() => getWeekBounds(0), []);
  const nextWeek = useMemo(() => getWeekBounds(1), []);

  // Overdue = strictly before today (remind_at < today.start).
  // The repo uses <=, so subtract 1ms to get strict less-than.
  const overdueEnd = useMemo(
    () => new Date(new Date(today.start).getTime() - 1).toISOString(),
    [today.start],
  );

  const overdueData = useReminders({
    remind_at_to: overdueEnd,
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

  function handleQuickDismiss(reminder: ReminderSummary): void {
    // Don't fire the API yet — surface a confirmation first.
    setDismissing(reminder);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: 800,
        margin: "0 auto",
        gap: t.spaceLg,
      }}
    >
      {/* Compact toolbar — no redundant h1, the tab already says "Reminders" */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>+ New Reminder</Button>
      </div>

      {(overdueData.reminders.length > 0 || overdueData.loading) && (
        <ReminderSection
          title="Overdue"
          reminders={overdueData.reminders}
          loading={overdueData.loading}
          error={overdueData.error}
          onEdit={setEditing}
          onDismiss={handleQuickDismiss}
        />
      )}

      <ReminderSection
        title="Today"
        reminders={todayData.reminders}
        loading={todayData.loading}
        error={todayData.error}
        onEdit={setEditing}
        onDismiss={handleQuickDismiss}
        alwaysShow
      />

      <ReminderSection
        title="This Week"
        reminders={thisWeekData.reminders}
        loading={thisWeekData.loading}
        error={thisWeekData.error}
        onEdit={setEditing}
        onDismiss={handleQuickDismiss}
      />

      <ReminderSection
        title="Next Week"
        reminders={nextWeekData.reminders}
        loading={nextWeekData.loading}
        error={nextWeekData.error}
        onEdit={setEditing}
        onDismiss={handleQuickDismiss}
      />

      {/* Dormant section */}
      {(dormantData.reminders.length > 0 || dormantData.loading) && (
        <DisclosureCard
          title={`Dormant${dormantData.total > 0 ? ` (${dormantData.total})` : ""}`}
        >
          {dormantData.error && (
            <div style={{ color: t.colorError, fontSize: t.fontSizeSm, marginBottom: t.spaceMd }}>{dormantData.error}</div>
          )}
          {dormantData.loading && dormantData.reminders.length === 0 && (
            <Stack gap="sm">
              <Skeleton height={56} />
            </Stack>
          )}
          <Stack gap="sm">
            {dormantData.reminders.map((r, i) => (
              <DormantReminderCard
                key={r.id}
                reminder={r}
                index={i}
                onClick={() => setEditing(r)}
              />
            ))}
          </Stack>
        </DisclosureCard>
      )}

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

      {dismissing && (
        <DismissConfirmOverlay
          reminder={dismissing}
          onClose={() => setDismissing(null)}
          onDismissed={refetchAll}
        />
      )}
    </div>
  );
}
