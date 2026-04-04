import { useState } from "react";
import type { DailySummaryItem } from "@domain/summary";
import { useDailySummary } from "../hooks";
import { completeTask } from "../api";
import { useTheme } from "../components/theme";
import { StatusDot, Badge, Button, Textarea } from "../components";
import { ContentCard } from "../components/ContentCard";
import { EmptyState } from "../components/molecules/EmptyState";
import { TaskDetailOverlay } from "./TaskDetailOverlay";

// ---------------------------------------------------------------------------
// MarkDoneButton
// ---------------------------------------------------------------------------

function MarkDoneButton({ taskId, onComplete }: { taskId: string; onComplete: () => void }) {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleDone() {
    setError(null);
    setBusy(true);
    try {
      await completeTask(taskId, note || undefined);
      setNote("");
      setShowNote(false);
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={handleDone}
        style={{ color: theme.color.success, borderColor: theme.color.success, whiteSpace: "nowrap", flexShrink: 0 }}
      >
        {busy ? "..." : "Done"}
      </Button>
      {error && <div style={{ color: theme.color.danger, fontSize: theme.font.size.xs, marginTop: 4, textAlign: "right" }}>{error}</div>}
      {!showNote && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowNote(true)}
          style={{ fontSize: theme.font.size.xs, padding: 0, border: "none", textDecoration: "underline", marginTop: 4 }}
        >
          + note
        </Button>
      )}
      {showNote && (
        <Textarea
          rows={2}
          placeholder="Completion note..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          autoFocus
          style={{ maxWidth: 200, marginTop: 8 }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SummaryItem
// ---------------------------------------------------------------------------

function SummaryItem({ item, variant, onComplete, onItemClick }: {
  item: DailySummaryItem;
  variant: "danger" | "primary" | "muted";
  onComplete: () => void;
  onItemClick: (taskId: string) => void;
}) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const statusColor = variant === "danger"
    ? theme.color.danger
    : variant === "primary"
      ? theme.color.success
      : theme.color.textMuted;

  return (
    <div style={{ padding: "12px 0", borderBottom: `1px solid ${theme.color.borderSubtle}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div
          style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
          role="button"
          tabIndex={0}
          onClick={() => onItemClick(item.task.id)}
          onKeyDown={(e) => e.key === "Enter" && onItemClick(item.task.id)}
        >
          <div style={{ fontSize: theme.font.size.md, fontWeight: 500, color: theme.color.text, display: "flex", alignItems: "center", gap: 6 }}>
            <StatusDot status={item.task.status} color={statusColor} />
            {item.task.title}
          </div>
          <div style={{ marginTop: 4 }}>
            {item.task.area && (
              <Badge variant="area">{item.task.area.replace(/_/g, " ")}</Badge>
            )}
            {item.recurrence_label && (
              <Badge variant="recurrence">{item.recurrence_label}</Badge>
            )}
            {variant === "danger" && item.days_overdue > 0 && (
              <Badge variant="overdue" style={{ fontWeight: 600 }}>{item.days_overdue}d overdue</Badge>
            )}
          </div>
          {item.schedule.next_due && variant === "muted" && (
            <div style={{ fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: 4 }}>Due: {item.schedule.next_due}</div>
          )}
          {(() => {
            const manualNotes = item.notes.filter((n) => n.note_type !== "completion");
            return manualNotes.length > 0 ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                  style={{ fontSize: theme.font.size.xs, padding: 0, border: "none", textDecoration: "underline", marginTop: 4 }}
                >
                  {expanded ? "hide" : `${manualNotes.length} note${manualNotes.length > 1 ? "s" : ""}`}
                </Button>
                {expanded && manualNotes.map((n) => (
                  <ContentCard
                    key={n.id}
                    variant="note"
                    style={{ marginTop: 4, padding: "6px 10px", fontSize: 12 }}
                  >
                    {n.title}
                  </ContentCard>
                ))}
              </>
            ) : null;
          })()}
        </div>
        <MarkDoneButton taskId={item.task.id} onComplete={onComplete} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SummarySection
// ---------------------------------------------------------------------------

function SummarySection({ title, variant, items, onComplete, onItemClick }: {
  title: string;
  variant: "danger" | "primary" | "muted";
  items: DailySummaryItem[];
  onComplete: () => void;
  onItemClick: (taskId: string) => void;
}) {
  const { theme } = useTheme();

  if (items.length === 0) return null;

  const sectionColor = variant === "danger"
    ? theme.color.danger
    : variant === "primary"
      ? theme.color.text
      : theme.color.textMuted;

  return (
    <section>
      <h2 style={{
        fontSize: theme.font.size.sm,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        padding: "8px 0",
        marginTop: 16,
        marginBottom: 8,
        borderBottom: `1px solid ${theme.color.border}`,
        color: sectionColor,
      }}>
        {title} ({items.length})
      </h2>
      {items.map((item) => (
        <SummaryItem key={item.task.id} item={item} variant={variant} onComplete={onComplete} onItemClick={onItemClick} />
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// DailySummaryPage
// ---------------------------------------------------------------------------

export function DailySummaryPage() {
  const { theme } = useTheme();
  const { summary, loading, error, refetch } = useDailySummary();
  const [overlayTaskId, setOverlayTaskId] = useState<string | null>(null);

  if (loading && !summary) {
    return (
      <div style={{ textAlign: "center", padding: `${theme.spacing["2xl"]} ${theme.spacing.lg}`, color: theme.color.textMuted }}>
        Loading today's summary...
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div style={{ textAlign: "center", padding: `${theme.spacing.xl} ${theme.spacing.lg}`, color: theme.color.danger }}>
        {error}
      </div>
    );
  }

  if (!summary) return null;

  const isEmpty = summary.counts.total === 0;

  return (
    <div style={{ width: "100%", maxWidth: 640, margin: "0 auto", padding: `${theme.spacing.xl} ${theme.spacing.lg}` }}>
      <div style={{
        fontSize: theme.font.size.sm,
        color: theme.color.textMuted,
        marginBottom: 24,
        textAlign: "center",
      }}>
        {new Date().toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </div>

      {isEmpty ? (
        <EmptyState icon="check_circle" message="All clear! Nothing due today. Enjoy your free time." />
      ) : (
        <>
          <SummarySection
            title="Overdue"
            variant="danger"
            items={summary.overdue}
            onComplete={refetch}
            onItemClick={setOverlayTaskId}
          />
          <SummarySection
            title="Due Today"
            variant="primary"
            items={summary.due_today}
            onComplete={refetch}
            onItemClick={setOverlayTaskId}
          />
          <SummarySection
            title="Upcoming"
            variant="muted"
            items={summary.upcoming}
            onComplete={refetch}
            onItemClick={setOverlayTaskId}
          />
        </>
      )}

      {overlayTaskId && (
        <TaskDetailOverlay taskId={overlayTaskId} onClose={() => setOverlayTaskId(null)} />
      )}
    </div>
  );
}
