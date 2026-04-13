import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { useAuth } from "@app/providers/AuthProvider";
import { AppCard } from "@design/components/AppCard";
import { PrimaryButton } from "@design/components/PrimaryButton";
import { palette, spacing, typography } from "@design/theme";
import { createLedgerRepository } from "@lib/repositories/createLedgerRepository";
import type { SettingsSummary } from "@lib/repositories/types";
import { isSupabaseConfigured } from "@lib/supabase/client";
import { FeatureScaffold } from "@shared/components/FeatureScaffold";
import { SmsSettingsCard } from "@features/settings/components/SmsSettingsCard";
import { useSmsMessages } from "@features/sms/hooks/useSmsMessages";
import {
  getSmsSettings,
  saveSmsSettings,
  updateSmsSetting,
  type SmsSettings,
} from "@lib/sms/smsSettingsStore";
import { DEFAULT_BASE_CURRENCY, DEFAULT_AI_MODEL } from "@lib/constants";

const EMPTY_SETTINGS: SettingsSummary = {
  baseCurrency: DEFAULT_BASE_CURRENCY,
  emailCount: 0,
  accountCount: 0,
  pendingInboxCount: 0,
  transactionCount: 0,
  aiEndpointConfigured: false,
  aiSharedKeyConfigured: false,
  aiModel: DEFAULT_AI_MODEL,
};

export function SettingsScreen() {
  const auth = useAuth();
  const repo = useMemo(() => createLedgerRepository(), []);
  const sms = useSmsMessages();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [summary, setSummary] = useState<SettingsSummary>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [smsSettings, setSmsSettings] = useState<SmsSettings>({
    smsEnabled: false,
    autoDedup: true,
    lastScanDate: null,
    lastScanError: null,
  });
  const [smsSaving, setSmsSaving] = useState(false);

  const appVersion = Constants.expoConfig?.version || "0.1.0";

  useEffect(() => {
    let active = true;
    Promise.all([
      repo.getSettingsSummary(),
      getSmsSettings(repo),
    ])
      .then(([nextSummary, nextSmsSettings]) => {
        if (!active) return;
        setSummary(nextSummary);
        setSmsSettings(nextSmsSettings);
      })
      .catch((err) => {
        if (!active) return;
        setError(String((err as Error)?.message || "Unable to load settings summary"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repo]);

  const onSignOut = async () => {
    setError("");
    setNotice("");
    setSigningOut(true);
    try {
      await auth.signOut();
    } catch (err) {
      setError(String((err as Error)?.message || "Unable to sign out"));
    } finally {
      setSigningOut(false);
    }
  };

  /**
   * Handle SMS scanning toggle
   */
  const handleToggleSms = async (enabled: boolean) => {
    setSmsSaving(true);
    try {
      const updated: SmsSettings = {
        ...smsSettings,
        smsEnabled: enabled,
      };
      await saveSmsSettings(repo, updated);
      setSmsSettings(updated);
    } catch (err) {
      console.error("[Settings] Failed to save SMS toggle:", err);
      setError("Failed to save SMS settings");
    } finally {
      setSmsSaving(false);
    }
  };

  /**
   * Handle SMS permission request
   */
  const handleRequestPermission = async () => {
    await sms.requestPermission();
  };

  /**
   * Handle auto-dedup toggle
   */
  const handleDedupToggle = async (enabled: boolean) => {
    setSmsSaving(true);
    try {
      const updated: SmsSettings = {
        ...smsSettings,
        autoDedup: enabled,
      };
      await saveSmsSettings(repo, updated);
      setSmsSettings(updated);
    } catch (err) {
      console.error("[Settings] Failed to save dedup toggle:", err);
      setError("Failed to save dedup settings");
    } finally {
      setSmsSaving(false);
    }
  };

  return (
    <FeatureScaffold
      title="Settings"
      subtitle="Control security, data, and environment for your LedgerAI account."
      rightLabel={`v${appVersion}`}
    >
      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>Environment</Text>
        <Row label="Supabase auth/data" value={isSupabaseConfigured ? "Configured" : "Missing"} />
        <Row label="Secure session store" value="Enabled (expo-secure-store)" />
        <Row label="Base currency" value={summary.baseCurrency} />
        <Row label="AI endpoint" value={summary.aiEndpointConfigured ? "Configured" : "Not set"} />
        <Row label="AI session auth" value={summary.aiSharedKeyConfigured ? "Active" : "Sign in again"} />
        <Row label="AI model" value={summary.aiModel} />
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>AI Access</Text>
        <Text style={styles.copy}>
          Mobile AI calls authenticate with your signed-in LedgerAI session. No manual AI shared key entry is required for normal users.
        </Text>
        <Row label="Session token ready" value={summary.aiSharedKeyConfigured ? "Yes" : "No"} />
        <Row label="Action if missing" value="Sign out, then sign back in" />
      </AppCard>

      <SmsSettingsCard
        smsEnabled={smsSettings.smsEnabled}
        onToggleSms={handleToggleSms}
        permissionStatus={sms.permissionState.status}
        onRequestPermission={handleRequestPermission}
        lastScanDate={smsSettings.lastScanDate}
        pendingCount={sms.messages.length}
        autoDedup={smsSettings.autoDedup}
        onDedupToggle={handleDedupToggle}
        isLoading={smsSaving || sms.loading}
      />

      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>Workspace Snapshot</Text>
        <Row label="Transactions" value={String(summary.transactionCount)} />
        <Row label="Pending inbox" value={String(summary.pendingInboxCount)} />
        <Row label="Accounts" value={String(summary.accountCount)} />
        <Row label="Email connectors" value={String(summary.emailCount)} />
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        <Text style={styles.userText}>{auth.user?.email || "Signed-in user"}</Text>
        <PrimaryButton title={signingOut ? "Signing out..." : "Sign Out"} onPress={onSignOut} disabled={signingOut} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </AppCard>
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={palette.accentBlue} />
          <Text style={styles.copy}>Loading account-backed settings...</Text>
        </View>
      ) : null}
    </FeatureScaffold>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.h3,
    color: palette.textPrimary,
  },
  row: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  label: {
    ...typography.body,
    color: palette.textSecondary,
    flex: 1,
  },
  value: {
    ...typography.body,
    color: palette.textPrimary,
    fontWeight: "700",
    textAlign: "right",
  },
  copy: {
    ...typography.body,
    color: palette.textSecondary,
  },
  userText: {
    ...typography.body,
    color: palette.accentTeal,
  },
  error: {
    ...typography.caption,
    color: palette.accentDanger,
  },
  notice: {
    ...typography.caption,
    color: palette.accentSuccess,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
