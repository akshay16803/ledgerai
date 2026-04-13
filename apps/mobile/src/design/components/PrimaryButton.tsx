import { Pressable, StyleSheet, Text, ViewStyle, StyleProp } from "react-native";
import { palette, radius, shadows } from "@design/theme";

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "default" | "small";
};

export function PrimaryButton({
  title,
  onPress,
  disabled,
  style,
  variant = "primary",
  size = "default",
}: PrimaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && shadows.glow,
        variant === "secondary" && styles.secondary,
        variant === "danger" && styles.danger,
        variant === "ghost" && styles.ghost,
        size === "small" && styles.small,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          variant !== "primary" && styles.secondaryText,
          variant === "danger" && styles.primaryText,
          variant === "ghost" && styles.ghostText,
          size === "small" && styles.smallText,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accentBlue,
  },
  disabled: {
    opacity: 0.45,
  },
  secondary: {
    backgroundColor: palette.surfaceElevated,
    borderWidth: 1,
    borderColor: palette.border,
  },
  danger: {
    backgroundColor: palette.accentDanger,
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: palette.border,
  },
  small: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  text: {
    color: palette.textPrimary,
    fontWeight: "700",
    fontSize: 15,
  },
  primaryText: {
    color: palette.textPrimary,
  },
  secondaryText: {
    color: palette.textPrimary,
  },
  ghostText: {
    color: palette.textSecondary,
  },
  smallText: {
    fontSize: 13,
  },
});
