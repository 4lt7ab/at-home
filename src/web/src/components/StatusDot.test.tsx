import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusDot, STATUS_DOT_COLORS } from "./StatusDot";

describe("StatusDot", () => {
  it("renders a span element", () => {
    render(<StatusDot status="active" />);
    const el = screen.getByTitle("active");
    expect(el.tagName).toBe("SPAN");
  });

  it("has aria-hidden='true' attribute", () => {
    render(<StatusDot status="active" />);
    const el = screen.getByTitle("active");
    expect(el.getAttribute("aria-hidden")).toBe("true");
  });

  it("has title attribute matching the status string", () => {
    render(<StatusDot status="paused" />);
    expect(screen.getByTitle("paused")).toBeTruthy();
  });

  it("uses var(--color-success) for 'active' status", () => {
    render(<StatusDot status="active" />);
    const el = screen.getByTitle("active");
    expect(el.style.background).toBe("var(--color-success)");
  });

  it("uses var(--color-warning) for 'paused' status", () => {
    render(<StatusDot status="paused" />);
    const el = screen.getByTitle("paused");
    expect(el.style.background).toBe("var(--color-warning)");
  });

  it("uses var(--color-text-faint) for 'done' status", () => {
    render(<StatusDot status="done" />);
    const el = screen.getByTitle("done");
    expect(el.style.background).toBe("var(--color-text-faint)");
  });

  it("uses var(--color-text-faintest) for 'archived' status", () => {
    render(<StatusDot status="archived" />);
    const el = screen.getByTitle("archived");
    expect(el.style.background).toBe("var(--color-text-faintest)");
  });

  it("falls back to var(--color-text-faint) for unknown status", () => {
    render(<StatusDot status="unknown-status" />);
    const el = screen.getByTitle("unknown-status");
    expect(el.style.background).toBe("var(--color-text-faint)");
  });

  it("defaults to 8px width and height when size prop omitted", () => {
    render(<StatusDot status="active" />);
    const el = screen.getByTitle("active");
    expect(el.style.width).toBe("8px");
    expect(el.style.height).toBe("8px");
  });

  it("respects custom size prop (e.g., size=12 -> 12px)", () => {
    render(<StatusDot status="active" size={12} />);
    const el = screen.getByTitle("active");
    expect(el.style.width).toBe("12px");
    expect(el.style.height).toBe("12px");
  });

  it("uses color override prop instead of status lookup", () => {
    render(<StatusDot status="active" color="var(--color-danger)" />);
    const el = screen.getByTitle("active");
    expect(el.style.background).toBe("var(--color-danger)");
  });

  it("merges custom style prop with base styles", () => {
    render(<StatusDot status="active" style={{ marginLeft: 10 }} />);
    const el = screen.getByTitle("active");
    expect(el.style.marginLeft).toBe("10px");
    // Base styles should still be present
    expect(el.style.borderRadius).toBe("50%");
  });

  it("has flexShrink: 0", () => {
    render(<StatusDot status="active" />);
    const el = screen.getByTitle("active");
    expect(el.style.flexShrink).toBe("0");
  });

  it("has borderRadius: 50% (circle shape)", () => {
    render(<StatusDot status="active" />);
    const el = screen.getByTitle("active");
    expect(el.style.borderRadius).toBe("50%");
  });
});
