import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppCard } from "@design/components/AppCard";
import { PrimaryButton } from "@design/components/PrimaryButton";
import { TextField } from "@design/components/TextField";
import { palette, radius, spacing, typography } from "@design/theme";
import type { BookkeepingAccount, LedgerTransactionDraft, TransactionType } from "@lib/repositories/types";

type TransactionEditorCardProps = {
  title: string;
  submitLabel: string;
  busy?: boolean;
  form: LedgerTransactionDraft;
  accounts: BookkeepingAccount[];
  baseCurrency: string;
  validationMessage?: string;
  helperText?: string;
  onChange: (patch: Partial<LedgerTransactionDraft>) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

const TX_TYPES: TransactionType[] = ["expense", "income", "transfer", "borrow"];

export function TransactionEditorCard({
  title,
  submitLabel,
  busy,
  form,
  accounts,
  baseCurrency,
  validationMessage,
  helperText,
  onChange,
  onSubmit,
  onCancel,
}: TransactionEditorCardProps) {
  const setField = <K extends keyof LedgerTransactionDraft>(key: K, value: LedgerTransactionDraft[K]) => {
    onChange({ [key]: value } as Partial<LedgerTransactionDraft>);
  };

  return (
    <AppCard style={styles.card}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.typeRow}>
        {TX_TYPES.map((type) => (
          <ChoiceChip
            key={type}
            label={labelForType(type)}
            active={form.type === type}
            onPress={() => onChange({
              type,
              category: type === "transfer" || type === "borrow" ? "" : form.category,
              subCategory: type === "transfer" || type === "borrow" ? "" : form.subCategory,
              businessActivity: type === "transfer" || type === "borrow" ? "" : form.businessActivity,
              targetAccountId: type === "transfer" ? form.targetAccountId : "",
              liabilityAccountId: type === "borrow" ? form.liabilityAccountId : "",
              borrowSource: type === "borrow" ? form.borrowSource : "",
            })}
          />
        ))}
      </View>

      <TextField
        label={`Amount (${baseCurrency})`}
        value={String(form.amount || "")}
        onChangeText={(value) => setField("amount", Number(value.replace(/[^0-9.-]/g, "")) || 0)}
        keyboardType="decimal-pad"
        autoCapitalize="none"
      />
      <TextField
        label="Date"
        value={form.date}
        onChangeText={(value) => setField("date", value)}
        hint="Use YYYY-MM-DD"
        autoCapitalize="none"
      />
      <TextField
        label="Description"
        value={form.description}
        onChangeText={(value) => setField("description", value)}
        autoCapitalize="sentences"
      />

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          {form.type === "income" ? "Receiving account" : form.type === "transfer" ? "Transfer from account" : "Account used"}
        </Text>
        <View style={styles.chipWrap}>
          {accounts.map((account) => (
            <ChoiceChip
              key={account.id}
              label={account.name}
              active={form.accountId === account.id}
              onPress={() => setField("accountId", account.id)}
            />
          ))}
        </View>
      </View>

      {form.type === "transfer" ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Transfer to account</Text>
          <View style={styles.chipWrap}>
            {accounts.map((account) => (
              <ChoiceChip
                key={`target-${account.id}`}
                label={account.name}
                active={form.targetAccountId === account.id}
                onPress={() => setField("targetAccountId", account.id)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {form.type === "borrow" ? (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Liability account</Text>
            <View style={styles.chipWrap}>
              {accounts.map((account) => (
                <ChoiceChip
                  key={`liability-${account.id}`}
                  label={account.name}
                  active={form.liabilityAccountId === account.id}
                  onPress={() => setField("liabilityAccountId", account.id)}
                />
              ))}
            </View>
          </View>
          <TextField
            label="Borrowed source"
            value={form.borrowSource}
            onChangeText={(value) => setField("borrowSource", value)}
            hint="Use this if you do not want to link a liability account."
            autoCapitalize="words"
          />
        </>
      ) : null}

      {form.type !== "transfer" && form.type !== "borrow" ? (
        <>
          <TextField
            label="Business activity"
            value={form.businessActivity}
            onChangeText={(value) => setField("businessActivity", value)}
            autoCapitalize="words"
          />
          <TextField
            label="Category"
            value={form.category}
            onChangeText={(value) => setField("category", value)}
            autoCapitalize="words"
          />
          <TextField
            label="Sub category"
            value={form.subCategory}
            onChangeText={(value) => setField("subCategory", value)}
            autoCapitalize="words"
          />
        </>
      ) : null}

      <TextField
        label="Payment method"
        value={form.paymentMethod}
        onChangeText={(value) => setField("paymentMethod", value)}
        autoCapitalize="words"
      />

      {form.type !== "transfer" && form.type !== "borrow" ? (
        <>
          <View style={styles.trackRow}>
            <Text style={styles.sectionLabel}>Track vendor in vendor-wise reports</Text>
            <ChoiceChip
              label={form.trackVendor ? "Tracking on" : "Tracking off"}
              active={form.trackVendor}
              onPress={() => setField("trackVendor", !form.trackVendor)}
            />
          </View>
          <TextField
            label="Vendor"
            value={form.vendor}
            onChangeText={(value) => setField("vendor", value)}
            hint={form.trackVendor ? "Vendor name is required while tracking is on." : "Optional when tracking is off."}
            autoCapitalize="words"
          />
        </>
      ) : null}

      <TextField
        label="Notes"
        value={form.notes}
        onChangeText={(value) => setField("notes", value)}
        multiline
        numberOfLines={3}
        autoCapitalize="sentences"
      />

      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
      {validationMessage ? <Text style={styles.error}>{validationMessage}</Text> : null}

      <View style={styles.actions}>
        <PrimaryButton
          title={busy ? `${submitLabel}...` : submitLabel}
          onPress={onSubmit}
          disabled={busy}
          style={styles.primaryAction}
        />
        <PrimaryButton
          title="Cancel"
          onPress={onCancel}
          disabled={busy}
          variant="secondary"
          style={styles.secondaryAction}
        />
      </View>
    </AppCard>
  );
}

function ChoiceChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function labelForType(type: TransactionType) {
  if (type === "expense") return "Expense";
  if (type === "income") return "Income";
  if (type === "transfer") return "Transfer";
  return "Borrow";
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: palette.textPrimary,
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  section: {
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
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    borderColor: palette.accentBlue,
    backgroundColor: "rgba(91, 140, 255, 0.18)",
  },
  chipText: {
    ...typography.caption,
    color: palette.textSecondary,
    fontWeight: "700",
  },
  chipTextActive: {
    color: palette.textPrimary,
  },
  trackRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  helper: {
    ...typography.caption,
    color: palette.textSecondary,
  },
  error: {
    ...typography.caption,
    color: palette.accentDanger,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  primaryAction: {
    flex: 1,
  },
  secondaryAction: {
    flex: 1,
  },
});
