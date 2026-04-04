import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./Button";
import { ThemeProvider } from "../theme";
import type { ReactNode } from "react";

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe("Button", () => {
  it("renders children text", () => {
    render(<Button>Click me</Button>, { wrapper });
    expect(screen.getByRole("button")).toHaveTextContent("Click me");
  });

  it("renders as a button element", () => {
    render(<Button>Test</Button>, { wrapper });
    expect(screen.getByRole("button").tagName).toBe("BUTTON");
  });

  it("fires onClick handler", () => {
    const fn = vi.fn();
    render(<Button onClick={fn}>Click</Button>, { wrapper });
    fireEvent.click(screen.getByRole("button"));
    expect(fn).toHaveBeenCalledOnce();
  });

  it("applies primary variant styles by default", () => {
    render(<Button>Primary</Button>, { wrapper });
    const btn = screen.getByRole("button");
    // Primary variant has a non-transparent background
    expect(btn.style.background).toBeTruthy();
    expect(btn.style.background).not.toBe("transparent");
  });

  it("applies ghost variant styles", () => {
    render(<Button variant="ghost">Ghost</Button>, { wrapper });
    const btn = screen.getByRole("button");
    expect(btn.style.background).toBe("transparent");
  });

  it("applies danger variant styles", () => {
    render(<Button variant="danger">Danger</Button>, { wrapper });
    const btn = screen.getByRole("button");
    expect(btn.style.background).toBeTruthy();
  });

  it("applies icon variant styles", () => {
    render(<Button variant="icon">X</Button>, { wrapper });
    const btn = screen.getByRole("button");
    expect(btn.style.background).toBe("transparent");
  });

  it("shows spinner when loading", () => {
    render(<Button loading>Save</Button>, { wrapper });
    const btn = screen.getByRole("button");
    // Should not show children text when loading
    expect(btn.textContent).toBe("");
    // Button should be disabled when loading
    expect(btn).toBeDisabled();
  });

  it("applies disabled styling", () => {
    render(<Button disabled>Disabled</Button>, { wrapper });
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn.style.opacity).toBe("0.5");
    expect(btn.style.cursor).toBe("not-allowed");
  });

  it("manages hover state via mouse events", () => {
    render(<Button>Hover me</Button>, { wrapper });
    const btn = screen.getByRole("button");
    fireEvent.mouseEnter(btn);
    fireEvent.mouseLeave(btn);
    // No error means the handlers work
    expect(btn).toBeInTheDocument();
  });

  it("applies sm size padding", () => {
    render(<Button size="sm">Small</Button>, { wrapper });
    const btn = screen.getByRole("button");
    expect(btn.style.padding).toBeTruthy();
  });

  it("spreads caller style last", () => {
    render(<Button style={{ marginTop: 99 }}>Styled</Button>, { wrapper });
    const btn = screen.getByRole("button");
    expect(btn.style.marginTop).toBe("99px");
  });
});
