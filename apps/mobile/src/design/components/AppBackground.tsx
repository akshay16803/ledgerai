import { PropsWithChildren } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import { palette } from "@design/theme";

type AppBackgroundProps = PropsWithChildren<{
  padded?: boolean;
}>;

export function AppBackground({ children, padded = false }: AppBackgroundProps) {
  return (
    <LinearGradient colors={[palette.bgTop, palette.bgBottom]} style={styles.root}>
      <View style={[styles.content, padded && styles.padded]}>{children}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
