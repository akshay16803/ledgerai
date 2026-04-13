import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppBackground } from "@design/components/AppBackground";
import { AppCard } from "@design/components/AppCard";
import { PrimaryButton } from "@design/components/PrimaryButton";
import { TextField } from "@design/components/TextField";
import { palette, spacing, typography } from "@design/theme";

type SignInScreenProps = {
  configured: boolean;
  onSignIn: (email: string, password: string) => Promise<void>;
  onGoToSignUp: () => void;
  onGoToForgot: () => void;
};

export function SignInScreen({ configured, onSignIn, onGoToSignUp, onGoToForgot }: SignInScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const disabled = useMemo(() => !email.trim() || !password.trim() || loading || !configured, [email, password, loading, configured]);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      await onSignIn(email.trim(), password);
    } catch (err) {
      setError(String((err as Error)?.message || "Sign in failed."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppBackground padded>
      <View style={styles.root}>
        <View style={styles.heading}>
          <Text style={styles.brand}>LedgerAI</Text>
          <Text style={styles.subtitle}>Secure finance operations across web, Android, and iOS.</Text>
        </View>

        <AppCard style={styles.card}>
          <TextField label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <TextField label="Password" placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry />

          {!configured ? <Text style={styles.warn}>This mobile build is missing secure account setup. Ask the app owner to finish the mobile environment configuration before testing sign-in.</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton title={loading ? "Signing In..." : "Sign In"} onPress={submit} disabled={disabled} />

          <View style={styles.row}>
            <Pressable onPress={onGoToForgot}>
              <Text style={styles.link}>Forgot password?</Text>
            </Pressable>
            <Pressable onPress={onGoToSignUp}>
              <Text style={styles.link}>Create account</Text>
            </Pressable>
          </View>
        </AppCard>
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.lg,
    paddingBottom: 60,
  },
  heading: {
    gap: 8,
  },
  brand: {
    ...typography.h1,
    color: palette.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: palette.textSecondary,
    maxWidth: 360,
  },
  card: {
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  link: {
    ...typography.caption,
    color: palette.accentBlue,
    fontWeight: "700",
  },
  warn: {
    ...typography.caption,
    color: palette.accentWarn,
  },
  error: {
    ...typography.caption,
    color: palette.accentDanger,
  },
});
