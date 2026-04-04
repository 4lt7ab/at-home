import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge, badgeStyle } from "./Badge";
import { ThemeProvider } from "../theme";
import type { ReactNode } from "react";

// jsdom normalizes hex colors to rgb() format.
function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe("Badge", () => {
  it("renders children text", () => {
    render(<Badge variant="default">label</Badge>, { wrapper });
    expect(screen.getByText("label")).toBeInTheDocument();
  });

  it("renders as a span element", () => {
    render(<Badge variant="default">text</Badge>, { wrapper });
    expect(screen.getByText("text").tagName).toBe("SPAN");
  });

  it("active variant applies a color style", () => {
    render(<Badge variant="active">Active</Badge>, { wrapper });
    const el = screen.getByText("Active");
    // #2ecc71 -> rgb(46, 204, 113)
    expect(el.style.color).toBe("rgb(46, 204, 113)");
  });

  it("area variant applies tertiary color", () => {
    render(<Badge variant="area">Area</Badge>, { wrapper });
    const el = screen.getByText("Area");
    // #7b8acf -> rgb(123, 138, 207)
    expect(el.style.color).toBe("rgb(123, 138, 207)");
  });

  it("overdue variant uses onPrimary color and danger bg", () => {
    render(<Badge variant="overdue">Overdue</Badge>, { wrapper });
    const el = screen.getByText("Overdue");
    // #fff -> rgb(255, 255, 255) and #e74c3c -> rgb(231, 76, 60)
    expect(el.style.color).toBe("rgb(255, 255, 255)");
    expect(el.style.background).toBe("rgb(231, 76, 60)");
  });

  it("effort variant applies textMuted color", () => {
    render(<Badge variant="effort">Low</Badge>, { wrapper });
    const el = screen.getByText("Low");
    // #888 -> rgb(136, 136, 136)
    expect(el.style.color).toBe("rgb(136, 136, 136)");
  });

  it("completion variant applies success color", () => {
    render(<Badge variant="completion">Done</Badge>, { wrapper });
    const el = screen.getByText("Done");
    // #2ecc71 -> rgb(46, 204, 113)
    expect(el.style.color).toBe("rgb(46, 204, 113)");
  });

  it("default variant applies textMuted color", () => {
    render(<Badge variant="default">Default</Badge>, { wrapper });
    const el = screen.getByText("Default");
    expect(el.style.color).toBe("rgb(136, 136, 136)");
  });

  it("falls back to default when no variant or legacy props", () => {
    render(<Badge>Fallback</Badge>, { wrapper });
    const el = screen.getByText("Fallback");
    expect(el.style.color).toBe("rgb(136, 136, 136)");
  });

  // Legacy backward compatibility
  it("supports legacy color/bg props", () => {
    render(
      <Badge color="#ff0000" bg="#00ff00">
        Legacy
      </Badge>,
      { wrapper },
    );
    const el = screen.getByText("Legacy");
    expect(el.style.color).toBe("rgb(255, 0, 0)");
    expect(el.style.background).toBe("rgb(0, 255, 0)");
  });

  it("legacy badgeStyle function still works", () => {
    const style = badgeStyle("#ff0000", "#00ff00");
    expect(style.color).toBe("#ff0000");
    expect(style.background).toBe("#00ff00");
    expect(style.display).toBe("inline-block");
    expect(style.borderRadius).toBe(4);
  });

  it("spreads caller style last", () => {
    render(
      <Badge variant="active" style={{ marginLeft: 20 }}>
        Styled
      </Badge>,
      { wrapper },
    );
    const el = screen.getByText("Styled");
    expect(el.style.marginLeft).toBe("20px");
  });
});
