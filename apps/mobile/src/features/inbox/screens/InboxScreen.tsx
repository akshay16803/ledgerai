import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, AppState, type AppStateStatus, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { AppCard } from "@design/components/AppCard";
import { PrimaryButton } from "@design/components/PrimaryButton";
import { palette, spacing, typography } from "@design/theme";
import { getMobileAccountingValidationMessage } from "@lib/repositories/accounting";
import { createLedgerRepository } from "@lib/repositories/createLedgerRepository";
import type { InboxReviewItem, TransactionSupportBundle } from "@lib/repositories/types";
import { FeatureScaffold } from "@shared/components/FeatureScaffold";
import { TransactionEditorCard } from "@shared/components/TransactionEditorCard";

const EMPTY_SUPPORT: TransactionSupportBundle = {
  accounts: [],
  activities: [],
  categories: {},
  baseCurrency: "INR",
};

type FilterType = "all" | "email" | "sms" | "matched";

function formatMoney(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function getSourceType(item: InboxReviewItem): "email" | "sms" | "both" {
  const source = (item.source || "").toLowerCase();
  if (source.includes("email") && source.includes("sms")) return "both";
  if (source.includes("sms")) return "sms";
  return "email";
}

function hasDeduplicationMatch(item: InboxReviewItem): boolean {
  return item.reviewStatus === "deduped" || item.reviewStatus === "matched";
}

export function InboxScreen() {
  const repo = useMemo(() => createLedgerRepository(), []);
  const [pendingItems, setPendingItems] = useState<InboxReviewItem[]>([]);
  const [support, setSupport] = useState<TransactionSupportBundle>(EMPTY_SUPPORT);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<InboxReviewItem | null>(null);
  const [filterType, setFilterType] = useState<FilterType>("all");

  const load = useCallback(async(isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [items, nextSupport] = await Promise.all([
        repo.listInboxItems(),
        repo.getTransactionSupportBundle(),
      ]);
      setPendingItems(items);
      setSupport(nextSupport);
      setError("");
    } catch (err) {
      setError(String((err as Error)?.message || "Unable to load inbox"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [repo]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  // Subscribe to inbox item changes for real-time updates
  useEffect(() => {
    let active = true;

    const unsubscribe = repo.subscribeToInboxItems((updatedItem) => {
      console.log("[INBOX] Item updated via subscription:", updatedItem.id);
      if (active) {
        setPendingItems((prev) => {
          const idx = prev.findIndex((i) => i.id === updatedItem.id);
          if (idx >= 0) {
            // Update existing item
            return [...prev.slice(0, idx), updatedItem, ...prev.slice(idx + 1)];
          } else {
            // New item - add to the top
            return [updatedItem, ...prev];
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
        console.log("[INBOX] App came to foreground; performing delta sync");
        try {
          const lastSyncTime = await repo.getLastSyncTime();
          const delta = await repo.getChangesSinceLast(lastSyncTime);
          if (delta.inboxItems.length > 0) {
            setPendingItems((prev) => {
              // Filter out deleted items and merge in updates
              let merged = prev.filter((i) => !delta.deletedInboxItemIds.includes(i.id));
              for (const remoteItem of delta.inboxItems) {
                const idx = merged.findIndex((i) => i.id === remoteItem.id);
                if (idx >= 0) {
                  merged[idx] = remoteItem;
                } else {
                  merged.unshift(remoteItem);
                }
              }
              return merged;
            });
            await repo.recordSyncTime(delta.syncedAt);
          }
        } catch (err) {
          console.warn("[INBOX] Delta sync failed:", err);
        }
      }
    }
  }, [repo]);

  const validationMessage = editor
    ? getMobileAccountingValidationMessage(editor, support.accounts)
    : "";

  const saveEditor = async() => {
    if (!editor) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await repo.saveInboxItem(editor);
      setNotice("Pending item updated.");
      setEditor(null);
      await load(true);
    } catch (err) {
      setError(String((err as Error)?.message || "Unable to save inbox item"));
    } finally {
      setSaving(false);
    }
  };

  const approveItem = async(item: InboxReviewItem) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await repo.approveInboxItem(item);
      if (editor?.id === item.id) setEditor(null);
      setNotice("Inbox item approved and posted to the ledger.");
      await load(true);
    } catch (err) {
      setError(String((err as Error)?.message || "Unable to approve inbox item"));
    } finally {
      setSaving(false);
    }
  };

  const discardItem = (item: InboxReviewItem) => {
    Alert.alert(
      "Discard inbox item",
      `Discard "${item.subject || item.description || "this pending item"}" from the inbox?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: async() => {
            setSaving(true);
            setError("");
            setNotice("");
            try {
              await repo.discardInboxItem(item.id);
              if (editor?.id === item.id) setEditor(null);
              setNotice("Inbox item discarded.");
              await load(true);
            } catch (err) {
              setError(String((err as Error)?.message || "Unable to discard inbox item"));
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const markAllReviewed = async() => {
    setError("");
    setNotice("");
    setSaving(true);
    try {
      for (const item of filteredItems) {
        await repo.saveInboxItem({ ...item, reviewStatus: "reviewed" });
      }
      setNotice(`Marked ${filteredItems.length} items as reviewed.`);
      await load(true);
    } catch (err) {
      setError(String((err as Error)?.message || "Unable to mark items as reviewed"));
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = useMemo(() => {
    return pendingItems.filter((item) => {
      if (filterType === "all") return true;
      const sourceType = getSourceType(item);
      if (filterType === "email") return sourceType === "email";
      if (filterType === "sms") return sourceType === "sms";
      if (filterType === "matched") return hasDeduplicationMatch(item);
      return true;
    });
  }, [pendingItems, filterType]);

  const renderInboxItem = ({ item }: { item: InboxReviewItem }) => {
    const sourceType = getSourceType(item);
    const isDeduplicated = hasDeduplicationMatch(item);
    const dedupLabel = isDeduplicated ? "SMS Confirmed" : sourceType === "sms" ? "Pending Match" : null;

    return (
      <AppCard style={styles.item}>
        <View style={styles.itemHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.source}>{sourceType.toUpperCase()}</Text>
            {dedupLabel && (
              <View style={[styles.dedupPill, isDeduplicated ? styles.dedupMatchedPill : styles.dedupPendingPill]}>
                <Text style={[styles.dedupPillText, isDeduplicated ? styles.dedupMatchedText : styles.dedupPendingText]}>
                  {dedupLabel}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.amount}>{formatMoney(item.amount, item.baseCurrency || item.currency || support.baseCurrency)}</Text>
        </View>

        <Text style={styles.subject}>{item.subject || item.description || "Pending review item"}</Text>

        <Text style={styles.meta}>
          {item.date}
          {item.category ? ` · ${item.category}` : ""}
          {item.accountId ? ` · account selected` : " · account missing"}
        </Text>

        <Text style={item.required.length ? styles.required : styles.ready}>
          {item.required.length ? `Mandatory before approve: ${item.required.join(" + ")}` : "Ready to approve"}
        </Text>

        <View style={styles.actions}>
          <PrimaryButton
            title={saving ? "Working..." : "Approve"}
            onPress={() => approveItem(item)}
            disabled={saving}
            style={styles.actionButton}
          />
          <PrimaryButton
            title="Edit"
            onPress={() => setEditor(item)}
            disabled={saving}
            variant="secondary"
            style={styles.actionButton}
          />
          <PrimaryButton
            title="Discard"
            onPress={() => discardItem(item)}
            disabled={saving}
            variant="ghost"
            style={styles.actionButton}
          />
        </View>
      </AppCard>
    );
  };

  const renderFilterChips = () => {
    const filters: Array<{ label: string; type: FilterType }> = [
      { label: "All", type: "all" },
      { label: "Email Only", type: "email" },
      { label: "SMS Only", type: "sms" },
      { label: "Matched", type: "matched" },
    ];

    return (
      <View style={styles.filterContainer}>
        {filters.map((filter) => (
          <PrimaryButton
            key={filter.type}
            title={filter.label}
            onPress={() => setFilterType(filter.type)}
            variant={filterType === filter.type ? "primary" : "secondary"}
            size="small"
            style={styles.filterChip}
          />
        ))}
      </View>
    );
  };

  const renderHeader = () => {
    return (
      <View>
        <AppCard style={styles.toolbar}>
          <View style={styles.toolbarRow}>
            <Text style={styles.cardTitle}>Review Queue</Text>
            <PrimaryButton
              title={refreshing ? "Refreshing..." : "Refresh"}
              onPress={() => load(true)}
              disabled={refreshing || loading}
              variant="secondary"
              size="small"
            />
          </View>
          <Text style={styles.copy}>Approval uses the same mandatory accounting checks as the web product.</Text>
        </AppCard>

        {editor ? (
          <TransactionEditorCard
            title="Edit pending item"
            submitLabel="Save pending item"
            form={editor}
            accounts={support.accounts}
            baseCurrency={support.baseCurrency}
            validationMessage={validationMessage}
            helperText="Save keeps the item in Inbox. Approve moves it into Ledger. Discard removes it."
            busy={saving}
            onChange={(patch) => setEditor((current) => current ? { ...current, ...patch } : current)}
            onSubmit={saveEditor}
            onCancel={() => setEditor(null)}
          />
        ) : null}

        {renderFilterChips()}

        {pendingItems.length > 0 && (
          <PrimaryButton
            title={saving ? "Working..." : `Mark All Reviewed (${filteredItems.length})`}
            onPress={markAllReviewed}
            disabled={saving || filteredItems.length === 0}
            variant="secondary"
          />
        )}

        {filteredItems.length === 0 && !loading ? (
          <AppCard>
            <Text style={styles.copy}>
              {pendingItems.length === 0
                ? "No pending transactions in inbox. Extracted items will appear here."
                : "No items match the selected filter."}
            </Text>
          </AppCard>
        ) : null}
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={palette.accentBlue} />
          <Text style={styles.copy}>Loading inbox...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No pending transactions</Text>
        <Text style={styles.copy}>Extracted items from emails and SMS will appear here.</Text>
      </View>
    );
  };

  return (
    <FeatureScaffold
      title="Inbox"
      subtitle="Review, edit, approve, or discard extracted items before they post into the ledger."
      rightLabel={`${filteredItems.length} shown`}
    >
      {filteredItems.length > 0 ? (
        <FlatList
          data={filteredItems}
          renderItem={renderInboxItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={() => (
            <View style={styles.footerSpacer}>
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          )}
          scrollEnabled={false}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View>
          {renderHeader()}
          {renderEmpty()}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      )}
    </FeatureScaffold>
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
  cardTitle: {
    ...typography.h3,
    color: palette.textPrimary,
  },
  filterContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  filterChip: {
    flex: 0,
    paddingHorizontal: spacing.md,
  },
  item: {
    gap: spacing.xs,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  source: {
    ...typography.caption,
    color: palette.accentTeal,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  dedupPill: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 12,
  },
  dedupMatchedPill: {
    backgroundColor: palette.accentSuccess,
  },
  dedupPendingPill: {
    backgroundColor: palette.accentWarn,
  },
  dedupPillText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: "700",
  },
  dedupMatchedText: {
    color: palette.bgTop,
  },
  dedupPendingText: {
    color: palette.bgTop,
  },
  amount: {
    ...typography.body,
    color: palette.textPrimary,
    fontWeight: "700",
  },
  subject: {
    ...typography.body,
    color: palette.textPrimary,
  },
  meta: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  required: {
    ...typography.caption,
    color: palette.accentWarn,
  },
  ready: {
    ...typography.caption,
    color: palette.accentSuccess,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  actionButton: {
    flex: 1,
  },
  copy: {
    ...typography.body,
    color: palette.textSecondary,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.h3,
    color: palette.textPrimary,
  },
  listContent: {
    gap: spacing.md,
  },
  footerSpacer: {
    gap: spacing.sm,
    marginTop: spacing.sm,
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
