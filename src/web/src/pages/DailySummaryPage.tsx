import { useState } from "react";
import { semantic as t, Card, Badge, Button, Stack, Skeleton, EmptyState, Input } from "@4lt7ab/ui/ui";
import type { DailySummaryItem } from "@domain/summary";
import { useDailySummary } from "../hooks";
import { completeTask } from "../api";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  onNavigate: (path: string) => void;
}

// ---------------------------------------------------------------------------
// SectionHeading
// ---------------------------------------------------------------------------

function SectionHeading({ children, count }: { children: React.ReactNode; count: number }): React.JSX.Element {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: t.spaceSm,
      padding: `${t.spaceSm} 0`,
    }}>
      <span style={{ fontSize: t.fontSizeLg, fontWeight: 600 }}>{children}</span>
      <Badge variant="secondary">{count}</Badge>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TaskRow
// ---------------------------------------------------------------------------

function TaskRow({ item, onNavigate }: { item: DailySummaryItem; onNavigate: (path: string) => void }): React.JSX.Element {
  const [completing, setCompleting] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [showNote, setShowNote] = useState(false);

  async function handleComplete(): Promise<void> {
    setCompleting(true);
    try {
      await completeTask(item.task.id, noteText || undefined);
      setNoteText("");
      setShowNote(false);
    } finally {
      setCompleting(false);
    }
  }

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: t.spaceMd }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: t.spaceSm, flexWrap: "wrap" }}>
            <button
              onClick={() => onNavigate(`/tasks/${item.task.id}`)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                fontSize: t.fontSizeMd,
                fontWeight: 600,
                fontFamily: t.fontSans,
                color: t.colorText,
                textAlign: "left",
              }}
            >
              {item.task.title}
            </button>
            {item.task.area && <Badge variant="secondary">{formatArea(item.task.area)}</Badge>}
            <Badge variant="secondary">{item.recurrence_label}</Badge>
            {item.days_overdue > 0 && (
              <Badge variant="destructive">
                {item.days_overdue}d overdue
              </Badge>
            )}
          </div>
          {item.schedule.next_due && (
            <div style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted, marginTop: t.spaceXs }}>
              Due: {item.schedule.next_due}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: t.spaceXs, flexShrink: 0 }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowNote(!showNote)}
          >
            Note
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={handleComplete}
            disabled={completing}
          >
            {completing ? "..." : "Done"}
          </Button>
        </div>
      </div>

      {showNote && (
        <div style={{ marginTop: t.spaceSm, display: "flex", gap: t.spaceXs }}>
          <Input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Optional completion note..."
            style={{ flex: 1 }}
            onKeyDown={(e) => { if (e.key === "Enter") handleComplete(); }}
          />
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatArea(area: string): string {
  return area.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// DailySummaryPage
// ---------------------------------------------------------------------------

export function DailySummaryPage({ onNavigate }: Props): React.JSX.Element {
  const { summary, loading, error } = useDailySummary();

  if (loading) {
    return (
      <PageShell>
        <Stack gap="md">
          <Skeleton height={60} />
          <Skeleton height={60} />
          <Skeleton height={60} />
        </Stack>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <EmptyState icon="error" message="Failed to load summary">{error}</EmptyState>
      </PageShell>
    );
  }

  if (!summary || summary.counts.total === 0) {
    return (
      <PageShell>
        <EmptyState icon="check-circle" message="All clear">No tasks due today or upcoming. Enjoy your free time.</EmptyState>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: t.spaceLg }}>
        <h1 style={{ fontSize: t.fontSize2xl, fontWeight: 700, margin: 0 }}>Today</h1>
        <span style={{ fontSize: t.fontSizeXs, color: t.colorTextMuted }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </span>
      </div>

      {summary.overdue.length > 0 && (
        <section>
          <SectionHeading count={summary.counts.overdue}>Overdue</SectionHeading>
          <Stack gap="sm">
            {summary.overdue.map((item) => (
              <TaskRow key={item.task.id} item={item} onNavigate={onNavigate} />
            ))}
          </Stack>
        </section>
      )}

      {summary.due_today.length > 0 && (
        <section style={{ marginTop: t.spaceLg }}>
          <SectionHeading count={summary.counts.due_today}>Due Today</SectionHeading>
          <Stack gap="sm">
            {summary.due_today.map((item) => (
              <TaskRow key={item.task.id} item={item} onNavigate={onNavigate} />
            ))}
          </Stack>
        </section>
      )}

      {summary.upcoming.length > 0 && (
        <section style={{ marginTop: t.spaceLg }}>
          <SectionHeading count={summary.counts.upcoming}>Upcoming</SectionHeading>
          <Stack gap="sm">
            {summary.upcoming.map((item) => (
              <TaskRow key={item.task.id} item={item} onNavigate={onNavigate} />
            ))}
          </Stack>
        </section>
      )}
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// PageShell
// ---------------------------------------------------------------------------

function PageShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div style={{
      maxWidth: 800,
      margin: "0 auto",
      padding: `${t.spaceXl} ${t.spaceLg}`,
    }}>
      {children}
    </div>
  );
}
