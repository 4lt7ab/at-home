/**
 * Shared utility functions for the web UI.
 */

/**
 * Formats a completion activity log summary (JSON string) into a human-readable string.
 * Used by both DailySummaryPage (TaskDetailOverlay) and TaskDetailPage.
 */
export function formatCompletionSummary(summary: string): string {
  try {
    const data = JSON.parse(summary);
    const parts: string[] = [];
    if (data.next_due) parts.push(`next due: ${data.next_due}`);
    else if (data.next_due === null) parts.push("schedule complete");
    if (data.last_completed) parts.push(`completed: ${data.last_completed}`);
    return parts.length > 0 ? "Completed \u2014 " + parts.join(", ") : "Completed";
  } catch {
    return summary;
  }
}
