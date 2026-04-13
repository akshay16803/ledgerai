import { useWindowDimensions as useWindowDimensionsRN } from "react-native";

/**
 * Breakpoint constants for device detection
 * phone: 0-899dp (5"-6.5" phones)
 * tablet: 900dp+ (7"+ tablets)
 *
 * @example
 * if (width >= BREAKPOINTS.tablet) { // tablet layout }
 */
export const BREAKPOINTS = {
  phone: 600,    // Max width for phone layout
  tablet: 900,   // Min width for tablet layout
} as const;

/**
 * Detect device type based on window width
 * Hook — causes re-render on orientation change
 *
 * @returns "phone" if width < BREAKPOINTS.tablet, else "tablet"
 *
 * @example
 * const device = useDeviceType();
 * if (device === "tablet") { // 4-col grid }
 */
export function useDeviceType(): "phone" | "tablet" {
  const { width } = useWindowDimensionsRN();
  return width >= BREAKPOINTS.tablet ? "tablet" : "phone";
}

/**
 * Window dimensions hook — re-export from React Native for convenience
 * Triggers re-render on orientation/size change
 *
 * @returns { width: number, height: number }
 *
 * @example
 * const { width, height } = useWindowDimensions();
 */
export function useWindowDimensions() {
  return useWindowDimensionsRN();
}

/**
 * Get responsive scaling multiplier based on device type
 * Hook — causes re-render on orientation change
 *
 * @returns 1 for phone, 1.25 for tablet
 *
 * @example
 * const scale = getResponsiveSpaceScale();
 * const scaledSpacing = 14 * scale; // 14 on phone, 17.5 on tablet
 */
export function getResponsiveSpaceScale(): number {
  const device = useDeviceType();
  return device === "tablet" ? 1.25 : 1;
}

/**
 * Scale a font size based on device type
 * Hook — causes re-render on orientation change
 *
 * @param base - Base font size (e.g., 15 for body text)
 * @param scale - Additional scale factor (default 1)
 * @returns Math.round(base * scale * spaceScale)
 *
 * @example
 * const fontSize = getResponsiveFontSize(15, 1); // 15 on phone, 18-19 on tablet
 */
export function getResponsiveFontSize(base: number, scale: number = 1): number {
  const spaceScale = getResponsiveSpaceScale();
  return Math.round(base * scale * spaceScale);
}

/**
 * Scale a spacing value based on device type
 * Hook — causes re-render on orientation change
 *
 * @param value - Base spacing value (e.g., 14 for spacing.md)
 * @returns Math.round(value * spaceScale), where spaceScale is 1 for phone, 1.25 for tablet
 *
 * @example
 * const padding = getResponsiveSpacing(14); // 14 on phone, 17-18 on tablet
 */
export function getResponsiveSpacing(value: number): number {
  const spaceScale = getResponsiveSpaceScale();
  return Math.round(value * spaceScale);
}

/**
 * Get responsive padding object for containers
 * Hook — causes re-render on orientation change
 *
 * @param horizontal - Horizontal padding value
 * @param vertical - Vertical padding value
 * @returns { paddingHorizontal: number, paddingVertical: number }
 *
 * @example
 * const padding = getResponsivePadding(14, 10);
 * // phone: { paddingHorizontal: 14, paddingVertical: 10 }
 * // tablet: { paddingHorizontal: 17-18, paddingVertical: 12-13 }
 */
export function getResponsivePadding(
  horizontal: number,
  vertical: number
): {
  paddingHorizontal: number;
  paddingVertical: number;
} {
  return {
    paddingHorizontal: getResponsiveSpacing(horizontal),
    paddingVertical: getResponsiveSpacing(vertical),
  };
}

/**
 * Get responsive gap for flexbox grids
 * Hook — causes re-render on orientation change
 *
 * @returns 10 on phone, 12-16 on tablet (adjusts to ~1.25x multiplier)
 *
 * @example
 * const styles = StyleSheet.create({
 *   grid: { flexDirection: "row", flexWrap: "wrap", gap: getResponsiveGap() }
 * });
 */
export function getResponsiveGap(): number {
  const device = useDeviceType();
  return device === "tablet" ? 12 : 10;
}
