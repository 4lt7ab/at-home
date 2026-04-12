import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@4lt7ab/ui/core";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="synthwave" applyPageStyles>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
