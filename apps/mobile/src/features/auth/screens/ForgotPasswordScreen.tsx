import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppBackground } from "@design/components/AppBackground";
import { AppCard } from "@design/components/AppCard";
import { PrimaryButton } from "@design/components/PrimaryButton";
import { TextField } from "@design/components/TextField";
import { palette, spacing, typography } from "@design/theme";

type ForgotPasswordScreenProps = {
  configured: boolean;
  onSendReset: (email: string) => Promise<void>;
  onBackToSignIn: () => void;
};

export function ForgotPasswordScreen({ configured, onSendReset, onBackToSignIn }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const disabled = useMemo(() => !email.trim() || loading || !configured, [email, loading, configured]);

  const submit = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await onSendReset(email.trim());
      setSuccess("Password reset email sent. Check your inbox.");
    } catch (err) {
      setError(String((err as Error)?.message || "Unable to send reset email."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppBackground padded>
      <View style={styles.root}>
        <Text style={styles.title}>Reset password</Text>
        <AppCard style={styles.card}>
          <TextField label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.success}>{success}</Text> : null}
          <PrimaryButton title={loading ? "Sending..." : "Send reset link"} onPress={submit} disabled={disabled} />
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
  error: {
    ...typography.caption,
    color: palette.accentDanger,
  },
  success: {
    ...typography.caption,
    color: palette.accentSuccess,
  },
});
