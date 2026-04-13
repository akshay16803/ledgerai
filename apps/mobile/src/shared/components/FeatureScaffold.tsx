import { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBackground } from "@design/components/AppBackground";
import { SectionHeader } from "@design/components/SectionHeader";
import { palette, spacing, typography } from "@design/theme";

type FeatureScaffoldProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  rightLabel?: string;
}>;

export function FeatureScaffold({ title, subtitle, rightLabel, children }: FeatureScaffoldProps) {
  return (
    <AppBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.headerRow}>
          <SectionHeader title={title} subtitle={subtitle} />
          {rightLabel ? <Text style={styles.rightLabel}>{rightLabel}</Text> : null}
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: spacing.xs,
  },
  rightLabel: {
    ...typography.caption,
    color: palette.textSecondary,
    marginBottom: 3,
  },
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
});
