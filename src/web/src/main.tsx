import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ThemeProvider } from "./components/theme";
import { ToastProvider } from "./components/ToastContext";
import { AnimationStyles } from "./components/atoms/AnimationStyles";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AnimationStyles />
      <ToastProvider>
        <App />
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
);
