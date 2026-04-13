/**
 * Shared Constants for LedgerAI Mobile App
 * 
 * This file centralizes all constants used across the mobile app.
 * It re-exports from @ledgerai/core where possible and defines
 * mobile-specific constants.
 * 
 * IMPORTANT: When updating constants, ensure they stay in sync with:
 * - /app/packages/ledgerai-core/src/constants.js
 * - /app/scripts/cloudflare-ai-worker.js
 */

// ============================================================================
// AI CONFIGURATION
// ============================================================================

/** Default AI model for email/SMS analysis */
export const DEFAULT_AI_MODEL = "gpt-4o-mini";

/** Default AI endpoint (from environment or fallback) */
export const DEFAULT_AI_ENDPOINT = process.env.EXPO_PUBLIC_AI_ENDPOINT || "";

/** Maximum tokens for AI responses */
export const MAX_AI_TOKENS = 1600;

/** Timeout for AI requests (ms) */
export const AI_REQUEST_TIMEOUT_MS = 35_000;

// ============================================================================
// CURRENCY CONFIGURATION
// ============================================================================

/** Default base currency */
export const DEFAULT_BASE_CURRENCY = "INR";

/** Currency code aliases for normalization */
export const CURRENCY_ALIASES: Record<string, string> = {
  "₹": "INR",
  RS: "INR",
  "RS.": "INR",
  RUPEE: "INR",
  RUPEES: "INR",
  INR: "INR",
  "$": "USD",
  "US$": "USD",
  USD: "USD",
  DOLLAR: "USD",
  DOLLARS: "USD",
  "€": "EUR",
  EUR: "EUR",
  EURO: "EUR",
  EUROS: "EUR",
  "£": "GBP",
  GBP: "GBP",
  POUND: "GBP",
  POUNDS: "GBP",
  AED: "AED",
  DIRHAM: "AED",
  DIRHAMS: "AED",
  AUD: "AUD",
  CAD: "CAD",
  SGD: "SGD",
  JPY: "JPY",
  YEN: "JPY",
  CNY: "CNY",
  RMB: "CNY",
  HKD: "HKD",
  CHF: "CHF",
};

/** Supported currency options for user selection */
export const CURRENCY_OPTIONS = ["INR", "USD", "EUR", "GBP", "AED", "AUD", "CAD", "SGD", "JPY", "CNY", "HKD", "CHF"];

// ============================================================================
// RETRY QUEUE CONFIGURATION
// ============================================================================

/** Time after which a cloud-queued item is considered stale (ms) */
export const STALE_QUEUE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

/** Maximum items to process in a single retry batch */
export const MAX_RETRY_BATCH_SIZE = 60;

/** Timeout for cloud queue pull operations (ms) */
export const CLOUD_PULL_TIMEOUT_MS = 120_000; // 2 minutes

/** Timeout for cloud queue enqueue operations (ms) */
export const CLOUD_ENQUEUE_TIMEOUT_MS = 30_000; // 30 seconds

// ============================================================================
// VALIDATION PATTERNS
// ============================================================================

/** ISO date format regex (YYYY-MM-DD) */
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Email address validation regex */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ============================================================================
// APP SETTINGS DEFAULTS
// ============================================================================

/** Default app settings structure */
export const DEFAULT_APP_SETTINGS = {
  baseCurrency: DEFAULT_BASE_CURRENCY,
  ai: {
    endpoint: DEFAULT_AI_ENDPOINT,
    model: DEFAULT_AI_MODEL,
    sharedKeyConfigured: false,
  },
  sync: {
    autoSyncHourly: true,
  },
};

// ============================================================================
// TRANSACTION TYPES
// ============================================================================

export const TRANSACTION_TYPES = ["income", "expense", "transfer", "borrow"] as const;
export type TransactionType = typeof TRANSACTION_TYPES[number];

// ============================================================================
// ACCOUNT TYPES
// ============================================================================

export const ACCOUNT_TYPES = [
  { key: "savings", label: "Savings Account", cls: "asset" },
  { key: "current", label: "Current Account", cls: "asset" },
  { key: "trading", label: "Trading Account", cls: "asset" },
  { key: "wallet", label: "Digital Wallet", cls: "asset" },
  { key: "investment", label: "Investment Account", cls: "asset" },
  { key: "realestate", label: "Real Estate", cls: "asset" },
  { key: "cash", label: "Cash", cls: "asset" },
  { key: "creditcard", label: "Credit Card", cls: "liability" },
  { key: "paylater", label: "Pay Later", cls: "liability" },
  { key: "loan", label: "Loan", cls: "liability" },
  { key: "borrowing", label: "Borrowing (Friends)", cls: "liability" },
] as const;

// ============================================================================
// PAYMENT METHODS
// ============================================================================

export const PAYMENT_METHODS = [
  "UPI",
  "Debit Card",
  "Credit Card",
  "Cash",
  "Bank Transfer",
  "NEFT/RTGS",
  "Cheque",
  "Pay Later",
  "Wallet",
] as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize a currency code to standard format
 */
export function normalizeCurrencyCode(value: unknown, fallback = DEFAULT_BASE_CURRENCY): string {
  const raw = String(value || "").toUpperCase().trim();
  if (!raw) return fallback;
  if (CURRENCY_ALIASES[raw]) return CURRENCY_ALIASES[raw];
  const letters = raw.replace(/[^A-Z]/g, "");
  if (!letters) return fallback;
  if (CURRENCY_ALIASES[letters]) return CURRENCY_ALIASES[letters];
  return /^[A-Z]{3}$/.test(letters) ? letters : fallback;
}

/**
 * Check if a string is a valid ISO date
 */
export function isValidIsoDate(value: unknown): boolean {
  return typeof value === "string" && ISO_DATE_RE.test(value);
}

/**
 * Get today's date in ISO format
 */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Get current timestamp in ISO format
 */
export function nowIso(): string {
  return new Date().toISOString();
}
