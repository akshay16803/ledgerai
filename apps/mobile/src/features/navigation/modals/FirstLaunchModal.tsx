import { useState } from "react";
import { Modal, View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { smsNativeModule } from "@lib/sms/smsNativeModule";
import { palette, spacing, typography } from "@design/theme";
import { PrimaryButton } from "@design/components/PrimaryButton";

/**
 * Props for FirstLaunchModal component
 */
export type FirstLaunchModalProps = {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback when modal should be dismissed */
  onDismiss: () => void;
};

/**
 * First Launch Modal Component
 *
 * SMS permission prompt modal displayed on first app launch.
 * Allows users to grant SMS permission for transaction analysis or defer with "Not Now".
 * Modal can be dismissed by tapping "Not Now" or after permission request completes.
 *
 * @example
 * ```tsx
 * <FirstLaunchModal
 *   visible={showSmsPrompt}
 *   onDismiss={() => setShowSmsPrompt(false)}
 * />
 * ```
 */
export function FirstLaunchModal({ visible, onDismiss }: FirstLaunchModalProps) {
  const [loading, setLoading] = useState(false);

  const handleGrantPermission = async () => {
    setLoading(true);
    try {
      const granted = await smsNativeModule.requestPermission();
      console.debug("[SMS] Permission request completed:", granted ? "granted" : "denied");
    } catch (err) {
      console.error("[SMS] Permission request failed:", err);
    } finally {
      setLoading(false);
      onDismiss();
    }
  };

  const handleDismiss = () => {
    setLoading(false);
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Title */}
          <Text style={styles.title}>SMS Access Needed</Text>

          {/* Message */}
          <Text style={styles.message}>
            LedgerAI can read SMS messages to help you track transactions automatically.
          </Text>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <PrimaryButton
              title={loading ? "Requesting..." : "Grant Permission"}
              onPress={handleGrantPermission}
              disabled={loading}
            />
            <PrimaryButton
              title="Not Now"
              onPress={handleDismiss}
              disabled={loading}
              variant="secondary"
            />
          </View>

          {/* Loading Indicator (optional visual feedback) */}
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color={palette.accentBlue} />
              <Text style={styles.loadingText}>Processing...</Text>
            </View>
          )}

          {/* Footer Hint */}
          <Text style={styles.hint}>You can change this in Settings anytime.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    marginHorizontal: spacing.xl,
    width: "90%",
    maxWidth: 400,
  },
  title: {
    ...typography.h3,
    color: palette.textPrimary,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  message: {
    ...typography.body,
    color: palette.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  buttonContainer: {
    gap: spacing.md,
    marginVertical: spacing.md,
  },
  hint: {
    ...typography.caption,
    color: palette.textSecondary,
    textAlign: "center",
    marginTop: spacing.md,
  },
  loadingOverlay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.caption,
    color: palette.textSecondary,
  },
});
