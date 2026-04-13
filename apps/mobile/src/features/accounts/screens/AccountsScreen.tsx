import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { AppCard } from "@design/components/AppCard";
import { PrimaryButton } from "@design/components/PrimaryButton";
import { TextField } from "@design/components/TextField";
import { palette, spacing, typography } from "@design/theme";
import { useDeviceType } from "@design/responsive";
import { createLedgerRepository } from "@lib/repositories/createLedgerRepository";
import type { BookkeepingAccount, BookkeepingAccountDraft } from "@lib/repositories/types";
import { requireSupabaseClient } from "@lib/supabase/client";
import { FeatureScaffold } from "@shared/components/FeatureScaffold";

const CLASS_TYPE_OPTIONS = ["asset", "liability", "equity", "income", "expense"] as const;

function formatMoney(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function makeAccountDraft(overrides: Partial<BookkeepingAccountDraft> = {}): BookkeepingAccountDraft {
  return {
    name: "",
    type: "",
    classType: "asset",
    bank: "",
    number: "",
    balance: 0,
    ...overrides,
  };
}

export function AccountsScreen() {
  const repo = useMemo(() => createLedgerRepository(), []);
  const device = useDeviceType();
  const [accounts, setAccounts] = useState<BookkeepingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<BookkeepingAccountDraft | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const next = await repo.listAccounts();
      setAccounts(next);
      setError("");
    } catch (err) {
      setError(String((err as Error)?.message || "Unable to load accounts"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [repo]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const saveEditor = async () => {
    if (!editor) return;
    if (!editor.name.trim()) {
      setError("Enter an account name before saving.");
      return;
    }
    if (!CLASS_TYPE_OPTIONS.includes(editor.classType as typeof CLASS_TYPE_OPTIONS[number])) {
      setError("Choose a valid account class before saving.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await repo.saveAccount(editor);
      setNotice(editor.id ? "Account updated." : "Account created.");
      setEditor(null);
      await load(true);
    } catch (err) {
      setError(String((err as Error)?.message || "Unable to save account"));
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async (accountId: string) => {
    setError("");
    setNotice("");
    try {
      const client = requireSupabaseClient();
      await client
        .from("ledger_bookkeeping_accounts")
        .delete()
        .eq("id", accountId);
      setNotice("Account deleted.");
      setShowDeleteConfirm(null);
      await load(true);
    } catch (err) {
      setError(String((err as Error)?.message || "Unable to delete account"));
    }
  };

  const groupedAccounts = useMemo(() => {
    const groups: Record<string, BookkeepingAccount[]> = {
      asset: [],
      liability: [],
    };
    accounts.forEach((acc) => {
      const key = acc.classType.toLowerCase() as keyof typeof groups;
      if (key in groups) {
        groups[key].push(acc);
      }
    });
    return groups;
  }, [accounts]);

  const assetTotal = useMemo(() => groupedAccounts.asset.reduce((sum, acc) => sum + acc.balance, 0), [groupedAccounts]);
  const liabilityTotal = useMemo(() => groupedAccounts.liability.reduce((sum, acc) => sum + acc.balance, 0), [groupedAccounts]);

  const accountsToDisplay = [
    ...groupedAccounts.asset,
    ...groupedAccounts.liability,
  ];

  const renderAccountSection = (title: string, items: BookkeepingAccount[], total: number) => {
    if (items.length === 0) return null;

    return (
      <View key={title} style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={[styles.sectionTotal, total >= 0 ? styles.positive : styles.negative]}>
            {formatMoney(total)}
          </Text>
        </View>
        {items.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            onEdit={() =>
              setEditor(
                makeAccountDraft({
                  id: account.id,
                  name: account.name,
                  type: account.type,
                  classType: account.classType,
                  bank: account.bank,
                  number: account.number,
                  balance: account.balance,
                })
              )
            }
            onDelete={() => setShowDeleteConfirm(account.id)}
          />
        ))}
      </View>
    );
  };

  return (
    <FeatureScaffold
      title="Accounts"
      subtitle="Manage your chart of accounts"
      rightLabel={`${accounts.length} active`}
    >
      <View style={styles.container}>
        {/* Add Account Button */}
        <PrimaryButton
          title="Add Account"
          onPress={() => setEditor(makeAccountDraft())}
          style={styles.addButton}
        />

        {/* Pull-to-Refresh and Content */}
        <FlatList
          data={[null]} // Dummy item for FlatList wrapper
          keyExtractor={() => "accounts"}
          renderItem={() => (
            <View style={styles.content}>
              {/* Empty State */}
              {!loading && accounts.length === 0 && (
                <AppCard style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No accounts yet</Text>
                  <Text style={styles.emptyCopy}>
                    Add your first account to get started tracking your finances.
                  </Text>
                </AppCard>
              )}

              {/* Account Sections */}
              {accounts.length > 0 && (
                <>
                  {renderAccountSection("Assets", groupedAccounts.asset, assetTotal)}
                  {renderAccountSection("Liabilities", groupedAccounts.liability, liabilityTotal)}
                </>
              )}

              {/* Loading Indicator */}
              {loading && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={palette.accentBlue} />
                  <Text style={styles.copy}>Loading accounts...</Text>
                </View>
              )}

              {/* Error and Notice Messages */}
              {notice && <Text style={styles.notice}>{notice}</Text>}
              {error && <Text style={styles.error}>{error}</Text>}
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={palette.accentBlue}
            />
          }
          scrollEnabled={false}
        />

        {/* Editor Modal */}
        {editor && (
          <AppCard style={styles.editorCard}>
            <Text style={styles.editorTitle}>
              {editor.id ? "Edit Account" : "Add Account"}
            </Text>
            <TextField
              label="Account name"
              value={editor.name}
              onChangeText={(value) =>
                setEditor((current) =>
                  current ? { ...current, name: value } : current
                )
              }
              autoCapitalize="words"
            />
            <TextField
              label="Account type label"
              value={editor.type}
              onChangeText={(value) =>
                setEditor((current) =>
                  current ? { ...current, type: value } : current
                )
              }
              autoCapitalize="words"
              hint="Examples: Savings Account, Credit Card, Trading Account"
            />
            <View style={styles.classTypeSection}>
              <Text style={styles.fieldLabel}>Class type</Text>
              <View style={styles.classTypeRow}>
                {CLASS_TYPE_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() =>
                      setEditor((current) =>
                        current ? { ...current, classType: option } : current
                      )
                    }
                    style={[
                      styles.classTypeChip,
                      editor.classType === option && styles.classTypeChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.classTypeChipText,
                        editor.classType === option &&
                          styles.classTypeChipTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <TextField
              label="Bank / provider"
              value={editor.bank}
              onChangeText={(value) =>
                setEditor((current) =>
                  current ? { ...current, bank: value } : current
                )
              }
              autoCapitalize="words"
            />
            <TextField
              label="Account number / last 4"
              value={editor.number}
              onChangeText={(value) =>
                setEditor((current) =>
                  current ? { ...current, number: value } : current
                )
              }
              autoCapitalize="none"
            />
            <TextField
              label="Opening / current balance"
              value={String(editor.balance || "")}
              onChangeText={(value) =>
                setEditor((current) =>
                  current
                    ? {
                        ...current,
                        balance: Number(value.replace(/[^0-9.-]/g, "")) || 0,
                      }
                    : current
                )
              }
              keyboardType="decimal-pad"
              autoCapitalize="none"
            />
            <View style={styles.editorActions}>
              <PrimaryButton
                title={saving ? "Saving..." : editor.id ? "Save changes" : "Create"}
                onPress={saveEditor}
                disabled={saving}
                style={styles.actionButton}
              />
              <PrimaryButton
                title="Cancel"
                onPress={() => setEditor(null)}
                disabled={saving}
                variant="secondary"
                style={styles.actionButton}
              />
            </View>
          </AppCard>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <AppCard style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Delete account?</Text>
            <Text style={styles.confirmMessage}>
              This action cannot be undone. Are you sure?
            </Text>
            <View style={styles.editorActions}>
              <PrimaryButton
                title="Delete"
                onPress={() => deleteAccount(showDeleteConfirm)}
                variant="secondary"
                style={[styles.actionButton, styles.dangerButton]}
              />
              <PrimaryButton
                title="Cancel"
                onPress={() => setShowDeleteConfirm(null)}
                style={styles.actionButton}
              />
            </View>
          </AppCard>
        )}
      </View>
    </FeatureScaffold>
  );
}

type AccountCardProps = {
  account: BookkeepingAccount;
  onEdit: () => void;
  onDelete: () => void;
};

function AccountCard({ account, onEdit, onDelete }: AccountCardProps) {
  const device = useDeviceType();
  const isTablet = device === "tablet";

  return (
    <AppCard
      style={[
        styles.accountCard,
        isTablet && styles.accountCardTablet,
      ]}
    >
      <Pressable style={styles.cardContent} onPress={onEdit}>
        <View style={styles.left}>
          <Text style={styles.accountName}>{account.name}</Text>
          <Text style={styles.accountType}>
            {account.type}
            {account.bank ? ` · ${account.bank}` : ""}
            {account.number ? ` · ${account.number}` : ""}
          </Text>
          <Text style={styles.accountClass}>{account.classType}</Text>
        </View>
        <View style={styles.right}>
          <Text
            style={[
              styles.balance,
              account.balance > 0
                ? styles.positive
                : account.balance < 0
                  ? styles.negative
                  : styles.zeroBalance,
            ]}
          >
            {formatMoney(account.balance, account.currency)}
          </Text>
          <Text style={styles.currency}>{account.currency}</Text>
        </View>
      </Pressable>
      <View style={styles.cardActions}>
        <PrimaryButton
          title="Edit"
          onPress={onEdit}
          size="small"
          style={styles.actionButtonSmall}
        />
        <PrimaryButton
          title="Delete"
          onPress={onDelete}
          size="small"
          variant="secondary"
          style={styles.actionButtonSmall}
        />
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  addButton: {
    marginBottom: spacing.md,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  sectionTitle: {
    ...typography.h3,
    color: palette.textPrimary,
    fontWeight: "600",
  },
  sectionTotal: {
    ...typography.body,
    fontWeight: "700",
  },
  accountCard: {
    gap: spacing.sm,
  },
  accountCardTablet: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  left: {
    flex: 1,
    gap: 4,
  },
  right: {
    alignItems: "flex-end",
    gap: 2,
  },
  accountName: {
    ...typography.body,
    color: palette.textPrimary,
    fontWeight: "600",
  },
  accountType: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  accountClass: {
    ...typography.caption,
    color: palette.textSecondary,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  balance: {
    ...typography.body,
    fontWeight: "700",
  },
  positive: {
    color: palette.accentSuccess,
  },
  negative: {
    color: palette.accentDanger,
  },
  zeroBalance: {
    color: palette.textSecondary,
  },
  currency: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  cardActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  actionButtonSmall: {
    flex: 1,
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    color: palette.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyCopy: {
    ...typography.body,
    color: palette.textSecondary,
    textAlign: "center",
  },
  editorCard: {
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  editorTitle: {
    ...typography.h3,
    color: palette.textPrimary,
  },
  fieldLabel: {
    ...typography.caption,
    color: palette.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  classTypeSection: {
    gap: spacing.xs,
  },
  classTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  classTypeChip: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceElevated,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  classTypeChipActive: {
    backgroundColor: "rgba(91, 140, 255, 0.18)",
    borderColor: palette.accentBlue,
  },
  classTypeChipText: {
    ...typography.caption,
    color: palette.textSecondary,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  classTypeChipTextActive: {
    color: palette.textPrimary,
  },
  editorActions: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  dangerButton: {
    borderColor: palette.accentDanger,
  },
  confirmCard: {
    gap: spacing.md,
    marginVertical: spacing.md,
    backgroundColor: "rgba(244, 105, 105, 0.05)",
    borderColor: palette.accentDanger,
  },
  confirmTitle: {
    ...typography.h3,
    color: palette.accentDanger,
  },
  confirmMessage: {
    ...typography.body,
    color: palette.textSecondary,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  copy: {
    ...typography.body,
    color: palette.textSecondary,
  },
  error: {
    ...typography.caption,
    color: palette.accentDanger,
    marginTop: spacing.sm,
  },
  notice: {
    ...typography.caption,
    color: palette.accentSuccess,
    marginTop: spacing.sm,
  },
});
