import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getResponsiveSpacing, useDeviceType } from "./responsive";

/**
 * Safe area insets hook — convenience wrapper
 *
 * @returns { top: number, bottom: number, left: number, right: number }
 *
 * @example
 * const insets = useSafeInsets();
 * return <View style={{ paddingLeft: insets.left }} />
 */
export function useSafeInsets() {
  return useSafeAreaInsets();
}

/**
 * Get responsive horizontal padding inside the safe area
 * Accounts for notches, home indicators, and device scaling
 * Hook — causes re-render on orientation change
 *
 * @returns Responsive spacing value (14 on phone, ~17-18 on tablet)
 *
 * @example
 * const padding = useResponsiveHorizontalPadding();
 */
export function useResponsiveHorizontalPadding(): number {
  return getResponsiveSpacing(14); // spacing.md scaled by device multiplier
}

/**
 * Get responsive vertical padding inside the safe area
 * Hook — causes re-render on orientation change
 *
 * @returns Responsive spacing value (10 on phone, ~12-13 on tablet)
 *
 * @example
 * const padding = useResponsiveVerticalPadding();
 */
export function useResponsiveVerticalPadding(): number {
  return getResponsiveSpacing(10); // spacing.sm scaled by device multiplier
}

/**
 * Get bottom inset accounting for keyboard presence
 * Note: React Native doesn't expose keyboard state directly.
 * For real keyboard avoidance, use KeyboardAvoidingView or Keyboard.addListener.
 *
 * @param insets - Result from useSafeAreaInsets()
 * @returns Additional bottom padding if insets.bottom > 0, else 10
 *
 * @example
 * const insets = useSafeInsets();
 * const bottomPadding = getBottomInsetForKeyboard(insets);
 */
export function getBottomInsetForKeyboard(
  insets: ReturnType<typeof useSafeAreaInsets>
): number {
  return insets.bottom > 0 ? insets.bottom + 10 : 10;
}

/**
 * Get responsive container style with flex, padding
 * Convenience helper for common pattern: flex container + responsive padding
 * Hook — causes re-render on orientation change
 *
 * @returns { flex: 1, paddingHorizontal: number, paddingVertical: number }
 *
 * @example
 * const containerStyle = getResponsiveContainerStyle();
 * <View style={containerStyle}>...</View>
 */
export function getResponsiveContainerStyle() {
  return {
    flex: 1,
    paddingHorizontal: getResponsiveSpacing(14),
    paddingVertical: getResponsiveSpacing(10),
  } as const;
}

/**
 * Get number of grid columns based on device type
 * Hook — causes re-render on orientation change
 *
 * @param phoneColumns - Column count on phone (default 2)
 * @param tabletColumns - Column count on tablet (default 4)
 * @returns phoneColumns on phone device, tabletColumns on tablet device
 *
 * @example
 * const cols = getGridColumns(1, 2); // 1 column phone, 2 tablet
 * // Use with flexBasis: `${100 / cols}%` to distribute items
 */
export function getGridColumns(phoneColumns: number = 2, tabletColumns: number = 4): number {
  const device = useDeviceType();
  return device === "tablet" ? tabletColumns : phoneColumns;
}

/**
 * Get safe area-aware flex layout style
 * Useful for root containers that need to account for notches/home indicators
 * Hook — causes re-render on orientation change
 *
 * @returns { flex: 1, paddingLeft: number, paddingRight: number }
 *
 * @example
 * const layout = useSafeAreaFlexContainer();
 * <View style={layout}>...</View>
 */
export function useSafeAreaFlexContainer() {
  const insets = useSafeAreaInsets();
  return {
    flex: 1,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  };
}
