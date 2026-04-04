/**
 * HighlightOnChange molecule -- wraps children and animates when trackValue changes.
 * Respects reduced motion preferences.
 */
import { useRef, useEffect, useState } from "react";
import { useTheme } from "../theme";
import { useReducedMotion } from "../../hooks/useReducedMotion";

export interface HighlightOnChangeProps {
  trackValue: unknown;
  effect?: "flash" | "glow" | "border";
  duration?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function HighlightOnChange({
  trackValue,
  effect = "flash",
  duration = 600,
  children,
  style,
}: HighlightOnChangeProps) {
  const { theme } = useTheme();
  const reduced = useReducedMotion();
  const prevRef = useRef(trackValue);
  const [active, setActive] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevRef.current = trackValue;
      return;
    }
    if (prevRef.current !== trackValue) {
      prevRef.current = trackValue;
      if (!reduced) {
        setActive(true);
        const timer = setTimeout(() => setActive(false), duration);
        return () => clearTimeout(timer);
      }
    }
  }, [trackValue, duration, reduced]);

  const effectStyles: Record<string, React.CSSProperties> = {
    flash: {
      ["--flash-color" as string]: theme.color.activityFlash,
      animation: active ? `highlight-flash ${duration}ms ease-out` : undefined,
    },
    glow: {
      boxShadow: active ? `0 0 8px ${theme.color.glowPrimary}` : "none",
      transition: `box-shadow ${duration}ms ease-out`,
    },
    border: {
      borderColor: active ? theme.color.activityBorder : "transparent",
      borderWidth: 1,
      borderStyle: "solid",
      transition: `border-color ${duration}ms ease-out`,
    },
  };

  return (
    <div style={{ ...effectStyles[effect], ...style }}>
      {children}
    </div>
  );
}
