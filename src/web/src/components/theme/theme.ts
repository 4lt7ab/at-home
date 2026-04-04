// ---------------------------------------------------------------------------
// Theme token system
// ---------------------------------------------------------------------------

export interface Theme {
  color: {
    // Text hierarchy
    text: string;
    textMuted: string;
    textFaint: string;

    // Surface layers (Material Design 3 naming)
    surface: string;
    surfaceContainer: string;
    surfaceContainerLow: string;
    surfaceContainerHigh: string;
    surfaceContainerHighest: string;

    // Borders
    border: string;
    borderSubtle: string;

    // Primary palette
    primary: string;
    primaryContainer: string;
    onPrimary: string;
    onPrimaryContainer: string;

    // Semantic
    tertiary: string;
    danger: string;
    success: string;
    warning: string;

    // Status indicators
    running: string;
    failed: string;

    // Effects
    activityFlash: string;
    activityBorder: string;
    glowPrimary: string;
    glowSuccess: string;
    glowDanger: string;
  };

  shadow: {
    sm: string;
    md: string;
    lg: string;
  };

  glow: {
    animated: boolean;
    accentColors?: string[];
    borderSubtle: string;
    borderLight: string;
    borderMedium: string;
    borderStrong: string;
    shadowSm: string;
    shadowMd: string;
    shadowLg: string;
    shadowXl: string;
    textShadow: string;
    focusRing: string;
    focusRingSubtle: string;
    hoverShadow: string;
    dangerShadow: string;
  };

  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    "2xl": string;
    "3xl": string;
  };

  radius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
  };

  font: {
    headline: string;
    body: string;
    mono: string;
    size: {
      xxs: string;
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      "2xl": string;
    };
    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
      mono: number;
    };
    letterSpacing: {
      tight: string;
      normal: string;
      wide: string;
    };
  };

  motion: {
    fast: string;
    normal: string;
    slow: string;
    easing: string;
    animation: {
      instant: string;
      fast: string;
      normal: string;
      slow: string;
      pulse: string;
      glow: string;
    };
    spring: string;
  };

  layout: {
    topBarHeight: string;
    maxContentWidth: string;
    tableRowHeight: string;
  };

  breakpoint: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
}

// ---------------------------------------------------------------------------
// noGlow helper -- returns all-transparent glow values
// ---------------------------------------------------------------------------

export function noGlow(): Theme["glow"] {
  return {
    animated: false,
    borderSubtle: "transparent",
    borderLight: "transparent",
    borderMedium: "transparent",
    borderStrong: "transparent",
    shadowSm: "none",
    shadowMd: "none",
    shadowLg: "none",
    shadowXl: "none",
    textShadow: "none",
    focusRing: "transparent",
    focusRingSubtle: "transparent",
    hoverShadow: "none",
    dangerShadow: "none",
  };
}

// ---------------------------------------------------------------------------
// Shared token values (same across all themes)
// ---------------------------------------------------------------------------

const sharedSpacing: Theme["spacing"] = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
  "2xl": "2rem",
  "3xl": "2.5rem",
};

const sharedRadius: Theme["radius"] = {
  sm: 2,
  md: 4,
  lg: 8,
  xl: 12,
  full: 9999,
};

const sharedFont: Theme["font"] = {
  headline: "'Manrope'",
  body: "'Inter'",
  mono: "'JetBrains Mono'",
  size: {
    xxs: "0.625rem",
    xs: "0.75rem",
    sm: "0.875rem",
    md: "1rem",
    lg: "1.25rem",
    xl: "1.5rem",
    "2xl": "2.25rem",
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
    mono: 1.6,
  },
  letterSpacing: {
    tight: "-0.02em",
    normal: "0",
    wide: "0.08em",
  },
};

const sharedMotion: Theme["motion"] = {
  fast: "100ms",
  normal: "200ms",
  slow: "400ms",
  easing: "cubic-bezier(0.4, 0, 0.2, 1)",
  animation: {
    instant: "50ms",
    fast: "150ms",
    normal: "300ms",
    slow: "500ms",
    pulse: "2000ms",
    glow: "1500ms",
  },
  spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
};

const sharedLayout: Theme["layout"] = {
  topBarHeight: "48px",
  maxContentWidth: "1400px",
  tableRowHeight: "52px",
};

const sharedBreakpoint: Theme["breakpoint"] = {
  sm: 640,
  md: 1024,
  lg: 1440,
  xl: 1920,
};

// ---------------------------------------------------------------------------
// deepTeal theme -- maps existing dark CSS variables from index.html
// ---------------------------------------------------------------------------

const deepTeal: Theme = {
  color: {
    text: "#e0e0e0",
    textMuted: "#888",
    textFaint: "#777",

    surface: "#16213e",
    surfaceContainer: "#1a2540",
    surfaceContainerLow: "#141c34",
    surfaceContainerHigh: "#1e2b48",
    surfaceContainerHighest: "#243250",

    border: "#2a2a4a",
    borderSubtle: "#222244",

    primary: "#5dade2",
    primaryContainer: "#1a2d42",
    onPrimary: "#fff",
    onPrimaryContainer: "#5dade2",

    tertiary: "#7b8acf",
    danger: "#e74c3c",
    success: "#2ecc71",
    warning: "#f39c12",

    running: "#5dade2",
    failed: "#e74c3c",

    activityFlash: "#5dade233",
    activityBorder: "#5dade266",
    glowPrimary: "#5dade244",
    glowSuccess: "#2ecc7144",
    glowDanger: "#e74c3c44",
  },

  shadow: {
    sm: "0 1px 3px rgba(0,0,0,0.4)",
    md: "0 4px 20px rgba(0,0,0,0.3)",
    lg: "0 8px 40px rgba(0,0,0,0.4)",
  },

  glow: noGlow(),
  spacing: sharedSpacing,
  radius: sharedRadius,
  font: sharedFont,
  motion: sharedMotion,
  layout: sharedLayout,
  breakpoint: sharedBreakpoint,
};

// ---------------------------------------------------------------------------
// ember theme -- amber/orange primary palette
// ---------------------------------------------------------------------------

const ember: Theme = {
  color: {
    text: "#e8dcc8",
    textMuted: "#a08b70",
    textFaint: "#887560",

    surface: "#1c1410",
    surfaceContainer: "#241c16",
    surfaceContainerLow: "#181210",
    surfaceContainerHigh: "#2c221a",
    surfaceContainerHighest: "#342a20",

    border: "#3a2a1a",
    borderSubtle: "#302218",

    primary: "#e8943a",
    primaryContainer: "#3a2810",
    onPrimary: "#fff",
    onPrimaryContainer: "#e8943a",

    tertiary: "#c4956a",
    danger: "#d94432",
    success: "#5aad5a",
    warning: "#e8b030",

    running: "#e8943a",
    failed: "#d94432",

    activityFlash: "#e8943a33",
    activityBorder: "#e8943a66",
    glowPrimary: "#e8943a44",
    glowSuccess: "#5aad5a44",
    glowDanger: "#d9443244",
  },

  shadow: {
    sm: "0 1px 3px rgba(0,0,0,0.5)",
    md: "0 4px 20px rgba(0,0,0,0.4)",
    lg: "0 8px 40px rgba(0,0,0,0.5)",
  },

  glow: noGlow(),
  spacing: sharedSpacing,
  radius: sharedRadius,
  font: sharedFont,
  motion: sharedMotion,
  layout: sharedLayout,
  breakpoint: sharedBreakpoint,
};

// ---------------------------------------------------------------------------
// Theme registry
// ---------------------------------------------------------------------------

export const themes: Record<string, Theme> = {
  deepTeal,
  ember,
};
