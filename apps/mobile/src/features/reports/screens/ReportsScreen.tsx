import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AppCard } from "@design/components/AppCard";
import {
  getResponsiveSpacing,
  useDeviceType,
} from "@design/responsive";
import { palette, spacing, typography } from "@design/theme";
import { createLedgerRepository } from "@lib/repositories/createLedgerRepository";
import type { LedgerTransaction, ReportsSummary } from "@lib/repositories/types";
import { FeatureScaffold } from "@shared/components/FeatureScaffold";

const EMPTY_REPORTS: ReportsSummary = {
  categoryInsights: [],
  monthlyTrend: [],
  currency: "INR",
  totalIncome: 0,
  totalExpense: 0,
  net: 0,
};

const PERIOD_OPTIONS = [
  { label: "This Month", months: 1 },
  { label: "Last Month", months: 1, offset: 1 },
  { label: "Last 3 Months", months: 3 },
  { label: "Last 6 Months", months: 6 },
  { label: "This Year", months: 12 },
] as const;

const CATEGORY_COLORS = [
  palette.accentBlue,
  palette.accentSuccess,
  palette.accentTeal,
  palette.accentWarn,
  palette.accentDanger,
  "#B56BFF", // purple
] as const;

function getCategoryColor(index: number): string {
  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

function formatMoney(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ReportsScreen() {
  const repo = useMemo(() => createLedgerRepository(), []);
  const device = useDeviceType();
  const [selectedPeriod, setSelectedPeriod] = useState(3); // Last 3 Months
  const [report, setReport] = useState<ReportsSummary>(EMPTY_REPORTS);
  const [topVendors, setTopVendors] = useState<
    Array<{ name: string; count: number; total: number }>
  >([]);
  const [transactionCount, setTransactionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const monthsForPeriod = PERIOD_OPTIONS.find((p) => p.months === selectedPeriod)?.months || 6;

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      try {
        const [reportData, transactions] = await Promise.all([
          repo.getReportsSummary(monthsForPeriod),
          repo.listTransactions(500),
        ]);

        setReport(reportData);
        setTransactionCount(transactions.length);

        // Calculate top vendors
        const vendorMap = new Map<
          string,
          { count: number; total: number }
        >();
        transactions.forEach((tx) => {
          const vendor = tx.vendor || "Unknown";
          const current = vendorMap.get(vendor) || { count: 0, total: 0 };
          vendorMap.set(vendor, {
            count: current.count + 1,
            total: current.total + Math.abs(tx.baseAmount || tx.amount),
          });
        });

        const topVendorsList = [...vendorMap.entries()]
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        setTopVendors(topVendorsList);
        setError("");
      } catch (err) {
        setError(String((err as Error)?.message || "Unable to load reports"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [monthsForPeriod, repo],
  );

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const onRefresh = useCallback(() => {
    load(true).catch(() => undefined);
  }, [load]);

  const isTablet = device === "tablet";
  const categoryGridCols = isTablet ? 2 : 1;

  return (
    <FeatureScaffold
      title="Reports"
      subtitle="Cloud-backed profit, expense, and category insights in your base currency."
      rightLabel={`${monthsForPeriod}M view`}
    >
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.accentBlue}
          />
        }
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
      >
        {/* Period Selector */}
        <AppCard style={styles.periodCard}>
          <Text style={styles.cardTitle}>Period</Text>
          <View style={styles.periodChips}>
            {PERIOD_OPTIONS.map((option) => (
              <PeriodChip
                key={option.label}
                label={option.label}
                active={selectedPeriod === option.months}
                onPress={() => setSelectedPeriod(option.months)}
              />
            ))}
          </View>
        </AppCard>

        {/* Summary Stats */}
        <View style={[styles.summaryGrid, isTablet && styles.summaryGridTablet]}>
          <Metric
            label="Income"
            value={formatMoney(report.totalIncome, report.currency)}
            tone="success"
          />
          <Metric
            label="Expense"
            value={formatMoney(report.totalExpense, report.currency)}
            tone="danger"
          />
          <Metric label="Net" value={formatMoney(report.net, report.currency)} />
          <Metric
            label="Transactions"
            value={String(transactionCount)}
            tone="neutral"
          />
        </View>

        {/* Monthly Trend Chart */}
        {report.monthlyTrend.length > 0 && (
          <AppCard style={styles.card}>
            <Text style={styles.cardTitle}>Monthly Net Trend</Text>
            <View style={styles.chart}>
              {report.monthlyTrend.map((bar) => (
                <View key={bar.label} style={styles.barWrap}>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        bar.value < 0
                          ? styles.barFillNegative
                          : styles.barFillPositive,
                        {
                          height: `${Math.max(
                            6,
                            Math.round(bar.ratio * 100),
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{bar.label}</Text>
                </View>
              ))}
            </View>
          </AppCard>
        )}

        {/* Category Breakdown */}
        {report.categoryInsights.length > 0 && (
          <AppCard style={styles.card}>
            <Text style={styles.cardTitle}>Spending by Category</Text>
            <View style={[styles.categoryGrid, isTablet && styles.categoryGrid2Col]}>
              {report.categoryInsights.map((insight, idx) => {
                const percentage =
                  report.totalExpense > 0
                    ? ((insight.value / report.totalExpense) * 100).toFixed(1)
                    : "0";
                const color = getCategoryColor(idx);
                return (
                  <View
                    key={insight.label}
                    style={[
                      styles.categoryRow,
                      isTablet && styles.categoryRowTablet,
                    ]}
                  >
                    <View style={styles.categoryInfo}>
                      <Text style={styles.categoryLabel}>{insight.label}</Text>
                      <Text style={styles.categoryPercentage}>
                        {percentage}% of expenses
                      </Text>
                    </View>
                    <View style={styles.categoryAmount}>
                      <Text style={styles.categoryValue}>
                        {formatMoney(insight.value, report.currency)}
                      </Text>
                      <View
                        style={[
                          styles.categoryBar,
                          {
                            backgroundColor: color,
                            flex: parseFloat(percentage) / 100,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </AppCard>
        )}

        {/* Top Vendors */}
        {topVendors.length > 0 && (
          <AppCard style={styles.card}>
            <Text style={styles.cardTitle}>Top Vendors</Text>
            {topVendors.map((vendor) => (
              <VendorRow
                key={vendor.name}
                name={vendor.name}
                count={vendor.count}
                total={vendor.total}
                currency={report.currency}
              />
            ))}
          </AppCard>
        )}

        {/* Empty States */}
        {!loading && report.monthlyTrend.length === 0 && (
          <AppCard style={styles.card}>
            <Text style={styles.copy}>
              Not enough cloud data yet to show reports for this period.
            </Text>
          </AppCard>
        )}

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={palette.accentBlue} />
            <Text style={styles.copy}>Loading reports...</Text>
          </View>
        )}

        {/* Error State */}
        {error && !loading && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    </FeatureScaffold>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "danger";
}) {
  return (
    <AppCard style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text
        style={[
          styles.metricValue,
          tone === "success" && styles.success,
          tone === "danger" && styles.danger,
        ]}
      >
        {value}
      </Text>
    </AppCard>
  );
}

function PeriodChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.periodChip, active && styles.periodChipActive]}
    >
      <Text style={[styles.periodText, active && styles.periodTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function VendorRow({
  name,
  count,
  total,
  currency,
}: {
  name: string;
  count: number;
  total: number;
  currency: string;
}) {
  return (
    <View style={styles.vendorRow}>
      <View style={styles.vendorInfo}>
        <Text style={styles.vendorName}>{name}</Text>
        <Text style={styles.vendorCount}>{count} transaction(s)</Text>
      </View>
      <Text style={styles.vendorAmount}>{formatMoney(total, currency)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  periodCard: {
    gap: spacing.sm,
  },
  card: {
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.h3,
    color: palette.textPrimary,
  },
  periodChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: getResponsiveSpacing(spacing.xs),
  },
  periodChip: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceElevated,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  periodChipActive: {
    backgroundColor: "rgba(91, 140, 255, 0.18)",
    borderColor: palette.accentBlue,
  },
  periodText: {
    ...typography.caption,
    color: palette.textSecondary,
    fontWeight: "700",
  },
  periodTextActive: {
    color: palette.textPrimary,
  },
  summaryGrid: {
    gap: spacing.sm,
  },
  summaryGridTablet: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  metricCard: {
    gap: spacing.xs,
    flex: 1,
    minWidth: 150,
  },
  metricLabel: {
    ...typography.caption,
    color: palette.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  metricValue: {
    ...typography.h3,
    color: palette.textPrimary,
  },
  success: {
    color: palette.accentSuccess,
  },
  danger: {
    color: palette.accentDanger,
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  barWrap: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  barTrack: {
    width: 20,
    height: 120,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: palette.surfaceElevated,
    borderColor: palette.border,
    borderWidth: 1,
    justifyContent: "flex-end",
  },
  barFill: {
    width: "100%",
    borderRadius: 10,
  },
  barFillPositive: {
    backgroundColor: palette.accentBlue,
  },
  barFillNegative: {
    backgroundColor: palette.accentDanger,
  },
  barLabel: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  categoryGrid: {
    gap: spacing.sm,
  },
  categoryGrid2Col: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  categoryRow: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  categoryRowTablet: {
    flex: 1,
    minWidth: "48%",
  },
  categoryInfo: {
    gap: spacing.xs,
  },
  categoryLabel: {
    ...typography.body,
    color: palette.textPrimary,
    fontWeight: "700",
  },
  categoryPercentage: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  categoryAmount: {
    gap: 6,
  },
  categoryValue: {
    ...typography.body,
    color: palette.textPrimary,
    fontWeight: "700",
  },
  categoryBar: {
    height: 6,
    borderRadius: 3,
    minWidth: 20,
  },
  vendorRow: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  vendorInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  vendorName: {
    ...typography.body,
    color: palette.textPrimary,
    fontWeight: "700",
  },
  vendorCount: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  vendorAmount: {
    ...typography.body,
    color: palette.textPrimary,
    fontWeight: "700",
  },
  copy: {
    ...typography.body,
    color: palette.textSecondary,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  error: {
    ...typography.caption,
    color: palette.accentDanger,
    padding: spacing.md,
    backgroundColor: "rgba(244, 105, 105, 0.1)",
    borderRadius: 10,
  },
});
