import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@app/providers/AuthProvider";
import { AppTabs } from "@app/navigation/AppTabs";
import { AuthStack } from "@app/navigation/AuthStack";
import { AppBackground } from "@design/components/AppBackground";
import { palette, typography } from "@design/theme";

export function RootNavigator() {
  const auth = useAuth();

  if (auth.loading) {
    return <BootSplash />;
  }

  if (!auth.configured) {
    return <EnvironmentBlockedScreen />;
  }

  if (auth.recoveryMode) {
    return <AuthStack />;
  }

  return auth.session ? <AppTabs /> : <AuthStack />;
}

function BootSplash() {
  return (
    <AppBackground padded>
      <View style={styles.bootRoot}>
        <Text style={styles.brand}>LedgerAI</Text>
        <ActivityIndicator size="small" color={palette.accentBlue} />
        <Text style={styles.copy}>Preparing secure workspace...</Text>
      </View>
    </AppBackground>
  );
}

function EnvironmentBlockedScreen() {
  return (
    <AppBackground padded>
      <View style={styles.blockedRoot}>
        <Text style={styles.brand}>LedgerAI</Text>
        <Text style={styles.blockedTitle}>Mobile environment setup required</Text>
        <Text style={styles.copy}>
          This mobile build is intentionally blocked until Supabase is configured. Add the mobile public keys and restart Expo before testing sign in.
        </Text>
        <View style={styles.blockList}>
          <Text style={styles.blockItem}>Set `EXPO_PUBLIC_SUPABASE_URL`</Text>
          <Text style={styles.blockItem}>Set `EXPO_PUBLIC_SUPABASE_ANON_KEY`</Text>
          <Text style={styles.blockItem}>Set provider client IDs before testing native Gmail / Outlook connect on mobile</Text>
          <Text style={styles.blockItem}>Confirm the project callback URLs and password reset URLs include the mobile setup you are using</Text>
        </View>
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  bootRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
  },
  brand: {
    ...typography.h1,
    color: palette.textPrimary,
  },
  copy: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  blockedRoot: {
    flex: 1,
    justifyContent: "center",
    gap: 16,
  },
  blockedTitle: {
    ...typography.h2,
    color: palette.textPrimary,
  },
  blockList: {
    gap: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  blockItem: {
    ...typography.body,
    color: palette.textPrimary,
  },
});
