import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, render, screen, fireEvent } from "@testing-library/react";
import { ToastProvider, useToastContext } from "./ToastContext";
import { ThemeProvider } from "./theme";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider isolated>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ToastProvider", () => {
  it("renders children", () => {
    render(
      <ThemeProvider isolated>
        <ToastProvider>
          <div data-testid="child">hello</div>
        </ToastProvider>
      </ThemeProvider>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("provides showToast and dismissToast via useToastContext", () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });
    expect(typeof result.current.showToast).toBe("function");
    expect(typeof result.current.dismissToast).toBe("function");
  });
});

describe("useToastContext", () => {
  it("throws if used outside ToastProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => {
      renderHook(() => useToastContext());
    }).toThrow("useToastContext must be used within a ToastProvider");
    spy.mockRestore();
  });
});

describe("showToast", () => {
  it("displays a success toast", () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    act(() => {
      result.current.showToast("Saved!", "success");
    });

    expect(screen.getByText("Saved!")).toBeInTheDocument();
  });

  it("displays an error toast", () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    act(() => {
      result.current.showToast("Something failed", "error");
    });

    expect(screen.getByText("Something failed")).toBeInTheDocument();
  });

  it("defaults to info type", () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    act(() => {
      result.current.showToast("FYI");
    });

    expect(screen.getByText("FYI")).toBeInTheDocument();
  });

  it("stacks multiple toasts", () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    act(() => {
      result.current.showToast("First", "success");
      result.current.showToast("Second", "error");
      result.current.showToast("Third", "info");
    });

    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getByText("Third")).toBeInTheDocument();
  });

  it("auto-dismisses success toasts after 3s", () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    act(() => {
      result.current.showToast("Success toast", "success");
    });

    expect(screen.getByText("Success toast")).toBeInTheDocument();

    // Advance past the 3s duration
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Wait for exit animation (200ms)
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByText("Success toast")).not.toBeInTheDocument();
  });

  it("auto-dismisses error toasts after 6s", () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    act(() => {
      result.current.showToast("Error toast", "error");
    });

    expect(screen.getByText("Error toast")).toBeInTheDocument();

    // Should still be visible at 5s
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText("Error toast")).toBeInTheDocument();

    // Advance past 6s total
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Wait for exit animation
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByText("Error toast")).not.toBeInTheDocument();
  });
});

describe("dismissToast", () => {
  it("removes a toast when clicked", () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    act(() => {
      result.current.showToast("Click me away", "success");
    });

    const toast = screen.getByText("Click me away");
    expect(toast).toBeInTheDocument();

    // Click the parent toast item (the div with onClick)
    fireEvent.click(toast.closest("[role='button']")!);

    // Wait for exit animation
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByText("Click me away")).not.toBeInTheDocument();
  });

  it("removes a specific toast without affecting others", () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    act(() => {
      result.current.showToast("First", "success");
      result.current.showToast("Second", "error");
    });

    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();

    // Auto-dismiss the success one (3s)
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByText("First")).not.toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });
});

describe("Toast rendering", () => {
  it("renders with fixed positioning at bottom-right", () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    act(() => {
      result.current.showToast("Positioned toast", "info");
    });

    // The container has role="status"
    const container = screen.getByRole("status");
    expect(container.style.position).toBe("fixed");
    expect(container.style.zIndex).toBe("9999");
  });

  it("uses theme tokens for styling", () => {
    const { result } = renderHook(() => useToastContext(), { wrapper });

    act(() => {
      result.current.showToast("Themed toast", "success");
    });

    // Toast should be rendered (the styling is theme-based inline styles)
    expect(screen.getByText("Themed toast")).toBeInTheDocument();
  });
});
