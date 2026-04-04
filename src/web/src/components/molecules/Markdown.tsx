/**
 * Markdown molecule -- renders markdown text with theme-aware styling.
 *
 * Migrated from MarkdownContent.tsx. Uses react-markdown with inline styles
 * driven by theme tokens (no CSS variables). Component overrides are
 * memoized per theme via useMemo keyed on themeName.
 */

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { useTheme } from "../theme";
import type { Theme } from "../theme";

// ---------------------------------------------------------------------------
// Plain-text helper (for previews / truncated views)
// ---------------------------------------------------------------------------

/**
 * Strips common markdown syntax to produce readable plain text.
 * Used when showing truncated note previews where rendering markdown
 * would look broken (e.g. half a link, unclosed bold).
 */
export function stripMarkdown(text: string): string {
  return text
    // Remove images ![alt](url)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Convert links [text](url) to just text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Remove heading markers
    .replace(/^#{1,6}\s+/gm, "")
    // Remove bold/italic markers
    .replace(/(\*{1,3}|_{1,3})(.+?)\1/g, "$2")
    // Remove inline code backticks
    .replace(/`([^`]+)`/g, "$1")
    // Remove fenced code block markers
    .replace(/^```[\s\S]*?^```/gm, "")
    // Remove blockquote markers
    .replace(/^>\s?/gm, "")
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // Remove list markers
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/^[\s]*\d+\.\s+/gm, "")
    // Collapse multiple newlines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Theme-aware markdown style builder
// ---------------------------------------------------------------------------

function buildMarkdownStyles(theme: Theme): Record<string, React.CSSProperties> {
  return {
    h1: {
      fontSize: 18,
      fontWeight: 600,
      margin: "12px 0 6px",
      lineHeight: 1.3,
      color: theme.color.text,
    },
    h2: {
      fontSize: 16,
      fontWeight: 600,
      margin: "10px 0 4px",
      lineHeight: 1.3,
      color: theme.color.text,
    },
    h3: {
      fontSize: 14,
      fontWeight: 600,
      margin: "8px 0 4px",
      lineHeight: 1.3,
      color: theme.color.text,
    },
    h4: {
      fontSize: 13,
      fontWeight: 600,
      margin: "8px 0 4px",
      lineHeight: 1.3,
      color: theme.color.text,
    },
    p: {
      margin: "4px 0",
    },
    ul: {
      margin: "4px 0",
      paddingLeft: 20,
    },
    ol: {
      margin: "4px 0",
      paddingLeft: 20,
    },
    li: {
      margin: "2px 0",
    },
    blockquote: {
      margin: "6px 0",
      padding: "4px 12px",
      borderLeft: `3px solid ${theme.color.border}`,
      color: theme.color.textMuted,
      fontStyle: "italic",
    },
    code: {
      fontSize: 12,
      fontFamily: theme.font.mono,
      background: theme.color.surfaceContainerHigh,
      color: theme.color.text,
      padding: "1px 4px",
      borderRadius: 3,
    },
    pre: {
      margin: "6px 0",
      padding: "8px 12px",
      background: theme.color.surfaceContainerHigh,
      borderRadius: 4,
      overflow: "auto",
      fontSize: 12,
      lineHeight: 1.5,
      border: `1px solid ${theme.color.borderSubtle}`,
    },
    a: {
      color: theme.color.primary,
      textDecoration: "underline",
    },
    hr: {
      border: "none",
      borderTop: `1px solid ${theme.color.border}`,
      margin: "8px 0",
    },
    img: {
      maxWidth: "100%",
      borderRadius: 4,
    },
    table: {
      width: "100%",
      borderCollapse: "collapse" as const,
      margin: "6px 0",
      fontSize: 12,
    },
    th: {
      textAlign: "left" as const,
      padding: "4px 8px",
      borderBottom: `2px solid ${theme.color.border}`,
      fontWeight: 600,
    },
    td: {
      padding: "4px 8px",
      borderBottom: `1px solid ${theme.color.borderSubtle}`,
    },
  };
}

function makeComponents(theme: Theme) {
  const ms = buildMarkdownStyles(theme);
  return {
    h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h1 style={ms.h1} {...props} />,
    h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h2 style={ms.h2} {...props} />,
    h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h3 style={ms.h3} {...props} />,
    h4: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h4 style={ms.h4} {...props} />,
    h5: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h5 style={ms.h4} {...props} />,
    h6: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h6 style={ms.h4} {...props} />,
    p: (props: React.HTMLAttributes<HTMLParagraphElement>) => <p style={ms.p} {...props} />,
    ul: (props: React.HTMLAttributes<HTMLUListElement>) => <ul style={ms.ul} {...props} />,
    ol: (props: React.HTMLAttributes<HTMLOListElement>) => <ol style={ms.ol} {...props} />,
    li: (props: React.HTMLAttributes<HTMLLIElement>) => <li style={ms.li} {...props} />,
    blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => <blockquote style={ms.blockquote} {...props} />,
    a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a style={ms.a} target="_blank" rel="noopener noreferrer" {...props} />,
    hr: (props: React.HTMLAttributes<HTMLHRElement>) => <hr style={ms.hr} {...props} />,
    img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img style={ms.img} {...props} />,
    table: (props: React.TableHTMLAttributes<HTMLTableElement>) => <table style={ms.table} {...props} />,
    th: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => <th style={ms.th} {...props} />,
    td: (props: React.TdHTMLAttributes<HTMLTableCellElement>) => <td style={ms.td} {...props} />,
    pre: (props: React.HTMLAttributes<HTMLPreElement>) => <pre style={ms.pre} {...props} />,
    code: ({ children, className, ...rest }: React.HTMLAttributes<HTMLElement>) => {
      const isBlock = typeof className === "string" && className.startsWith("language-");
      return (
        <code
          style={isBlock ? { fontFamily: ms.code.fontFamily, fontSize: ms.code.fontSize } : ms.code}
          className={className}
          {...rest}
        >
          {children}
        </code>
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface MarkdownProps {
  content: string;
  style?: React.CSSProperties;
}

export function Markdown({ content, style }: MarkdownProps) {
  const { theme, themeName } = useTheme();

  const components = useMemo(() => makeComponents(theme), [themeName]);

  return (
    <div
      style={{
        fontSize: 13,
        lineHeight: 1.6,
        color: theme.color.text,
        overflow: "hidden",
        wordBreak: "break-word" as const,
        ...style,
      }}
    >
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}
