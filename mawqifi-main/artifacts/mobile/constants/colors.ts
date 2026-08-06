/**
 * Mawqifi design tokens — dark navy + cyan palette.
 *
 * A premium dark theme optimized for outdoor readability and quick scanning.
 * All values are consumed via the `useColors()` hook; never use raw hex in components.
 */

const colors = {
  /** Primary dark palette (navy + cyan). */
  light: {
    // Base surfaces
    background: "#080D1A",
    foreground: "#EEF2FF",
    text: "#EEF2FF",
    tint: "#38BDF8",

    // Cards & sheets
    card: "#0E1929",
    cardForeground: "#EEF2FF",

    // Primary action — vivid blue
    primary: "#2563EB",
    primaryForeground: "#FFFFFF",

    // Secondary interactive surfaces
    secondary: "#0F2245",
    secondaryForeground: "#60A5FA",

    // Muted / subdued
    muted: "#0D1A30",
    mutedForeground: "#5E7DA0",

    // Accent — bright cyan highlight
    accent: "#06B6D4",
    accentForeground: "#080D1A",

    // Feedback colors
    destructive: "#FF4040",
    destructiveForeground: "#FFFFFF",
    border: "#162235",
    input: "#162235",
    success: "#10D97F",
    successForeground: "#080D1A",
    warning: "#FBBF24",
    warningForeground: "#080D1A",
  },

  /** Dark variant — same look, kept for hook compatibility. */
  dark: {
    background: "#080D1A",
    foreground: "#EEF2FF",
    text: "#EEF2FF",
    tint: "#38BDF8",
    card: "#0E1929",
    cardForeground: "#EEF2FF",
    primary: "#2563EB",
    primaryForeground: "#FFFFFF",
    secondary: "#0F2245",
    secondaryForeground: "#60A5FA",
    muted: "#0D1A30",
    mutedForeground: "#5E7DA0",
    accent: "#06B6D4",
    accentForeground: "#080D1A",
    destructive: "#FF4040",
    destructiveForeground: "#FFFFFF",
    border: "#162235",
    input: "#162235",
    success: "#10D97F",
    successForeground: "#080D1A",
    warning: "#FBBF24",
    warningForeground: "#080D1A",
  },

  radius: 16,
};

export default colors;
