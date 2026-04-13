import type { BookkeepingAccount, LedgerTransactionDraft } from "@lib/repositories/types";

function asString(value: unknown) {
  return String(value || "").trim();
}

export function getMobileAccountingValidationMessage(entry: LedgerTransactionDraft, accounts: BookkeepingAccount[]) {
  const errors: string[] = [];
  const amount = Number(entry.amount);

  if (!(amount > 0)) errors.push("enter a valid amount");

  if (entry.type === "transfer") {
    if ((accounts || []).length < 2) errors.push("add at least two accounts before approving a transfer");
    if (!asString(entry.accountId)) errors.push("select the transfer from account");
    if (!asString(entry.targetAccountId)) errors.push("select the transfer to account");
    if (asString(entry.accountId) && asString(entry.accountId) === asString(entry.targetAccountId)) {
      errors.push("choose different transfer from and to accounts");
    }
  } else {
    if ((accounts || []).length === 0) errors.push("add at least one account before approving");
    if (!asString(entry.accountId)) errors.push(entry.type === "income" ? "select the receiving account" : "select the account used");
  }

  if (entry.type === "borrow" && !asString(entry.liabilityAccountId) && !asString(entry.borrowSource)) {
    errors.push("select a liability account or enter the borrowed source");
  }

  if (entry.type !== "transfer" && entry.type !== "borrow") {
    if (!asString(entry.businessActivity)) errors.push("select the business activity");
    if (!asString(entry.category)) errors.push("select the category");
  }

  if (entry.trackVendor && !asString(entry.vendor)) {
    errors.push("enter the vendor name or turn off vendor tracking");
  }

  if (!errors.length) return "";
  return `Update the mandatory fields before saving or approving: ${errors.join(", ")}.`;
}

export function makeTransactionDraft(overrides: Partial<LedgerTransactionDraft> = {}): LedgerTransactionDraft {
  return {
    amount: 0,
    type: "expense",
    description: "",
    date: new Date().toISOString().slice(0, 10),
    businessActivity: "",
    category: "",
    subCategory: "",
    accountId: "",
    targetAccountId: "",
    liabilityAccountId: "",
    paymentMethod: "",
    vendor: "",
    trackVendor: false,
    notes: "",
    borrowSource: "",
    ...overrides,
  };
}
