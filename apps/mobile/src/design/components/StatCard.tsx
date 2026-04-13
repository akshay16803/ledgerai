import { StyleSheet, Text, View } from "react-native";
import { AppCard } from "@design/components/AppCard";
import { palette, typography } from "@design/theme";

type StatCardProps = {
  label: string;
  value: string;
  delta?: string;
  tone?: "neutral" | "success" | "danger" | "warn";
};

const toneMap = {
  neutral: palette.accentBlue,
  success: palette.accentSuccess,
  danger: palette.accentDanger,
  warn: palette.accentWarn,
};

export function StatCard({ label, value, delta, tone = "neutral" }: StatCardProps) {
  return (
    <AppCard style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: toneMap[tone] }]}>{value}</Text>
      {delta ? <Text style={styles.delta}>{delta}</Text> : <View style={styles.spacer} />}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minWidth: 145,
    gap: 10,
  },
  label: {
    ...typography.caption,
    color: palette.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  value: {
    ...typography.h2,
  },
  delta: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  spacer: {
    height: 16,
  },
});
