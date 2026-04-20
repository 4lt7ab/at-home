// Temporary compat shims for @4lt7ab/ui v1.0.0 migration.
//
// These three components were retired in @4lt7ab/ui v1.0.0 and have no
// drop-in exports. The v1.0.0-appropriate replacements (roll-your-own
// <div>+tokens for PageShell, <Header/> + <Stack> for SectionHeader,
// <Card> + useDisclosure() for ExpandableCard) are documented in
// docs/ui-v1-migration.md (Axis 1) and land in task
// 01KPM3JPWENK4TA2ZHVNSJ4G84 ("Replace retired @4lt7ab/ui components
// with documented replacements").
//
// This file only exists to keep `bun run build` compiling against v1.0.0
// types until that task rewrites the two call sites (LogsPage,
// ReminderDashboardPage). It intentionally forwards children without
// trying to fake the full visual behavior -- the migration task will
// rewrite the call sites before runtime correctness matters.
//
// REMOVE when task 01KPM3JPWENK4TA2ZHVNSJ4G84 lands.

import type { ReactNode } from "react";

type PageShellProps = {
  children?: ReactNode;
  maxWidth?: number | string;
  gap?: string;
};

export function PageShell({ children, maxWidth, gap }: PageShellProps): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth,
        margin: "0 auto",
        gap,
      }}
    >
      {children}
    </div>
  );
}

type SectionHeaderProps = {
  title: ReactNode;
  spacing?: string;
};

export function SectionHeader({ title }: SectionHeaderProps): React.JSX.Element {
  return <h2>{title}</h2>;
}

type ExpandableCardProps = {
  children?: ReactNode;
  title: ReactNode;
  variant?: string;
};

export function ExpandableCard({ children, title }: ExpandableCardProps): React.JSX.Element {
  return (
    <details>
      <summary>{title}</summary>
      {children}
    </details>
  );
}
