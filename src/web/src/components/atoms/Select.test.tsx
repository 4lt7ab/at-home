import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Select } from "./Select";
import { ThemeProvider } from "../theme";
import type { ReactNode } from "react";

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe("Select", () => {
  it("renders a select element", () => {
    render(
      <Select aria-label="choice">
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>,
      { wrapper },
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders label when provided", () => {
    render(
      <Select label="Pick one">
        <option>X</option>
      </Select>,
      { wrapper },
    );
    expect(screen.getByText("Pick one")).toBeInTheDocument();
  });

  it("handles focus and blur events", () => {
    render(
      <Select aria-label="focus-test">
        <option>A</option>
      </Select>,
      { wrapper },
    );
    const select = screen.getByRole("combobox");
    fireEvent.focus(select);
    fireEvent.blur(select);
    expect(select).toBeInTheDocument();
  });

  it("passes children options through", () => {
    render(
      <Select aria-label="opts">
        <option value="1">One</option>
        <option value="2">Two</option>
      </Select>,
      { wrapper },
    );
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("Two")).toBeInTheDocument();
  });
});
