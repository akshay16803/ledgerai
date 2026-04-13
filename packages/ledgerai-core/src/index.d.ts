export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | { [key: string]: JsonValue } | JsonValue[];

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: string;
  expiresIn: number;
  state: string;
}

export interface CurrencyConfig {
  baseCurrency: string;
}

export interface AppSettings {
  baseCurrency: string;
  ai: {
    endpoint: string;
    model: string;
    sharedKeyConfigured: boolean;
  };
  sync: {
    autoSyncHourly: boolean;
  };
}

export interface MoneyNormalizedEntry {
  amount: number;
  baseAmount: number;
  originalAmount: number;
  currency: string;
  baseCurrency: string;
  fxRate: number;
  fxDate: string;
  fxRateDate: string;
  fxSource: string;
  [key: string]: unknown;
}

export interface FxIdentityResult {
  id: string;
  amount: number;
  from: string;
  to: string;
  requestedDate: string;
  rateDate: string;
  rate: number;
  converted: number;
  provider: "identity";
}

export interface ReconciliationMatch {
  id: string;
  statementRow: Record<string, unknown>;
  ledgerTx: Record<string, unknown>;
  score: number;
}

export interface ReconciliationAmountMismatch extends ReconciliationMatch {
  amountGap: number;
  dayGap: number;
}

export interface ReconciliationStatementOnly {
  id: string;
  statementRow: Record<string, unknown>;
}

export interface ReconciliationLedgerOnly {
  id: string;
  ledgerTx: Record<string, unknown>;
}

export interface ReconciliationResult {
  matched: ReconciliationMatch[];
  amountMismatches: ReconciliationAmountMismatch[];
  statementOnly: ReconciliationStatementOnly[];
  ledgerOnly: ReconciliationLedgerOnly[];
}

export interface NormalizedTransactionEntity extends MoneyNormalizedEntry {
  id: string;
  date: string;
  type: string;
  description: string;
  businessActivity: string;
  category: string;
  subCategory: string;
  vendor: string;
  trackVendor: boolean;
  paymentMethod: string;
  accountId: string;
  accountName: string;
  targetAccountId: string;
  targetAccountName: string;
  liabilityAccountId: string;
  liabilityAccountName: string;
  borrowSource: string;
  notes: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface NormalizedInboxEntity extends NormalizedTransactionEntity {
  iid: string;
  ts: number;
  reviewStatus: string;
  emailAccountId: string;
  emailMsgId: string;
}

export interface NormalizedBookkeepingAccountEntity {
  id: string;
  name: string;
  cls: string;
  type: string;
  typeName: string;
  bank: string;
  number: string;
  accountCurrency: string;
  balance: number;
  originalBalance: number;
  balanceBaseCurrency: string;
  balanceFxRate: number;
  balanceFxDate: string;
  balanceRateDate: string;
  balanceFxSource: string;
  createdAt: string;
  updatedAt: string;
}

export interface NormalizedEmailAccountEntity {
  id: string;
  provider: "google" | "microsoft";
  email: string;
  label: string;
  connected: boolean;
  enabled: boolean;
  userDisconnected: boolean;
  reauthRequired: boolean;
  syncQuery: string;
  syncFromDate: string;
  maxEmails: number;
  firstSyncCompleted: boolean;
  autoSyncHourly: boolean;
  lastSync: string;
  lastAuthAt: string;
  lastError: string;
  lastErrorAt: string;
  msClientId: string;
  msAccountId: string;
  msUsername: string;
}

export interface NormalizedRecurringEntity extends MoneyNormalizedEntry {
  id: string;
  type: string;
  description: string;
  businessActivity: string;
  category: string;
  subCategory: string;
  paymentMethod: string;
  accountId: string;
  cadence: string;
  dayOfWeek: number;
  dayOfMonth: number;
  startDate: string;
  endDate: string;
  nextRunDate: string;
  lastRunDate: string;
  enabled: boolean;
  notes: string;
}

export interface NormalizedAppSettingsEntity {
  baseCurrency: string;
  aiEndpoint: string;
  aiModel: string;
  aiSharedKeyConfigured: boolean;
  cloud: Record<string, JsonValue>;
  misc: Record<string, JsonValue>;
  updatedAt: string;
}

export interface NormalizedAiPendingEntity {
  id: string;
  accountId: string;
  provider: "google" | "microsoft";
  msgId: string;
  subject: string;
  from: string;
  emailDate: string;
  snippet: string;
  queuedAt: string;
  lastTriedAt: string;
  attempts: number;
  nextRetryAt: string;
  lastError: string;
  cloudQueued: boolean;
  cloudJobId: string;
}

export interface NormalizedReconciliationArtifact {
  id: string;
  accountId: string;
  accountName: string;
  fromDate: string;
  toDate: string;
  sourceLabel: string;
  status: string;
  result: Record<string, JsonValue>;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_AI_MODEL: string;
export const DEFAULT_BASE_CURRENCY: string;
export const LEGACY_DEFAULT_CURRENCY: string;
export const DEFAULT_ACTIVITIES: string[];
export const DEFAULT_CATEGORIES: Record<string, string[]>;
export const NEW_ACTIVITY_DEFAULT_CATEGORIES: string[];
export const ACCOUNT_TYPES: Array<{ key: string; label: string; cls: string }>;
export const PAYMENT_METHODS: string[];
export const CURRENCY_OPTIONS: string[];
export const CURRENCY_ALIASES: Record<string, string>;
export const ISO_DATE_RE: RegExp;
export const TX_TYPES: string[];
export const APP_SECTIONS: string[];

export function defaultCurrencyConfig(): CurrencyConfig;
export function defaultAppSettings(): AppSettings;

export const AUTH_STATES: {
  UNKNOWN: "unknown";
  AUTHENTICATED: "authenticated";
  UNAUTHENTICATED: "unauthenticated";
  REFRESHING: "refreshing";
  ERROR: "error";
};

export function normalizeAuthUser(user?: Record<string, unknown>): AuthUser;
export function normalizeSession(session?: Record<string, unknown>): AuthSession;
export function sessionExpiryMs(session?: Record<string, unknown>): number;
export function hasValidSession(session?: Record<string, unknown>, nowMs?: number, skewMs?: number): boolean;
export function authStateFromSession(session?: Record<string, unknown>): string;
export function canAccessOwner(user?: Record<string, unknown>, ownerEmail?: string): boolean;
export function assertAuthenticatedContext(input?: {
  user?: Record<string, unknown>;
  session?: Record<string, unknown>;
}): { user: AuthUser; session: AuthSession };

export function todayIsoDate(): string;
export function normalizeCurrencyCode(value?: string, fallback?: string): string;
export function normalizeFxDate(value?: string): string;
export function normalizeBaseCurrencyConfig(cfg?: Record<string, unknown>): CurrencyConfig;
export function roundMoney(value: unknown): number;
export function formatMoney(value: unknown, currency?: string, locale?: string): string;
export function fxCacheKey(from?: string, to?: string, date?: string): string;
export function identityFxResult(item?: Record<string, unknown>, baseCurrency?: string): FxIdentityResult;
export function applyMoneyNormalization(
  entry?: Record<string, unknown>,
  options?: { baseCurrency?: string; fallbackCurrency?: string },
): MoneyNormalizedEntry;
export function currencyMetaLabel(entry?: Record<string, unknown>, baseCurrency?: string, locale?: string): string;

export function isVendorTracked(entry?: Record<string, unknown>): boolean;
export function normalizeTrackedVendor(entry?: Record<string, unknown>): Record<string, unknown> & {
  vendor: string;
  trackVendor: boolean;
};
export function getAccountingValidationMessage(entry?: Record<string, unknown>, accounts?: unknown[]): string;
export function ensureCategoryInMap(
  categoryMap?: Record<string, string[]>,
  activity?: string,
  category?: string,
): Record<string, string[]>;
export function isAccountTransfer(entry?: Record<string, unknown>): boolean;

export function inDateRange(date?: string, from?: string, to?: string): boolean;
export function textSimilarity(a?: string, b?: string): number;
export function matchesAccountForReconciliation(
  tx?: Record<string, unknown>,
  accountId?: string,
  accountName?: string,
): boolean;
export function reconciliationScore(statementRow?: Record<string, unknown>, ledgerTx?: Record<string, unknown>): number;
export function buildReconciliationResult(
  statementRows?: Array<Record<string, unknown>>,
  ledgerRows?: Array<Record<string, unknown>>,
): ReconciliationResult;

export function normalizeTransactionEntity(tx?: Record<string, unknown>): NormalizedTransactionEntity;
export function toCloudTransaction(tx?: Record<string, unknown>, userId?: string): Record<string, unknown>;
export function fromCloudTransaction(row?: Record<string, unknown>): NormalizedTransactionEntity;

export function normalizeInboxEntity(item?: Record<string, unknown>): NormalizedInboxEntity;
export function toCloudInboxItem(item?: Record<string, unknown>, userId?: string): Record<string, unknown>;
export function fromCloudInboxItem(row?: Record<string, unknown>): NormalizedInboxEntity;

export function normalizeBookkeepingAccountEntity(account?: Record<string, unknown>): NormalizedBookkeepingAccountEntity;
export function toCloudBookkeepingAccount(account?: Record<string, unknown>, userId?: string): Record<string, unknown>;
export function fromCloudBookkeepingAccount(row?: Record<string, unknown>): NormalizedBookkeepingAccountEntity;

export function normalizeEmailAccountEntity(account?: Record<string, unknown>): NormalizedEmailAccountEntity;
export function toCloudEmailAccount(account?: Record<string, unknown>, userId?: string): Record<string, unknown>;
export function fromCloudEmailAccount(row?: Record<string, unknown>): NormalizedEmailAccountEntity;

export function normalizeActivityCatalog(catalog?: Record<string, unknown>): {
  activities: string[];
  categories: Record<string, string[]>;
};
export function toCloudActivityCategoryState(state?: Record<string, unknown>, userId?: string): Record<string, unknown>;
export function fromCloudActivityCategoryState(row?: Record<string, unknown>): {
  activities: string[];
  categories: Record<string, string[]>;
};

export function normalizeRecurringEntity(item?: Record<string, unknown>): NormalizedRecurringEntity;
export function toCloudRecurringItem(item?: Record<string, unknown>, userId?: string): Record<string, unknown>;
export function fromCloudRecurringItem(row?: Record<string, unknown>): NormalizedRecurringEntity;

export function normalizeAppSettingsEntity(settings?: Record<string, unknown>): NormalizedAppSettingsEntity;
export function toCloudAppSettings(settings?: Record<string, unknown>, userId?: string): Record<string, unknown>;
export function fromCloudAppSettings(row?: Record<string, unknown>): NormalizedAppSettingsEntity;

export function normalizeAiPendingEntity(item?: Record<string, unknown>): NormalizedAiPendingEntity;
export function toCloudAiPendingItem(item?: Record<string, unknown>, userId?: string): Record<string, unknown>;
export function fromCloudAiPendingItem(row?: Record<string, unknown>): NormalizedAiPendingEntity;

export function normalizeReconciliationArtifact(item?: Record<string, unknown>): NormalizedReconciliationArtifact;
export function toCloudReconciliationArtifact(item?: Record<string, unknown>, userId?: string): Record<string, unknown>;
export function fromCloudReconciliationArtifact(row?: Record<string, unknown>): NormalizedReconciliationArtifact;
