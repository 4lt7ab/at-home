import { useState, useMemo } from "react";
import { semantic as t } from "@4lt7ab/ui/core";
import {
  Card, Badge, Button, Stack, Skeleton, EmptyState,
  Input, Textarea, ModalShell,
} from "@4lt7ab/ui/ui";
import type { ReminderSummary, Recurrence } from "@domain/entities";
import { useReminders } from "../hooks";
import { createReminders, dismissReminders, updateReminders } from "../api";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

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
  const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${day} at ${time}`;
}

function localToUtcIso(localDatetimeValue: string): string {
  return new Date(localDatetimeValue).toISOString();
}

// ---------------------------------------------------------------------------
// CreateReminderOverlay
// ---------------------------------------------------------------------------

function CreateReminderOverlay({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: () => void;
}): React.JSX.Element {
  const [context, setContext] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!context.trim() || !remindAt) return;
    setError(null);
    setBusy(true);
    try {
      await createReminders([{
        context: context.trim(),
        remind_at: localToUtcIso(remindAt),
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
          <Textarea
            rows={3}
            placeholder="What do you want to be reminded about?"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            autoFocus
          />
          <Input
            type="datetime-local"
            value={remindAt}
            onChange={(e) => setRemindAt(e.target.value)}
          />
          <select
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as Recurrence | "")}
            style={{
              padding: `${t.spaceXs} ${t.spaceSm}`,
              fontSize: t.fontSizeSm,
              borderRadius: t.radiusSm,
              border: `1px solid ${t.colorBorder}`,
              background: t.colorSurface,
              color: t.colorText,
            }}
          >
            <option value="">No recurrence</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
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
// ReactivateOverlay
// ---------------------------------------------------------------------------

function ReactivateOverlay({ reminder, onClose, onReactivated }: {
  reminder: ReminderSummary;
  onClose: () => void;
  onReactivated: () => void;
}): React.JSX.Element {
  const [remindAt, setRemindAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!remindAt) return;
    setError(null);
    setBusy(true);
    try {
      await updateReminders([{ id: reminder.id, remind_at: localToUtcIso(remindAt) }]);
      onReactivated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reactivate reminder");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h3 style={{ fontSize: t.fontSizeLg, fontWeight: 600, marginBottom: t.spaceLg }}>Reactivate Reminder</h3>
        <div style={{ fontSize: t.fontSizeSm, color: t.colorTextMuted, marginBottom: t.spaceMd }}>
          {reminder.context_preview}
        </div>
        <Input
          type="datetime-local"
          value={remindAt}
          onChange={(e) => setRemindAt(e.target.value)}
          autoFocus
        />
        {error && <div style={{ color: t.colorError, fontSize: t.fontSizeXs, marginTop: t.spaceXs }}>{error}</div>}
        <Stack direction="row" gap="sm" style={{ marginTop: t.spaceLg, justifyContent: "flex-end" }}>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={busy}>{busy ? "Setting..." : "Set"}</Button>
        </Stack>
      </form>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// ReminderCard
// ---------------------------------------------------------------------------

function ReminderCard({ reminder, onDismiss, confirmDismiss }: {
  reminder: ReminderSummary;
  onDismiss?: () => void;
  confirmDismiss?: boolean;
}): React.JSX.Element {
  const [dismissing, setDismissing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function executeDismiss(): Promise<void> {
    setDismissing(true);
    setError(null);
    setConfirming(false);
    try {
      await dismissReminders([{ id: reminder.id }]);
      onDismiss?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dismiss");
    } finally {
      setDismissing(false);
    }
  }

  function handleDismissClick(): void {
    if (confirmDismiss) {
      setConfirming(true);
    } else {
      executeDismiss();
    }
  }

  return (
    <>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: t.spaceSm }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: t.fontSizeMd, fontWeight: 500 }}>{reminder.context_preview}</div>
            <div style={{ display: "flex", gap: t.spaceXs, marginTop: t.spaceXs, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted }}>
                {formatRemindAt(reminder.remind_at)}
              </div>
              {reminder.recurrence && <Badge variant="secondary">{reminder.recurrence}</Badge>}
            </div>
            {error && <div style={{ fontSize: t.fontSizeXs, color: t.colorError, marginTop: t.spaceXs }}>{error}</div>}
          </div>
          {onDismiss && (
            <Button variant="secondary" size="sm" onClick={handleDismissClick} disabled={dismissing}>
              {dismissing ? "..." : "Dismiss"}
            </Button>
          )}
        </div>
      </Card>
      {confirming && (
        <ModalShell onClose={() => setConfirming(false)}>
          <h3 style={{ fontSize: t.fontSizeLg, fontWeight: 600, marginBottom: t.spaceMd }}>Dismiss this reminder?</h3>
          <div style={{ fontSize: t.fontSizeSm, marginBottom: t.spaceSm }}>{reminder.context_preview}</div>
          <div style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted, marginBottom: t.spaceLg }}>
            {formatRemindAt(reminder.remind_at)}
            {reminder.recurrence
              ? ` · Repeats ${reminder.recurrence} — will advance to the next occurrence.`
              : " · This is a one-time reminder and will go dormant."}
          </div>
          <Stack direction="row" gap="sm" style={{ justifyContent: "flex-end" }}>
            <Button variant="secondary" type="button" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button variant="primary" type="button" onClick={executeDismiss} disabled={dismissing}>
              {dismissing ? "Dismissing..." : "Dismiss"}
            </Button>
          </Stack>
        </ModalShell>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// DormantReminderCard
// ---------------------------------------------------------------------------

function DormantReminderCard({ reminder, onReactivate }: {
  reminder: ReminderSummary;
  onReactivate: () => void;
}): React.JSX.Element {
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: t.spaceSm }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: t.fontSizeMd, fontWeight: 500, color: t.colorTextMuted }}>{reminder.context_preview}</div>
          <div style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted, marginTop: t.spaceXs }}>
            was {formatRemindAt(reminder.remind_at)}
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onReactivate}>Reactivate</Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ReminderSection
// ---------------------------------------------------------------------------

function ReminderSection({ title, reminders, loading, error, emptyMessage, onDismiss, confirmDismiss }: {
  title: string;
  reminders: ReminderSummary[];
  loading: boolean;
  error: string | null;
  emptyMessage: string;
  onDismiss: () => void;
  confirmDismiss?: boolean;
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
          <ReminderCard key={r.id} reminder={r} onDismiss={onDismiss} confirmDismiss={confirmDismiss} />
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
  const [showDormant, setShowDormant] = useState(false);
  const [reactivating, setReactivating] = useState<ReminderSummary | null>(null);

  const thisWeek = useMemo(() => getWeekBounds(0), []);
  const nextWeek = useMemo(() => getWeekBounds(1), []);

  const overdueData = useReminders({
    remind_at_to: thisWeek.start,
    status: "active",
    limit: 200,
  });

  const thisWeekData = useReminders({
    remind_at_from: thisWeek.start,
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

  function handleCreated(): void {
    overdueData.refetch();
    thisWeekData.refetch();
    nextWeekData.refetch();
  }

  function handleDismissed(): void {
    overdueData.refetch();
    thisWeekData.refetch();
    nextWeekData.refetch();
    dormantData.refetch();
  }

  function handleReactivated(): void {
    overdueData.refetch();
    dormantData.refetch();
    thisWeekData.refetch();
    nextWeekData.refetch();
  }

  return (
    <div style={{
      maxWidth: 800,
      margin: "0 auto",
      padding: `${t.spaceXl} ${t.spaceLg}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: t.spaceLg }}>
        <h1 style={{ fontSize: t.fontSize2xl, fontWeight: 700, margin: 0 }}>Reminders</h1>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>+ New Reminder</Button>
      </div>

      {(overdueData.reminders.length > 0 || overdueData.loading) && (
        <ReminderSection
          title="Overdue"
          reminders={overdueData.reminders}
          loading={overdueData.loading}
          error={overdueData.error}
          emptyMessage="No overdue reminders."
          onDismiss={handleDismissed}
        />
      )}

      <ReminderSection
        title="This Week"
        reminders={thisWeekData.reminders}
        loading={thisWeekData.loading}
        error={thisWeekData.error}
        emptyMessage="No reminders this week."
        onDismiss={handleDismissed}
      />

      <ReminderSection
        title="Next Week"
        reminders={nextWeekData.reminders}
        loading={nextWeekData.loading}
        error={nextWeekData.error}
        emptyMessage="No reminders next week."
        onDismiss={handleDismissed}
        confirmDismiss
      />

      {/* Dormant section */}
      <section>
        <button
          type="button"
          onClick={() => setShowDormant((v) => !v)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: t.colorTextSecondary,
            fontSize: t.fontSizeMd,
            fontWeight: 600,
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: t.spaceXs,
          }}
        >
          <span style={{
            display: "inline-block",
            transition: "transform 0.15s",
            transform: showDormant ? "rotate(90deg)" : "rotate(0deg)",
          }}>
            &#9654;
          </span>
          Dormant Reminders
          {dormantData.total > 0 && (
            <Badge variant="secondary">{dormantData.total}</Badge>
          )}
        </button>

        {showDormant && (
          <div style={{ marginTop: t.spaceMd }}>
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
                  onReactivate={() => setReactivating(r)}
                />
              ))}
            </Stack>
          </div>
        )}
      </section>

      {showCreate && (
        <CreateReminderOverlay
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      {reactivating && (
        <ReactivateOverlay
          reminder={reactivating}
          onClose={() => setReactivating(null)}
          onReactivated={handleReactivated}
        />
      )}
    </div>
  );
}
