import { useEffect, useState } from "react";
import { semantic as t } from "@4lt7ab/ui/core";
import { PALETTE } from "@domain/services/log-entries";
import { addLogEntryReaction } from "../api";

// ---------------------------------------------------------------------------
// ReactionStrip
// ---------------------------------------------------------------------------

/**
 * Inline emoji strip rendered under each log entry. Always shows all 9 PALETTE
 * chips; chips with a non-zero count display a small count badge. Tapping a
 * chip optimistically bumps the local count and POSTs to the reaction endpoint.
 * On error the optimistic bump is reverted. No decrement UX — count only goes up.
 *
 * The canonical reaction state lives server-side: `useLogEntries` subscribes
 * to the `log_entry` WebSocket channel and refetches, so remote reactions and
 * server-reconciled counts flow back in automatically. This component only
 * tracks the optimistic delta between the prop snapshot and the user's most
 * recent tap — when the `reactions` prop changes, we reset to that snapshot.
 */
export interface ReactionStripProps {
  /** Log id — required for the nested reaction route. */
  logId: string;
  /** Log entry id the reactions belong to. */
  entryId: string;
  /** Current reaction counts from the server, keyed by emoji. Unknown emojis render count 0. */
  reactions: ReadonlyArray<{ emoji: string; count: number }>;
  /**
   * Optional override for the POST — used in tests to avoid mocking the module.
   * Must resolve on success or throw on failure (same shape as `addLogEntryReaction`).
   */
  onReact?: (logId: string, entryId: string, emoji: string) => Promise<unknown>;
}

function buildCounts(reactions: ReadonlyArray<{ emoji: string; count: number }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const emoji of PALETTE) out[emoji] = 0;
  for (const r of reactions) {
    if (r.emoji in out) out[r.emoji] = r.count;
  }
  return out;
}

export function ReactionStrip({
  logId,
  entryId,
  reactions,
  onReact,
}: ReactionStripProps): React.JSX.Element {
  const [counts, setCounts] = useState<Record<string, number>>(() => buildCounts(reactions));

  useEffect(() => {
    setCounts(buildCounts(reactions));
  }, [reactions]);

  const reactFn = onReact ?? addLogEntryReaction;

  async function handleTap(emoji: string): Promise<void> {
    // Optimistic bump — updates UI before the server responds.
    setCounts((prev) => ({ ...prev, [emoji]: (prev[emoji] ?? 0) + 1 }));
    try {
      await reactFn(logId, entryId, emoji);
      // Leave the optimistic count in place; the WebSocket refetch via
      // useLogEntries will reconcile to the authoritative value on re-render.
    } catch {
      // Revert the optimistic bump on failure.
      setCounts((prev) => ({ ...prev, [emoji]: Math.max(0, (prev[emoji] ?? 1) - 1) }));
    }
  }

  return (
    <div
      role="group"
      aria-label="Reactions"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: t.spaceXs,
        marginTop: t.spaceXs,
      }}
    >
      {PALETTE.map((emoji) => {
        const count = counts[emoji] ?? 0;
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => handleTap(emoji)}
            aria-label={`React with ${emoji}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "2px",
              padding: "2px 6px",
              fontSize: t.fontSizeSm,
              lineHeight: 1,
              background: count > 0 ? t.colorSurfaceRaised : "transparent",
              border: `1px solid ${count > 0 ? t.colorBorder : "transparent"}`,
              borderRadius: t.radiusFull,
              cursor: "pointer",
              fontFamily: t.fontSans,
              color: t.colorText,
            }}
          >
            <span aria-hidden="true">{emoji}</span>
            {count > 0 && (
              <span
                data-testid={`reaction-count-${emoji}`}
                style={{
                  fontSize: "0.6rem",
                  fontFamily: t.fontMono,
                  color: t.colorTextMuted,
                  marginLeft: "2px",
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
