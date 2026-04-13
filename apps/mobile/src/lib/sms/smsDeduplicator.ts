/**
 * SMS Deduplicator Module
 *
 * Matches SMS transaction results against email transaction results using
 * transaction signature hashing and confidence scoring. Handles fuzzy matching
 * with tolerance for rounding errors, date offsets, and vendor abbreviations.
 *
 * Database Persistence:
 * - Saves dedup matches to ledger_transaction_deduplication table
 * - Updates ledger_inbox with source_type and dedup references
 * - Maintains audit trail of matches and user confirmations
 *
 * @module smsDeduplicator
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildTransactionSignature, compareTransactionSignatures } from "./transactionSignature";

/**
 * Extracted email/SMS item for deduplication
 * Superset of ExtractedEmailItem with optional id field
 */
export type ExtractedItem = {
  id?: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  originalAmount?: number;
  baseAmount?: number;
  currency: string;
  baseCurrency?: string;
  businessActivity?: string;
  category?: string;
  subCategory?: string;
  description?: string;
  vendor: string;
  trackVendor?: boolean;
  paymentMethod?: string;
  accountName?: string;
  targetAccountName?: string;
  date: string;
  fxRate?: number;
  fxDate?: string;
  fxRateDate?: string;
  fxSource?: string;
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
  smsItem: ExtractedItem;
  /** Email extracted item */
  emailItem: ExtractedItem;
  /** Confidence score (0-100) */
  confidence: number;
  /** Reason for potential match */
  reason: string;
  /** Dedup ID if already recorded, for linking */
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

// Constants for fuzzy matching
const CONFIDENCE_EXACT_MATCH = 100;
const CONFIDENCE_THRESHOLD = 90;
const AMOUNT_TOLERANCE_PERCENT = 0.01;
const DATE_TOLERANCE_DAYS = 1;
const FUZZY_SCORE_AMOUNT = 10;
const FUZZY_SCORE_DATE = 5;
const FUZZY_SCORE_VENDOR = 5;

/**
 * Normalize vendor name for matching
 *
 * Removes special characters, converts to lowercase, trims whitespace.
 * Enables partial matching across vendor name variations.
 *
 * @param vendor - Vendor name to normalize
 * @returns Normalized vendor name
 */
function normalizeVendor(vendor: string): string {
  return vendor
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculate vendor similarity using simple substring matching
 *
 * Returns true if:
 * - Normalized strings are identical
 * - One is contained in the other
 * - Common significant words overlap
 *
 * @param vendor1 - First vendor name
 * @param vendor2 - Second vendor name
 * @returns Similarity score (0-1)
 */
function getVendorSimilarity(vendor1: string, vendor2: string): number {
  const norm1 = normalizeVendor(vendor1);
  const norm2 = normalizeVendor(vendor2);

  if (norm1 === norm2) return 1.0;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.8;

  // Word overlap matching
  const words1 = norm1.split(" ");
  const words2 = norm2.split(" ");
  const overlap = words1.filter((w) => words2.includes(w)).length;
  const maxWords = Math.max(words1.length, words2.length);

  return overlap > 0 ? overlap / maxWords : 0;
}

/**
 * Calculate date difference in days
 *
 * @param date1 - First date (ISO string)
 * @param date2 - Second date (ISO string)
 * @returns Absolute difference in days
 */
function getDateDifferenceDays(date1: string, date2: string): number {
  try {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffMs = Math.abs(d1.getTime() - d2.getTime());
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return 999;
  }
}

/**
 * Calculate amount difference as percentage
 *
 * @param amount1 - First amount
 * @param amount2 - Second amount
 * @returns Percentage difference (0-100)
 */
function getAmountDifferencePercent(amount1: number, amount2: number): number {
  if (amount1 === 0 && amount2 === 0) return 0;
  if (amount1 === 0 || amount2 === 0) return 100;
  const diff = Math.abs(amount1 - amount2);
  const avg = (Math.abs(amount1) + Math.abs(amount2)) / 2;
  return (diff / avg) * 100;
}

/**
 * Compare two transaction items using fuzzy matching
 *
 * Assigns confidence score based on:
 * - Exact signature match: 100% confidence
 * - Fuzzy match components:
 *   - Amount within tolerance: +10 points
 *   - Date within tolerance: +5 points
 *   - Vendor similarity: +5 points
 * - Baseline: 50 points (initial match attempt)
 *
 * @param smsItem - SMS extracted transaction
 * @param emailItem - Email extracted transaction
 * @returns Confidence score (0-100)
 */
function calculateConfidenceScore(smsItem: ExtractedItem, emailItem: ExtractedItem): number {
  try {
    // Normalize for comparison
    const smsAmount = Math.round(smsItem.amount * 100) / 100;
    const emailAmount = Math.round(emailItem.amount * 100) / 100;
    const smsDate = smsItem.date || "";
    const emailDate = emailItem.date || "";
    const smsVendor = smsItem.vendor || "";
    const emailVendor = emailItem.vendor || "";

    // Build signatures
    const smsSig = buildTransactionSignature(smsAmount, smsDate, normalizeVendor(smsVendor));
    const emailSig = buildTransactionSignature(emailAmount, emailDate, normalizeVendor(emailVendor));

    // Exact match check
    if (compareTransactionSignatures(smsSig, emailSig)) {
      return CONFIDENCE_EXACT_MATCH;
    }

    // Fuzzy match scoring
    let score = 50; // Baseline for considering a match

    // Amount tolerance
    const amountDiffPercent = getAmountDifferencePercent(smsAmount, emailAmount);
    if (amountDiffPercent <= AMOUNT_TOLERANCE_PERCENT) {
      score += FUZZY_SCORE_AMOUNT;
    }

    // Date tolerance
    const dateDiffDays = getDateDifferenceDays(smsDate, emailDate);
    if (dateDiffDays <= DATE_TOLERANCE_DAYS) {
      score += FUZZY_SCORE_DATE;
    }

    // Vendor similarity
    const vendorSim = getVendorSimilarity(smsVendor, emailVendor);
    if (vendorSim >= 0.7) {
      score += FUZZY_SCORE_VENDOR;
    }

    return Math.min(score, 99); // Cap at 99 (reserve 100 for exact match)
  } catch (err) {
    console.warn("[SMS] Error calculating confidence score:", err);
    return 0;
  }
}

/**
 * Find best matching email item for an SMS item
 *
 * Evaluates all email items against SMS item, returns best match if
 * confidence >= threshold (90%).
 *
 * @param smsItem - SMS extracted transaction
 * @param emailItems - Array of email extracted transactions
 * @returns Best matching email item and confidence, or null
 */
function findBestMatch(
  smsItem: ExtractedItem,
  emailItems: ExtractedItem[],
): { emailItem: ExtractedItem; confidence: number } | null {
  let bestMatch: { emailItem: ExtractedItem; confidence: number } | null = null;
  let bestConfidence = CONFIDENCE_THRESHOLD - 1;

  for (const emailItem of emailItems) {
    const confidence = calculateConfidenceScore(smsItem, emailItem);

    if (confidence >= CONFIDENCE_THRESHOLD && confidence > bestConfidence) {
      bestMatch = { emailItem, confidence };
      bestConfidence = confidence;
    }
  }

  return bestMatch;
}

/**
 * Deduplicate a single SMS item against email items
 *
 * Core deduplication engine. Finds best matching email item for SMS,
 * returns result with confidence score. Does not persist to database.
 *
 * @param smsItem - SMS extracted transaction
 * @param emailItems - Array of email extracted transactions
 * @returns Deduplication result
 *
 * @example
 * const result = deduplicateSmsWithEmail(smsItem, [emailItem1, emailItem2]);
 * if (result.matched) {
 *   console.log(`Matched with ${result.confidence}% confidence`);
 * }
 */
export function deduplicateSmsWithEmail(smsItem: ExtractedItem, emailItems: ExtractedItem[]): DeduplicationResult {
  try {
    if (!smsItem) {
      return {
        matched: false,
        confidence: 0,
        smsItemId: "",
        reason: "no_match",
        details: "SMS item is null or undefined",
      };
    }

    if (!emailItems || emailItems.length === 0) {
      return {
        matched: false,
        confidence: 0,
        smsItemId: smsItem.id || "",
        reason: "no_match",
        details: "No email items to compare against",
      };
    }

    const bestMatch = findBestMatch(smsItem, emailItems);

    if (!bestMatch) {
      return {
        matched: false,
        confidence: 0,
        smsItemId: smsItem.id || "",
        reason: "no_match",
      };
    }

    return {
      matched: true,
      confidence: bestMatch.confidence,
      emailItemId: bestMatch.emailItem.id,
      smsItemId: smsItem.id || "",
      reason: bestMatch.confidence === CONFIDENCE_EXACT_MATCH ? "exact_match" : "fuzzy_match",
    };
  } catch (err) {
    console.error("[SMS] Error in deduplicateSmsWithEmail:", err);
    return {
      matched: false,
      confidence: 0,
      smsItemId: smsItem?.id || "",
      reason: "error",
      details: String(err),
    };
  }
}

/**
 * Find all potential duplicates between SMS and email items
 *
 * Evaluates each SMS item against all email items, returns all pairs
 * meeting confidence threshold sorted by confidence (highest first).
 *
 * @param smsItems - Array of SMS extracted transactions
 * @param emailItems - Array of email extracted transactions
 * @returns Array of potential duplicate pairs
 *
 * @example
 * const candidates = findPotentialDuplicates(smsItems, emailItems);
 * candidates.forEach(({ smsItem, emailItem, confidence }) => {
 *   console.log(`${confidence}% match: ${smsItem.vendor} vs ${emailItem.vendor}`);
 * });
 */
export function findPotentialDuplicates(
  smsItems: ExtractedItem[],
  emailItems: ExtractedItem[],
): PotentialDuplicate[] {
  try {
    const candidates: PotentialDuplicate[] = [];

    for (const smsItem of smsItems) {
      for (const emailItem of emailItems) {
        const confidence = calculateConfidenceScore(smsItem, emailItem);

        if (confidence >= CONFIDENCE_THRESHOLD) {
          candidates.push({
            smsItem,
            emailItem,
            confidence,
            reason: confidence === CONFIDENCE_EXACT_MATCH ? "exact_match" : `fuzzy_match_${Math.round(confidence)}%`,
          });
        }
      }
    }

    // Sort by confidence descending
    candidates.sort((a, b) => b.confidence - a.confidence);

    return candidates;
  } catch (err) {
    console.error("[SMS] Error finding potential duplicates:", err);
    return [];
  }
}

/**
 * Mark an SMS-email pair as deduped in the database
 *
 * Creates or updates deduplication record and marks both items as linked.
 * Sets marked_dedup_at timestamp to indicate user confirmation.
 *
 * @param smsItemId - SMS analysis item ID
 * @param emailItemId - Email inbox item ID
 * @param supabase - Supabase client
 * @param userId - User ID
 * @param notes - Optional user notes
 * @returns Created/updated dedup record ID
 * @throws Error if database operation fails
 *
 * @example
 * await markAsDeduped("sms_123", "email_456", supabase, userId);
 */
export async function markAsDeduped(
  smsItemId: string,
  emailItemId: string,
  supabase: SupabaseClient,
  userId: string,
  notes = "",
): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("ledger_transaction_deduplication")
      .insert([
        {
          user_id: userId,
          sms_item_id: smsItemId,
          email_item_id: emailItemId,
          marked_dedup_at: new Date().toISOString(),
          notes: notes || null,
          payload: { source: "user_confirmed" },
        },
      ])
      .select("id")
      .single();

    if (error) {
      throw new Error(`[SMS] Database insert failed: ${error.message}`);
    }

    const dedupId = data?.id as string;
    console.log("[SMS] Marked as deduped:", { smsItemId, emailItemId, dedupId });

    return dedupId;
  } catch (err) {
    console.error("[SMS] Mark dedup failed:", err);
    throw err;
  }
}

/**
 * Get deduplication status for user
 *
 * Returns summary of confirmed matches and pending review items.
 * Pending items are potential matches not yet confirmed by user.
 *
 * @param supabase - Supabase client
 * @param userId - User ID
 * @returns Deduplication status summary
 *
 * @example
 * const status = await getDeduplicationStatus(supabase, userId);
 * console.log(`${status.totalMatched} matches, ${status.totalPending} pending`);
 */
export async function getDeduplicationStatus(supabase: SupabaseClient, userId: string): Promise<DeduplicationStatus> {
  try {
    const [matchesData, smsData, emailData] = await Promise.all([
      // Fetch confirmed matches
      supabase
        .from("ledger_transaction_deduplication")
        .select("*")
        .eq("user_id", userId)
        .not("marked_dedup_at", "is", null),

      // Fetch SMS analysis items
      supabase
        .from("ledger_sms_analysis")
        .select("id, extracted_amount, extracted_vendor, extracted_currency, raw_response")
        .eq("user_id", userId),

      // Fetch email inbox items
      supabase
        .from("ledger_inbox")
        .select("id, amount, vendor, currency, extracted_data")
        .eq("user_id", userId)
        .eq("source_type", "email"),
    ]);

    // Count matches
    const totalMatched = matchesData.data?.length || 0;

    // Find pending duplicates
    const smsItems = (smsData.data || [])
      .map((row) => {
        const rawResponse = (row.raw_response as Record<string, unknown>) || {};
        return {
          id: row.id,
          amount: row.extracted_amount || 0,
          vendor: row.extracted_vendor || "",
          currency: row.extracted_currency || "INR",
          type: rawResponse.type || "expense",
          date: rawResponse.date || "",
          businessActivity: rawResponse.businessActivity || "",
          category: rawResponse.category || "",
          subCategory: rawResponse.subCategory || "",
          description: rawResponse.description || "",
          accountName: rawResponse.accountName || "",
          targetAccountName: rawResponse.targetAccountName || "",
        } as ExtractedItem;
      })
      .filter((item) => item.amount > 0);

    const emailItems = (emailData.data || [])
      .map((row) => {
        const extractedData = (row.extracted_data as Record<string, unknown>) || {};
        return {
          id: row.id,
          amount: row.amount || 0,
          vendor: row.vendor || "",
          currency: row.currency || "INR",
          type: extractedData.type || "expense",
          date: extractedData.date || "",
          businessActivity: extractedData.businessActivity || "",
          category: extractedData.category || "",
          subCategory: extractedData.subCategory || "",
          description: extractedData.description || "",
          accountName: extractedData.accountName || "",
          targetAccountName: extractedData.targetAccountName || "",
        } as ExtractedItem;
      })
      .filter((item) => item.amount > 0);

    // Find unmatched potential duplicates
    const matchedPairs = new Set(
      (matchesData.data || []).map((m) => `${m.sms_item_id}:${m.email_item_id}`),
    );

    const pendingReview = findPotentialDuplicates(
      smsItems,
      emailItems,
    ).filter((p) => !matchedPairs.has(`${p.smsItem.id}:${p.emailItem.id}`));

    return {
      totalMatched,
      totalPending: pendingReview.length,
      pendingReview,
    };
  } catch (err) {
    console.error("[SMS] Error fetching dedup status:", err);
    return {
      totalMatched: 0,
      totalPending: 0,
      pendingReview: [],
    };
  }
}

/**
 * Auto-deduplicate SMS items with existing email items (automatic)
 *
 * Called during SMS analysis enqueue. For each SMS item with high confidence
 * match (>=95%), automatically creates dedup record without user interaction.
 *
 * Lower confidence matches (90-95%) are surfaced as pending for user review.
 *
 * @param smsItems - Array of newly analyzed SMS items
 * @param supabase - Supabase client
 * @param userId - User ID
 * @returns Auto-deduped count
 */
export async function autoDeduplicateSmsWithEmail(
  smsItems: ExtractedItem[],
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  try {
    // Fetch existing email items
    const { data: emailData, error: emailError } = await supabase
      .from("ledger_inbox")
      .select("id, amount, vendor, currency, extracted_data")
      .eq("user_id", userId)
      .eq("source_type", "email");

    if (emailError) {
      console.warn("[SMS] Failed to fetch email items for auto-dedup:", emailError.message);
      return 0;
    }

    const emailItems = (emailData || [])
      .map((row) => {
        const extractedData = (row.extracted_data as Record<string, unknown>) || {};
        return {
          id: row.id,
          amount: row.amount || 0,
          vendor: row.vendor || "",
          currency: row.currency || "INR",
          type: extractedData.type || "expense",
          date: extractedData.date || "",
        } as ExtractedItem;
      })
      .filter((item) => item.amount > 0);

    let autoDeduped = 0;

    for (const smsItem of smsItems) {
      const bestMatch = findBestMatch(smsItem, emailItems);

      // Auto-deduplicate only if confidence is EXACT (100%) to avoid false positives
      // Lower confidence matches (90-99%) are surfaced as pending for user review
      if (bestMatch && bestMatch.confidence === CONFIDENCE_EXACT_MATCH) {
        try {
          await markAsDeduped(smsItem.id || "", bestMatch.emailItem.id || "", supabase, userId, "auto_dedup_exact");
          autoDeduped += 1;
        } catch (err) {
          console.warn("[SMS] Auto-dedup mark failed:", { smsId: smsItem.id, error: String(err) });
        }
      }
    }

    console.log("[SMS] Auto-dedup complete:", { total: smsItems.length, autoDeduped, threshold: "exact_only" });
    return autoDeduped;
  } catch (err) {
    console.error("[SMS] Error in auto-deduplication:", err);
    return 0;
  }
}
