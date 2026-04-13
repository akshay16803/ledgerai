export const DEFAULT_AI_MODEL = "gpt-4o-mini";
export const DEFAULT_BASE_CURRENCY = "INR";
export const LEGACY_DEFAULT_CURRENCY = "INR";

export const DEFAULT_ACTIVITIES = [
  "Futures & Commodities Trading",
  "Equity Trading",
  "Kite / Zerodha Platform",
  "Personal",
  "Trial Business – Venture A",
  "Trial Business – Venture B",
  "Trial Business – Venture C",
];

export const DEFAULT_CATEGORIES = {
  "Futures & Commodities Trading": [
    "Brokerage",
    "STT",
    "Exchange Charges",
    "SEBI Fees",
    "Stamp Duty",
    "GST on Charges",
    "Software/Tools",
    "Data Feeds",
    "Other",
  ],
  "Equity Trading": [
    "Brokerage",
    "STT",
    "Exchange Charges",
    "SEBI Fees",
    "Stamp Duty",
    "GST on Charges",
    "Software/Tools",
    "Research Reports",
    "Other",
  ],
  "Kite / Zerodha Platform": [
    "Brokerage",
    "API Charges",
    "Margin Interest",
    "Ledger Charges",
    "DP Charges",
    "Other Platform Charges",
  ],
  Personal: [
    "Food & Dining",
    "Transport",
    "Groceries",
    "Entertainment",
    "Healthcare",
    "Clothing",
    "Utilities",
    "Rent",
    "EMI",
    "Shopping",
    "Other",
  ],
  "Trial Business – Venture A": [
    "Marketing",
    "Operations",
    "Salaries",
    "Rent",
    "Utilities",
    "Miscellaneous",
  ],
  "Trial Business – Venture B": [
    "Marketing",
    "Operations",
    "Salaries",
    "Rent",
    "Utilities",
    "Miscellaneous",
  ],
  "Trial Business – Venture C": [
    "Marketing",
    "Operations",
    "Salaries",
    "Rent",
    "Utilities",
    "Miscellaneous",
  ],
};

export const NEW_ACTIVITY_DEFAULT_CATEGORIES = ["General", "Marketing", "Operations", "Other"];

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
];

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
];

export const CURRENCY_OPTIONS = ["INR", "USD", "EUR", "GBP", "AED", "AUD", "CAD", "SGD", "JPY", "CNY", "HKD", "CHF"];

export const CURRENCY_ALIASES = {
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

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const TX_TYPES = ["income", "expense", "transfer", "borrow"];

export const APP_SECTIONS = [
  "dashboard",
  "transactions",
  "inbox",
  "email",
  "journal",
  "accounts",
  "reconciliation",
  "reports",
  "settings",
  "daily",
];

export function defaultCurrencyConfig() {
  return { baseCurrency: DEFAULT_BASE_CURRENCY };
}

export function defaultAppSettings() {
  return {
    baseCurrency: DEFAULT_BASE_CURRENCY,
    ai: {
      endpoint: "",
      model: DEFAULT_AI_MODEL,
      sharedKeyConfigured: false,
    },
    sync: {
      autoSyncHourly: true,
    },
  };
}
