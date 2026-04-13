import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppBackground } from "@design/components/AppBackground";
import { AppCard } from "@design/components/AppCard";
import { PrimaryButton } from "@design/components/PrimaryButton";
import { TextField } from "@design/components/TextField";
import { palette, spacing, typography } from "@design/theme";

type ResetPasswordScreenProps = {
  configured: boolean;
  onUpdatePassword: (password: string) => Promise<void>;
  onDismiss: () => void;
};

export function ResetPasswordScreen({ configured, onUpdatePassword, onDismiss }: ResetPasswordScreenProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const hasMismatch = confirmPassword.trim().length > 0 && password !== confirmPassword;
  const disabled = useMemo(
    () => password.trim().length < 8 || !confirmPassword.trim() || hasMismatch || loading || !configured,
    [configured, confirmPassword, hasMismatch, loading, password],
  );

  const submit = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await onUpdatePassword(password);
      setSuccess("Password updated. You can continue into LedgerAI with this session.");
    } catch (err) {
      setError(String((err as Error)?.message || "Unable to update password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppBackground padded>
      <View style={styles.root}>
        <Text style={styles.title}>Choose a new password</Text>
        <AppCard style={styles.card}>
          <TextField label="New Password" placeholder="At least 8 characters" value={password} onChangeText={setPassword} secureTextEntry />
          <TextField label="Confirm Password" placeholder="Repeat password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
          {hasMismatch ? <Text style={styles.error}>Passwords do not match.</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.success}>{success}</Text> : null}
          <PrimaryButton title={loading ? "Saving..." : "Save new password"} onPress={submit} disabled={disabled} />
          <Pressable onPress={onDismiss}>
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
