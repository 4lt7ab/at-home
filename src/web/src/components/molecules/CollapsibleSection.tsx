/**
 * CollapsibleSection molecule -- SectionLabel header with collapsible body
 * using CSS grid animation.
 */
import { useState } from "react";
import { useTheme } from "../theme";
import { SectionLabel, Icon } from "../atoms";

export interface CollapsibleSectionProps {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function CollapsibleSection({
  label,
  defaultOpen = true,
  children,
  style,
}: CollapsibleSectionProps) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={style}>
      {/* Header */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: theme.spacing.xs,
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          marginBottom: open ? theme.spacing.sm : 0,
        }}
      >
        <Icon
          name="expand_more"
          size={14}
          style={{
            color: theme.color.textFaint,
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: `transform ${theme.motion.normal} ${theme.motion.easing}`,
          }}
        />
        <SectionLabel>{label}</SectionLabel>
      </button>

      {/* Collapsible body */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: `grid-template-rows ${theme.motion.normal} ${theme.motion.easing}`,
        }}
      >
        <div style={{ overflow: "hidden", minHeight: 0 }}>{children}</div>
      </div>
    </div>
  );
}
