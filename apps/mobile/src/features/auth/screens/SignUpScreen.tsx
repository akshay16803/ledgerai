import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppBackground } from "@design/components/AppBackground";
import { AppCard } from "@design/components/AppCard";
import { PrimaryButton } from "@design/components/PrimaryButton";
import { TextField } from "@design/components/TextField";
import { palette, spacing, typography } from "@design/theme";

type SignUpScreenProps = {
  configured: boolean;
  onSignUp: (email: string, password: string) => Promise<void>;
  onBackToSignIn: () => void;
};

export function SignUpScreen({ configured, onSignUp, onBackToSignIn }: SignUpScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const hasMismatch = confirmPassword.trim().length > 0 && password !== confirmPassword;
  const disabled = useMemo(
    () => !email.trim() || !password.trim() || !confirmPassword.trim() || hasMismatch || loading || !configured,
    [email, password, confirmPassword, hasMismatch, loading, configured],
  );

  const submit = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await onSignUp(email.trim(), password);
      setSuccess("Account created. Check your inbox and confirm your email before signing in.");
    } catch (err) {
      setError(String((err as Error)?.message || "Sign up failed."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppBackground padded>
      <View style={styles.root}>
        <Text style={styles.title}>Create your LedgerAI account</Text>
        <AppCard style={styles.card}>
          <TextField label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <TextField label="Password" placeholder="At least 8 characters" value={password} onChangeText={setPassword} secureTextEntry />
          <TextField label="Confirm Password" placeholder="Repeat password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

          {hasMismatch ? <Text style={styles.error}>Passwords do not match.</Text> : null}
          {!configured ? <Text style={styles.warn}>This mobile build is missing secure account setup. Ask the app owner to finish the mobile environment configuration before testing sign-up.</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.success}>{success}</Text> : null}

          <PrimaryButton title={loading ? "Creating..." : "Create Account"} onPress={submit} disabled={disabled} />
          <Pressable onPress={onBackToSignIn}>
            <Text style={styles.link}>Back to sign in</Text>
          </Pressable>
        </AppCard>
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.md,
    paddingBottom: 40,
  },
  title: {
    ...typography.h2,
    color: palette.textPrimary,
  },
  card: {
    gap: spacing.md,
  },
  link: {
    ...typography.caption,
    color: palette.accentBlue,
    fontWeight: "700",
    textAlign: "center",
  },
  warn: {
    ...typography.caption,
    color: palette.accentWarn,
  },
  error: {
    ...typography.caption,
    color: palette.accentDanger,
  },
  success: {
    ...typography.caption,
    color: palette.accentSuccess,
  },
});
