/**
 * ErrorBoundary organism -- standard React error boundary with theme-aware fallback.
 * Uses a function component wrapper for the fallback UI (to access useTheme).
 */
import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { useTheme } from "../theme";
import { Button } from "../atoms";

// ---------------------------------------------------------------------------
// Fallback UI (function component for hook access)
// ---------------------------------------------------------------------------

interface ErrorFallbackProps {
  error: Error;
  onRetry: () => void;
}

function ErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  const { theme } = useTheme();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: theme.spacing["2xl"],
        gap: theme.spacing.lg,
        minHeight: 200,
      }}
    >
      <div
        style={{
          fontSize: theme.font.size.lg,
          fontWeight: 600,
          color: theme.color.danger,
          fontFamily: theme.font.headline,
        }}
      >
        Something went wrong
      </div>
      <div
        style={{
          fontSize: theme.font.size.sm,
          color: theme.color.textMuted,
          textAlign: "center",
          maxWidth: 400,
          fontFamily: theme.font.mono,
          background: theme.color.surfaceContainerHigh,
          padding: theme.spacing.md,
          borderRadius: theme.radius.md,
          wordBreak: "break-word",
        }}
      >
        {error.message}
      </div>
      <Button variant="ghost" onClick={onRetry}>
        Try Again
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error Boundary class component
// ---------------------------------------------------------------------------

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}
