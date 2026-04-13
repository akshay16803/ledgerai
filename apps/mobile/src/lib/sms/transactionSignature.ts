/**
 * Transaction Signature Module
 *
 * Generates deterministic signatures for transactions to enable deduplication
 * across email and SMS sources.
 *
 * Signature format: amount|date|vendor hashed with FNV-1a algorithm
 * Same inputs always produce same output (deterministic across runtimes)
 *
 * @module transactionSignature
 */

/**
 * FNV-1a hash function for deterministic string hashing
 *
 * Generates consistent, deterministic hashes across JavaScript runtimes.
 * Used for transaction signature generation.
 *
 * @param str - String to hash
 * @returns Hash as base-36 string
 *
 * @internal
 */
function quickHash(str = ""): string {
  let hash = 2166136261;
  for (let index = 0; index < str.length; index += 1) {
    hash ^= str.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Builds a deterministic transaction signature for deduplication
 *
 * Combines normalized amount, date, and vendor name to create a unique
 * transaction fingerprint. Same transaction data always produces same signature.
 *
 * Used to match transactions across SMS and email sources.
 *
 * NOTE: This signature is used for EXACT matching only. For fuzzy matching with
 * tolerance for rounding/date offsets, use calculateConfidenceScore() instead.
 * Collision risk is mitigated by confidence-based fuzzy matching.
 *
 * @param amount - Normalized amount (should be 2 decimal places)
 * @param date - ISO date (YYYY-MM-DD format)
 * @param vendor - Normalized vendor name (lowercase, no special chars)
 * @returns Deterministic hash signature
 *
 * @example
 * const sig1 = buildTransactionSignature(2500, "2026-03-31", "amazon");
 * const sig2 = buildTransactionSignature(2500, "2026-03-31", "amazon");
 * sig1 === sig2; // true (deterministic)
 *
 * @example
 * // Different vendors produce different signatures
 * const sig1 = buildTransactionSignature(2500, "2026-03-31", "amazon");
 * const sig2 = buildTransactionSignature(2500, "2026-03-31", "flipkart");
 * sig1 !== sig2; // true
 */
export function buildTransactionSignature(amount: number, date: string, vendor: string): string {
  try {
    // Normalize amount to 2 decimal places
    const normalizedAmount = Math.round(amount * 100) / 100;

    // Validate inputs to prevent signature collisions
    if (!Number.isFinite(normalizedAmount) || !date || !vendor) {
      console.warn("[SMS] Invalid signature inputs - returning empty hash", {
        amount: normalizedAmount,
        date,
        vendor,
      });
      return "";
    }

    // Build signature string: amount|date|vendor
    const signatureBase = `${normalizedAmount.toFixed(2)}|${date}|${vendor}`;

    // Hash with FNV-1a algorithm
    const signature = quickHash(signatureBase);

    return signature;
  } catch (err) {
    console.error("[SMS] Error building transaction signature:", err);
    return "";
  }
}

/**
 * Compares two transaction signatures for equality
 *
 * Performs exact string comparison. For fuzzy matching (with tolerance for
 * rounding or date offsets), use deduplication matching logic elsewhere.
 *
 * @param sig1 - First transaction signature
 * @param sig2 - Second transaction signature
 * @returns true if signatures match exactly, false otherwise
 *
 * @example
 * const sig1 = buildTransactionSignature(2500, "2026-03-31", "amazon");
 * const sig2 = buildTransactionSignature(2500, "2026-03-31", "amazon");
 * compareTransactionSignatures(sig1, sig2); // true
 *
 * @example
 * const sig1 = buildTransactionSignature(2500, "2026-03-31", "amazon");
 * const sig2 = buildTransactionSignature(2500.01, "2026-03-31", "amazon");
 * compareTransactionSignatures(sig1, sig2); // false (different amount)
 */
export function compareTransactionSignatures(sig1: string, sig2: string): boolean {
  try {
    return sig1 === sig2;
  } catch (err) {
    console.error("[SMS] Error comparing transaction signatures:", err);
    return false;
  }
}
