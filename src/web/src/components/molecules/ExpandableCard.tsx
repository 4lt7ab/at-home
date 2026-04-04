/**
 * ExpandableCard molecule -- card with a collapsible body using CSS grid animation.
 */
import { useState } from "react";
import { useTheme } from "../theme";
import { Icon } from "../atoms";

export interface ExpandableCardProps {
  title: React.ReactNode;
  defaultOpen?: boolean;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function ExpandableCard({
  title,
  defaultOpen = false,
  headerAction,
  children,
  style,
}: ExpandableCardProps) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        background: theme.color.surfaceContainer,
        border: `1px solid ${theme.color.borderSubtle}`,
        borderRadius: theme.radius.lg,
        overflow: "hidden",
        ...style,
      }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
          background: "transparent",
          border: "none",
          color: theme.color.text,
          fontFamily: theme.font.body,
          fontSize: theme.font.size.sm,
          fontWeight: 600,
          cursor: "pointer",
          gap: theme.spacing.sm,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm }}>
          <Icon
            name="expand_more"
            size={18}
            style={{
              transform: open ? "rotate(0deg)" : "rotate(-90deg)",
              transition: `transform ${theme.motion.normal} ${theme.motion.easing}`,
            }}
          />
          {title}
        </span>
        {headerAction && (
          <span onClick={(e) => e.stopPropagation()}>{headerAction}</span>
        )}
      </button>

      {/* Collapsible body */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: `grid-template-rows ${theme.motion.normal} ${theme.motion.easing}`,
        }}
      >
        <div style={{ overflow: "hidden", minHeight: 0 }}>
          <div style={{ padding: `0 ${theme.spacing.lg} ${theme.spacing.lg}` }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
