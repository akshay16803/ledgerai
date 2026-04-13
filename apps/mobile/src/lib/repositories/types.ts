export type TransactionType = "income" | "expense" | "transfer" | "borrow";

export type LedgerTransaction = {
  id: string;
  amount: number;
  originalAmount: number;
  baseAmount: number;
  type: TransactionType;
  description: string;
  date: string;
  businessActivity: string;
  category: string;
  subCategory: string;
  accountId: string;
  accountName: string;
  targetAccountId: string;
  targetAccountName: string;
  liabilityAccountId: string;
  liabilityAccountName: string;
  paymentMethod: string;
  vendor: string;
  trackVendor: boolean;
  notes: string;
  borrowSource: string;
  createdAt: string;
  currency: string;
  baseCurrency: string;
  source: string;
};

export type LedgerTransactionDraft = {
  id?: string;
  createdAt?: string;
  amount: number;
  type: TransactionType;
  description: string;
  date: string;
  businessActivity: string;
  category: string;
  subCategory: string;
  accountId: string;
  targetAccountId: string;
  liabilityAccountId: string;
  paymentMethod: string;
  vendor: string;
  trackVendor: boolean;
  notes: string;
  borrowSource: string;
};

export type DashboardSummary = {
  totalIncome: number;
  totalExpense: number;
  net: number;
  todayIncome: number;
  todayExpense: number;
  todayCount: number;
  currency: string;
};

export type InboxReviewItem = LedgerTransactionDraft & {
  id: string;
  source: string;
  subject: string;
  amount: number;
  date: string;
  required: string[];
  currency: string;
  baseCurrency: string;
  emailAccountId: string;
  emailMsgId: string;
  reviewStatus: string;
  /**
   * Source type of the transaction item
   * - "email": sourced from email only
   * - "sms": sourced from SMS only
   * - "both": matched email + SMS sources (deduped)
   */
  sourceType?: "email" | "sms" | "both";
  /**
   * Deduplication status (relevant for SMS-sourced items)
   * - "matched": successfully deduplicated with email item
   * - "unmatched": SMS item with no email match found
   * - "pending": awaiting user review for potential match
   */
  dedupStatus?: "matched" | "unmatched" | "pending";
  /**
   * Confidence score for deduplication match (0-100)
   * Only populated if dedupStatus is "matched" or "pending"
   */
  dedupConfidence?: number;
  /**
   * ID of the matched email inbox item (if deduped)
   * Populated when sourceType="both" and dedupStatus="matched"
   */
  dedupEmailItemId?: string;
  /**
   * ID of the matched SMS item (if deduped)
   * Populated when sourceType="both" and dedupStatus="matched"
   */
  dedupSmsItemId?: string;
};

export type EmailConnector = {
  id: string;
  provider: string;
  label: string;
  email: string;
  status: string;
  note: string;
  connected: boolean;
  reauthRequired: boolean;
  hasLocalSession: boolean;
  providerConfigured: boolean;
  lastSync: string;
  lastError: string;
  lastErrorAt: string;
  pendingAiCount: number;
  pendingRetryDueCount: number;
  firstSyncCompleted: boolean;
  syncFromDate: string;
  syncQuery: string;
  maxEmails: number;
  canConnect: boolean;
  canReconnect: boolean;
  canSync: boolean;
  canRetryAi: boolean;
  canDisconnect: boolean;
  setupBlockers: string[];
  actionBlockedReason: string;
};

export type EmailWorkspace = {
  connectors: EmailConnector[];
  connectedCount: number;
  totalPendingAi: number;
  aiEndpointConfigured: boolean;
  aiSharedKeyConfigured: boolean;
  providerSetup: {
    google: {
      available: boolean;
      blockers: string[];
    };
    microsoft: {
      available: boolean;
      blockers: string[];
    };
  };
  actionBlockedReason: string;
};

export type EmailConnectPayload = {
  provider: "google" | "microsoft";
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  issuedAt?: number;
  tokenType?: string;
  scope?: string;
  idToken?: string;
  email: string;
  label?: string;
  existingConnectorId?: string;
  providerClientId?: string;
  msAccountId?: string;
  msUsername?: string;
};

export type EmailSyncResult = {
  connectorId: string;
  provider: "google" | "microsoft";
  totalMatched: number;
  processed: number;
  addedToInbox: number;
  cloudQueued: number;
  skipped: number;
  failed: number;
  pendingAi: number;
};

export type EmailRetryResult = {
  retried: number;
  recovered: number;
  remaining: number;
};

export type BookkeepingAccount = {
  id: string;
  name: string;
  type: string;
  classType: string;
  bank: string;
  number: string;
  balance: number;
  currency: string;
};

export type BookkeepingAccountDraft = {
  id?: string;
  name: string;
  type: string;
  classType: string;
  bank: string;
  number: string;
  balance: number;
};

export type CategoryInsight = {
  label: string;
  value: number;
};

export type TrendPoint = {
  label: string;
  ratio: number;
  value: number;
};

export type ReportsSummary = {
  categoryInsights: CategoryInsight[];
  monthlyTrend: TrendPoint[];
  currency: string;
  totalIncome: number;
  totalExpense: number;
  net: number;
};

export type ReconciliationSummary = {
  runCount: number;
  unresolvedItems: number;
  latestRange: string;
};

export type ReconciliationRunDraft = {
  accountId: string;
  statementFrom: string;
  statementTo: string;
  sourceText: string;
  sourceLabel: string;
  sourceKind: "upload" | "paste";
};

export type ReconciliationRun = {
  id: string;
  accountId: string;
  accountName: string;
  statementFrom: string;
  statementTo: string;
  sourceLabel: string;
  sourceKind: string;
  status: string;
  matchedCount: number;
  mismatchCount: number;
  statementOnlyCount: number;
  ledgerOnlyCount: number;
  startedAt: string;
  finishedAt: string;
  errorMessage: string;
};

export type ReconciliationItem = {
  id: string;
  runId: string;
  itemKind: string;
  itemKey: string;
  hidden: boolean;
  statementDate: string;
  ledgerDate: string;
  statementAmount: number;
  ledgerAmount: number;
  amountGap: number;
  currency: string;
  baseCurrency: string;
  score: number;
  description: string;
};

export type ReconciliationCreateResult = {
  run: ReconciliationRun;
  items: ReconciliationItem[];
  matchedCount: number;
  mismatchCount: number;
  statementOnlyCount: number;
  ledgerOnlyCount: number;
};

export type TransactionSupportBundle = {
  accounts: BookkeepingAccount[];
  activities: string[];
  categories: Record<string, string[]>;
  baseCurrency: string;
};

export type SettingsSummary = {
  baseCurrency: string;
  emailCount: number;
  accountCount: number;
  pendingInboxCount: number;
  transactionCount: number;
  aiEndpointConfigured: boolean;
  aiSharedKeyConfigured: boolean;
  aiModel: string;
};

export type SmsAnalysisStatus = {
  /** Number of SMS messages pending analysis */
  pending: number;
  /** Number of SMS messages currently being processed */
  processing: number;
  /** Number of SMS messages successfully analyzed */
  completed: number;
  /** Number of SMS messages that failed analysis */
  failed: number;
  /** ISO timestamp of last analysis attempt, if any */
  lastAnalysisAt?: string;
  /** ISO timestamp of next scheduled retry, if any */
  nextRetryAt?: string;
};

export type SmsRetryResult = {
  /** Number of SMS messages that were retried */
  retried: number;
  /** Number of SMS messages successfully recovered during retry */
  recovered: number;
  /** Number of SMS messages still pending after retry */
  remaining: number;
};

/**
 * Result of deduplication attempt between SMS and email items
 */
export type DeduplicationResult = {
  /** Whether a match was found (confidence >= 90%) */
  matched: boolean;
  /** Confidence score (0-100) */
  confidence: number;
  /** Email item ID if matched, undefined otherwise */
  emailItemId?: string;
  /** SMS item ID being evaluated */
  smsItemId: string;
  /** Reason for match/no-match decision */
  reason: "exact_match" | "fuzzy_match" | "no_match" | "error";
  /** Additional context (error message, etc.) */
  details?: string;
};

/**
 * Potential duplicate pair pending user review
 */
export type PotentialDuplicate = {
  /** SMS extracted item */
  smsItem: any; // Reuse ExtractedEmailItem structure without circular import
  /** Email extracted item */
  emailItem: any;
  /** Confidence score (0-100) */
  confidence: number;
  /** Reason for potential match */
  reason: string;
  /** Dedup ID if already recorded */
  dedupId?: string;
};

/**
 * Deduplication record stored in database
 */
export type DeduplicationMatch = {
  /** Unique record ID */
  id: string;
  /** SMS item ID (correlates to ledger_sms_analysis) */
  smsItemId: string;
  /** Email item ID (correlates to ledger_inbox) */
  emailItemId: string;
  /** Confidence score (0-100) */
  confidence: number;
  /** SMS transaction amount */
  smsAmount: number;
  /** Email transaction amount */
  emailAmount: number;
  /** Date offset in days (negative = SMS earlier) */
  dateOffset: number;
  /** When the match was created */
  createdAt: string;
  /** When user confirmed/marked as deduped, null if pending */
  markedDedupAt?: string;
  /** User notes or reason */
  notes?: string;
};

/**
 * Deduplication status summary
 */
export type DeduplicationStatus = {
  /** Total number of confirmed dedup matches */
  totalMatched: number;
  /** Total number of pending dedup records awaiting confirmation */
  totalPending: number;
  /** List of potential duplicates pending user review */
  pendingReview: PotentialDuplicate[];
};

// Real-time subscription types
export type UnsubscribeFn = () => void;

export type RealtimePayload<T> = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T | null;
  old: T | null;
  schema: string;
  table: string;
  commit_timestamp: string;
};

// Sync delta type
export type SyncDelta = {
  transactions: LedgerTransaction[];
  inboxItems: InboxReviewItem[];
  accounts: BookkeepingAccount[];
  deletedTransactionIds: string[];
  deletedAccountIds: string[];
  deletedInboxItemIds: string[];
  lastSyncTime: string;
  syncedAt: string;
};

// Pending transaction type
export type PendingTransaction = {
  id: string;
  action: "create" | "update" | "delete";
  data: Partial<LedgerTransaction>;
  createdAt: string;
  retryCount: number;
  lastError?: string;
};

// Conflict resolution type
export type ConflictResolutionEvent = {
  table: string;
  id: string;
  conflictType: "update-vs-update" | "delete-vs-update";
  localModified: string;
  remoteModified: string;
  resolution: "local-kept" | "remote-applied";
  timestamp: string;
};

// Sync state type
export type SyncState = {
  lastSyncTime: string;
  lastSyncAt: string;
  isSubscribed: boolean;
  isPolling: boolean;
  pendingCount: number;
  conflictCount: number;
  lastError?: string;
};

// Polling config type
export type PollingConfig = {
  intervalMs: number;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
};

export type LedgerRepository = {
  getDashboardSummary: () => Promise<DashboardSummary>;
  getTransactionSupportBundle: () => Promise<TransactionSupportBundle>;
  listTransactions: (limit?: number) => Promise<LedgerTransaction[]>;
  saveTransaction: (draft: LedgerTransactionDraft) => Promise<LedgerTransaction>;
  deleteTransaction: (id: string) => Promise<void>;
  listInboxItems: () => Promise<InboxReviewItem[]>;
  saveInboxItem: (draft: InboxReviewItem) => Promise<InboxReviewItem>;
  approveInboxItem: (draft: InboxReviewItem) => Promise<void>;
  discardInboxItem: (id: string) => Promise<void>;
  getEmailWorkspace: () => Promise<EmailWorkspace>;
  connectEmailProvider: (provider: "google" | "microsoft", opts?: { existingConnectorId?: string }) => Promise<EmailConnector>;
  disconnectEmailConnector: (id: string) => Promise<void>;
  syncEmailConnector: (id: string, opts?: { fromDate?: string }) => Promise<EmailSyncResult>;
  retryEmailPending: (opts?: { connectorId?: string; force?: boolean }) => Promise<EmailRetryResult>;
  listAccounts: () => Promise<BookkeepingAccount[]>;
  saveAccount: (draft: BookkeepingAccountDraft) => Promise<BookkeepingAccount>;
  getReportsSummary: (months?: number) => Promise<ReportsSummary>;
  getReconciliationSummary: () => Promise<ReconciliationSummary>;
  listReconciliationRuns: () => Promise<ReconciliationRun[]>;
  createReconciliationRun: (draft: ReconciliationRunDraft) => Promise<ReconciliationCreateResult>;
  listReconciliationItems: (runId?: string) => Promise<ReconciliationItem[]>;
  updateReconciliationItem: (item: Pick<ReconciliationItem, "id" | "description" | "hidden">) => Promise<void>;
  getSettingsSummary: () => Promise<SettingsSummary>;
  getSmsAnalysisStatus: () => Promise<SmsAnalysisStatus>;
  retrySmsAnalysis: (smsMessageIds: string[]) => Promise<SmsRetryResult>;
  deduplicateSmsWithEmail: (smsItem: any, emailItems: any[]) => Promise<DeduplicationResult>;
  getDeduplicationStatus: () => Promise<DeduplicationStatus>;
  markSmsAsDeduped: (smsItemId: string, emailItemId: string, notes?: string) => Promise<string>;
  getSmsInboxItems: () => Promise<InboxReviewItem[]>;

  // Real-time subscriptions
  subscribeToTransactions: (callback: (tx: LedgerTransaction) => void) => UnsubscribeFn;
  subscribeToInboxItems: (callback: (item: InboxReviewItem) => void) => UnsubscribeFn;
  subscribeToAccounts: (callback: (account: BookkeepingAccount) => void) => UnsubscribeFn;

  // Sync state management
  getLastSyncTime: () => Promise<string>;
  recordSyncTime: (timestamp: string) => Promise<void>;
  getChangesSinceLast: (lastSyncTime: string) => Promise<SyncDelta>;
  getSyncState: () => Promise<SyncState>;

  // Offline queue
  enqueuePendingTransaction: (
    action: "create" | "update" | "delete",
    data: Partial<LedgerTransaction>
  ) => Promise<string>;

  processPendingQueue: () => Promise<{
    successful: number;
    failed: number;
    remaining: PendingTransaction[];
  }>;

  getOfflineQueueStatus: () => Promise<{
    pending: number;
    processing: number;
    failed: number;
    lastProcessedAt?: string;
  }>;

  // Background polling
  startBackgroundPolling: (intervalMs?: number) => () => void;
  getPollingConfig: () => Promise<PollingConfig>;
};
