import * as DocumentPicker from "expo-document-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppCard } from "@design/components/AppCard";
import { PrimaryButton } from "@design/components/PrimaryButton";
import { TextField } from "@design/components/TextField";
import { palette, spacing, typography } from "@design/theme";
import { getResponsiveSpacing, useDeviceType } from "@design/responsive";
import { readStatementDocumentText } from "@lib/reconciliation/reconciliationProcessing";
import { createLedgerRepository } from "@lib/repositories/createLedgerRepository";
import type {
  BookkeepingAccount,
  ReconciliationItem,
  ReconciliationRun,
  ReconciliationSummary,
} from "@lib/repositories/types";
import { FeatureScaffold } from "@shared/components/FeatureScaffold";

const EMPTY_SUMMARY: ReconciliationSummary = {
  runCount: 0,
  unresolvedItems: 0,
  latestRange: "No runs yet",
};

function defaultFromDate() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ReconciliationScreen() {
  const repo = useMemo(() => createLedgerRepository(), []);
  const device = useDeviceType();
  const [summary, setSummary] = useState<ReconciliationSummary>(EMPTY_SUMMARY);
  const [runs, setRuns] = useState<ReconciliationRun[]>([]);
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [accounts, setAccounts] = useState<BookkeepingAccount[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [statementFrom, setStatementFrom] = useState(defaultFromDate);
  const [statementTo, setStatementTo] = useState(todayIso);
  const [sourceText, setSourceText] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [editingItem, setEditingItem] = useState<ReconciliationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [viewMode, setViewMode] = useState<"overview" | "items">("overview");

  const loadRuns = useCallback(async(isRefresh = false, preferredRunId = "", preferredAccountId = "") => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [nextSummary, nextRuns, nextAccounts, nextSettings] = await Promise.all([
        repo.getReconciliationSummary(),
        repo.listReconciliationRuns(),
        repo.listAccounts(),
        repo.getSettingsSummary(),
      ]);
      const fallbackRunId = preferredRunId || nextRuns[0]?.id || "";
      const nextItems = await repo.listReconciliationItems(fallbackRunId);

      setSummary(nextSummary);
      setRuns(nextRuns);
      setItems(nextItems);
      setSelectedRunId(fallbackRunId);
      setAccounts(nextAccounts);
      setAiReady(nextSettings.aiEndpointConfigured && nextSettings.aiSharedKeyConfigured);
      setSelectedAccountId((current) => {
        const requested = preferredAccountId || current;
        if (requested && nextAccounts.some((item) => item.id === requested)) return requested;
        return nextAccounts[0]?.id || "";
      });
      setError("");
    } catch (err) {
      setError(String((err as Error)?.message || "Unable to load reconciliation status"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [repo]);

  useEffect(() => {
    loadRuns().catch(() => undefined);
  }, [loadRuns]);

  const selectedRun = runs.find((run) => run.id === selectedRunId) || runs[0] || null;
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) || null;

  const changeRun = async(runId: string) => {
    setSelectedRunId(runId);
    setRefreshing(true);
    try {
      const nextItems = await repo.listReconciliationItems(runId);
      setItems(nextItems);
      setError("");
    } catch (err) {
      setError(String((err as Error)?.message || "Unable to load reconciliation items"));
    } finally {
      setRefreshing(false);
    }
  };

  const pickStatementFile = async() => {
    setFileBusy(true);
    setError("");
    setNotice("");
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: [
          "text/plain",
          "text/csv",
          "application/csv",
          "application/json",
          "application/xml",
          "text/xml",
          "application/pdf",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled) return;
      const asset = picked.assets?.[0];
      if (!asset) throw new Error("No statement file was selected.");
      const loaded = await readStatementDocumentText(asset);
      setSourceText(loaded.text);
      setSourceLabel(loaded.label);
      setNotice(`Loaded statement file: ${loaded.label}`);
    } catch (err) {
      setError(String((err as Error)?.message || "Unable to load the statement file."));
    } finally {
      setFileBusy(false);
    }
  };

  const clearStatement = () => {
    setSourceText("");
    setSourceLabel("");
    setNotice("");
    setError("");
  };

  const createRun = async() => {
    if (!selectedAccount) {
      setError("Select an account before starting reconciliation.");
      return;
    }
    setCreating(true);
    setError("");
    setNotice("");
    try {
      const created = await repo.createReconciliationRun({
        accountId: selectedAccount.id,
        statementFrom,
        statementTo,
        sourceText,
        sourceLabel,
        sourceKind: sourceLabel ? "upload" : "paste",
      });
      setSourceText("");
      setSourceLabel("");
      setNotice(
        `Reconciliation run created. Matched ${created.matchedCount}, mismatches ${created.mismatchCount}, statement only ${created.statementOnlyCount}, ledger only ${created.ledgerOnlyCount}.`,
      );
      await loadRuns(true, created.run.id, selectedAccount.id);
    } catch (err) {
      setError(String((err as Error)?.message || "Unable to create the reconciliation run."));
    } finally {
      setCreating(false);
    }
  };

  const saveItem = async(hidden: boolean) => {
    if (!editingItem) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await repo.updateReconciliationItem({
        id: editingItem.id,
        description: editingItem.description,
        hidden,
      });
      setNotice(hidden ? "Reconciliation item marked resolved." : "Reconciliation item updated.");
      setEditingItem(null);
      await loadRuns(true, selectedRunId, selectedAccountId);
    } catch (err) {
      setError(String((err as Error)?.message || "Unable to update reconciliation item"));
    } finally {
      setSaving(false);
    }
  };

  const resolveItem = (item: ReconciliationItem) => {
    Alert.alert(
      "Resolve reconciliation item",
      "Mark this reconciliation item as resolved?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Resolve",
          onPress: async() => {
            setSaving(true);
            setError("");
            setNotice("");
            try {
              await repo.updateReconciliationItem({
                id: item.id,
                description: item.description,
                hidden: true,
              });
              if (editingItem?.id === item.id) setEditingItem(null);
              setNotice("Reconciliation item marked resolved.");
              await loadRuns(true, selectedRunId, selectedAccountId);
            } catch (err) {
              setError(String((err as Error)?.message || "Unable to resolve reconciliation item"));
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  return (
    <FeatureScaffold
      title="Reconciliation"
      subtitle="Import statements, match transactions, and resolve discrepancies."
      rightLabel={`${summary.unresolvedItems} open`}
    >
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadRuns(true, selectedRunId, selectedAccountId)}
            tintColor={palette.accentBlue}
          />
        }
        scrollEnabled={false}
        nestedScrollEnabled={true}
      >
        {/* Reconciliation Overview Card */}
        <AppCard style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.cardTitle}>Overview</Text>
            <PrimaryButton
              title={refreshing ? "Refreshing..." : "Refresh"}
              onPress={() => loadRuns(true, selectedRunId, selectedAccountId)}
              disabled={refreshing || loading}
              variant="secondary"
              size="small"
            />
          </View>
          <View style={styles.summaryGrid}>
            <Metric label="Total Runs" value={String(summary.runCount)} />
            <Metric label="Open Items" value={String(summary.unresolvedItems)} tone="warn" />
            <Metric label="Latest Period" value={summary.latestRange} />
          </View>
        </AppCard>

        {/* Reconciliation History */}
        {runs.length > 0 && (
          <AppCard style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <Text style={styles.cardTitle}>History</Text>
            </View>
            <View style={styles.runList}>
              {runs.map((run) => {
                const isSelected = selectedRunId === run.id;
                const matchPercentage =
                  run.matchedCount + run.mismatchCount > 0
                    ? Math.round((run.matchedCount / (run.matchedCount + run.mismatchCount)) * 100)
                    : 0;
                return (
                  <PrimaryButton
                    key={run.id}
                    title={`${run.accountName || "Account"} · ${run.statementFrom} to ${run.statementTo}`}
                    onPress={() => changeRun(run.id)}
                    variant={isSelected ? "primary" : "secondary"}
                    size="small"
                  />
                );
              })}
            </View>
            {selectedRun && (
              <View style={styles.runDetail}>
                <Text style={styles.detailLabel}>Status: {selectedRun.status}</Text>
                <Text style={styles.detailLabel}>
                  Matched: {selectedRun.matchedCount} · Mismatches: {selectedRun.mismatchCount} · Statement Only: {selectedRun.statementOnlyCount} · Ledger Only: {selectedRun.ledgerOnlyCount}
                </Text>
                {selectedRun.finishedAt && (
                  <Text style={styles.detailLabel}>
                    Completed: {new Date(selectedRun.finishedAt).toLocaleDateString()}
                  </Text>
                )}
                {selectedRun.errorMessage && (
                  <Text style={styles.errorLabel}>Error: {selectedRun.errorMessage}</Text>
                )}
              </View>
            )}
          </AppCard>
        )}

        {/* Unresolved Items */}
        {selectedRun && items.length > 0 && (
          <AppCard style={styles.itemsCard}>
            <View style={styles.itemsHeader}>
              <Text style={styles.cardTitle}>Unresolved Items</Text>
              <Text style={styles.itemCount}>{items.length}</Text>
            </View>
            <View style={styles.itemsList}>
              {items.map((item) => (
                <ReconciliationItemRow
                  key={item.id}
                  item={item}
                  onEdit={() => setEditingItem(item)}
                  onResolve={() => resolveItem(item)}
                  device={device}
                />
              ))}
            </View>
          </AppCard>
        )}

        {/* No Items Message */}
        {selectedRun && !loading && items.length === 0 && (
          <AppCard style={styles.emptyCard}>
            <Text style={styles.copy}>No unresolved items for this run. All transactions have been matched!</Text>
          </AppCard>
        )}

        {/* New Reconciliation Run Card */}
        <AppCard style={styles.createCard}>
          <Text style={styles.cardTitle}>Start a New Run</Text>
          <Text style={styles.copy}>
            Upload a bank statement file or paste statement text. LedgerAI will parse and match transactions against your ledger.
          </Text>
          <Text style={styles.helper}>
            Supported: CSV, TXT, JSON, XML, or text-based PDF. Image-only PDFs need OCR preprocessing.
          </Text>

          {!aiReady && (
            <Text style={styles.warn}>
              AI endpoint not configured. Check Settings to enable statement parsing.
            </Text>
          )}

          {!accounts.length ? (
            <Text style={styles.warn}>Create at least one account before reconciliation.</Text>
          ) : (
            <>
              {/* Account Selection */}
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionLabel}>Account</Text>
                <View style={styles.chipWrap}>
                  {accounts.map((account) => (
                    <PrimaryButton
                      key={account.id}
                      title={account.name}
                      onPress={() => setSelectedAccountId(account.id)}
                      variant={selectedAccountId === account.id ? "primary" : "secondary"}
                      size="small"
                    />
                  ))}
                </View>
                {selectedAccount && (
                  <Text style={styles.helper}>
                    {selectedAccount.type} · {selectedAccount.classType} · Balance{" "}
                    {formatMoney(selectedAccount.balance, selectedAccount.currency || "INR")}
                  </Text>
                )}
              </View>

              {/* Date Range */}
              <View style={device === "tablet" ? styles.inputRowTablet : styles.inputRow}>
                <View style={styles.inputCol}>
                  <TextField
                    label="From Date"
                    value={statementFrom}
                    onChangeText={setStatementFrom}
                    placeholder="YYYY-MM-DD"
                    hint="Inclusive"
                  />
                </View>
                <View style={styles.inputCol}>
                  <TextField
                    label="To Date"
                    value={statementTo}
                    onChangeText={setStatementTo}
                    placeholder="YYYY-MM-DD"
                    hint="Inclusive"
                  />
                </View>
              </View>

              {/* File Upload */}
              <View style={styles.fileActions}>
                <PrimaryButton
                  title={fileBusy ? "Loading..." : "Pick File"}
                  onPress={pickStatementFile}
                  disabled={fileBusy || creating}
                  variant="secondary"
                  style={styles.fileButton}
                />
                <PrimaryButton
                  title="Clear"
                  onPress={clearStatement}
                  disabled={creating || fileBusy || (!sourceText && !sourceLabel)}
                  variant="ghost"
                  style={styles.fileButton}
                />
              </View>

              {sourceLabel && (
                <Text style={styles.helper}>Loaded: {sourceLabel}</Text>
              )}

              {/* Statement Text Input */}
              <TextField
                label="Statement Text"
                value={sourceText}
                onChangeText={setSourceText}
                placeholder="Paste bank statement text here…"
                multiline
                numberOfLines={6}
                style={styles.statementInput}
              />

              {/* Run Reconciliation Button */}
              <PrimaryButton
                title={creating ? "Processing..." : "Run Reconciliation"}
                onPress={createRun}
                disabled={creating || fileBusy || !aiReady || !selectedAccountId || !sourceText.trim()}
              />
            </>
          )}
        </AppCard>

        {/* Edit Item Modal Card */}
        {editingItem && (
          <AppCard style={styles.editorCard}>
            <Text style={styles.cardTitle}>Edit Item</Text>
            <Text style={styles.copy}>
              {editingItem.itemKind.replace(/_/g, " ")} ·{" "}
              {formatMoney(
                editingItem.statementAmount || editingItem.ledgerAmount || 0,
                editingItem.baseCurrency || editingItem.currency || "INR"
              )}
            </Text>
            <TextField
              label="Description"
              value={editingItem.description}
              onChangeText={(value) =>
                setEditingItem((current) => (current ? { ...current, description: value } : current))
              }
              autoCapitalize="sentences"
              multiline
              numberOfLines={3}
            />
            <View style={styles.editorActions}>
              <PrimaryButton
                title={saving ? "Saving..." : "Save"}
                onPress={() => saveItem(false)}
                disabled={saving}
                style={styles.actionButton}
              />
              <PrimaryButton
                title="Mark Resolved"
                onPress={() => saveItem(true)}
                disabled={saving}
                variant="secondary"
                style={styles.actionButton}
              />
              <PrimaryButton
                title="Cancel"
                onPress={() => setEditingItem(null)}
                disabled={saving}
                variant="ghost"
                style={styles.actionButton}
              />
            </View>
          </AppCard>
        )}

        {/* Loading Indicator */}
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={palette.accentBlue} />
            <Text style={styles.copy}>Loading reconciliation data...</Text>
          </View>
        )}

        {/* Messages */}
        {notice && <Text style={styles.notice}>{notice}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    </FeatureScaffold>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "warn" }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, tone === "warn" && styles.warnText]}>{value}</Text>
    </View>
  );
}

function ReconciliationItemRow({
  item,
  onEdit,
  onResolve,
  device,
}: {
  item: ReconciliationItem;
  onEdit: () => void;
  onResolve: () => void;
  device: "phone" | "tablet";
}) {
  const getItemColor = () => {
    if (item.itemKind === "matched") return palette.accentSuccess;
    if (item.itemKind === "statement_only") return palette.accentWarn;
    if (item.itemKind === "ledger_only") return palette.accentDanger;
    return palette.textSecondary;
  };

  const itemColor = getItemColor();

  return (
    <View style={[styles.itemRow, { borderLeftColor: itemColor, borderLeftWidth: 3 }]}>
      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <Text style={[styles.itemTitle, { color: itemColor }]}>
            {item.itemKind.replace(/_/g, " ").toUpperCase()}
          </Text>
          <Text style={styles.itemScore}>Score: {Math.round(item.score)}%</Text>
        </View>

        <Text style={styles.itemDate}>
          {item.statementDate || item.ledgerDate || "Unknown date"}
        </Text>

        {item.description && (
          <Text style={styles.itemDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.amountRow}>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>Statement</Text>
            <Text style={styles.amount}>
              {formatMoney(item.statementAmount || 0, item.baseCurrency || item.currency || "INR")}
            </Text>
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>Ledger</Text>
            <Text style={styles.amount}>
              {formatMoney(item.ledgerAmount || 0, item.baseCurrency || item.currency || "INR")}
            </Text>
          </View>
          {item.amountGap !== 0 && (
            <View style={styles.amountCol}>
              <Text style={styles.amountLabel}>Gap</Text>
              <Text style={[styles.amount, { color: palette.accentWarn }]}>
                {formatMoney(Math.abs(item.amountGap), item.baseCurrency || item.currency || "INR")}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={device === "tablet" ? styles.itemActionsTablet : styles.itemActions}>
        <PrimaryButton title="Edit" onPress={onEdit} variant="secondary" size="small" />
        <PrimaryButton title="Resolve" onPress={onResolve} size="small" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    gap: spacing.sm,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  summaryGrid: {
    gap: spacing.xs,
  },
  metricCard: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: spacing.sm,
  },
  metricLabel: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  metricValue: {
    ...typography.body,
    color: palette.textPrimary,
    fontWeight: "700",
    marginTop: 2,
  },
  cardTitle: {
    ...typography.h3,
    color: palette.textPrimary,
  },
  copy: {
    ...typography.body,
    color: palette.textSecondary,
  },
  helper: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  warn: {
    ...typography.caption,
    color: palette.accentWarn,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: `${palette.accentWarn}20`,
    borderRadius: 6,
    marginVertical: spacing.xs,
  },
  warnText: {
    color: palette.accentWarn,
  },
  errorLabel: {
    ...typography.caption,
    color: palette.accentDanger,
    marginTop: spacing.xs,
  },
  sectionBlock: {
    gap: spacing.xs,
  },
  sectionLabel: {
    ...typography.caption,
    color: palette.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  inputRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  inputRowTablet: {
    flexDirection: "row",
    gap: spacing.md,
  },
  inputCol: {
    flex: 1,
  },
  fileActions: {
    flexDirection: "row",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  fileButton: {
    flex: 1,
    minWidth: 100,
  },
  statementInput: {
    minHeight: 140,
    textAlignVertical: "top",
  },
  historyCard: {
    gap: spacing.sm,
  },
  historyHeader: {
    marginBottom: spacing.xs,
  },
  runList: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  runDetail: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  detailLabel: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  itemsCard: {
    gap: spacing.sm,
  },
  itemsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  itemCount: {
    ...typography.h3,
    color: palette.accentBlue,
  },
  itemsList: {
    gap: spacing.sm,
  },
  itemRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  itemContent: {
    flex: 1,
    gap: spacing.xs,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.xs,
  },
  itemTitle: {
    ...typography.body,
    fontWeight: "700",
    flex: 1,
  },
  itemScore: {
    ...typography.caption,
    color: palette.textSecondary,
    fontWeight: "600",
  },
  itemDate: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  itemDescription: {
    ...typography.caption,
    color: palette.textPrimary,
    fontStyle: "italic",
  },
  amountRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  amountCol: {
    flex: 1,
    minWidth: 80,
  },
  amountLabel: {
    ...typography.caption,
    color: palette.textSecondary,
    marginBottom: 2,
  },
  amount: {
    ...typography.body,
    color: palette.textPrimary,
    fontWeight: "600",
  },
  itemActions: {
    gap: spacing.xs,
    justifyContent: "flex-start",
  },
  itemActionsTablet: {
    gap: spacing.sm,
    justifyContent: "flex-end",
    minWidth: 160,
  },
  createCard: {
    gap: spacing.sm,
  },
  emptyCard: {
    gap: spacing.sm,
  },
  editorCard: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: palette.accentBlue,
    backgroundColor: `${palette.accentBlue}10`,
  },
  editorActions: {
    flexDirection: "row",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  actionButton: {
    flex: 1,
    minWidth: 90,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  error: {
    ...typography.caption,
    color: palette.accentDanger,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: `${palette.accentDanger}20`,
    borderRadius: 6,
  },
  notice: {
    ...typography.caption,
    color: palette.accentSuccess,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: `${palette.accentSuccess}20`,
    borderRadius: 6,
  },
});
