/**
 * Unit tests for transaction signature generation and comparison
 * Covers: FNV-1a hashing, deterministic signature generation, comparison
 */

import { describe, test, expect } from "vitest";
import {
  buildTransactionSignature,
  compareTransactionSignatures,
} from "./transactionSignature";

describe("Transaction Signature Module", () => {
  describe("buildTransactionSignature", () => {
    test("generates consistent signature for same inputs", () => {
      const sig1 = buildTransactionSignature(2500, "2026-03-31", "amazon");
      const sig2 = buildTransactionSignature(2500, "2026-03-31", "amazon");
      expect(sig1).toBe(sig2);
    });

    test("generates different signature for different vendor", () => {
      const sig1 = buildTransactionSignature(2500, "2026-03-31", "amazon");
      const sig2 = buildTransactionSignature(2500, "2026-03-31", "flipkart");
      expect(sig1).not.toBe(sig2);
    });

    test("generates different signature for different amount", () => {
      const sig1 = buildTransactionSignature(2500, "2026-03-31", "amazon");
      const sig2 = buildTransactionSignature(2500.01, "2026-03-31", "amazon");
      expect(sig1).not.toBe(sig2);
    });

    test("generates different signature for different date", () => {
      const sig1 = buildTransactionSignature(2500, "2026-03-31", "amazon");
      const sig2 = buildTransactionSignature(2500, "2026-04-01", "amazon");
      expect(sig1).not.toBe(sig2);
    });

    test("normalizes amount to 2 decimal places", () => {
      const sig1 = buildTransactionSignature(100.1, "2026-03-31", "vendor");
      const sig2 = buildTransactionSignature(100.10, "2026-03-31", "vendor");
      expect(sig1).toBe(sig2);
    });

    test("returns non-empty hash string", () => {
      const sig = buildTransactionSignature(2500, "2026-03-31", "amazon");
      expect(sig).toBeTruthy();
      expect(typeof sig).toBe("string");
      expect(sig.length).toBeGreaterThan(0);
    });

    test("handles zero amount", () => {
      const sig = buildTransactionSignature(0, "2026-03-31", "amazon");
      expect(sig).toBeTruthy();
      expect(sig.length).toBeGreaterThan(0);
    });

    test("handles negative amount", () => {
      const sig1 = buildTransactionSignature(-100, "2026-03-31", "vendor");
      const sig2 = buildTransactionSignature(-100, "2026-03-31", "vendor");
      expect(sig1).toBe(sig2);
    });

    test("handles very large amounts", () => {
      const sig = buildTransactionSignature(999999999.99, "2026-03-31", "vendor");
      expect(sig).toBeTruthy();
    });

    test("handles decimal rounding consistently", () => {
      // 100.005 should round to 100.01
      const sig1 = buildTransactionSignature(100.005, "2026-03-31", "vendor");
      const sig2 = buildTransactionSignature(100.01, "2026-03-31", "vendor");
      expect(sig1).toBe(sig2);
    });

    test("handles empty vendor name", () => {
      const sig = buildTransactionSignature(100, "2026-03-31", "");
      expect(sig).toBeTruthy();
    });

    test("is case-sensitive for vendor name", () => {
      const sig1 = buildTransactionSignature(100, "2026-03-31", "Amazon");
      const sig2 = buildTransactionSignature(100, "2026-03-31", "amazon");
      // These should be different because vendor is case-sensitive
      expect(sig1).not.toBe(sig2);
    });
  });

  describe("compareTransactionSignatures", () => {
    test("returns true for identical signatures", () => {
      const sig1 = buildTransactionSignature(2500, "2026-03-31", "amazon");
      const sig2 = buildTransactionSignature(2500, "2026-03-31", "amazon");
      expect(compareTransactionSignatures(sig1, sig2)).toBe(true);
    });

    test("returns false for different signatures", () => {
      const sig1 = buildTransactionSignature(2500, "2026-03-31", "amazon");
      const sig2 = buildTransactionSignature(2500, "2026-03-31", "flipkart");
      expect(compareTransactionSignatures(sig1, sig2)).toBe(false);
    });

    test("handles empty string comparison", () => {
      expect(compareTransactionSignatures("", "")).toBe(true);
    });

    test("returns false when comparing empty with non-empty", () => {
      const sig = buildTransactionSignature(100, "2026-03-31", "vendor");
      expect(compareTransactionSignatures("", sig)).toBe(false);
      expect(compareTransactionSignatures(sig, "")).toBe(false);
    });

    test("performs exact string comparison", () => {
      const sig1 = buildTransactionSignature(100, "2026-03-31", "vendor");
      const sig2 = buildTransactionSignature(100, "2026-03-31", "vendor");
      const sig3 = buildTransactionSignature(100.01, "2026-03-31", "vendor");

      expect(compareTransactionSignatures(sig1, sig2)).toBe(true);
      expect(compareTransactionSignatures(sig1, sig3)).toBe(false);
    });

    test("is case-sensitive for signature comparison", () => {
      const sig1 = "ABC123";
      const sig2 = "abc123";
      expect(compareTransactionSignatures(sig1, sig2)).toBe(false);
    });
  });

  describe("Hash Determinism", () => {
    test("multiple runs produce identical hashes for same inputs", () => {
      const inputs = [
        { amount: 100, date: "2026-01-15", vendor: "starbucks" },
        { amount: 5000.99, date: "2026-12-31", vendor: "amazon" },
        { amount: 0.01, date: "2000-01-01", vendor: "test" },
      ];

      inputs.forEach(({ amount, date, vendor }) => {
        const hashes = [
          buildTransactionSignature(amount, date, vendor),
          buildTransactionSignature(amount, date, vendor),
          buildTransactionSignature(amount, date, vendor),
        ];
        expect(hashes[0]).toBe(hashes[1]);
        expect(hashes[1]).toBe(hashes[2]);
      });
    });

    test("hash changes with any input parameter", () => {
      const baseAmount = 100;
      const baseDate = "2026-03-31";
      const baseVendor = "vendor";

      const baseHash = buildTransactionSignature(baseAmount, baseDate, baseVendor);

      // Different amount
      const diffAmount = buildTransactionSignature(101, baseDate, baseVendor);
      expect(diffAmount).not.toBe(baseHash);

      // Different date
      const diffDate = buildTransactionSignature(baseAmount, "2026-03-30", baseVendor);
      expect(diffDate).not.toBe(baseHash);

      // Different vendor
      const diffVendor = buildTransactionSignature(baseAmount, baseDate, "other");
      expect(diffVendor).not.toBe(baseHash);
    });
  });
});
