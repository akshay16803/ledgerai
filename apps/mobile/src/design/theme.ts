import { DarkTheme } from "@react-navigation/native";

export const palette = {
  bgTop: "#05070E",
  bgBottom: "#0C1426",
  bgSecondary: "#17223B",
  surface: "#111A2F",
  surfaceElevated: "#17223B",
  border: "#243656",
  textPrimary: "#F4F8FF",
  textSecondary: "#9FB0CE",
  accentBlue: "#5B8CFF",
  accentTeal: "#14C4B8",
  accentSuccess: "#1FC47E",
  accentWarn: "#F6B73C",
  accentDanger: "#F46969",
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
};

export const typography = {
  h1: { fontSize: 30, fontWeight: "800" as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.2 },
  h3: { fontSize: 17, fontWeight: "700" as const },
  body: { fontSize: 15, fontWeight: "500" as const },
  caption: { fontSize: 12, fontWeight: "500" as const },
  mono: { fontFamily: "monospace", fontSize: 14, fontWeight: "600" as const },
};

export const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: palette.accentBlue,
    background: palette.bgTop,
    card: palette.surface,
    text: palette.textPrimary,
    border: palette.border,
    notification: palette.accentWarn,
  },
};

export const shadows = {
  glow: {
    shadowColor: "#5B8CFF",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
};

/**
 * Scale font size for responsive design
 * Used by responsive.ts helpers; also available as a utility function
 *
 * @param baseSize - Base font size (e.g., 15 for body)
 * @param scaleFactor - Device multiplier (1 for phone, 1.1-1.25 for tablet)
 * @returns Math.round(baseSize * scaleFactor)
 *
 * @example
 * getResponsiveFontSize(15, 1.25) // returns 18-19
 */
export function getResponsiveFontSize(
  baseSize: number,
  scaleFactor: number = 1,
): number {
  return Math.round(baseSize * scaleFactor);
}

/**
 * Scale spacing for responsive design
 * Centralizes responsive scaling logic; complements responsive.ts
 *
 * @param baseValue - Base spacing value (e.g., 14 for spacing.md)
 * @param scaleFactor - Device multiplier (1 for phone, 1.25 for tablet)
 * @returns Math.round(baseValue * scaleFactor)
 *
 * @example
 * getResponsiveSpacing(14, 1.25) // returns 17-18
 */
export function getResponsiveSpacing(
  baseValue: number,
  scaleFactor: number = 1,
): number {
  return Math.round(baseValue * scaleFactor);
}

/**
 * Responsive typography presets
 * Phone and tablet font sizes for h1-h3, body, caption
 * Use these in screens that need to scale headings on tablet
 *
 * @example
 * const titleStyle = device === "tablet"
 *   ? responsiveTypography.h1Responsive.tablet
 *   : responsiveTypography.h1Responsive.phone
 */
export const responsiveTypography = {
  // Heading 1: 30 on phone, 36 on tablet
  h1Responsive: {
    phone: typography.h1,
    tablet: { ...typography.h1, fontSize: 36 },
  },
  // Heading 2: 22 on phone, 26 on tablet
  h2Responsive: {
    phone: typography.h2,
    tablet: { ...typography.h2, fontSize: 26 },
  },
  // Heading 3: 17 on phone, 20 on tablet
  h3Responsive: {
    phone: typography.h3,
    tablet: { ...typography.h3, fontSize: 20 },
  },
  // Body: 15 on phone, 16 on tablet
  bodyResponsive: {
    phone: typography.body,
    tablet: { ...typography.body, fontSize: 16 },
  },
  // Caption: same on both (too small to scale)
  captionResponsive: {
    phone: typography.caption,
    tablet: typography.caption,
  },
} as const;

/**
 * Responsive spacing multipliers
 * Use as base scales for custom responsive calculations
 *
 * @example
 * const scaled = spacing.md * responsiveSpacingScale.tablet; // 14 * 1.25 = 17.5
 */
export const responsiveSpacingScale = {
  phone: 1,      // No scaling on phone
  tablet: 1.25,  // 25% larger on tablet
} as const;
