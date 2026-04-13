import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, AppState, type AppStateStatus, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { AppCard } from "@design/components/AppCard";
import { PrimaryButton } from "@design/components/PrimaryButton";
import { TextField } from "@design/components/TextField";
import { palette, spacing, typography } from "@design/theme";
import { useDeviceType, getResponsiveSpacing } from "@design/responsive";
import { getMobileAccountingValidationMessage, makeTransactionDraft } from "@lib/repositories/accounting";
import { createLedgerRepository } from "@lib/repositories/createLedgerRepository";
import type { LedgerTransaction, LedgerTransactionDraft, TransactionSupportBundle, TransactionType } from "@lib/repositories/types";
import { FeatureScaffold } from "@shared/components/FeatureScaffold";
import { TransactionEditorCard } from "@shared/components/TransactionEditorCard";

function formatMoney(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function getSourceBadgeColor(source: string): string {
  const lowerSource = (source || "").toLowerCase();
  if (lowerSource.includes("email")) return palette.accentBlue;
  if (lowerSource.includes("sms")) return palette.accentTeal;
  return palette.textSecondary;
}

function getSourceBadgeLabel(source: string): string {
  const lowerSource = (source || "").toLowerCase();
  if (lowerSource.includes("email")) return "Email";
  if (lowerSource.includes("sms")) return "SMS";
  return "Manual";
}

const EMPTY_SUPPORT: TransactionSupportBundle = {
  accounts: [],
  activities: [],
  categories: {},
  baseCurrency: "INR",
};

export function LedgerScreen() {
  const repo = useMemo(() => createLedgerRepository(), []);
  const [rows, setRows] = useState<LedgerTransaction[]>([]);
  const [support, setSupport] = useState<TransactionSupportBundle>(EMPTY_SUPPORT);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | TransactionType>("all");
  const [editor, setEditor] = useState<{ mode: "add" | "edit"; form: LedgerTransactionDraft } | null>(null);

  const load = useCallback(async(isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [transactions, nextSupport] = await Promise.all([
        repo.listTransactions(120),
        repo.getTransactionSupportBundle(),
      ]);
      setRows(transactions);
      setSupport(nextSupport);
      setError("");
    } catch (err) {
      setError(String((err as Error)?.message || "Unable to load ledger"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [repo]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  // Subscribe to transaction changes for real-time updates
  useEffect(() => {
    let active = true;

    const unsubscribe = repo.subscribeToTransactions((updatedTx) => {
      console.log("[LEDGER] Transaction updated via subscription:", updatedTx.id);
      if (active) {
        setRows((prev) => {
          const idx = prev.findIndex((t) => t.id === updatedTx.id);
          if (idx >= 0) {
            // Update existing transaction
            return [...prev.slice(0, idx), updatedTx, ...prev.slice(idx + 1)];
          } else {
            // New transaction - add to the top
            return [updatedTx, ...prev];
          }
        });
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [repo]);

  // Handle app focus for delta sync
  useEffect(() => {
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();

    async function handleAppStateChange(state: AppStateStatus) {
      if (state === "active") {
        console.log("[LEDGER] App came to foreground; performing delta sync");
        try {
          const lastSyncTime = await repo.getLastSyncTime();
          const delta = await repo.getChangesSinceLast(lastSyncTime);
          if (delta.transactions.length > 0) {
            setRows((prev) => {
              // Filter out deleted transactions and merge in updates
              let merged = prev.filter((t) => !delta.deletedTransactionIds.includes(t.id));
              for (const remoteTx of delta.transactions) {
                const idx = merged.findIndex((t) => t.id === remoteTx.id);
                if (idx >= 0) {
                  merged[idx] = remoteTx;
                } else {
                  merged.unshift(remoteTx);
                }
              }
              return merged;
            });
            await repo.recordSyncTime(delta.syncedAt);
          }
        } catch (err) {
          console.warn("[LEDGER] Delta sync failed:", err);
        }
      }
    }
  }, [repo]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (typeFilter !== "all" && row.type !== typeFilter) return false;
      if (!needle) return true;
      const haystack = [
        row.description,
        row.category,
        row.subCategory,
        row.businessActivity,
        row.accountName,
        row.vendor,
        row.notes,
      ].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [query, rows, typeFilter]);

  const validationMessage = editor
    ? getMobileAccountingValidationMessage(editor.form, support.accounts)
    : "";

  const openAdd = () => {
    setNotice("");
    setError("");
    setEditor({
      mode: "add",
      form: makeTransactionDraft({
        accountId: support.accounts[0]?.id || "",
      }),
    });
  };

  const openEdit = (row: LedgerTransaction) => {
    setNotice("");
    setError("");
    setEditor({
      mode: "edit",
      form: makeTransactionDraft({
        id: row.id,
        createdAt: row.createdAt,
        amount: row.amount,
        type: row.type,
        description: row.description,
        date: row.date,
        businessActivity: row.businessActivity,
        category: row.category,
        subCategory: row.subCategory,
        accountId: row.accountId,
        targetAccountId: row.targetAccountId,
        liabilityAccountId: row.liabilityAccountId,
        paymentMethod: row.paymentMethod,
        vendor: row.vendor,
        trackVendor: row.trackVendor,
        notes: row.notes,
        borrowSource: row.borrowSource,
      }),
    });
  };

  const saveEditor = async() => {
    if (!editor) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await repo.saveTransaction(editor.form);
      setNotice(editor.mode === "add" ? "Transaction saved to cloud." : "Transaction updated.");
      setEditor(null);
      await load(true);
    } catch (err) {
      setError(String((err as Error)?.message || "Unable to save transaction"));
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = (row: LedgerTransaction) => {
    Alert.alert(
      "Delete transaction",
      `Delete "${row.description || row.category || "this transaction"}" from the ledger?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async() => {
            setError("");
            setNotice("");
            try {
              await repo.deleteTransaction(row.id);
              if (editor?.form.id === row.id) setEditor(null);
              setNotice("Transaction deleted.");
              await load(true);
            } catch (err) {
              setError(String((err as Error)?.message || "Unable to delete transaction"));
            }
          },
        },
      ],
    );
  };

  return (
    <FeatureScaffold
      title="Ledger"
      subtitle="Review, search, filter, add, edit, and delete cloud-backed transactions."
      rightLabel={`${filteredRows.length} shown`}
    >
      <AppCard style={styles.toolbar}>
        <View style={styles.toolbarRow}>
          <Text style={styles.cardTitle}>Filters</Text>
          <View style={styles.toolbarActions}>
            <PrimaryButton title={refreshing ? "Refreshing..." : "Refresh"} onPress={() => load(true)} disabled={refreshing || loading} variant="secondary" size="small" />
            <PrimaryButton title="Add transaction" onPress={openAdd} size="small" />
          </View>
        </View>
        <TextField
          label="Search"
          value={query}
          onChangeText={setQuery}
          placeholder="Search description, category, account, vendor"
          autoCapitalize="none"
        />
        <View style={styles.filterRow}>
          {(["all", "income", "expense", "transfer", "borrow"] as const).map((filter) => (
            <FilterChip
              key={filter}
              label={filter === "all" ? "All" : filter[0].toUpperCase() + filter.slice(1)}
              active={typeFilter === filter}
              onPress={() => setTypeFilter(filter)}
            />
          ))}
        </View>
      </AppCard>

      {editor ? (
        <TransactionEditorCard
          title={editor.mode === "add" ? "Add transaction" : "Edit transaction"}
          submitLabel={editor.mode === "add" ? "Save transaction" : "Save changes"}
          form={editor.form}
          accounts={support.accounts}
          baseCurrency={support.baseCurrency}
          validationMessage={validationMessage}
          helperText={`Mobile entry stores new transactions in your base currency (${support.baseCurrency}).`}
          busy={saving}
          onChange={(patch) => setEditor((current) => current ? { ...current, form: { ...current.form, ...patch } } : current)}
          onSubmit={saveEditor}
          onCancel={() => setEditor(null)}
        />
      ) : null}

      <AppCard style={styles.tableCard}>
        <Text style={styles.cardTitle}>Transactions</Text>
        {!loading && !filteredRows.length ? (
          <Text style={styles.copy}>
            {rows.length ? "No transactions match the current filters." : "No cloud transactions yet for this account. Add your first transaction using the button above."}
          </Text>
        ) : null}

        <FlatList
          data={filteredRows}
          renderItem={({ item }) => <TransactionRow transaction={item} support={support} onPress={openEdit} onDelete={deleteRow} />}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          nestedScrollEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={!loading ? null : (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={palette.accentBlue} />
              <Text style={styles.copy}>Loading ledger rows...</Text>
            </View>
          )}
        />
      </AppCard>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </FeatureScaffold>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SourceBadge({ source }: { source: string }) {
  const device = useDeviceType();
  const badgeColor = getSourceBadgeColor(source);
  const label = getSourceBadgeLabel(source);

  return (
    <View style={[styles.badge, { borderColor: badgeColor, backgroundColor: `${badgeColor}15` }]}>
      <Text style={[styles.badgeText, { color: badgeColor }]}>{label}</Text>
    </View>
  );
}

function TransactionRow({
  transaction,
  support,
  onPress,
  onDelete,
}: {
  transaction: LedgerTransaction;
  support: TransactionSupportBundle;
  onPress: (tx: LedgerTransaction) => void;
  onDelete: (tx: LedgerTransaction) => void;
}) {
  const device = useDeviceType();
  const responsivePadding = device === "tablet" ? spacing.md : spacing.sm;

  return (
    <Pressable
      style={[styles.row, { paddingVertical: responsivePadding }]}
      onPress={() => onPress(transaction)}
    >
      <View style={styles.rowLeft}>
        <View style={styles.rowHeader}>
          <View style={styles.rowMainInfo}>
            <Text style={styles.rowTitle}>
              {transaction.description || transaction.category || transaction.businessActivity || "Untitled transaction"}
            </Text>
            <Text style={styles.rowMeta}>
              {transaction.date}
              {transaction.accountName ? ` · ${transaction.accountName}` : ""}
            </Text>
          </View>
          <SourceBadge source={transaction.source} />
        </View>
        {transaction.category ? (
          <Text style={styles.rowCategory}>{transaction.category}</Text>
        ) : null}
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowAmount, transaction.type === "expense" ? styles.danger : styles.success]}>
          {transaction.type === "expense" ? "-" : "+"}
          {formatMoney(Math.abs(transaction.baseAmount || transaction.amount), transaction.baseCurrency || transaction.currency || support.baseCurrency)}
        </Text>
        <View style={styles.inlineActions}>
          <PrimaryButton title="Edit" onPress={() => onPress(transaction)} variant="secondary" size="small" />
          <PrimaryButton title="Delete" onPress={() => onDelete(transaction)} variant="ghost" size="small" />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    gap: spacing.sm,
  },
  toolbarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  toolbarActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  tableCard: {
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.h3,
    color: palette.textPrimary,
  },
  filterRow: {
    flexDirection: "row",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  pill: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceElevated,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  pillActive: {
    backgroundColor: "rgba(91, 140, 255, 0.2)",
    borderColor: palette.accentBlue,
  },
  pillText: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  pillTextActive: {
    color: palette.textPrimary,
    fontWeight: "700",
  },
  row: {
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  separator: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: spacing.xs,
  },
  rowLeft: {
    gap: spacing.xs,
    flex: 1,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  rowMainInfo: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...typography.body,
    color: palette.textPrimary,
    fontWeight: "600",
  },
  rowMeta: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  rowCategory: {
    ...typography.caption,
    color: palette.accentBlue,
    fontWeight: "600",
  },
  rowRight: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  rowAmount: {
    ...typography.body,
    fontWeight: "700",
  },
  success: {
    color: palette.accentSuccess,
  },
  danger: {
    color: palette.accentDanger,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    ...typography.caption,
    fontWeight: "600",
  },
  inlineActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  copy: {
    ...typography.body,
    color: palette.textSecondary,
    marginTop: spacing.md,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  error: {
    ...typography.caption,
    color: palette.accentDanger,
  },
  notice: {
    ...typography.caption,
    color: palette.accentSuccess,
  },
});
