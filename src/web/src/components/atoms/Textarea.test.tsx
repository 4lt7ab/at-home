import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Textarea } from "./Textarea";
import { ThemeProvider } from "../theme";
import type { ReactNode } from "react";

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe("Textarea", () => {
  it("renders a textarea element", () => {
    render(<Textarea placeholder="Enter text" />, { wrapper });
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  it("renders label when provided", () => {
    render(<Textarea label="Description" />, { wrapper });
    expect(screen.getByText("Description")).toBeInTheDocument();
  });

  it("defaults to 3 rows", () => {
    render(<Textarea placeholder="rows-test" />, { wrapper });
    const ta = screen.getByPlaceholderText("rows-test") as HTMLTextAreaElement;
    expect(ta.rows).toBe(3);
  });

  it("applies resize: vertical", () => {
    render(<Textarea placeholder="resize-test" />, { wrapper });
    const ta = screen.getByPlaceholderText("resize-test");
    expect(ta.style.resize).toBe("vertical");
  });

  it("handles focus and blur events", () => {
    render(<Textarea placeholder="focus-test" />, { wrapper });
    const ta = screen.getByPlaceholderText("focus-test");
    fireEvent.focus(ta);
    fireEvent.blur(ta);
    expect(ta).toBeInTheDocument();
  });
});
