import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Input } from "./Input";
import { ThemeProvider } from "../theme";
import type { ReactNode } from "react";

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe("Input", () => {
  it("renders an input element", () => {
    render(<Input placeholder="Type here" />, { wrapper });
    expect(screen.getByPlaceholderText("Type here")).toBeInTheDocument();
  });

  it("renders label when provided", () => {
    render(<Input label="Name" />, { wrapper });
    expect(screen.getByText("Name")).toBeInTheDocument();
  });

  it("handles focus and blur events", () => {
    render(<Input placeholder="focus-test" />, { wrapper });
    const input = screen.getByPlaceholderText("focus-test");
    fireEvent.focus(input);
    fireEvent.blur(input);
    // No error means focus/blur handling works
    expect(input).toBeInTheDocument();
  });

  it("spreads caller style last", () => {
    render(<Input placeholder="styled" style={{ marginTop: 50 }} />, { wrapper });
    const input = screen.getByPlaceholderText("styled");
    expect(input.style.marginTop).toBe("50px");
  });

  it("forwards standard input props", () => {
    render(<Input type="email" placeholder="email" />, { wrapper });
    const input = screen.getByPlaceholderText("email") as HTMLInputElement;
    expect(input.type).toBe("email");
  });
});
