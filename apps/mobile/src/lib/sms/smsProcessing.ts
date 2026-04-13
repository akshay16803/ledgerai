/**
 * SMS Parsing and Normalization Module
 *
 * Extracts and normalizes transaction data from raw SMS messages.
 * Handles Indian banking SMS formats including:
 * - Bank transaction alerts (HDFC, ICICI, SBI, Axis, etc.)
 * - UPI payment confirmations
 * - Credit card alerts
 * - Payment gateway notifications (Paytm, PhonePe, Google Pay)
 *
 * @module smsProcessing
 */

/**
 * Extracted transaction context from raw SMS
 */
export type TransactionExtractContext = {
  /** Normalized amount (2 decimal places) */
  amount: number;
  /** ISO date (YYYY-MM-DD) */
  date: string;
  /** Normalized vendor name (lowercase, no special chars) */
  vendor: string;
  /** Inferred transaction type */
  type: "income" | "expense" | "transfer";
  /** Original parsed values for debugging */
  raw: {
    amount: string;
    date: string;
    vendor: string;
    type: string;
  };
};

// Currency symbol and code patterns
const CURRENCY_PATTERNS = {
  "₹": "INR",
  $: "USD",
  "€": "EUR",
  "£": "GBP",
};

const CURRENCY_CODE_ALIASES: Record<string, string> = {
  RS: "INR",
  "RS.": "INR",
  INR: "INR",
  RUPEE: "INR",
  RUPEES: "INR",
  USD: "USD",
  "US$": "USD",
  DOLLAR: "USD",
  DOLLARS: "USD",
  EUR: "EUR",
  EURO: "EUR",
  EUROS: "EUR",
  GBP: "GBP",
  POUND: "GBP",
  POUNDS: "GBP",
};

/**
 * Normalizes a raw amount string to a numeric value
 *
 * Removes currency symbols, thousand separators, and normalizes to 2 decimal places.
 *
 * @param rawAmount - Raw amount string or number (e.g., "₹1,234.50", "1000")
 * @returns Normalized amount (e.g., 1234.50), or 0 if invalid
 *
 * @example
 * normalizeSmsAmount("₹1,234.50") // 1234.50
 * normalizeSmsAmount("Rs. 2500.99") // 2500.99
 * normalizeSmsAmount("1000") // 1000.00
 */
export function normalizeSmsAmount(rawAmount: string | number): number {
  try {
    if (typeof rawAmount === "number") {
      const rounded = Math.round(rawAmount * 100) / 100;
      return Number.isFinite(rounded) ? rounded : 0;
    }

    const str = String(rawAmount || "").trim();
    if (!str) return 0;

    // Remove currency symbols (₹, $, €, £)
    let cleaned = str;
    Object.entries(CURRENCY_PATTERNS).forEach(([symbol]) => {
      cleaned = cleaned.replace(new RegExp(`\\${symbol}`, "g"), "");
    });

    // Remove currency codes (RS, RS., INR, USD, etc.) - use word boundaries to avoid partial matches
    cleaned = cleaned.replace(/\b(?:RS\.?|INR|USD|EUR|GBP|RUPEE|RUPEES|DOLLAR|DOLLARS|EURO|EUROS|POUND|POUNDS)\b/gi, "");

    // Remove thousand separators (comma, space) and other non-numeric chars (except dot)
    cleaned = cleaned.replace(/[,\s]/g, "").replace(/[^\d.]/g, "");

    // Handle edge case: multiple dots (use only first valid decimal point)
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      cleaned = parts[0] + "." + parts.slice(1).join("");
    }

    // Parse as float
    const amount = parseFloat(cleaned);

    // Return 0 if invalid
    if (!Number.isFinite(amount) || amount < 0) {
      console.warn("[SMS] Failed to parse amount (invalid result):", rawAmount, "parsed:", cleaned);
      return 0;
    }

    // Round to 2 decimal places
    return Math.round(amount * 100) / 100;
  } catch (err) {
    console.error("[SMS] Error normalizing amount:", err);
    return 0;
  }
}

/**
 * Normalizes a date string to ISO format (YYYY-MM-DD)
 *
 * Parses common Indian SMS date formats and falls back to timestamp or today's date.
 *
 * @param rawDate - Raw date string from SMS (e.g., "31-Mar-2026", "31/03/2026")
 * @param timestamp - Optional fallback timestamp (ISO string or milliseconds)
 * @returns ISO date (YYYY-MM-DD), or today's date if parsing fails
 *
 * @example
 * normalizeSmsDate("31-Mar-2026") // "2026-03-31"
 * normalizeSmsDate("31/03/2026") // "2026-03-31"
 * normalizeSmsDate("31-Mar") // "2026-03-31" (assumes current year)
 */
export function normalizeSmsDate(rawDate: string, timestamp?: string): string {
  try {
    const str = String(rawDate || "").trim();

    // Try parsing common Indian date formats
    if (str) {
      // Format: "31-Mar-2026" or "31-Mar-26"
      const match1 = str.match(/(\d{1,2})-([A-Za-z]{3})-(\d{2,4})/);
      if (match1) {
        const [, day, monthStr, year] = match1;
        const fullYear = year.length === 2 ? parseInt(year, 10) + 2000 : parseInt(year, 10);
        const monthNum = new Date(`${monthStr} 1`).getMonth() + 1;
        const dateStr = `${fullYear}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const parsed = Date.parse(dateStr);
        if (Number.isFinite(parsed)) {
          return dateStr;
        }
      }

      // Format: "31/03/2026" or "31.03.2026"
      const match2 = str.match(/(\d{1,2})[/./-](\d{1,2})[/./-](\d{2,4})/);
      if (match2) {
        const [, day, month, year] = match2;
        const fullYear = year.length === 2 ? parseInt(year, 10) + 2000 : parseInt(year, 10);
        const dateStr = `${fullYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const parsed = Date.parse(dateStr);
        if (Number.isFinite(parsed)) {
          return dateStr;
        }
      }

      // Try standard Date.parse()
      const parsed = Date.parse(str);
      if (Number.isFinite(parsed)) {
        const date = new Date(parsed);
        return date.toISOString().slice(0, 10);
      }
    }

    // Fallback to timestamp
    if (timestamp) {
      let timeMs = 0;
      if (timestamp.includes("-")) {
        // ISO string
        timeMs = Date.parse(timestamp);
      } else {
        // Milliseconds
        timeMs = parseInt(timestamp, 10);
      }

      if (Number.isFinite(timeMs)) {
        const date = new Date(timeMs);
        return date.toISOString().slice(0, 10);
      }
    }

    // Fallback to today
    return new Date().toISOString().slice(0, 10);
  } catch (err) {
    console.error("[SMS] Error normalizing date:", err);
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Normalizes a vendor name to a standard format
 *
 * Converts to lowercase, removes special characters, and trims.
 *
 * @param rawVendor - Raw vendor string (e.g., "Amazon Technologies Ltd.", "HDFC_BANK")
 * @returns Normalized vendor (lowercase, space-separated)
 *
 * @example
 * normalizeSmsVendor("Amazon Technologies Ltd.") // "amazon technologies"
 * normalizeSmsVendor("HDFC_BANK") // "hdfc bank"
 * normalizeSmsVendor("Paytm Service Pvt Ltd.") // "paytm"
 */
export function normalizeSmsVendor(rawVendor: string): string {
  try {
    if (!rawVendor) return "";

    let normalized = String(rawVendor).trim();

    // Lowercase
    normalized = normalized.toLowerCase();

    // Remove common business suffixes
    normalized = normalized.replace(
      /\b(ltd|limited|inc|incorporated|pvt|private|llc|corp|corporation|service|services|bank|banking|pvt\.?ltd\.?)\b/gi,
      ""
    );

    // Replace underscores, hyphens, dots with spaces
    normalized = normalized.replace(/[_\-./]+/g, " ");

    // Remove non-alphanumeric except spaces
    normalized = normalized.replace(/[^\w\s]/g, "");

    // Replace multiple spaces with single space
    normalized = normalized.replace(/\s+/g, " ");

    // Trim
    normalized = normalized.trim();

    return normalized;
  } catch (err) {
    console.error("[SMS] Error normalizing vendor:", err);
    return "";
  }
}

/**
 * Infers transaction type from SMS keywords
 *
 * @param body - SMS message body
 * @returns Transaction type (income, expense, or transfer)
 */
function inferTransactionType(body: string): "income" | "expense" | "transfer" {
  const lower = body.toLowerCase();

  // Income keywords
  if (/\b(credit|received|refund|income|deposit|credited|salary|bonus)\b/.test(lower)) {
    return "income";
  }

  // Transfer keywords (check for "to" or account mentions)
  if (/\b(transfer|sent|send to)\b/.test(lower) && /\b(to|account)\b/.test(lower)) {
    return "transfer";
  }

  // Default to expense
  return "expense";
}

/**
 * Parses raw SMS text to extract transaction data
 *
 * Handles common Indian banking SMS formats and returns normalized transaction context.
 *
 * @param body - Raw SMS message body
 * @param timestamp - Optional SMS timestamp (ISO string or milliseconds)
 * @returns Extracted transaction context with normalized fields
 *
 * @example
 * parseSmsForTransaction("Payment received from Amazon ₹2500 on 31-Mar-2026")
 * // Returns: { amount: 2500, date: "2026-03-31", vendor: "amazon", type: "expense", raw: {...} }
 */
export function parseSmsForTransaction(body: string, timestamp?: string): TransactionExtractContext {
  try {
    if (!body) {
      return {
        amount: 0,
        date: new Date().toISOString().slice(0, 10),
        vendor: "",
        type: "expense",
        raw: {
          amount: "",
          date: "",
          vendor: "",
          type: "",
        },
      };
    }

    // Extract amount from SMS
    // Patterns: "₹2500", "Rs. 2500", "INR 2500", "2500 rupees", "$100"
    const amountRegex = /(?:₹|Rs\.?|INR|USD|\$|EUR|€|GBP|£)\s*[\d,]+\.?\d*|\b\d+(?:,\d{3})*(?:\.\d{1,2})?\s*(?:rupees?|dollars?|euros?|pounds?|INR|USD|EUR|GBP)\b/gi;
    const amountMatches = body.match(amountRegex);
    const rawAmount = amountMatches ? amountMatches[0] : "0";
    const amount = normalizeSmsAmount(rawAmount);

    // Extract date from SMS
    const rawDate = body; // Pass entire SMS; function will extract date
    const date = normalizeSmsDate(rawDate, timestamp);

    // Extract vendor from SMS
    // Look for company/bank names, or extract from "from X" or "by X" patterns
    let vendor = "";
    const vendorPatterns = [
      /(?:from|by|via|account)\s+([A-Za-z\s&.]+?)(?:\s+(?:Ltd|Inc|Limited|Bank|Bank of|Ltd|Pvt)|\s+(?:account|on|for|of)|$)/i,
      /^([A-Z][A-Za-z\s&.]+?)(?:\s+(?:Alert|Notification|Confirmed))/i,
      /(amazon|hdfc|icici|sbi|axis|upi|paytm|google\s*pay|whatsapp\s*pay|phonpe|airtel\s*pay|razorpay|stripe|flipkart|myntra|zomato|uber|ola)/i,
    ];

    for (const pattern of vendorPatterns) {
      const match = body.match(pattern);
      if (match && match[1]) {
        vendor = match[1];
        break;
      }
    }

    const normalizedVendor = normalizeSmsVendor(vendor);
    const type = inferTransactionType(body);

    return {
      amount,
      date,
      vendor: normalizedVendor,
      type,
      raw: {
        amount: rawAmount,
        date: rawDate.substring(0, 50), // Limit raw date to first 50 chars
        vendor,
        type,
      },
    };
  } catch (err) {
    console.error("[SMS] Error parsing SMS for transaction:", err);
    return {
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      vendor: "",
      type: "expense",
      raw: {
        amount: "",
        date: "",
        vendor: "",
        type: "",
      },
    };
  }
}
