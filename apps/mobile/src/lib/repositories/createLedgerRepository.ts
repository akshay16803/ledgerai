import * as AuthSession from "expo-auth-session";
import { discovery as googleDiscovery } from "expo-auth-session/providers/google";
import { requireSupabaseClient } from "@lib/supabase/client";
import { emailRetryLogger, cloudQueueLogger } from "@lib/utils/logger";
import {
  buildAiEmailAnalysisMessages,
  analyzeEmailEvidence,
  enqueueCloudRetryJob,
  classifySyncError,
  formatIsoDate as formatEmailIsoDate,
  fetchGoogleProfile,
  fetchMessageEvidence,
  fetchMicrosoftProfileByToken,
  getDefaultGmailQuery,
  listGmailMessages,
  listMicrosoftMessages,
  makeAiPendingId,
  makeEmailInboxClientId,
  normalizeAiConfig,
  pullCloudRetryJobs,
  resolveEmailAnalysisFromRaw,
  stableAiCloudClientId,
  todayIso as emailTodayIso,
} from "@lib/email/emailProcessing";
import { getProviderRuntimeConfig } from "@lib/email/providerConfig";
import {
  buildLedgerRowsForReconciliation,
  buildReconciliationResult,
  inDateRange,
  parseAndPrepareStatementRows,
} from "@lib/reconciliation/reconciliationProcessing";
import {
  clearProviderSession,
  loadProviderSession,
  saveProviderSession,
  type ProviderSessionRecord,
} from "@lib/email/providerSessionStore";
import type {
  BookkeepingAccount,
  BookkeepingAccountDraft,
  ConflictResolutionEvent,
  DashboardSummary,
  DeduplicationResult,
  DeduplicationStatus,
  EmailConnectPayload,
  EmailConnector,
  EmailRetryResult,
  EmailSyncResult,
  EmailWorkspace,
  InboxReviewItem,
  LedgerRepository,
  LedgerTransaction,
  LedgerTransactionDraft,
  PendingTransaction,
  PollingConfig,
  ReconciliationCreateResult,
  ReconciliationItem,
  ReconciliationRunDraft,
  ReconciliationRun,
  ReconciliationSummary,
  ReportsSummary,
  SettingsSummary,
  SmsAnalysisStatus,
  SmsRetryResult,
  SyncDelta,
  SyncState,
  TransactionSupportBundle,
  UnsubscribeFn,
} from "@lib/repositories/types";
import {
  deduplicateSmsWithEmail,
  getDeduplicationStatus,
  markAsDeduped,
} from "@lib/sms/smsDeduplicator";
import {
  subscribeToTransactionsWithRetry,
  subscribeToInboxItemsWithRetry,
  subscribeToAccountsWithRetry,
} from "@lib/repositories/realtimeSubscriptions";
import {
  getChangesSinceLast,
  getLastSyncTime,
  recordSyncTime,
  getSyncState,
} from "@lib/repositories/deltaSync";
import {
  enqueuePendingTransaction,
  processPendingQueue,
  getOfflineQueueStatus,
  readOfflineQueue,
} from "@lib/repositories/offlineQueue";
import {
  startBackgroundPolling,
  getPollingConfig,
} from "@lib/repositories/backgroundPolling";
import {
  DEFAULT_BASE_CURRENCY,
  DEFAULT_AI_MODEL,
  STALE_QUEUE_THRESHOLD_MS,
  nowIso,
} from "@lib/constants";

const ACCOUNT_CLASS_TYPES = ["asset", "liability", "equity", "income", "expense"] as const;

const EMPTY_SUMMARY: DashboardSummary = {
  totalIncome: 0,
  totalExpense: 0,
  net: 0,
  todayIncome: 0,
  todayExpense: 0,
  todayCount: 0,
  currency: DEFAULT_BASE_CURRENCY,
};

const EMPTY_REPORTS: ReportsSummary = {
  categoryInsights: [],
  monthlyTrend: [],
  currency: DEFAULT_BASE_CURRENCY,
  totalIncome: 0,
  totalExpense: 0,
  net: 0,
};

// Use STALE_QUEUE_THRESHOLD_MS from @lib/constants for retry timing
const AI_PENDING_RETRY_MS = STALE_QUEUE_THRESHOLD_MS;
const APP_SETTING_AI_CONFIG = "ai_config";
const APP_SETTING_PROCESSED_EMAIL_CACHE = "processed_email_cache";
const MICROSOFT_SCOPES = ["openid", "profile", "offline_access", "Mail.Read", "User.Read"];
const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

let microsoftDiscoveryPromise: Promise<AuthSession.DiscoveryDocument> | null = null;

// ============================================================================
// UTILITY FUNCTIONS
// Type coercion, formatting, and general helpers
// ============================================================================

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown, fallback = "") {
  return String(value || fallback).trim();
}

function asNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asBool(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// nowIso is imported from @lib/constants

function formatIsoDate(value: unknown) {
  const raw = asString(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : "";
}

function roundMoney(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

// ============================================================================
// AUTH & USER FUNCTIONS
// ============================================================================

async function getCurrentUser() {
  const client = requireSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error("Authenticated user is required.");
  return data.user;
}

// ============================================================================
// APP SETTINGS & CACHE FUNCTIONS
// ============================================================================

async function readAppSetting(settingKey: string) {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from("ledger_app_settings")
    .select("id, setting_key, setting_value")
    .eq("setting_key", settingKey)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? (data as Record<string, unknown>) : null;
}

async function upsertAppSetting(settingKey: string, settingValue: unknown) {
  const client = requireSupabaseClient();
  const existing = await readAppSetting(settingKey);
  const row = existing?.id
    ? { id: existing.id, setting_key: settingKey, setting_value: settingValue, payload: { updatedAt: nowIso() } }
    : { setting_key: settingKey, setting_value: settingValue, payload: { updatedAt: nowIso() } };

  const { error } = await client
    .from("ledger_app_settings")
    .upsert([row], { onConflict: "id", ignoreDuplicates: false });
  if (error) throw error;
}

async function readProcessedEmailCache() {
  const row = await readAppSetting(APP_SETTING_PROCESSED_EMAIL_CACHE);
  return asObject(row?.setting_value);
}

async function writeProcessedEmailCache(cache: Record<string, unknown>) {
  await upsertAppSetting(APP_SETTING_PROCESSED_EMAIL_CACHE, cache);
}

async function readAiConfigForUser(userId = "") {
  void userId;
  const client = requireSupabaseClient();
  const [aiConfigRow, sessionRes] = await Promise.all([
    readAppSetting(APP_SETTING_AI_CONFIG),
    client.auth.getSession(),
  ]);
  const aiConfig = normalizeAiConfig(aiConfigRow?.setting_value);
  const bearerToken = asString(sessionRes?.data?.session?.access_token);
  return {
    ...aiConfig,
    bearerToken,
  };
}

function isProviderSessionFresh(session: ProviderSessionRecord | null) {
  if (!session?.accessToken) return false;
  const expiresAtMs = Date.parse(session.expiresAt || "");
  return Number.isFinite(expiresAtMs) && expiresAtMs - Date.now() > 60 * 1000;
}

function authPromptCancelled(result: AuthSession.AuthSessionResult | null) {
  return result?.type === "cancel" || result?.type === "dismiss";
}

function authPromptFailed(result: AuthSession.AuthSessionResult | null) {
  return result?.type === "error";
}

function authPromptErrorMessage(result: AuthSession.AuthSessionResult | null) {
  const extended = result as (AuthSession.AuthSessionResult & {
    error?: { message?: string };
    errorCode?: string;
  }) | null;
  return asString(extended?.error?.message || extended?.errorCode || "Authentication failed.");
}

function authPromptCode(result: AuthSession.AuthSessionResult | null) {
  const extended = result as (AuthSession.AuthSessionResult & {
    params?: Record<string, string>;
  }) | null;
  return asString(extended?.params?.code);
}

function providerStatusLabel(input: {
  connected: boolean;
  reauthRequired: boolean;
  hasLocalSession: boolean;
}) {
  if (input.reauthRequired) return "Reconnect Needed";
  if (input.connected && input.hasLocalSession) return "Connected";
  if (input.connected) return "Connected On Another Device";
  return "Disconnected";
}

function normalizeProvider(value: unknown) {
  return asString(value || "google").toLowerCase() === "microsoft" ? "microsoft" : "google";
}

function parsePendingPayload(row: Record<string, unknown>) {
  return asObject(row.payload);
}

function makePendingRetryDate() {
  return new Date(Date.now() + AI_PENDING_RETRY_MS).toISOString();
}

function makeProviderSessionRecord(payload: EmailConnectPayload): ProviderSessionRecord {
  return {
    provider: payload.provider,
    accessToken: asString(payload.accessToken),
    refreshToken: asString(payload.refreshToken),
    expiresAt: asString(payload.expiresAt || new Date(Date.now() + 55 * 60 * 1000).toISOString()),
    issuedAt: Number(payload.issuedAt) || Math.floor(Date.now() / 1000),
    tokenType: asString(payload.tokenType || "Bearer"),
    scope: asString(payload.scope),
    idToken: asString(payload.idToken),
    email: asString(payload.email),
    providerClientId: asString(payload.providerClientId),
    msAccountId: asString(payload.msAccountId),
    msUsername: asString(payload.msUsername || payload.email),
    updatedAt: nowIso(),
  };
}

async function getMicrosoftDiscovery() {
  const runtime = getProviderRuntimeConfig();
  if (!microsoftDiscoveryPromise) {
    microsoftDiscoveryPromise = AuthSession.fetchDiscoveryAsync(runtime.microsoft.issuer);
  }
  return microsoftDiscoveryPromise;
}

function monthLabel(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleDateString("en-IN", { month: "short" });
}

function makeClientId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeAccountClassType(value: unknown) {
  const next = asString(value || "asset").toLowerCase();
  return ACCOUNT_CLASS_TYPES.includes(next as typeof ACCOUNT_CLASS_TYPES[number]) ? next : "asset";
}

function slugify(value: string, fallback: string) {
  const slug = asString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function getPayload(row: Record<string, unknown>) {
  return asObject(row.payload);
}

function isVendorTracked(entry: Record<string, unknown>) {
  if (entry.trackVendor === true) return true;
  if (entry.trackVendor === false) return false;
  return Boolean(asString(entry.vendor));
}

function normalizeTrackedVendor<T extends Record<string, unknown>>(entry: T): T & { vendor: string; trackVendor: boolean } {
  const vendor = asString(entry.vendor).slice(0, 140);
  return {
    ...entry,
    vendor,
    trackVendor: isVendorTracked({ ...entry, vendor }),
  };
}

function getAccountingValidationMessage(entry: Record<string, unknown>, accounts: BookkeepingAccount[]) {
  const tx = normalizeTrackedVendor(entry);
  const errors: string[] = [];
  const amount = Number(tx.amount);

  if (!(amount > 0)) errors.push("enter a valid amount");

  if (tx.type === "transfer") {
    if ((accounts || []).length < 2) errors.push("add at least two accounts before approving a transfer");
    if (!asString(tx.accountId)) errors.push("select the transfer from account");
    if (!asString(tx.targetAccountId)) errors.push("select the transfer to account");
    if (asString(tx.accountId) && asString(tx.targetAccountId) && asString(tx.accountId) === asString(tx.targetAccountId)) {
      errors.push("choose different transfer from and to accounts");
    }
  } else {
    if ((accounts || []).length === 0) errors.push("add at least one account before approving");
    if (!asString(tx.accountId)) errors.push(tx.type === "income" ? "select the receiving account" : "select the account used");
  }

  if (tx.type === "borrow" && !asString(tx.liabilityAccountId) && !asString(tx.borrowSource)) {
    errors.push("select a liability account or enter the borrowed source");
  }

  if (tx.type !== "transfer" && tx.type !== "borrow") {
    if (!asString(tx.businessActivity)) errors.push("select the business activity");
    if (!asString(tx.category)) errors.push("select the category");
  }

  if (tx.trackVendor && !asString(tx.vendor)) {
    errors.push("enter the vendor name or turn off vendor tracking");
  }

  if (!errors.length) return "";
  return `Update the mandatory fields before saving or approving: ${errors.join(", ")}.`;
}

function requiredFieldsFromInboxItem(item: InboxReviewItem) {
  const validation = getAccountingValidationMessage(item as unknown as Record<string, unknown>, []);
  if (!validation) return [];
  return item.required;
}

function buildJournalEntries(transaction: LedgerTransactionDraft, accounts: BookkeepingAccount[]) {
  const accountNameById = (id: string) => accounts.find((item) => item.id === id)?.name || "";
  const paymentAccountName = () => {
    if (transaction.accountId) {
      const found = accountNameById(transaction.accountId);
      if (found) return found;
    }
    return transaction.paymentMethod === "Credit Card" ? "Credit Card Payable" : "Bank Account – Savings";
  };

  if (transaction.type === "transfer") {
    const fromAccount = accountNameById(transaction.accountId) || "From Account";
    const toAccount = accountNameById(transaction.targetAccountId) || "To Account";
    return [
      { account: toAccount, dr: transaction.amount, cr: 0 },
      { account: fromAccount, dr: 0, cr: transaction.amount },
    ];
  }

  if (transaction.type === "borrow") {
    const receivedIn = paymentAccountName();
    const borrowedFrom = transaction.liabilityAccountId
      ? accountNameById(transaction.liabilityAccountId)
      : transaction.borrowSource
        ? `Borrowings – ${transaction.borrowSource}`
        : "Borrowings – Other";
    return [
      { account: receivedIn || "Cash on Hand", dr: transaction.amount, cr: 0 },
      { account: borrowedFrom || "Borrowings – Other", dr: 0, cr: transaction.amount },
    ];
  }

  const expenseMap: Record<string, string> = {
    "Futures & Commodities Trading": "Trading Expenses – Futures",
    "Equity Trading": "Trading Expenses – Equity",
    "Kite / Zerodha Platform": "Kite Platform Charges",
    Personal: "Personal Drawings",
  };
  const incomeMap: Record<string, string> = {
    "Futures & Commodities Trading": "Trading Income – Futures",
    "Equity Trading": "Trading Income – Equity",
  };

  if (transaction.type === "expense") {
    const expenseAccount = transaction.businessActivity === "Personal"
      ? "Drawings Account"
      : expenseMap[transaction.businessActivity] || `${transaction.businessActivity} – Expenses`;
    return [
      { account: expenseAccount, dr: transaction.amount, cr: 0 },
      { account: paymentAccountName(), dr: 0, cr: transaction.amount },
    ];
  }

  if (transaction.type === "income") {
    const incomeAccount = incomeMap[transaction.businessActivity] || `${transaction.businessActivity} – Income`;
    return [
      { account: paymentAccountName(), dr: transaction.amount, cr: 0 },
      { account: incomeAccount, dr: 0, cr: transaction.amount },
    ];
  }

  return [];
}

// ============================================================================
// DATA MAPPING FUNCTIONS
// Convert database rows to typed domain objects
// ============================================================================

function mapLedgerTransaction(row: Record<string, unknown>): LedgerTransaction {
  const payload = getPayload(row);
  return {
    id: asString(payload.id || row.client_id || row.id),
    amount: roundMoney(payload.amount ?? row.amount),
    originalAmount: roundMoney(payload.originalAmount ?? row.original_amount ?? row.amount),
    baseAmount: roundMoney(payload.baseAmount ?? row.base_amount ?? row.amount),
    type: asString(payload.type || row.entry_type || "expense") as LedgerTransaction["type"],
    description: asString(payload.description || row.description || "Untitled transaction"),
    date: formatIsoDate(payload.date || row.tx_date),
    businessActivity: asString(payload.businessActivity || row.business_activity),
    category: asString(payload.category || row.category),
    subCategory: asString(payload.subCategory || row.sub_category),
    accountId: asString(payload.accountId || row.account_client_id),
    accountName: asString(payload.accountName || row.account_name),
    targetAccountId: asString(payload.targetAccountId || row.target_account_client_id),
    targetAccountName: asString(payload.targetAccountName || row.target_account_name),
    liabilityAccountId: asString(payload.liabilityAccountId || row.liability_account_client_id),
    liabilityAccountName: asString(payload.liabilityAccountName || row.liability_account_name),
    paymentMethod: asString(payload.paymentMethod || row.payment_method),
    vendor: asString(payload.vendor || row.vendor),
    trackVendor: payload.trackVendor === true || row.track_vendor === true,
    notes: asString(payload.notes || row.notes),
    borrowSource: asString(payload.borrowSource || row.borrow_source),
    createdAt: asString(payload.createdAt || row.created_at_source || row.created_at),
    currency: asString(payload.currency || row.currency_code || DEFAULT_BASE_CURRENCY),
    baseCurrency: asString(payload.baseCurrency || row.base_currency_code || DEFAULT_BASE_CURRENCY),
    source: asString(payload.source || row.source || "manual"),
  };
}

function mapInboxItem(row: Record<string, unknown>): InboxReviewItem {
  const payload = getPayload(row);
  const sourceType = asString(payload.sourceType || row.source_type || "email") as "email" | "sms" | "both";
  const dedupStatus = asString(payload.dedupStatus || row.dedup_status) as "matched" | "unmatched" | "pending" | "";

  const item: InboxReviewItem = {
    id: asString(payload._iid || payload.id || row.client_id || row.id),
    source: asString(payload.emailProvider || row.email_provider || payload.source || row.source || "Inbox"),
    subject: asString(payload.emailSubject || row.email_subject || payload.description || row.description || "Pending review item"),
    amount: roundMoney(payload.baseAmount ?? row.base_amount ?? row.amount),
    date: formatIsoDate(payload.date || row.tx_date),
    required: [],
    currency: asString(payload.currency || row.currency_code || DEFAULT_BASE_CURRENCY),
    baseCurrency: asString(payload.baseCurrency || row.base_currency_code || DEFAULT_BASE_CURRENCY),
    emailAccountId: asString(payload.emailAccountId || row.email_account_client_id),
    emailMsgId: asString(payload.emailMsgId || row.email_msg_id),
    reviewStatus: asString(payload.reviewStatus || row.review_status || "pending"),
    type: asString(payload.type || row.item_type || "expense") as InboxReviewItem["type"],
    description: asString(payload.description || row.description),
    businessActivity: asString(payload.businessActivity || row.business_activity),
    category: asString(payload.category || row.category),
    subCategory: asString(payload.subCategory || row.sub_category),
    accountId: asString(payload.accountId || row.account_client_id),
    targetAccountId: asString(payload.targetAccountId || row.target_account_client_id),
    liabilityAccountId: asString(payload.liabilityAccountId || row.liability_account_client_id),
    paymentMethod: asString(payload.paymentMethod || row.payment_method),
    vendor: asString(payload.vendor || row.vendor),
    trackVendor: payload.trackVendor === true || row.track_vendor === true,
    notes: asString(payload.notes || row.notes),
    borrowSource: asString(payload.borrowSource || row.borrow_source),
    sourceType: sourceType || "email",
    dedupStatus: dedupStatus || undefined,
    dedupConfidence: asNumber(payload.dedupConfidence || row.dedup_confidence),
    dedupEmailItemId: asString(payload.dedupEmailItemId || row.dedup_email_item_id),
    dedupSmsItemId: asString(payload.dedupSmsItemId || row.dedup_sms_item_id),
  };

  item.required = (() => {
    const needed: string[] = [];
    if (!item.accountId) needed.push(item.type === "income" ? "Receiving account" : "Account");
    if (item.type !== "transfer" && item.type !== "borrow") {
      if (!item.businessActivity) needed.push("Business activity");
      if (!item.category) needed.push("Category");
    }
    if (item.trackVendor && !item.vendor) needed.push("Vendor");
    if (item.type === "transfer" && !item.targetAccountId) needed.push("Transfer to account");
    if (item.type === "borrow" && !item.liabilityAccountId && !item.borrowSource) needed.push("Liability account or borrowed source");
    return needed;
  })();

  return item;
}

function mapEmailAccount(
  row: Record<string, unknown>,
  pendingAiCount: number,
  pendingRetryDueCount: number,
  hasLocalSession: boolean,
  providerConfigured: boolean,
  setupBlockers: string[],
): EmailConnector {
  const payload = getPayload(row);
  const connected = row.connected === true || payload.connected === true;
  const reauthRequired = row.reauth_required === true || payload.reauthRequired === true;
  const provider = normalizeProvider(payload.provider || row.provider || "google");
  const lastError = asString(payload.lastError || row.last_error);
  const lastSync = asString(payload.lastSync || row.last_sync_at);
  const syncFromDate = asString(payload.syncFromDate || row.sync_from_date);
  const firstSyncCompleted = row.first_sync_completed === true || payload.firstSyncCompleted === true;
  const canConnect = providerConfigured;
  const canReconnect = providerConfigured;
  const canSync = providerConfigured && connected && hasLocalSession && !reauthRequired;
  const canRetryAi = Boolean(pendingAiCount) && providerConfigured;
  const canDisconnect = connected || hasLocalSession;
  const actionBlockedReason = !providerConfigured
    ? setupBlockers.join(". ")
    : !connected
      ? "Connect this provider before sync can start."
      : !hasLocalSession
        ? "This connector exists in cloud, but this device does not hold the provider token yet. Reconnect once on this device."
        : reauthRequired
          ? "Provider authentication needs to be refreshed on this device before sync can continue."
          : "";

  return {
    id: asString(payload.id || row.client_id || row.id),
    provider: provider === "microsoft" ? "Outlook" : "Gmail",
    label: asString(payload.label || row.label || payload.email || row.email),
    email: asString(payload.email || row.email),
    status: providerStatusLabel({ connected, reauthRequired, hasLocalSession }),
    note: lastError || (connected
      ? hasLocalSession
        ? "Connector metadata and local provider session are ready."
        : "Connector metadata is in cloud, but this device still needs provider authorization."
      : "Provider is not connected yet."),
    connected,
    reauthRequired,
    hasLocalSession,
    providerConfigured,
    lastSync,
    lastError,
    lastErrorAt: asString(payload.lastErrorAt || row.last_error_at),
    pendingAiCount,
    pendingRetryDueCount,
    firstSyncCompleted,
    syncFromDate,
    syncQuery: asString(payload.syncQuery || row.sync_query || getDefaultGmailQuery()),
    maxEmails: Math.max(1, Math.min(asNumber(payload.maxEmails, asNumber(row.max_emails, 100)), 5000)),
    canConnect,
    canReconnect,
    canSync,
    canRetryAi,
    canDisconnect,
    setupBlockers,
    actionBlockedReason,
  };
}

function mapAccount(row: Record<string, unknown>): BookkeepingAccount {
  const payload = getPayload(row);
  return {
    id: asString(payload.id || row.client_id || row.id),
    name: asString(payload.name || row.name),
    type: asString(payload.typeName || row.type_name || payload.type || row.account_type || "Account"),
    classType: asString(payload.cls || row.class_type || "asset"),
    bank: asString(payload.bank || row.bank_name),
    number: asString(payload.number || row.account_number),
    balance: roundMoney(payload.balance ?? row.balance),
    currency: asString(payload.balanceBaseCurrency || row.balance_base_currency_code || DEFAULT_BASE_CURRENCY),
  };
}

function mapReconciliationRun(row: Record<string, unknown>): ReconciliationRun {
  const payload = getPayload(row);
  return {
    id: asString(payload.id || row.client_id || row.id),
    accountId: asString(payload.accountId || row.account_client_id),
    accountName: asString(payload.accountName || row.account_name),
    statementFrom: formatIsoDate(payload.statementFrom || row.statement_from),
    statementTo: formatIsoDate(payload.statementTo || row.statement_to),
    sourceLabel: asString(payload.sourceLabel || row.source_label),
    sourceKind: asString(payload.sourceKind || row.source_kind || "other"),
    status: asString(payload.status || row.status || "pending"),
    matchedCount: asNumber(payload.matchedCount, asNumber(row.matched_count)),
    mismatchCount: asNumber(payload.mismatchCount, asNumber(row.mismatch_count)),
    statementOnlyCount: asNumber(payload.statementOnlyCount, asNumber(row.statement_only_count)),
    ledgerOnlyCount: asNumber(payload.ledgerOnlyCount, asNumber(row.ledger_only_count)),
    startedAt: asString(payload.startedAt || row.started_at),
    finishedAt: asString(payload.finishedAt || row.finished_at),
    errorMessage: asString(payload.errorMessage || row.error_message),
  };
}

function mapReconciliationItem(row: Record<string, unknown>): ReconciliationItem {
  const payload = getPayload(row);
  return {
    id: asString(payload.id || row.client_id || row.id),
    runId: asString(payload.runId || row.run_id),
    itemKind: asString(payload.itemKind || row.item_kind),
    itemKey: asString(payload.itemKey || row.item_key),
    hidden: payload.hidden === true || row.hidden === true,
    statementDate: formatIsoDate(payload.statementDate || row.statement_date),
    ledgerDate: formatIsoDate(payload.ledgerDate || row.ledger_date),
    statementAmount: roundMoney(payload.statementAmount ?? row.statement_amount),
    ledgerAmount: roundMoney(payload.ledgerAmount ?? row.ledger_amount),
    amountGap: roundMoney(payload.amountGap ?? row.amount_gap),
    currency: asString(payload.currency || row.currency_code || DEFAULT_BASE_CURRENCY),
    baseCurrency: asString(payload.baseCurrency || row.base_currency_code || DEFAULT_BASE_CURRENCY),
    score: asNumber(payload.score, asNumber(row.score)),
    description: asString(payload.description || row.description),
  };
}

async function readBaseCurrency() {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from("ledger_currency_settings")
    .select("base_currency_code")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return asString(data?.base_currency_code || DEFAULT_BASE_CURRENCY);
}

// ============================================================================
// DATABASE QUERY FUNCTIONS
// Read operations for various entities
// ============================================================================

async function listAccountsInternal() {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from("ledger_bookkeeping_accounts")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return asArray(data).map((row) => mapAccount(row as Record<string, unknown>));
}

async function listTransactionsForAccount(accountId: string, field: "account_client_id" | "target_account_client_id", fromDate: string, toDate: string) {
  const client = requireSupabaseClient();
  const pageSize = 1000;
  const rows: Array<Record<string, unknown>> = [];
  let offset = 0;

  while (true) {
    const { data, error } = await client
      .from("ledger_transactions")
      .select("*")
      .eq(field, accountId)
      .gte("tx_date", fromDate)
      .lte("tx_date", toDate)
      .order("tx_date", { ascending: false })
      .order("updated_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const batch = asArray(data).map((row) => row as Record<string, unknown>);
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

async function listTransactionsForReconciliation(accountId: string, fromDate: string, toDate: string) {
  const [outgoing, incoming] = await Promise.all([
    listTransactionsForAccount(accountId, "account_client_id", fromDate, toDate),
    listTransactionsForAccount(accountId, "target_account_client_id", fromDate, toDate),
  ]);
  const deduped = new Map<string, Record<string, unknown>>();
  [...outgoing, ...incoming].forEach((row) => {
    const key = asString(row.client_id || row.id);
    if (key) deduped.set(key, row);
  });
  return [...deduped.values()].map((row) => mapLedgerTransaction(row));
}

async function listActivitiesAndCategories() {
  const client = requireSupabaseClient();
  const [activitiesRes, categoriesRes] = await Promise.all([
    client.from("ledger_activities").select("name, sort_order").order("sort_order", { ascending: true }).order("name", { ascending: true }),
    client.from("ledger_categories").select("activity_name, name, sort_order").order("activity_name", { ascending: true }).order("sort_order", { ascending: true }).order("name", { ascending: true }),
  ]);

  if (activitiesRes.error) throw activitiesRes.error;
  if (categoriesRes.error) throw categoriesRes.error;

  const activities = asArray(activitiesRes.data).map((row) => asString(row.name)).filter(Boolean);
  const categories = asArray(categoriesRes.data).reduce<Record<string, string[]>>((acc, row) => {
    const activity = asString(row.activity_name);
    const name = asString(row.name);
    if (!activity || !name) return acc;
    acc[activity] = [...(acc[activity] || []), name];
    return acc;
  }, {});

  return { activities, categories };
}

async function upsertByClientId(table: string, clientId: string, row: Record<string, unknown>) {
  const client = requireSupabaseClient();
  const { data: existing, error: existingError } = await client
    .from(table)
    .select("id")
    .eq("client_id", clientId)
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;

  const payload = existing?.id ? { ...row, id: existing.id } : row;
  const { data, error } = await client
    .from(table)
    .upsert([payload], {
      onConflict: "id",
      ignoreDuplicates: false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Record<string, unknown>;
}

async function deleteByClientId(table: string, clientId: string) {
  const client = requireSupabaseClient();
  const { error } = await client.from(table).delete().eq("client_id", clientId);
  if (error) throw error;
}

async function ensureActivityAndCategory(activity: string, category: string) {
  const client = requireSupabaseClient();
  const activityName = asString(activity);
  const categoryName = asString(category);
  if (!activityName) return;

  await upsertByClientId("ledger_activities", `activity:${slugify(activityName, "activity")}`, {
    client_id: `activity:${slugify(activityName, "activity")}`,
    name: activityName,
    sort_order: 0,
    payload: {
      name: activityName,
      source: "mobile",
    },
  });

  if (!categoryName) return;

  await upsertByClientId("ledger_categories", `category:${slugify(activityName, "activity")}:${slugify(categoryName, "category")}`, {
    client_id: `category:${slugify(activityName, "activity")}:${slugify(categoryName, "category")}`,
    activity_name: activityName,
    name: categoryName,
    sort_order: 0,
    payload: {
      activityName,
      name: categoryName,
      source: "mobile",
    },
  });
}

async function serializeTransactionDraft(draft: LedgerTransactionDraft) {
  const baseCurrency = await readBaseCurrency();
  const accounts = await listAccountsInternal();
  const validation = getAccountingValidationMessage(draft as unknown as Record<string, unknown>, accounts);
  if (validation) throw new Error(validation);

  await ensureActivityAndCategory(draft.businessActivity, draft.category);

  const accountName = accounts.find((item) => item.id === draft.accountId)?.name || "";
  const targetAccountName = accounts.find((item) => item.id === draft.targetAccountId)?.name || "";
  const liabilityAccountName = accounts.find((item) => item.id === draft.liabilityAccountId)?.name || "";
  const normalized = normalizeTrackedVendor({
    ...draft,
    id: asString(draft.id || makeClientId("txn")),
    amount: roundMoney(draft.amount),
    date: formatIsoDate(draft.date) || todayIso(),
    businessActivity: asString(draft.businessActivity),
    category: asString(draft.category),
    subCategory: asString(draft.subCategory),
    description: asString(draft.description),
    notes: asString(draft.notes),
    paymentMethod: asString(draft.paymentMethod),
    accountId: asString(draft.accountId),
    accountName,
    targetAccountId: asString(draft.targetAccountId),
    targetAccountName,
    liabilityAccountId: asString(draft.liabilityAccountId),
    liabilityAccountName,
    borrowSource: asString(draft.borrowSource),
    currency: baseCurrency,
    baseCurrency,
    baseAmount: roundMoney(draft.amount),
    originalAmount: roundMoney(draft.amount),
    fxRate: 1,
    fxDate: formatIsoDate(draft.date) || todayIso(),
    fxRateDate: formatIsoDate(draft.date) || todayIso(),
    fxSource: "manual",
    source: "mobile",
    createdAt: asString(draft.createdAt || nowIso()),
  });

  return {
    clientId: normalized.id,
    row: {
      client_id: normalized.id,
      entry_type: normalized.type,
      tx_date: normalized.date,
      description: normalized.description,
      amount: normalized.amount,
      original_amount: normalized.originalAmount,
      base_amount: normalized.baseAmount,
      currency_code: normalized.currency,
      base_currency_code: normalized.baseCurrency,
      fx_rate: 1,
      fx_date: normalized.fxDate,
      fx_rate_date: normalized.fxRateDate,
      fx_source: normalized.fxSource,
      business_activity: normalized.businessActivity,
      category: normalized.category,
      sub_category: normalized.subCategory,
      vendor: normalized.vendor,
      track_vendor: normalized.trackVendor === true,
      payment_method: normalized.paymentMethod,
      account_client_id: normalized.accountId,
      account_name: normalized.accountName,
      target_account_client_id: normalized.targetAccountId,
      target_account_name: normalized.targetAccountName,
      liability_account_client_id: normalized.liabilityAccountId,
      liability_account_name: normalized.liabilityAccountName,
      borrow_source: normalized.borrowSource,
      notes: normalized.notes,
      source: normalized.source,
      review_status: "",
      journal_entries: buildJournalEntries(normalized, accounts),
      created_at_source: normalized.createdAt,
      payload: normalized,
    },
  };
}

function serializeInboxDraft(draft: InboxReviewItem, baseCurrency: string, accounts: BookkeepingAccount[]) {
  const validation = getAccountingValidationMessage(draft as unknown as Record<string, unknown>, accounts);
  const normalized = normalizeTrackedVendor({
    ...draft,
    id: asString(draft.id || makeClientId("inbox")),
    amount: roundMoney(draft.amount),
    date: formatIsoDate(draft.date) || todayIso(),
    businessActivity: asString(draft.businessActivity),
    category: asString(draft.category),
    subCategory: asString(draft.subCategory),
    description: asString(draft.description),
    notes: asString(draft.notes),
    paymentMethod: asString(draft.paymentMethod),
    accountId: asString(draft.accountId),
    targetAccountId: asString(draft.targetAccountId),
    liabilityAccountId: asString(draft.liabilityAccountId),
    borrowSource: asString(draft.borrowSource),
    currency: asString(draft.currency || baseCurrency),
    baseCurrency,
    required: validation
      ? validation
        .replace("Update the mandatory fields before saving or approving: ", "")
        .replace(/\.$/, "")
        .split(", ")
      : [],
  });

  return {
    clientId: normalized.id,
    row: {
      client_id: normalized.id,
      item_type: normalized.type,
      tx_date: normalized.date,
      description: normalized.description,
      amount: normalized.amount,
      original_amount: normalized.amount,
      base_amount: normalized.amount,
      currency_code: normalized.currency,
      base_currency_code: normalized.baseCurrency,
      fx_rate: 1,
      fx_date: normalized.date,
      fx_rate_date: normalized.date,
      fx_source: "manual",
      business_activity: normalized.businessActivity,
      category: normalized.category,
      sub_category: normalized.subCategory,
      vendor: normalized.vendor,
      track_vendor: normalized.trackVendor === true,
      payment_method: normalized.paymentMethod,
      account_client_id: normalized.accountId,
      account_name: accounts.find((item) => item.id === normalized.accountId)?.name || "",
      target_account_client_id: normalized.targetAccountId,
      target_account_name: accounts.find((item) => item.id === normalized.targetAccountId)?.name || "",
      liability_account_client_id: normalized.liabilityAccountId,
      liability_account_name: accounts.find((item) => item.id === normalized.liabilityAccountId)?.name || "",
      borrow_source: normalized.borrowSource,
      notes: normalized.notes,
      source: asString(draft.source || "mobile-review"),
      review_status: "pending",
      sort_ts: Date.now(),
      email_provider: asString(draft.source),
      email_subject: asString(draft.subject),
      email_account_client_id: asString(draft.emailAccountId),
      email_msg_id: asString(draft.emailMsgId),
      payload: {
        ...normalized,
        _iid: normalized.id,
        source: asString(draft.source || "mobile-review"),
        emailProvider: asString(draft.source),
        emailSubject: asString(draft.subject),
        emailAccountId: asString(draft.emailAccountId),
        emailMsgId: asString(draft.emailMsgId),
        reviewStatus: "pending",
      },
    },
  };
}

function findAccountByName(accounts: BookkeepingAccount[], name: string) {
  const normalized = asString(name).toLowerCase();
  if (!normalized) return null;
  return accounts.find((item) => asString(item.name).toLowerCase() === normalized) || null;
}

function serializeEmailInboxItem(
  connectorId: string,
  provider: "google" | "microsoft",
  msgId: string,
  subject: string,
  item: Record<string, unknown>,
  index: number,
  accounts: BookkeepingAccount[],
  baseCurrency: string,
) {
  const account = findAccountByName(accounts, asString(item.accountName));
  const targetAccount = findAccountByName(accounts, asString(item.targetAccountName));
  const clientId = makeEmailInboxClientId(connectorId, msgId, index);
  const draft = normalizeTrackedVendor({
    id: clientId,
    amount: roundMoney(item.baseAmount ?? item.amount),
    originalAmount: roundMoney(item.originalAmount ?? item.amount),
    baseAmount: roundMoney(item.baseAmount ?? item.amount),
    currency: asString(item.currency || baseCurrency),
    baseCurrency: asString(item.baseCurrency || baseCurrency),
    type: asString(item.type || "expense"),
    date: formatIsoDate(item.date) || todayIso(),
    businessActivity: asString(item.businessActivity),
    category: asString(item.category),
    subCategory: asString(item.subCategory),
    description: asString(item.description),
    notes: asString(item.notes),
    vendor: asString(item.vendor),
    trackVendor: item.trackVendor === true,
    paymentMethod: asString(item.paymentMethod),
    accountId: asString(account?.id),
    accountName: asString(account?.name),
    targetAccountId: asString(targetAccount?.id),
    targetAccountName: asString(targetAccount?.name),
    liabilityAccountId: asString(item.liabilityAccountId),
    borrowSource: asString(item.borrowSource),
    required: [],
  });

  const validation = getAccountingValidationMessage(draft, accounts);
  const required = validation
    ? validation
      .replace("Update the mandatory fields before saving or approving: ", "")
      .replace(/\.$/, "")
      .split(", ")
    : [];

  return {
    client_id: clientId,
    item_type: draft.type,
    tx_date: draft.date,
    description: draft.description,
    amount: draft.baseAmount,
    original_amount: draft.originalAmount,
    base_amount: draft.baseAmount,
    currency_code: draft.currency,
    base_currency_code: draft.baseCurrency,
    fx_rate: Number(item.fxRate) || 1,
    fx_date: asString(item.fxDate || draft.date) || draft.date,
    fx_rate_date: asString(item.fxRateDate || draft.date) || draft.date,
    fx_source: asString(item.fxSource || "worker_fx"),
    business_activity: draft.businessActivity,
    category: draft.category,
    sub_category: draft.subCategory,
    vendor: draft.vendor,
    track_vendor: draft.trackVendor === true,
    payment_method: draft.paymentMethod,
    account_client_id: draft.accountId,
    account_name: draft.accountName,
    target_account_client_id: draft.targetAccountId,
    target_account_name: draft.targetAccountName,
    liability_account_client_id: draft.liabilityAccountId,
    liability_account_name: "",
    borrow_source: draft.borrowSource,
    notes: draft.notes,
    source: "email",
    review_status: "pending",
    sort_ts: Date.now() + index,
    email_provider: provider,
    email_subject: subject,
    email_account_client_id: connectorId,
    email_msg_id: msgId,
    payload: {
      ...draft,
      _iid: clientId,
      source: "email",
      emailProvider: provider,
      emailSubject: subject,
      emailAccountId: connectorId,
      emailMsgId: msgId,
      reviewStatus: "pending",
      required,
    },
  };
}

async function listPendingEmailRows(accountId = "") {
  const client = requireSupabaseClient();
  let query = client
    .from("ledger_ai_pending_items")
    .select("*")
    .neq("status", "done")
    .neq("status", "cancelled")
    .order("queued_at", { ascending: false });

  if (accountId) query = query.eq("account_client_id", accountId);
  const { data, error } = await query;
  if (error) throw error;
  return asArray(data).map((row) => row as Record<string, unknown>);
}

async function deletePendingEmailRow(id: string) {
  await deleteByClientId("ledger_ai_pending_items", id);
}

async function upsertPendingEmailRow(row: Record<string, unknown>) {
  const clientId = asString(row.client_id || row.clientId || row.id);
  if (!clientId) throw new Error("Pending email row client id is required.");
  return upsertByClientId("ledger_ai_pending_items", clientId, row);
}

async function loadEmailConnectorRowByClientId(clientId: string) {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from("ledger_email_accounts")
    .select("*")
    .eq("client_id", clientId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? (data as Record<string, unknown>) : null;
}

async function loadEmailConnectorRowByIdentity(provider: "google" | "microsoft", email: string) {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from("ledger_email_accounts")
    .select("*")
    .eq("provider", provider)
    .eq("email", email)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? (data as Record<string, unknown>) : null;
}

async function resolveEmailConnectorRow(id: string) {
  const row = await loadEmailConnectorRowByClientId(id);
  if (!row) throw new Error("Email connector not found.");
  return row;
}

async function saveEmailConnectorCloudState(row: Record<string, unknown>) {
  const clientId = asString(row.client_id || row.clientId);
  if (!clientId) throw new Error("Email connector client id is required.");
  return upsertByClientId("ledger_email_accounts", clientId, row);
}

async function saveConnectedEmailConnector(payload: EmailConnectPayload) {
  const provider = payload.provider;
  const existing = payload.existingConnectorId
    ? await loadEmailConnectorRowByClientId(payload.existingConnectorId)
    : await loadEmailConnectorRowByIdentity(provider, asString(payload.email));
  const existingPayload = existing ? getPayload(existing) : {};
  const clientId = asString(existing?.client_id || payload.existingConnectorId || `email:${provider}:${slugify(asString(payload.email), "connector")}`);
  const normalizedPayload = {
    ...existingPayload,
    id: clientId,
    provider,
    label: asString(payload.label || asString(payload.email).split("@")[0]),
    email: asString(payload.email),
    syncQuery: provider === "google" ? (asString(existing?.sync_query || existingPayload.syncQuery) || getDefaultGmailQuery()) : "",
    maxEmails: Math.max(1, Math.min(asNumber(existing?.max_emails, asNumber(existingPayload.maxEmails, 100)), 5000)),
    autoPost: existingPayload.autoPost === true,
    autoSyncHourly: existingPayload.autoSyncHourly !== false,
    connected: true,
    userDisconnected: false,
    firstSyncCompleted: existing?.first_sync_completed === true || existingPayload.firstSyncCompleted === true,
    syncFromDate: asString(existing?.sync_from_date || existingPayload.syncFromDate),
    tokenExpiresAt: asString(payload.expiresAt),
    lastAuthAt: nowIso(),
    reauthRequired: false,
    msClientId: provider === "microsoft" ? asString(payload.providerClientId) : "",
    msAccountId: provider === "microsoft" ? asString(payload.msAccountId) : "",
    msUsername: provider === "microsoft" ? asString(payload.msUsername || payload.email) : "",
    lastSync: asString(existing?.last_sync_at || existingPayload.lastSync),
    lastCount: asNumber(existing?.last_count, asNumber(existingPayload.lastCount, 0)),
    enabled: true,
    lastError: "",
    lastErrorAt: "",
  };

  const row = {
    id: existing?.id,
    client_id: clientId,
    provider,
    label: normalizedPayload.label,
    email: normalizedPayload.email,
    sync_query: normalizedPayload.syncQuery,
    max_emails: normalizedPayload.maxEmails,
    auto_post: normalizedPayload.autoPost === true,
    auto_sync_hourly: normalizedPayload.autoSyncHourly !== false,
    connected: true,
    user_disconnected: false,
    first_sync_completed: normalizedPayload.firstSyncCompleted === true,
    sync_from_date: normalizedPayload.syncFromDate || null,
    token_expires_at: normalizedPayload.tokenExpiresAt || null,
    last_auto_sync_at: asString(existing?.last_auto_sync_at || existingPayload.lastAutoSyncAt) || null,
    last_auth_at: normalizedPayload.lastAuthAt,
    reauth_required: false,
    ms_client_id: normalizedPayload.msClientId || null,
    ms_account_id: normalizedPayload.msAccountId || null,
    ms_username: normalizedPayload.msUsername || null,
    last_sync_at: normalizedPayload.lastSync || null,
    last_count: normalizedPayload.lastCount,
    enabled: true,
    last_error: "",
    last_error_at: null,
    payload: normalizedPayload,
  };

  return saveEmailConnectorCloudState(row);
}

async function resolveProviderSessionForConnector(connectorRow: Record<string, unknown>, userId: string) {
  const connectorId = asString(connectorRow.client_id || getPayload(connectorRow).id);
  const provider = normalizeProvider(connectorRow.provider || getPayload(connectorRow).provider);
  const runtime = getProviderRuntimeConfig();
  let session = await loadProviderSession(userId, connectorId);
  if (isProviderSessionFresh(session)) return session;
  if (!session?.refreshToken) return session;

  try {
    const refreshed = provider === "microsoft"
      ? await AuthSession.refreshAsync({
        clientId: asString(getPayload(connectorRow).msClientId || connectorRow.ms_client_id || runtime.microsoft.clientId),
        refreshToken: session.refreshToken,
        scopes: MICROSOFT_SCOPES,
      }, await getMicrosoftDiscovery())
      : await AuthSession.refreshAsync({
        clientId: runtime.google.clientId,
        refreshToken: session.refreshToken,
        scopes: GOOGLE_SCOPES,
      }, googleDiscovery);

    session = {
      ...session,
      accessToken: refreshed.accessToken,
      refreshToken: asString(refreshed.refreshToken || session.refreshToken),
      expiresAt: new Date((Number(refreshed.issuedAt) || Math.floor(Date.now() / 1000) + (Number(refreshed.expiresIn) || 3600)) * 1000).toISOString(),
      issuedAt: Number(refreshed.issuedAt) || Math.floor(Date.now() / 1000),
      tokenType: asString(refreshed.tokenType || session.tokenType || "Bearer"),
      scope: asString(refreshed.scope || session.scope),
      idToken: asString(refreshed.idToken || session.idToken),
      updatedAt: nowIso(),
    };
    await saveProviderSession(userId, connectorId, session);
    await saveEmailConnectorCloudState({
      ...connectorRow,
      token_expires_at: session.expiresAt,
      last_auth_at: nowIso(),
      reauth_required: false,
      last_error: "",
      last_error_at: null,
      payload: {
        ...getPayload(connectorRow),
        tokenExpiresAt: session.expiresAt,
        lastAuthAt: nowIso(),
        reauthRequired: false,
        lastError: "",
        lastErrorAt: "",
      },
    });
    return session;
  } catch (error) {
    await saveEmailConnectorCloudState({
      ...connectorRow,
      reauth_required: true,
      last_error: asString((error as Error)?.message || "provider_refresh_failed"),
      last_error_at: nowIso(),
      payload: {
        ...getPayload(connectorRow),
        reauthRequired: true,
        lastError: asString((error as Error)?.message || "provider_refresh_failed"),
        lastErrorAt: nowIso(),
      },
    });
    return null;
  }
}

async function readEmailSyncContext(userId = "") {
  const [baseCurrency, metadata, aiConfig, processedCache, accounts] = await Promise.all([
    readBaseCurrency(),
    listActivitiesAndCategories(),
    readAiConfigForUser(userId),
    readProcessedEmailCache(),
    listAccountsInternal(),
  ]);

  return {
    baseCurrency,
    acts: metadata.activities,
    cats: metadata.categories,
    aiConfig,
    processedCache,
    accounts,
    accountNames: accounts.map((item) => item.name).filter(Boolean),
  };
}

async function readReconciliationContext(userId = "") {
  const [baseCurrency, aiConfig, accounts] = await Promise.all([
    readBaseCurrency(),
    readAiConfigForUser(userId),
    listAccountsInternal(),
  ]);

  return {
    baseCurrency,
    aiConfig,
    accounts,
  };
}

async function upsertInboxRows(rows: Array<Record<string, unknown>>) {
  const client = requireSupabaseClient();
  for (const row of rows) {
    await upsertByClientId("ledger_inbox_items", asString(row.client_id), row);
  }
  const { data, error } = await client
    .from("ledger_inbox_items")
    .select("*")
    .in("client_id", rows.map((row) => asString(row.client_id)));
  if (error) throw error;
  return asArray(data).map((row) => mapInboxItem(row as Record<string, unknown>));
}

// ============================================================================
// EMAIL RETRY & CLOUD QUEUE FUNCTIONS
// These functions handle the retry logic for failed AI email extractions
// using a cloud-based queue system (Cloudflare Workers KV)
// ============================================================================

async function queueCloudEmailAnalysisJob(params: {
  userId: string;
  connectorId: string;
  provider: "google" | "microsoft";
  msgId: string;
  subject: string;
  from: string;
  emailDate: string;
  evidence: { subject: string; from: string; body: string; attachmentNames: string[]; attachmentText: string; hasAttachment: boolean };
  acts: string[];
  cats: Record<string, string[]>;
  accountNames: string[];
  baseCurrency: string;
  aiConfig: { endpoint: string; secret: string; bearerToken?: string; model: string };
}) {
  cloudQueueLogger.debug("Queueing cloud email analysis job", {
    msgId: params.msgId,
    subject: params.subject?.slice(0, 50),
    provider: params.provider,
    hasEvidence: Boolean(params.evidence?.body),
    endpoint: params.aiConfig.endpoint,
    model: params.aiConfig.model,
  });

  const clientId = stableAiCloudClientId(params.userId);
  const jobId = makeAiPendingId(params.connectorId, params.msgId);
  const messages = buildAiEmailAnalysisMessages(
    params.subject || "",
    params.from || "",
    params.evidence.body || "",
    params.acts,
    params.cats,
    {
      attachmentNames: params.evidence.attachmentNames || [],
      attachmentText: params.evidence.attachmentText || "",
      hasAttachment: Boolean(params.evidence.hasAttachment),
      accountNames: params.accountNames,
      baseCurrency: params.baseCurrency,
    },
  );

  const result = await enqueueCloudRetryJob(params.aiConfig, {
    jobId,
    clientId,
    accountId: params.connectorId,
    provider: params.provider,
    msgId: params.msgId,
    rowId: jobId,
    subject: params.subject,
    from: params.from,
    emailDate: params.emailDate,
    model: params.aiConfig.model || DEFAULT_AI_MODEL,
    max_tokens: 1600,
    messages,
    queuedAt: nowIso(),
  });

  cloudQueueLogger.debug("Cloud queue result", { jobId, ok: result.ok });
  return result;
}

async function applyCloudEmailRetryJobs(params: {
  userId: string;
  baseCurrency: string;
  acts: string[];
  cats: Record<string, string[]>;
  accounts: BookkeepingAccount[];
  aiConfig: { endpoint: string; secret: string; bearerToken?: string; model: string };
}) {
  cloudQueueLogger.info("Applying cloud email retry jobs", {
    userId: params.userId?.slice(0, 8),
    endpoint: params.aiConfig.endpoint,
  });

  const clientId = stableAiCloudClientId(params.userId);
  const pulled = await pullCloudRetryJobs(params.aiConfig, clientId, 60);

  cloudQueueLogger.debug("Pulled jobs from cloud", {
    ok: pulled.ok,
    jobCount: pulled.jobs?.length || 0,
  });

  if (!pulled.ok || !pulled.jobs.length) {
    return { processed: 0, recovered: 0 };
  }

  const inboxRows: Array<Record<string, unknown>> = [];
  const processedCache = await readProcessedEmailCache();
  const processedForAccount = new Map<string, Set<string>>();
  let recovered = 0;
  for (const job of pulled.jobs) {
    // Handle permanently failed jobs from cloud processing
    const jobStatus = asString(job.status || "done");
    if (jobStatus === "failed") {
      // Reset cloud_queued so row can be retried locally
      const rowId = asString(job.rowId || makeAiPendingId(job.accountId, job.msgId));
      const client = requireSupabaseClient();
      await client
        .from("ledger_ai_pending_items")
        .update({
          cloud_queued: false,
          cloud_job_id: null,
          last_error: `cloud_failed: ${asString(job.lastError || "max_retries_exceeded")}`,
          next_retry_at: makePendingRetryDate(),
        })
        .eq("client_id", rowId);
      continue;
    }

    const analysis = await resolveEmailAnalysisFromRaw(job.outputText || "", {
      subject: asString(job.subject || ""),
      from: asString(job.from || ""),
      eDate: asString(job.emailDate || emailTodayIso()),
      acts: params.acts,
      cats: params.cats,
      accountNames: params.accounts.map((item) => item.name).filter(Boolean),
      baseCurrency: params.baseCurrency,
      aiConfig: params.aiConfig,
    });

    if (analysis.status === "retry") {
      // Reset cloud_queued so row can be retried in future calls
      const rowId = asString(job.rowId || makeAiPendingId(job.accountId, job.msgId));
      const client = requireSupabaseClient();
      await client
        .from("ledger_ai_pending_items")
        .update({
          cloud_queued: false,
          cloud_job_id: null,
          last_error: `parse_failed: ${analysis.reason || "unparseable_output"}`,
          next_retry_at: makePendingRetryDate(),
        })
        .eq("client_id", rowId);
      continue;
    }

    if (analysis.status !== "success" || !analysis.items.length) {
      await deletePendingEmailRow(asString(job.rowId || makeAiPendingId(job.accountId, job.msgId)));
      continue;
    }

    const connectorId = asString(job.accountId);
    const provider = normalizeProvider(job.provider || "google");
    const subject = asString(job.subject || "");
    analysis.items.forEach((item, index) => {
      inboxRows.push(
        serializeEmailInboxItem(
          connectorId,
          provider,
          asString(job.msgId),
          subject,
          item,
          index,
          params.accounts,
          params.baseCurrency,
        ),
      );
    });
    recovered += analysis.items.length;
    const processedSet = processedForAccount.get(connectorId) || new Set<string>();
    processedSet.add(asString(job.msgId));
    processedForAccount.set(connectorId, processedSet);
    await deletePendingEmailRow(asString(job.rowId || makeAiPendingId(job.accountId, job.msgId)));
  }

  if (inboxRows.length) {
    await upsertInboxRows(inboxRows);
  }
  if (processedForAccount.size) {
    const nextCache = { ...processedCache };
    processedForAccount.forEach((set, connectorId) => {
      const existing = new Set(asArray(nextCache[connectorId] as string[] | undefined).map((item) => asString(item)).filter(Boolean));
      set.forEach((msgId) => existing.add(msgId));
      nextCache[connectorId] = [...existing].slice(-50_000);
    });
    await writeProcessedEmailCache(nextCache);
  }
  return { processed: pulled.jobs.length, recovered };
}

function emailConnectorColumnsFromPatch(patch: Record<string, unknown>) {
  return {
    ...(patch.connected !== undefined ? { connected: patch.connected === true } : {}),
    ...(patch.userDisconnected !== undefined ? { user_disconnected: patch.userDisconnected === true } : {}),
    ...(patch.reauthRequired !== undefined ? { reauth_required: patch.reauthRequired === true } : {}),
    ...(patch.lastSync !== undefined ? { last_sync_at: asString(patch.lastSync) || null } : {}),
    ...(patch.firstSyncCompleted !== undefined ? { first_sync_completed: patch.firstSyncCompleted === true } : {}),
    ...(patch.syncFromDate !== undefined ? { sync_from_date: asString(patch.syncFromDate) || null } : {}),
    ...(patch.tokenExpiresAt !== undefined ? { token_expires_at: asString(patch.tokenExpiresAt) || null } : {}),
    ...(patch.lastAuthAt !== undefined ? { last_auth_at: asString(patch.lastAuthAt) || null } : {}),
    ...(patch.msClientId !== undefined ? { ms_client_id: asString(patch.msClientId) || null } : {}),
    ...(patch.msAccountId !== undefined ? { ms_account_id: asString(patch.msAccountId) || null } : {}),
    ...(patch.msUsername !== undefined ? { ms_username: asString(patch.msUsername) || null } : {}),
    ...(patch.lastCount !== undefined ? { last_count: asNumber(patch.lastCount) } : {}),
    ...(patch.enabled !== undefined ? { enabled: patch.enabled !== false } : {}),
  };
}

async function markConnectorIssue(connectorRow: Record<string, unknown>, message: string, patch: Record<string, unknown> = {}) {
  await saveEmailConnectorCloudState({
    ...connectorRow,
    ...emailConnectorColumnsFromPatch(patch),
    last_error: message,
    last_error_at: nowIso(),
    payload: {
      ...getPayload(connectorRow),
      ...patch,
      lastError: message,
      lastErrorAt: nowIso(),
    },
  });
}

async function clearConnectorIssue(connectorRow: Record<string, unknown>, patch: Record<string, unknown> = {}) {
  await saveEmailConnectorCloudState({
    ...connectorRow,
    ...emailConnectorColumnsFromPatch(patch),
    last_error: "",
    last_error_at: null,
    payload: {
      ...getPayload(connectorRow),
      ...patch,
      lastError: "",
      lastErrorAt: "",
    },
  });
}

export function createLedgerRepository(): LedgerRepository {
  return {
    async getDashboardSummary() {
      const client = requireSupabaseClient();
      const [currency, rowsRes] = await Promise.all([
        readBaseCurrency(),
        client
          .from("ledger_transactions")
          .select("entry_type, tx_date, base_amount, amount"),
      ]);
      if (rowsRes.error) throw rowsRes.error;

      const today = todayIso();
      return asArray(rowsRes.data).reduce<DashboardSummary>((acc, row) => {
        const type = asString(row.entry_type || "expense");
        const amount = roundMoney(row.base_amount ?? row.amount);
        const date = formatIsoDate(row.tx_date);

        if (type === "income") acc.totalIncome += amount;
        if (type === "expense") acc.totalExpense += amount;
        if (date === today) {
          acc.todayCount += 1;
          if (type === "income") acc.todayIncome += amount;
          if (type === "expense") acc.todayExpense += amount;
        }
        acc.net = acc.totalIncome - acc.totalExpense;
        return acc;
      }, { ...EMPTY_SUMMARY, currency });
    },

    async getTransactionSupportBundle() {
      const [accounts, baseCurrency, metadata] = await Promise.all([
        listAccountsInternal(),
        readBaseCurrency(),
        listActivitiesAndCategories(),
      ]);
      return {
        accounts,
        baseCurrency,
        activities: metadata.activities,
        categories: metadata.categories,
      };
    },

    async listTransactions(limit = 80) {
      const client = requireSupabaseClient();
      const { data, error } = await client
        .from("ledger_transactions")
        .select("*")
        .order("tx_date", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return asArray(data).map((row) => mapLedgerTransaction(row as Record<string, unknown>));
    },

    async saveTransaction(draft) {
      const serialized = await serializeTransactionDraft(draft);
      const saved = await upsertByClientId("ledger_transactions", serialized.clientId, serialized.row);
      return mapLedgerTransaction(saved);
    },

    async deleteTransaction(id) {
      await deleteByClientId("ledger_transactions", id);
    },

    async listInboxItems() {
      // Cloud queue apply is now only done during explicit retry/sync actions,
      // not during read operations, to avoid blocking the UI.
      const client = requireSupabaseClient();
      const { data, error } = await client
        .from("ledger_inbox_items")
        .select("*")
        .eq("review_status", "pending")
        .order("sort_ts", { ascending: false })
        .limit(60);
      if (error) throw error;
      return asArray(data).map((row) => mapInboxItem(row as Record<string, unknown>));
    },

    async saveInboxItem(draft) {
      const [accounts, baseCurrency] = await Promise.all([
        listAccountsInternal(),
        readBaseCurrency(),
      ]);
      await ensureActivityAndCategory(draft.businessActivity, draft.category);
      const serialized = serializeInboxDraft(draft, baseCurrency, accounts);
      const saved = await upsertByClientId("ledger_inbox_items", serialized.clientId, serialized.row);
      return mapInboxItem(saved);
    },

    async approveInboxItem(draft) {
      const transactionDraft: LedgerTransactionDraft = {
        id: makeClientId("txn"),
        amount: roundMoney(draft.amount),
        type: draft.type,
        description: draft.description,
        date: draft.date,
        businessActivity: draft.businessActivity,
        category: draft.category,
        subCategory: draft.subCategory,
        accountId: draft.accountId,
        targetAccountId: draft.targetAccountId,
        liabilityAccountId: draft.liabilityAccountId,
        paymentMethod: draft.paymentMethod,
        vendor: draft.vendor,
        trackVendor: draft.trackVendor,
        notes: draft.notes,
        borrowSource: draft.borrowSource,
      };

      const savedTransaction = await this.saveTransaction(transactionDraft);
      try {
        await this.discardInboxItem(draft.id);
      } catch (error) {
        try {
          await this.deleteTransaction(savedTransaction.id);
        } catch {}
        throw error;
      }
    },

    async discardInboxItem(id) {
      await deleteByClientId("ledger_inbox_items", id);
    },

    async getEmailWorkspace() {
      const client = requireSupabaseClient();
      const user = await getCurrentUser();
      const runtime = getProviderRuntimeConfig();
      // Cloud queue apply is now only done during explicit retry/sync actions,
      // not during read operations, to avoid blocking the UI.
      const [connectorsRes, pendingRes, aiConfig] = await Promise.all([
        client
          .from("ledger_email_accounts")
          .select("*")
          .order("updated_at", { ascending: false }),
        client
          .from("ledger_ai_pending_items")
          .select("account_client_id, status, next_retry_at")
          .order("queued_at", { ascending: false }),
        readAiConfigForUser(user.id),
      ]);

      if (connectorsRes.error) throw connectorsRes.error;
      if (pendingRes.error) throw pendingRes.error;

      const pendingByAccount = asArray(pendingRes.data).reduce<Map<string, number>>((acc, row) => {
        const accountId = asString(row.account_client_id);
        if (!accountId) return acc;
        const next = (acc.get(accountId) || 0) + (asString(row.status || "pending") === "resolved" ? 0 : 1);
        acc.set(accountId, next);
        return acc;
      }, new Map());

      const pendingRetryDueByAccount = asArray(pendingRes.data).reduce<Map<string, number>>((acc, row) => {
        const accountId = asString(row.account_client_id);
        const nextRetryAt = Date.parse(asString(row.next_retry_at));
        if (!accountId) return acc;
        if (Number.isFinite(nextRetryAt) && nextRetryAt > Date.now()) return acc;
        const next = (acc.get(accountId) || 0) + (asString(row.status || "pending") === "resolved" ? 0 : 1);
        acc.set(accountId, next);
        return acc;
      }, new Map());

      const aiEndpointConfigured = Boolean(aiConfig.endpoint);
      const aiSharedKeyConfigured = Boolean(aiConfig.bearerToken || aiConfig.secret);
      const connectorRows = asArray(connectorsRes.data).map((row) => row as Record<string, unknown>);
      const localSessions = await Promise.all(
        connectorRows.map(async(row) => ({
          connectorId: asString(row.client_id),
          session: await loadProviderSession(user.id, asString(row.client_id)),
        })),
      );
      const sessionByConnectorId = new Map(localSessions.map((item) => [item.connectorId, item.session]));

      const connectors = connectorRows.map((row) => {
        const provider = normalizeProvider(row.provider || getPayload(row).provider);
        const providerSetup = provider === "microsoft" ? runtime.microsoft : runtime.google;
        return mapEmailAccount(
          row,
          pendingByAccount.get(asString(row.client_id)) || 0,
          pendingRetryDueByAccount.get(asString(row.client_id)) || 0,
          Boolean(sessionByConnectorId.get(asString(row.client_id))?.accessToken),
          providerSetup.available,
          providerSetup.blockers,
        );
      });

      return {
        connectors,
        connectedCount: connectors.filter((item) => item.connected && item.hasLocalSession && !item.reauthRequired).length,
        totalPendingAi: connectors.reduce((sum, item) => sum + item.pendingAiCount, 0),
        aiEndpointConfigured,
        aiSharedKeyConfigured,
        providerSetup: {
          google: {
            available: runtime.google.available,
            blockers: runtime.google.blockers,
          },
          microsoft: {
            available: runtime.microsoft.available,
            blockers: runtime.microsoft.blockers,
          },
        },
        actionBlockedReason: !aiEndpointConfigured && !aiSharedKeyConfigured
          ? "Email extraction needs the LedgerAI AI worker endpoint and an active signed-in session."
          : !aiEndpointConfigured
            ? "Email extraction still needs the LedgerAI AI worker endpoint from account settings."
            : !aiSharedKeyConfigured
              ? "Email extraction still needs an active signed-in session."
              : "Provider actions run natively on this device and store provider tokens only in secure local storage.",
      };
    },

    async connectEmailProvider(provider, opts) {
      const runtime = getProviderRuntimeConfig();
      const user = await getCurrentUser();
      const existingConnectorId = asString(opts?.existingConnectorId);
      if (provider === "google" && !runtime.google.available) {
        throw new Error(runtime.google.blockers.join(". "));
      }
      if (provider === "microsoft" && !runtime.microsoft.available) {
        throw new Error(runtime.microsoft.blockers.join(". "));
      }

      if (provider === "google") {
        const request = new AuthSession.AuthRequest({
          clientId: runtime.google.clientId,
          scopes: GOOGLE_SCOPES,
          responseType: AuthSession.ResponseType.Code,
          redirectUri: runtime.google.redirectUri,
          usePKCE: true,
          extraParams: {
            access_type: "offline",
            prompt: "consent",
          },
        });
        const result = await request.promptAsync(googleDiscovery);
        if (authPromptCancelled(result)) {
          throw new Error("Google sign-in was cancelled.");
        }
        if (authPromptFailed(result)) {
          throw new Error(authPromptErrorMessage(result) || "Google sign-in failed.");
        }
        const code = authPromptCode(result);
        if (!code) throw new Error("Google did not return an authorization code.");

        const token = await AuthSession.exchangeCodeAsync({
          clientId: runtime.google.clientId,
          code,
          redirectUri: runtime.google.redirectUri,
          scopes: GOOGLE_SCOPES,
          extraParams: {
            code_verifier: asString(request.codeVerifier),
          },
        }, googleDiscovery);

        const profile = await fetchGoogleProfile(token.accessToken);
        const email = asString((profile as Record<string, unknown>).emailAddress);
        if (!email) throw new Error("Google did not return an email address.");
        const expiresAt = new Date(((Number(token.issuedAt) || Math.floor(Date.now() / 1000)) + (Number(token.expiresIn) || 3600)) * 1000).toISOString();
        const saved = await saveConnectedEmailConnector({
          provider,
          accessToken: token.accessToken,
          refreshToken: asString(token.refreshToken),
          expiresAt,
          issuedAt: Number(token.issuedAt) || Math.floor(Date.now() / 1000),
          tokenType: asString(token.tokenType || "Bearer"),
          scope: asString(token.scope),
          idToken: asString(token.idToken),
          email,
          label: email.split("@")[0],
          existingConnectorId,
          providerClientId: runtime.google.clientId,
        });
        const connectorId = asString(saved.client_id || getPayload(saved).id);
        await saveProviderSession(user.id, connectorId, makeProviderSessionRecord({
          provider,
          accessToken: token.accessToken,
          refreshToken: asString(token.refreshToken),
          expiresAt,
          issuedAt: Number(token.issuedAt) || Math.floor(Date.now() / 1000),
          tokenType: asString(token.tokenType || "Bearer"),
          scope: asString(token.scope),
          idToken: asString(token.idToken),
          email,
          label: email.split("@")[0],
          existingConnectorId: connectorId,
          providerClientId: runtime.google.clientId,
        }));
        return mapEmailAccount(saved, 0, 0, true, true, []);
      }

      const discovery = await getMicrosoftDiscovery();
      const request = new AuthSession.AuthRequest({
        clientId: runtime.microsoft.clientId,
        scopes: MICROSOFT_SCOPES,
        responseType: AuthSession.ResponseType.Code,
        redirectUri: runtime.microsoft.redirectUri,
        usePKCE: true,
        extraParams: {
          prompt: "select_account",
        },
      });
      const result = await request.promptAsync(discovery);
      if (authPromptCancelled(result)) {
        throw new Error("Microsoft sign-in was cancelled.");
      }
      if (authPromptFailed(result)) {
        throw new Error(authPromptErrorMessage(result) || "Microsoft sign-in failed.");
      }
      const code = authPromptCode(result);
      if (!code) throw new Error("Microsoft did not return an authorization code.");

      const token = await AuthSession.exchangeCodeAsync({
        clientId: runtime.microsoft.clientId,
        code,
        redirectUri: runtime.microsoft.redirectUri,
        scopes: MICROSOFT_SCOPES,
        extraParams: {
          code_verifier: asString(request.codeVerifier),
        },
      }, discovery);
      const profile = await fetchMicrosoftProfileByToken(token.accessToken);
      const profileObj = profile as Record<string, unknown>;
      const email = asString(profileObj.mail || profileObj.userPrincipalName);
      if (!email) throw new Error("Microsoft did not return an email address.");
      const expiresAt = new Date(((Number(token.issuedAt) || Math.floor(Date.now() / 1000)) + (Number(token.expiresIn) || 3600)) * 1000).toISOString();
      const saved = await saveConnectedEmailConnector({
        provider,
        accessToken: token.accessToken,
        refreshToken: asString(token.refreshToken),
        expiresAt,
        issuedAt: Number(token.issuedAt) || Math.floor(Date.now() / 1000),
        tokenType: asString(token.tokenType || "Bearer"),
        scope: asString(token.scope),
        idToken: asString(token.idToken),
        email,
        label: email.split("@")[0],
        existingConnectorId,
        providerClientId: runtime.microsoft.clientId,
        msAccountId: "",
        msUsername: email,
      });
      const connectorId = asString(saved.client_id || getPayload(saved).id);
      await saveProviderSession(user.id, connectorId, makeProviderSessionRecord({
        provider,
        accessToken: token.accessToken,
        refreshToken: asString(token.refreshToken),
        expiresAt,
        issuedAt: Number(token.issuedAt) || Math.floor(Date.now() / 1000),
        tokenType: asString(token.tokenType || "Bearer"),
        scope: asString(token.scope),
        idToken: asString(token.idToken),
        email,
        label: email.split("@")[0],
        existingConnectorId: connectorId,
        providerClientId: runtime.microsoft.clientId,
        msAccountId: "",
        msUsername: email,
      }));
      return mapEmailAccount(saved, 0, 0, true, true, []);
    },

    async disconnectEmailConnector(id) {
      const user = await getCurrentUser();
      const connectorRow = await resolveEmailConnectorRow(id);
      await clearProviderSession(user.id, id);
      await saveEmailConnectorCloudState({
        ...connectorRow,
        connected: false,
        user_disconnected: true,
        reauth_required: false,
        last_error: "",
        last_error_at: null,
        payload: {
          ...getPayload(connectorRow),
          connected: false,
          userDisconnected: true,
          reauthRequired: false,
          lastError: "",
          lastErrorAt: "",
        },
      });
    },

    async syncEmailConnector(id, opts = {}) {
      const user = await getCurrentUser();
      const connectorRow = await resolveEmailConnectorRow(id);
      const provider = normalizeProvider(connectorRow.provider || getPayload(connectorRow).provider);
      const syncFromDate = formatEmailIsoDate(opts.fromDate || connectorRow.sync_from_date || getPayload(connectorRow).syncFromDate || "", "");
      const firstSyncCompleted = connectorRow.first_sync_completed === true || getPayload(connectorRow).firstSyncCompleted === true;

      if (!firstSyncCompleted && !syncFromDate) {
        throw new Error("Choose a scan start date before the first sync.");
      }

      const context = await readEmailSyncContext(user.id);
      if (!context.aiConfig.endpoint) {
        throw new Error("AI backend endpoint missing. Configure LedgerAI AI backend in Settings before syncing email.");
      }
      if (!context.aiConfig.bearerToken && !context.aiConfig.secret) {
        throw new Error("AI authentication unavailable. Sign in again before syncing email.");
      }

      const session = await resolveProviderSessionForConnector(connectorRow, user.id);
      if (!session?.accessToken) {
        await markConnectorIssue(connectorRow, "Provider authentication must be refreshed on this device.", {
          reauthRequired: true,
        });
        throw new Error("Reconnect the provider on this device before syncing.");
      }

      const pendingRows = await listPendingEmailRows(id);
      const pendingByMsgId = new Map(pendingRows.map((row) => [asString(row.msg_id), row]));
      const processedCache = context.processedCache;
      const processedForAccount = new Set(asArray(processedCache[id] as string[] | undefined).map((item) => asString(item)).filter(Boolean));
      const maxEmails = Math.max(1, Math.min(asNumber(connectorRow.max_emails, asNumber(getPayload(connectorRow).maxEmails, 100)), 5000));
      const syncQuery = asString(connectorRow.sync_query || getPayload(connectorRow).syncQuery || getDefaultGmailQuery());
      const messages = provider === "microsoft"
        ? await listMicrosoftMessages(session.accessToken, syncFromDate, maxEmails)
        : await listGmailMessages(session.accessToken, syncFromDate, maxEmails, syncQuery);

      if (!messages.length) {
        await clearConnectorIssue(connectorRow);
        return {
          connectorId: id,
          provider,
          totalMatched: 0,
          processed: 0,
          addedToInbox: 0,
          cloudQueued: 0,
          skipped: 0,
          failed: 0,
          pendingAi: 0,
        };
      }

      const freshMessages = messages.filter((message) => !processedForAccount.has(asString(message.id)));
      if (!freshMessages.length) {
        await clearConnectorIssue(connectorRow);
        return {
          connectorId: id,
          provider,
          totalMatched: messages.length,
          processed: 0,
          addedToInbox: 0,
          cloudQueued: 0,
          skipped: 0,
          failed: 0,
          pendingAi: pendingRows.length,
        };
      }

      let processed = 0;
      let addedToInbox = 0;
      let cloudQueuedCount = 0;
      let skipped = 0;
      let failed = 0;
      let pendingAi = pendingRows.length;

      for (const message of freshMessages) {
        let evidence = null as Awaited<ReturnType<typeof fetchMessageEvidence>> | null;
        let cloudQueued = false;
        let cloudJobId = "";
        try {
          evidence = await fetchMessageEvidence(provider, session.accessToken, asString(message.id));
          const cloud = await queueCloudEmailAnalysisJob({
            userId: user.id,
            connectorId: id,
            provider,
            msgId: asString(message.id),
            subject: asString(evidence?.subject || message.subject),
            from: asString(evidence?.from || message.from?.emailAddress?.address),
            emailDate: asString(evidence?.eDate || emailTodayIso()),
            evidence: {
              subject: asString(evidence?.subject || message.subject),
              from: asString(evidence?.from || message.from?.emailAddress?.address),
              body: asString(evidence?.body || ""),
              attachmentNames: asArray(evidence?.attachmentNames as string[] | undefined),
              attachmentText: asString(evidence?.attachmentText || ""),
              hasAttachment: Boolean(evidence?.hasAttachment),
            },
            acts: context.acts,
            cats: context.cats,
            accountNames: context.accountNames,
            baseCurrency: context.baseCurrency,
            aiConfig: context.aiConfig,
          }).catch((error) => ({ ok: false, error: asString((error as Error)?.message || "cloud_queue_failed") }));
          cloudQueued = Boolean(cloud?.ok);
          cloudJobId = asString((cloud as { jobId?: string } | undefined)?.jobId || makeAiPendingId(id, asString(message.id)));
          if (cloudQueued) {
            const existingPending = pendingByMsgId.get(asString(message.id));
            processedForAccount.add(asString(message.id));
            await upsertPendingEmailRow({
              id: existingPending?.id,
              client_id: makeAiPendingId(id, asString(message.id)),
              account_client_id: id,
              provider,
              msg_id: asString(message.id),
              subject: asString(evidence?.subject || message.subject),
              sender: asString(evidence?.from || message.from?.emailAddress?.address),
              email_date: asString(evidence?.eDate || emailTodayIso()) || null,
              snippet: asString(evidence?.body || "").slice(0, 220),
              queued_at: asString(existingPending?.queued_at || nowIso()),
              last_tried_at: nowIso(),
              attempts: Math.max(0, asNumber(existingPending?.attempts, 0)),
              next_retry_at: makePendingRetryDate(),
              last_error: "queued_cloud_retry",
              cloud_queued: true,
              cloud_job_id: cloudJobId,
              status: "pending",
              resolved_at: null,
              payload: {
                ...parsePendingPayload(existingPending || {}),
                id: makeAiPendingId(id, asString(message.id)),
                accountId: id,
                provider,
                msgId: asString(message.id),
                subject: asString(evidence?.subject || message.subject),
                from: asString(evidence?.from || message.from?.emailAddress?.address),
                emailDate: asString(evidence?.eDate || emailTodayIso()),
                snippet: asString(evidence?.body || "").slice(0, 220),
                lastError: "queued_cloud_retry",
                attempts: Math.max(0, asNumber(existingPending?.attempts, 0)),
                nextRetryAt: makePendingRetryDate(),
                cloudQueued: true,
                cloudJobId,
                status: "pending",
                evidence: evidence || parsePendingPayload(existingPending || {}).evidence || null,
              },
            });
            if (!existingPending) pendingAi += 1;
            cloudQueuedCount += 1;
            continue;
          }

          const analysis = await analyzeEmailEvidence(evidence, {
            acts: context.acts,
            cats: context.cats,
            accountNames: context.accountNames,
            baseCurrency: context.baseCurrency,
            aiConfig: context.aiConfig,
          });

          if (analysis.status === "retry") {
            throw new Error(`ai_retry_required: ${analysis.reason || "retry requested"}`);
          }

          processedForAccount.add(asString(message.id));
          if (analysis.status === "no_transaction" || !analysis.items.length) {
            skipped += 1;
            const existingPending = pendingByMsgId.get(asString(message.id));
            if (existingPending) {
              await deletePendingEmailRow(asString(existingPending.client_id));
              pendingAi = Math.max(0, pendingAi - 1);
            }
            continue;
          }

          const inboxRows = analysis.items.map((item, index) =>
            serializeEmailInboxItem(id, provider, asString(message.id), evidence?.subject || asString(message.subject), item, index, context.accounts, context.baseCurrency),
          );
          await upsertInboxRows(inboxRows);
          const existingPending = pendingByMsgId.get(asString(message.id));
          if (existingPending) {
            await deletePendingEmailRow(asString(existingPending.client_id));
            pendingAi = Math.max(0, pendingAi - 1);
          }
          addedToInbox += inboxRows.length;
        } catch (error) {
          failed += 1;
          processedForAccount.add(asString(message.id));
          const failureReason = classifySyncError(error);
          const existingPending = pendingByMsgId.get(asString(message.id));
          await upsertPendingEmailRow({
            id: existingPending?.id,
            client_id: makeAiPendingId(id, asString(message.id)),
            account_client_id: id,
            provider,
            msg_id: asString(message.id),
            subject: asString(evidence?.subject || message.subject),
            sender: asString(evidence?.from || message.from?.emailAddress?.address),
            email_date: asString(evidence?.eDate || emailTodayIso()) || null,
            snippet: asString(evidence?.body || "").slice(0, 220),
            queued_at: asString(existingPending?.queued_at || nowIso()),
            last_tried_at: nowIso(),
            attempts: Math.max(1, asNumber(existingPending?.attempts, 0) + 1),
            next_retry_at: makePendingRetryDate(),
            last_error: asString((error as Error)?.message || failureReason),
            cloud_queued: cloudQueued,
            cloud_job_id: cloudQueued ? cloudJobId : null,
            status: "pending",
            resolved_at: null,
            payload: {
              ...parsePendingPayload(existingPending || {}),
              id: makeAiPendingId(id, asString(message.id)),
              accountId: id,
              provider,
              msgId: asString(message.id),
              subject: asString(evidence?.subject || message.subject),
              from: asString(evidence?.from || message.from?.emailAddress?.address),
              emailDate: asString(evidence?.eDate || emailTodayIso()),
              snippet: asString(evidence?.body || "").slice(0, 220),
              lastError: asString((error as Error)?.message || failureReason),
              attempts: Math.max(1, asNumber(existingPending?.attempts, 0) + 1),
              nextRetryAt: makePendingRetryDate(),
              cloudQueued,
              cloudJobId,
              status: "pending",
              evidence: evidence || parsePendingPayload(existingPending || {}).evidence || null,
            },
          });
          if (!existingPending) pendingAi += 1;
        } finally {
          processed += 1;
        }
      }

      await writeProcessedEmailCache({
        ...processedCache,
        [id]: [...processedForAccount].slice(-50_000),
      });

      const cloudApplied = await applyCloudEmailRetryJobs({
        userId: user.id,
        baseCurrency: context.baseCurrency,
        acts: context.acts,
        cats: context.cats,
        accounts: context.accounts,
        aiConfig: context.aiConfig,
      }).catch(() => ({ processed: 0, recovered: 0 }));
      addedToInbox += cloudApplied.recovered;
      pendingAi = (await listPendingEmailRows(id)).length;

      const syncStamp = nowIso();
      const connectorPatch = {
        connected: true,
        userDisconnected: false,
        reauthRequired: false,
        lastSync: syncStamp,
        firstSyncCompleted: firstSyncCompleted || Boolean(syncFromDate),
        syncFromDate: syncFromDate || asString(connectorRow.sync_from_date || getPayload(connectorRow).syncFromDate),
      };
      if (failed > 0 && addedToInbox === 0 && skipped === 0 && cloudQueuedCount === 0) {
        await markConnectorIssue(connectorRow, `Sync queued ${failed} message(s) for AI retry.`, connectorPatch);
      } else {
        await clearConnectorIssue(connectorRow, connectorPatch);
      }
      await saveEmailConnectorCloudState({
        ...connectorRow,
        connected: true,
        user_disconnected: false,
        reauth_required: false,
        last_sync_at: syncStamp,
        last_count: addedToInbox,
        first_sync_completed: firstSyncCompleted || Boolean(syncFromDate),
        sync_from_date: syncFromDate || null,
        payload: {
          ...getPayload(connectorRow),
          connected: true,
          userDisconnected: false,
          reauthRequired: false,
          lastSync: syncStamp,
          lastCount: addedToInbox,
          firstSyncCompleted: firstSyncCompleted || Boolean(syncFromDate),
          syncFromDate: syncFromDate || asString(connectorRow.sync_from_date || getPayload(connectorRow).syncFromDate),
        },
      });

      return {
        connectorId: id,
        provider,
        totalMatched: messages.length,
        processed,
        addedToInbox,
        cloudQueued: cloudQueuedCount,
        skipped,
        failed,
        pendingAi,
      };
    },

    async retryEmailPending(opts = {}) {
      emailRetryLogger.info("Starting email retry", { connectorId: opts.connectorId, force: opts.force });

      const user = await getCurrentUser();
      const context = await readEmailSyncContext(user.id);

      emailRetryLogger.debug("Context loaded", {
        hasEndpoint: Boolean(context.aiConfig.endpoint),
        hasBearerToken: Boolean(context.aiConfig.bearerToken),
        hasSecret: Boolean(context.aiConfig.secret),
        model: context.aiConfig.model,
      });

      if (!context.aiConfig.endpoint) {
        emailRetryLogger.error("AI backend endpoint missing");
        throw new Error("AI backend endpoint missing. Configure LedgerAI AI backend in Settings before retrying.");
      }
      if (!context.aiConfig.bearerToken && !context.aiConfig.secret) {
        emailRetryLogger.error("AI authentication unavailable");
        throw new Error("AI authentication unavailable. Sign in again before retrying email extraction.");
      }

      // When the user explicitly forces a retry (manual "Retry AI Pending" button),
      // skip the cloud pull entirely. The cloud queue is drained asynchronously by
      // the worker's 5-minute cron, so a synchronous pull here either returns nothing
      // (and wastes the pull timeout) or returns stale results. In both cases the
      // user wants immediate processing, which the direct-AI fallback below already
      // provides. For scheduled/background retries (force=false) we keep the cloud
      // pull so items that the cron already processed can be applied.
      const cloudForceSkipped = opts.force === true;
      let cloudApplyFailed = false;
      const cloudApplied = cloudForceSkipped
        ? { processed: 0, recovered: 0 }
        : await applyCloudEmailRetryJobs({
            userId: user.id,
            baseCurrency: context.baseCurrency,
            acts: context.acts,
            cats: context.cats,
            accounts: context.accounts,
            aiConfig: context.aiConfig,
          }).catch((err) => {
            emailRetryLogger.warn("Initial cloud apply failed", { error: err?.message });
            cloudApplyFailed = true;
            return { processed: 0, recovered: 0 };
          });

      // Both "force skipped" and "cloud apply failed" mean we should reset all
      // cloud-queued rows so the direct-AI path picks them up on this pass.
      const resetAllCloudRows = cloudForceSkipped || cloudApplyFailed;

      emailRetryLogger.debug("Initial cloud apply result", {
        recovered: cloudApplied.recovered,
        cloudApplyFailed,
        cloudForceSkipped,
      });

      // Reset cloud-queued items so they can be retried via direct AI analysis.
      // If the cloud apply failed (e.g. 401 auth error), reset ALL cloud-queued items
      // immediately so direct processing can proceed.
      // Otherwise only reset items that have been stale for longer than the threshold.
      const allPendingRows = await listPendingEmailRows(asString(opts.connectorId));

      emailRetryLogger.debug("Found pending rows", { total: allPendingRows.length });

      let cloudReset = 0;
      const staleThreshold = Date.now() - STALE_QUEUE_THRESHOLD_MS;
      const resetReason = cloudForceSkipped
        ? "manual_force_retry"
        : cloudApplyFailed
        ? "cloud_auth_failed_reset"
        : "cloud_processing_timeout";
      for (const row of allPendingRows) {
        if (!row.cloud_queued) continue;
        const shouldReset = resetAllCloudRows
          || !row.last_tried_at
          || (() => {
              const lastTriedMs = Date.parse(asString(row.last_tried_at));
              return Number.isFinite(lastTriedMs) && lastTriedMs < staleThreshold;
            })();
        if (shouldReset) {
          const client = requireSupabaseClient();
          await client
            .from("ledger_ai_pending_items")
            .update({
              cloud_queued: false,
              cloud_job_id: null,
              last_error: resetReason,
              next_retry_at: nowIso(),
            })
            .eq("client_id", asString(row.client_id));
          cloudReset += 1;
        }
      }

      if (cloudReset > 0) {
        emailRetryLogger.info("Reset cloud-queued items for direct retry", { count: cloudReset, reason: resetReason });
      }

      const rows = (await listPendingEmailRows(asString(opts.connectorId)))
        .filter((row) => !Boolean(row.cloud_queued))
        .filter((row) => opts.force === true || !Number.isFinite(Date.parse(asString(row.next_retry_at))) || Date.parse(asString(row.next_retry_at)) <= Date.now());

      emailRetryLogger.debug("Filtered rows for retry", { count: rows.length });

      if (!rows.length) {
        emailRetryLogger.info("No rows to retry", { recovered: cloudApplied.recovered });
        return {
          retried: 0,
          recovered: cloudApplied.recovered,
          remaining: (await listPendingEmailRows(asString(opts.connectorId))).length,
        };
      }

      let retried = 0;
      let recovered = cloudApplied.recovered;

      for (const row of rows) {
        const connectorId = asString(row.account_client_id);
        const connectorRow = await resolveEmailConnectorRow(connectorId);
        const provider = normalizeProvider(row.provider || connectorRow.provider || getPayload(connectorRow).provider);
        const pendingPayload = parsePendingPayload(row);
        let evidence = pendingPayload.evidence as Record<string, unknown> | null;

        try {
          if (!evidence) {
            const session = await resolveProviderSessionForConnector(connectorRow, user.id);
            if (!session?.accessToken) {
              throw new Error("Reconnect the provider on this device before retrying these emails.");
            }
            evidence = await fetchMessageEvidence(provider, session.accessToken, asString(row.msg_id));
          }

          // Always use direct analysis for immediate results
          // Cloud queueing is unreliable because:
          // 1. Jobs may not be processed immediately
          // 2. OPENAI_API_KEY might not be configured on the worker
          emailRetryLogger.debug("Using direct AI analysis", { msgId: row.msg_id });

          const analysis = await analyzeEmailEvidence(evidence as never, {
            acts: context.acts,
            cats: context.cats,
            accountNames: context.accountNames,
            baseCurrency: context.baseCurrency,
            aiConfig: context.aiConfig,
          });

          const processedCache = await readProcessedEmailCache();
          const processedForAccount = new Set(asArray(processedCache[connectorId] as string[] | undefined).map((item) => asString(item)).filter(Boolean));
          processedForAccount.add(asString(row.msg_id));
          await writeProcessedEmailCache({
            ...processedCache,
            [connectorId]: [...processedForAccount].slice(-50_000),
          });

          if (analysis.status === "retry") {
            throw new Error(`ai_retry_required: ${analysis.reason || "retry requested"}`);
          }

          if (analysis.status === "success" && analysis.items.length) {
            const inboxRows = analysis.items.map((item, index) =>
              serializeEmailInboxItem(connectorId, provider, asString(row.msg_id), asString((evidence as Record<string, unknown>)?.subject || row.subject), item, index, context.accounts, context.baseCurrency),
            );
            await upsertInboxRows(inboxRows);
            recovered += inboxRows.length;
          }

          await deletePendingEmailRow(asString(row.client_id));
          retried += 1;
        } catch (error) {
          emailRetryLogger.error("Email analysis failed", { msgId: row.msg_id, error: (error as Error)?.message });
          await upsertPendingEmailRow({
            ...row,
            last_tried_at: nowIso(),
            attempts: asNumber(row.attempts, 0) + 1,
            next_retry_at: makePendingRetryDate(),
            last_error: asString((error as Error)?.message || "retry_failed"),
            cloud_queued: false,
            cloud_job_id: null,
            payload: {
              ...pendingPayload,
              attempts: asNumber(row.attempts, 0) + 1,
              lastTriedAt: nowIso(),
              nextRetryAt: makePendingRetryDate(),
              lastError: asString((error as Error)?.message || "retry_failed"),
              evidence,
            },
          });
        }
      }

      const remainingRows = await listPendingEmailRows(asString(opts.connectorId));

      emailRetryLogger.info("Email retry complete", {
        retried,
        recovered,
        remaining: remainingRows.length,
      });

      return {
        retried,
        recovered,
        remaining: remainingRows.length,
      };
    },

    async listAccounts() {
      return listAccountsInternal();
    },

    async saveAccount(draft) {
      const baseCurrency = await readBaseCurrency();
      const clientId = asString(draft.id || makeClientId("account"));
      const classType = normalizeAccountClassType(draft.classType);
      const row = await upsertByClientId("ledger_bookkeeping_accounts", clientId, {
        client_id: clientId,
        name: asString(draft.name),
        account_type: asString(draft.type),
        class_type: classType,
        type_name: asString(draft.type),
        account_number: asString(draft.number),
        bank_name: asString(draft.bank),
        balance: roundMoney(draft.balance),
        original_balance: roundMoney(draft.balance),
        account_currency_code: baseCurrency,
        balance_base_currency_code: baseCurrency,
        balance_fx_rate: 1,
        balance_fx_date: todayIso(),
        balance_rate_date: todayIso(),
        balance_fx_source: "manual",
        payload: {
          id: clientId,
          name: asString(draft.name),
          type: asString(draft.type),
          typeName: asString(draft.type),
          cls: classType,
          bank: asString(draft.bank),
          number: asString(draft.number),
          balance: roundMoney(draft.balance),
          originalBalance: roundMoney(draft.balance),
          accountCurrency: baseCurrency,
          balanceBaseCurrency: baseCurrency,
          balanceFxRate: 1,
          balanceFxDate: todayIso(),
          balanceRateDate: todayIso(),
          balanceFxSource: "manual",
        },
      });
      return mapAccount(row);
    },

    async getReportsSummary(months = 6) {
      const client = requireSupabaseClient();
      const [currency, res] = await Promise.all([
        readBaseCurrency(),
        client
          .from("ledger_transactions")
          .select("entry_type, tx_date, base_amount, amount, category"),
      ]);
      if (res.error) throw res.error;

      const rows = asArray(res.data);
      if (!rows.length) return { ...EMPTY_REPORTS, currency };

      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - Math.max(months - 1, 0));
      cutoff.setDate(1);
      const cutoffIso = cutoff.toISOString().slice(0, 10);

      const monthly = new Map<string, number>();
      const categoryTotals = new Map<string, number>();
      let totalIncome = 0;
      let totalExpense = 0;
      let maxNet = 0;

      rows.forEach((row) => {
        const type = asString(row.entry_type);
        const amount = roundMoney(row.base_amount ?? row.amount);
        const date = asString(row.tx_date);
        if (!date || date < cutoffIso) return;

        const month = date.slice(0, 7);
        const delta = type === "expense" ? -amount : type === "income" ? amount : 0;
        const nextNet = asNumber(monthly.get(month), 0) + delta;
        monthly.set(month, nextNet);
        maxNet = Math.max(maxNet, Math.abs(nextNet));

        if (type === "income") totalIncome += amount;
        if (type === "expense") {
          totalExpense += amount;
          const category = asString(row.category || "Other");
          categoryTotals.set(category, asNumber(categoryTotals.get(category), 0) + amount);
        }
      });

      return {
        currency,
        totalIncome,
        totalExpense,
        net: totalIncome - totalExpense,
        monthlyTrend: [...monthly.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .slice(-Math.max(3, months))
          .map(([month, value]) => ({
            label: monthLabel(`${month}-01`),
            value,
            ratio: maxNet > 0 ? Math.min(1, Math.abs(value) / maxNet) : 0,
          })),
        categoryInsights: [...categoryTotals.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([label, value]) => ({ label, value })),
      };
    },

    async getReconciliationSummary() {
      const client = requireSupabaseClient();
      const [latestRes, runCountRes, itemCountRes] = await Promise.all([
        client
          .from("ledger_reconciliation_runs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        client
          .from("ledger_reconciliation_runs")
          .select("id", { count: "exact", head: true }),
        client
          .from("ledger_reconciliation_items")
          .select("id", { count: "exact", head: true })
          .eq("hidden", false),
      ]);
      if (latestRes.error) throw latestRes.error;
      if (runCountRes.error) throw runCountRes.error;
      if (itemCountRes.error) throw itemCountRes.error;

      const latest = latestRes.data ? mapReconciliationRun(latestRes.data as Record<string, unknown>) : null;
      return {
        runCount: Number(runCountRes.count) || 0,
        unresolvedItems: Number(itemCountRes.count) || 0,
        latestRange: latest?.statementFrom && latest?.statementTo
          ? `${latest.statementFrom} -> ${latest.statementTo}`
          : "No runs yet",
      };
    },

    async listReconciliationRuns() {
      const client = requireSupabaseClient();
      const pageSize = 100;
      const rows: Array<Record<string, unknown>> = [];
      let offset = 0;

      while (true) {
        const { data, error } = await client
          .from("ledger_reconciliation_runs")
          .select("*")
          .order("created_at", { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        const batch = asArray(data).map((row) => row as Record<string, unknown>);
        rows.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
      }

      return rows.map((row) => mapReconciliationRun(row));
    },

    async createReconciliationRun(draft: ReconciliationRunDraft): Promise<ReconciliationCreateResult> {
      const accountId = asString(draft.accountId);
      const statementFrom = formatIsoDate(draft.statementFrom) || "";
      const statementTo = formatIsoDate(draft.statementTo) || "";
      const sourceText = asString(draft.sourceText);
      const sourceKind = asString(draft.sourceKind || "paste") === "upload" ? "upload" : "paste";
      const sourceLabel = asString(draft.sourceLabel || (sourceKind === "upload" ? "Uploaded statement" : "Pasted statement"));

      if (!accountId) throw new Error("Select an account before starting reconciliation.");
      if (!statementFrom || !statementTo) throw new Error("Enter the statement period before starting reconciliation.");
      if (statementFrom > statementTo) throw new Error("Statement From cannot be after Statement To.");
      if (!sourceText) throw new Error("Add statement text or pick a statement file first.");

      const user = await getCurrentUser();
      const [context, transactions] = await Promise.all([
        readReconciliationContext(user.id),
        listTransactionsForReconciliation(accountId, statementFrom, statementTo),
      ]);
      if (!context.aiConfig.endpoint) {
        throw new Error("Configure the LedgerAI AI backend in Settings before importing reconciliation statements.");
      }
      if (!context.aiConfig.bearerToken && !context.aiConfig.secret) {
        throw new Error("AI authentication unavailable. Sign in again before importing reconciliation statements.");
      }

      const account = context.accounts.find((item) => item.id === accountId);
      if (!account) throw new Error("Selected account was not found in this LedgerAI workspace.");

      const runClientId = makeClientId("recon-run");
      const startedAt = nowIso();
      const baseRunPayload = {
        id: runClientId,
        accountId: account.id,
        accountName: account.name,
        accountCurrency: account.currency,
        statementFrom,
        statementTo,
        sourceLabel,
        sourceKind,
        status: "running",
        startedAt,
        sourcePreview: sourceText.slice(0, 220),
      };

      const savedRun = await upsertByClientId("ledger_reconciliation_runs", runClientId, {
        client_id: runClientId,
        account_client_id: account.id,
        account_name: account.name,
        statement_from: statementFrom,
        statement_to: statementTo,
        source_label: sourceLabel,
        source_kind: sourceKind,
        status: "running",
        matched_count: 0,
        mismatch_count: 0,
        statement_only_count: 0,
        ledger_only_count: 0,
        started_at: startedAt,
        finished_at: null,
        error_message: null,
        payload: baseRunPayload,
      });

      try {
        const preparedRows = await parseAndPrepareStatementRows({
          sourceText,
          accountName: account.name,
          accountType: account.type || "Account",
          accountCurrency: account.currency || context.baseCurrency,
          baseCurrency: context.baseCurrency,
          aiConfig: context.aiConfig,
          dateFallback: statementFrom || todayIso(),
        });
        const statementRows = preparedRows.filter((row) => inDateRange(asString(row.date), statementFrom, statementTo));
        if (!statementRows.length) {
          throw new Error("No statement rows were detected for the selected period. Try a clearer CSV, text file, or text-based PDF.");
        }

        const ledgerRows = buildLedgerRowsForReconciliation(
          transactions as unknown as Array<Record<string, unknown>>,
          account.id,
          account.name,
          statementFrom,
          statementTo,
        );
        const result = buildReconciliationResult(statementRows, ledgerRows);
        const finishedAt = nowIso();

        const unresolvedRows = [
          ...result.amountMismatches.map((issue, index) => ({
            client_id: `${runClientId}:mismatch:${index}`,
            run_id: savedRun.id,
            item_kind: "amount_mismatch",
            item_key: issue.id,
            hidden: false,
            statement_row_sid: asString(issue.statementRow._sid),
            ledger_transaction_client_id: asString(issue.ledgerTx.id),
            statement_date: asString(issue.statementRow.date) || null,
            ledger_date: asString(issue.ledgerTx.date) || null,
            statement_amount: roundMoney(issue.statementRow.amount),
            ledger_amount: roundMoney(issue.ledgerTx.amount),
            amount_gap: roundMoney(issue.amountGap),
            currency_code: asString(issue.statementRow.currency || context.baseCurrency),
            base_currency_code: asString(issue.statementRow.baseCurrency || context.baseCurrency),
            score: Number(issue.score) || 0,
            description: asString(issue.statementRow.description),
            payload: {
              id: `${runClientId}:mismatch:${index}`,
              runId: runClientId,
              itemKind: "amount_mismatch",
              itemKey: issue.id,
              hidden: false,
              statementRowSid: asString(issue.statementRow._sid),
              ledgerTransactionClientId: asString(issue.ledgerTx.id),
              statementDate: asString(issue.statementRow.date),
              ledgerDate: asString(issue.ledgerTx.date),
              statementAmount: roundMoney(issue.statementRow.amount),
              ledgerAmount: roundMoney(issue.ledgerTx.amount),
              amountGap: roundMoney(issue.amountGap),
              currency: asString(issue.statementRow.currency || context.baseCurrency),
              baseCurrency: asString(issue.statementRow.baseCurrency || context.baseCurrency),
              score: Number(issue.score) || 0,
              description: asString(issue.statementRow.description),
              statementRow: issue.statementRow,
              ledgerTx: issue.ledgerTx,
            },
          })),
          ...result.statementOnly.map((issue, index) => ({
            client_id: `${runClientId}:statement-only:${index}`,
            run_id: savedRun.id,
            item_kind: "statement_only",
            item_key: issue.id,
            hidden: false,
            statement_row_sid: asString(issue.statementRow._sid),
            ledger_transaction_client_id: null,
            statement_date: asString(issue.statementRow.date) || null,
            ledger_date: null,
            statement_amount: roundMoney(issue.statementRow.amount),
            ledger_amount: 0,
            amount_gap: roundMoney(issue.statementRow.amount),
            currency_code: asString(issue.statementRow.currency || context.baseCurrency),
            base_currency_code: asString(issue.statementRow.baseCurrency || context.baseCurrency),
            score: 0,
            description: asString(issue.statementRow.description),
            payload: {
              id: `${runClientId}:statement-only:${index}`,
              runId: runClientId,
              itemKind: "statement_only",
              itemKey: issue.id,
              hidden: false,
              statementRowSid: asString(issue.statementRow._sid),
              statementDate: asString(issue.statementRow.date),
              ledgerDate: "",
              statementAmount: roundMoney(issue.statementRow.amount),
              ledgerAmount: 0,
              amountGap: roundMoney(issue.statementRow.amount),
              currency: asString(issue.statementRow.currency || context.baseCurrency),
              baseCurrency: asString(issue.statementRow.baseCurrency || context.baseCurrency),
              score: 0,
              description: asString(issue.statementRow.description),
              statementRow: issue.statementRow,
            },
          })),
          ...result.ledgerOnly.map((issue, index) => ({
            client_id: `${runClientId}:ledger-only:${index}`,
            run_id: savedRun.id,
            item_kind: "ledger_only",
            item_key: issue.id,
            hidden: false,
            statement_row_sid: null,
            ledger_transaction_client_id: asString(issue.ledgerTx.id),
            statement_date: null,
            ledger_date: asString(issue.ledgerTx.date) || null,
            statement_amount: 0,
            ledger_amount: roundMoney(issue.ledgerTx.amount),
            amount_gap: roundMoney(issue.ledgerTx.amount),
            currency_code: asString(issue.ledgerTx.currency || context.baseCurrency),
            base_currency_code: asString(issue.ledgerTx.baseCurrency || context.baseCurrency),
            score: 0,
            description: asString(issue.ledgerTx.description || issue.ledgerTx.category),
            payload: {
              id: `${runClientId}:ledger-only:${index}`,
              runId: runClientId,
              itemKind: "ledger_only",
              itemKey: issue.id,
              hidden: false,
              statementRowSid: "",
              ledgerTransactionClientId: asString(issue.ledgerTx.id),
              statementDate: "",
              ledgerDate: asString(issue.ledgerTx.date),
              statementAmount: 0,
              ledgerAmount: roundMoney(issue.ledgerTx.amount),
              amountGap: roundMoney(issue.ledgerTx.amount),
              currency: asString(issue.ledgerTx.currency || context.baseCurrency),
              baseCurrency: asString(issue.ledgerTx.baseCurrency || context.baseCurrency),
              score: 0,
              description: asString(issue.ledgerTx.description || issue.ledgerTx.category),
              ledgerTx: issue.ledgerTx,
            },
          })),
        ];

        const savedItems: ReconciliationItem[] = [];
        for (const row of unresolvedRows) {
          const savedItem = await upsertByClientId("ledger_reconciliation_items", asString(row.client_id), row);
          savedItems.push(mapReconciliationItem(savedItem));
        }

        const completedRun = await upsertByClientId("ledger_reconciliation_runs", runClientId, {
          client_id: runClientId,
          account_client_id: account.id,
          account_name: account.name,
          statement_from: statementFrom,
          statement_to: statementTo,
          source_label: sourceLabel,
          source_kind: sourceKind,
          status: "completed",
          matched_count: result.matched.length,
          mismatch_count: result.amountMismatches.length,
          statement_only_count: result.statementOnly.length,
          ledger_only_count: result.ledgerOnly.length,
          started_at: startedAt,
          finished_at: finishedAt,
          error_message: null,
          payload: {
            ...baseRunPayload,
            status: "completed",
            finishedAt,
            statementRowCount: statementRows.length,
            ledgerRowCount: ledgerRows.length,
            matchedCount: result.matched.length,
            mismatchCount: result.amountMismatches.length,
            statementOnlyCount: result.statementOnly.length,
            ledgerOnlyCount: result.ledgerOnly.length,
          },
        });

        return {
          run: mapReconciliationRun(completedRun),
          items: savedItems,
          matchedCount: result.matched.length,
          mismatchCount: result.amountMismatches.length,
          statementOnlyCount: result.statementOnly.length,
          ledgerOnlyCount: result.ledgerOnly.length,
        };
      } catch (error) {
        const message = asString((error as Error)?.message || "Unable to create reconciliation run.");
        const client = requireSupabaseClient();
        await client.from("ledger_reconciliation_items").delete().eq("run_id", savedRun.id);
        await upsertByClientId("ledger_reconciliation_runs", runClientId, {
          client_id: runClientId,
          account_client_id: account.id,
          account_name: account.name,
          statement_from: statementFrom,
          statement_to: statementTo,
          source_label: sourceLabel,
          source_kind: sourceKind,
          status: "failed",
          matched_count: 0,
          mismatch_count: 0,
          statement_only_count: 0,
          ledger_only_count: 0,
          started_at: startedAt,
          finished_at: nowIso(),
          error_message: message,
          payload: {
            ...baseRunPayload,
            status: "failed",
            errorMessage: message,
          },
        });
        throw error;
      }
    },

    async listReconciliationItems(runId) {
      const client = requireSupabaseClient();
      let scopedRunId = "";

      if (asString(runId)) {
        const { data: runRow, error: runError } = await client
          .from("ledger_reconciliation_runs")
          .select("id")
          .eq("client_id", asString(runId))
          .limit(1)
          .maybeSingle();
        if (runError) throw runError;
        scopedRunId = asString(runRow?.id);
      }

      const pageSize = 200;
      const rows: Array<Record<string, unknown>> = [];
      let offset = 0;

      while (true) {
        let query = client
          .from("ledger_reconciliation_items")
          .select("*")
          .eq("hidden", false)
          .order("created_at", { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (scopedRunId) {
          query = query.eq("run_id", scopedRunId);
        }

        const { data, error } = await query;
        if (error) throw error;
        const batch = asArray(data).map((row) => row as Record<string, unknown>);
        rows.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
      }

      return rows.map((row) => mapReconciliationItem(row));
    },

    async updateReconciliationItem(item) {
      const client = requireSupabaseClient();
      const { data: existing, error: existingError } = await client
        .from("ledger_reconciliation_items")
        .select("*")
        .eq("client_id", asString(item.id))
        .limit(1)
        .maybeSingle();
      if (existingError) throw existingError;
      if (!existing) throw new Error("Reconciliation item not found.");

      const payload = {
        ...asObject(existing.payload),
        description: asString(item.description),
        hidden: item.hidden === true,
      };

      const { error } = await client
        .from("ledger_reconciliation_items")
        .update({
          description: asString(item.description),
          hidden: item.hidden === true,
          payload,
        })
        .eq("id", existing.id);
      if (error) throw error;
    },

    async getSettingsSummary() {
      const client = requireSupabaseClient();
      const user = await getCurrentUser();
      const [currencyRes, aiConfig, emailRes, accountRes, inboxRes, txRes] = await Promise.all([
        client.from("ledger_currency_settings").select("base_currency_code").limit(1).maybeSingle(),
        readAiConfigForUser(user.id),
        client.from("ledger_email_accounts").select("id", { count: "exact", head: true }),
        client.from("ledger_bookkeeping_accounts").select("id", { count: "exact", head: true }),
        client.from("ledger_inbox_items").select("id", { count: "exact", head: true }).eq("review_status", "pending"),
        client.from("ledger_transactions").select("id", { count: "exact", head: true }),
      ]);

      if (currencyRes.error) throw currencyRes.error;
      if (emailRes.error) throw emailRes.error;
      if (accountRes.error) throw accountRes.error;
      if (inboxRes.error) throw inboxRes.error;
      if (txRes.error) throw txRes.error;

      return {
        baseCurrency: asString(currencyRes.data?.base_currency_code || DEFAULT_BASE_CURRENCY),
        emailCount: emailRes.count || 0,
        accountCount: accountRes.count || 0,
        pendingInboxCount: inboxRes.count || 0,
        transactionCount: txRes.count || 0,
        aiEndpointConfigured: Boolean(asString(aiConfig.endpoint)),
        aiSharedKeyConfigured: Boolean(asString(aiConfig.bearerToken || aiConfig.secret)),
        aiModel: asString(aiConfig.model || DEFAULT_AI_MODEL),
      };
    },

    async getSmsAnalysisStatus() {
      const {
        getSmsAnalysisStatus: getSmsStatusImpl,
      } = await import("@lib/sms/smsAnalysisEnqueuer");
      const client = requireSupabaseClient();
      return getSmsStatusImpl(client);
    },

    async retrySmsAnalysis(smsMessageIds) {
      const {
        retrySmsAnalysis: retrySmsAnalysisImpl,
      } = await import("@lib/sms/smsAnalysisEnqueuer");
      const client = requireSupabaseClient();
      const user = await getCurrentUser();
      const bundle = await this.getTransactionSupportBundle();
      const aiConfig = await readAiConfigForUser(user.id);

      const context = {
        accountName: asString(bundle.accounts[0]?.name || ""),
        baseCurrency: bundle.baseCurrency,
        businessActivities: bundle.activities,
        categories: bundle.categories,
        aiConfig,
      };

      return retrySmsAnalysisImpl(smsMessageIds, client, context);
    },

    async deduplicateSmsWithEmail(smsItem, emailItems) {
      try {
        return deduplicateSmsWithEmail(smsItem, emailItems);
      } catch (err) {
        console.error("[SMS] Deduplication failed:", err);
        return {
          matched: false,
          confidence: 0,
          smsItemId: smsItem?.id || "",
          reason: "error" as const,
          details: String(err),
        };
      }
    },

    async getDeduplicationStatus() {
      try {
        const client = requireSupabaseClient();
        const user = await getCurrentUser();
        return getDeduplicationStatus(client, user.id);
      } catch (err) {
        console.error("[SMS] Failed to get dedup status:", err);
        return {
          totalMatched: 0,
          totalPending: 0,
          pendingReview: [],
        };
      }
    },

    async markSmsAsDeduped(smsItemId, emailItemId, notes = "") {
      try {
        const client = requireSupabaseClient();
        const user = await getCurrentUser();
        return markAsDeduped(smsItemId, emailItemId, client, user.id, notes);
      } catch (err) {
        console.error("[SMS] Mark dedup failed:", err);
        throw err;
      }
    },

    async getSmsInboxItems() {
      try {
        const client = requireSupabaseClient();
        const user = await getCurrentUser();

        // Fetch SMS analysis items that haven't been added to inbox yet
        const { data: smsItems, error: smsError } = await client
          .from("ledger_sms_analysis")
          .select("id, extracted_amount, extracted_vendor, extracted_currency, extracted_category, extracted_business_activity, raw_response")
          .eq("user_id", user.id)
          .eq("analysis_status", "completed")
          .is("inbox_item_id", null)
          .order("analyzed_at", { ascending: false })
          .limit(60);

        if (smsError) throw smsError;

        // Fetch deduplication status for these SMS items
        const { data: dedupMatches, error: dedupError } = await client
          .from("ledger_transaction_deduplication")
          .select("sms_item_id, email_item_id, confidence, marked_dedup_at")
          .eq("user_id", user.id)
          .in(
            "sms_item_id",
            (smsItems || []).map((item) => item.id),
          );

        if (dedupError) throw dedupError;

        // Build map of dedup matches
        const dedupMap = new Map(
          (dedupMatches || []).map((match) => [
            match.sms_item_id,
            {
              emailItemId: match.email_item_id,
              confidence: match.confidence,
              isConfirmed: !!match.marked_dedup_at,
            },
          ]),
        );

        // Transform SMS items to InboxReviewItem format
        return (smsItems || []).map((smsRow) => {
          const rawResponse = (smsRow.raw_response as Record<string, unknown>) || {};
          const dedupInfo = dedupMap.get(smsRow.id);
          const baseAmount = roundMoney(smsRow.extracted_amount || 0);

          const inboxItem: InboxReviewItem = {
            id: smsRow.id,
            source: "SMS",
            subject: asString(smsRow.extracted_vendor || "SMS Transaction"),
            amount: baseAmount,
            date: formatIsoDate(rawResponse.date || ""),
            required: [],
            currency: asString(smsRow.extracted_currency || DEFAULT_BASE_CURRENCY),
            baseCurrency: DEFAULT_BASE_CURRENCY,
            emailAccountId: "",
            emailMsgId: "",
            reviewStatus: "pending",
            type: asString(rawResponse.type || "expense") as InboxReviewItem["type"],
            description: asString(rawResponse.description || smsRow.extracted_vendor),
            businessActivity: asString(smsRow.extracted_business_activity || rawResponse.businessActivity || ""),
            category: asString(smsRow.extracted_category || rawResponse.category || ""),
            subCategory: asString(rawResponse.subCategory || ""),
            accountId: asString(rawResponse.accountId || ""),
            targetAccountId: asString(rawResponse.targetAccountId || ""),
            liabilityAccountId: asString(rawResponse.liabilityAccountId || ""),
            paymentMethod: asString(rawResponse.paymentMethod || ""),
            vendor: asString(smsRow.extracted_vendor || ""),
            trackVendor: asBool(rawResponse.trackVendor),
            notes: asString(rawResponse.notes || ""),
            borrowSource: asString(rawResponse.borrowSource || ""),
            sourceType: dedupInfo ? "both" : "sms",
            dedupStatus: dedupInfo ? (dedupInfo.isConfirmed ? "matched" : "pending") : "unmatched",
            dedupConfidence: dedupInfo?.confidence,
            dedupEmailItemId: dedupInfo?.emailItemId,
            dedupSmsItemId: dedupInfo ? smsRow.id : undefined,
          };

          // Calculate required fields
          inboxItem.required = (() => {
            const needed: string[] = [];
            if (!inboxItem.accountId) needed.push(inboxItem.type === "income" ? "Receiving account" : "Account");
            if (inboxItem.type !== "transfer" && inboxItem.type !== "borrow") {
              if (!inboxItem.businessActivity) needed.push("Business activity");
              if (!inboxItem.category) needed.push("Category");
            }
            if (inboxItem.trackVendor && !inboxItem.vendor) needed.push("Vendor");
            if (inboxItem.type === "transfer" && !inboxItem.targetAccountId) needed.push("Transfer to account");
            if (inboxItem.type === "borrow" && !inboxItem.liabilityAccountId && !inboxItem.borrowSource)
              needed.push("Liability account or borrowed source");
            return needed;
          })();

          return inboxItem;
        });
      } catch (err) {
        console.error("[SMS] Failed to fetch SMS inbox items:", err);
        return [];
      }
    },

    // Real-time subscriptions
    subscribeToTransactions(callback: (tx: LedgerTransaction) => void): UnsubscribeFn {
      let unsubscribe: UnsubscribeFn = () => {
        /* no-op */
      };
      subscribeToTransactionsWithRetry((payload) => {
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          if (payload.new) {
            callback(payload.new);
          }
        }
      }).then((fn) => {
        unsubscribe = fn;
      });
      return () => unsubscribe();
    },

    subscribeToInboxItems(callback: (item: InboxReviewItem) => void): UnsubscribeFn {
      let unsubscribe: UnsubscribeFn = () => {
        /* no-op */
      };
      subscribeToInboxItemsWithRetry((payload) => {
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          if (payload.new) {
            callback(payload.new);
          }
        }
      }).then((fn) => {
        unsubscribe = fn;
      });
      return () => unsubscribe();
    },

    subscribeToAccounts(callback: (account: BookkeepingAccount) => void): UnsubscribeFn {
      let unsubscribe: UnsubscribeFn = () => {
        /* no-op */
      };
      subscribeToAccountsWithRetry((payload) => {
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          if (payload.new) {
            callback(payload.new);
          }
        }
      }).then((fn) => {
        unsubscribe = fn;
      });
      return () => unsubscribe();
    },

    // Sync state management
    async getLastSyncTime(): Promise<string> {
      return getLastSyncTime(this as any);
    },

    async recordSyncTime(timestamp: string): Promise<void> {
      return recordSyncTime(this as any, timestamp);
    },

    async getChangesSinceLast(lastSyncTime: string): Promise<SyncDelta> {
      return getChangesSinceLast(this as any, lastSyncTime);
    },

    async getSyncState(): Promise<SyncState> {
      return getSyncState(this as any);
    },

    // Offline queue
    async enqueuePendingTransaction(
      action: "create" | "update" | "delete",
      data: Partial<LedgerTransaction>
    ): Promise<string> {
      return enqueuePendingTransaction(action, data);
    },

    async processPendingQueue(): Promise<{
      successful: number;
      failed: number;
      remaining: PendingTransaction[];
    }> {
      return processPendingQueue(this as any);
    },

    async getOfflineQueueStatus(): Promise<{
      pending: number;
      processing: number;
      failed: number;
      lastProcessedAt?: string;
    }> {
      return getOfflineQueueStatus();
    },

    // Background polling
    startBackgroundPolling(intervalMs?: number): () => void {
      return startBackgroundPolling(this as any, intervalMs);
    },

    async getPollingConfig(): Promise<PollingConfig> {
      return getPollingConfig(this as any);
    },
  };
}
