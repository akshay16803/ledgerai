/**
 * Unit tests for SMS processing and normalization
 * Covers: normalization of amounts, dates, vendors, and transaction type inference
 */

import { describe, test, expect } from "vitest";
import {
  normalizeSmsAmount,
  normalizeSmsDate,
  normalizeSmsVendor,
  parseSmsForTransaction,
} from "./smsProcessing";

describe("SMS Processing Module", () => {
  describe("normalizeSmsAmount", () => {
    test("normalizes Indian rupee amount with comma separator", () => {
      expect(normalizeSmsAmount("₹1,234.50")).toBe(1234.50);
    });

    test("handles Rs. notation", () => {
      expect(normalizeSmsAmount("Rs. 2500")).toBe(2500.0);
    });

    test("handles raw numbers", () => {
      expect(normalizeSmsAmount("5000")).toBe(5000.0);
    });

    test("rounds to 2 decimal places", () => {
      expect(normalizeSmsAmount("₹100.999")).toBe(101.0);
    });

    test("returns 0 for invalid input", () => {
      expect(normalizeSmsAmount("invalid")).toBe(0);
      expect(normalizeSmsAmount("")).toBe(0);
    });

    test("handles numeric input", () => {
      expect(normalizeSmsAmount(1234.567)).toBe(1234.57);
    });

    test("handles multiple currency symbols", () => {
      expect(normalizeSmsAmount("USD 100")).toBe(100.0);
      expect(normalizeSmsAmount("€50")).toBe(50.0);
    });

    test("handles amounts without decimal places", () => {
      expect(normalizeSmsAmount("1000")).toBe(1000.0);
    });

    test("removes currency codes like INR, USD, GBP", () => {
      expect(normalizeSmsAmount("INR 1234")).toBe(1234.0);
      expect(normalizeSmsAmount("500 USD")).toBe(500.0);
      expect(normalizeSmsAmount("GBP 100")).toBe(100.0);
    });

    test("handles amounts with spaces as thousand separators", () => {
      expect(normalizeSmsAmount("1 234 567.89")).toBe(1234567.89);
    });
  });

  describe("normalizeSmsDate", () => {
    test("parses DD-MMM-YYYY format", () => {
      expect(normalizeSmsDate("31-Mar-2026")).toBe("2026-03-31");
    });

    test("parses DD/MM/YYYY format", () => {
      expect(normalizeSmsDate("31/03/2026")).toBe("2026-03-31");
    });

    test("handles 2-digit year", () => {
      expect(normalizeSmsDate("31-Mar-26")).toBe("2026-03-31");
    });

    test("falls back to timestamp parameter", () => {
      const result = normalizeSmsDate("invalid", "2026-03-31T10:00:00Z");
      expect(result).toBe("2026-03-31");
    });

    test("falls back to today on invalid input", () => {
      const today = new Date().toISOString().slice(0, 10);
      expect(normalizeSmsDate("")).toBe(today);
    });

    test("handles ISO timestamp fallback", () => {
      const result = normalizeSmsDate("invalid", "2026-03-15T00:00:00Z");
      expect(result).toBe("2026-03-15");
    });

    test("parses dot-separated dates DD.MM.YYYY", () => {
      expect(normalizeSmsDate("31.03.2026")).toBe("2026-03-31");
    });

    test("handles month name variations", () => {
      expect(normalizeSmsDate("15-Jan-2026")).toBe("2026-01-15");
      expect(normalizeSmsDate("01-Dec-2025")).toBe("2025-12-01");
    });
  });

  describe("normalizeSmsVendor", () => {
    test("lowercases and trims vendor name", () => {
      expect(normalizeSmsVendor("  AMAZON  ")).toBe("amazon");
    });

    test("removes business suffixes", () => {
      expect(normalizeSmsVendor("Amazon Technologies Ltd.")).toBe("amazon technologies");
      expect(normalizeSmsVendor("HDFC Bank Ltd")).toBe("hdfc");
    });

    test("replaces underscores and hyphens with spaces", () => {
      expect(normalizeSmsVendor("HDFC_BANK")).toBe("hdfc bank");
      expect(normalizeSmsVendor("Paytm-Service")).toBe("paytm service");
    });

    test("removes special characters", () => {
      expect(normalizeSmsVendor("Paytm.Service@Ltd")).toBe("paytm service");
    });

    test("collapses multiple spaces", () => {
      expect(normalizeSmsVendor("Amazon   Technologies")).toBe("amazon technologies");
    });

    test("returns empty string for empty input", () => {
      expect(normalizeSmsVendor("")).toBe("");
    });

    test("removes pvt and limited suffixes", () => {
      expect(normalizeSmsVendor("Flipkart Pvt Ltd")).toBe("flipkart");
    });

    test("removes service/services suffix", () => {
      expect(normalizeSmsVendor("Google Services Inc")).toBe("google");
    });

    test("handles multiple special characters", () => {
      expect(normalizeSmsVendor("Paytm...Service---Inc")).toBe("paytm service");
    });
  });

  describe("parseSmsForTransaction", () => {
    test("extracts all transaction details from SMS", () => {
      const result = parseSmsForTransaction(
        "Payment received from Amazon ₹2500 on 31-Mar-2026"
      );
      expect(result.amount).toBe(2500);
      expect(result.vendor).toBe("amazon");
      expect(result.date).toBe("2026-03-31");
      expect(result.type).toBe("expense");
    });

    test("infers expense type from keywords", () => {
      const result = parseSmsForTransaction("Payment to HDFC ₹1000");
      expect(result.type).toBe("expense");
    });

    test("infers income type from keywords", () => {
      const result = parseSmsForTransaction("Amount credited to your account ₹5000");
      expect(result.type).toBe("income");
    });

    test("infers income from credit keyword", () => {
      const result = parseSmsForTransaction("Credit of ₹10000 received");
      expect(result.type).toBe("income");
    });

    test("infers income from refund keyword", () => {
      const result = parseSmsForTransaction("Refund approved: ₹500");
      expect(result.type).toBe("income");
    });

    test("infers transfer type from keywords", () => {
      const result = parseSmsForTransaction("You sent ₹500 to Alice on UPI");
      expect(result.type).toBe("transfer");
    });

    test("handles empty SMS gracefully", () => {
      const result = parseSmsForTransaction("");
      expect(result.amount).toBe(0);
      expect(result.vendor).toBe("");
      expect(result.type).toBe("expense");
    });

    test("returns raw values in debug context", () => {
      const result = parseSmsForTransaction("Payment ₹1000 on 31-Mar");
      expect(result.raw.amount).toBeDefined();
      expect(result.raw.date).toBeDefined();
      expect(result.raw.vendor).toBeDefined();
    });

    test("handles SMS without date", () => {
      const result = parseSmsForTransaction("Amazon charge ₹500");
      expect(result.amount).toBe(500);
      expect(result.vendor).toBe("amazon");
      expect(result.date).toBeTruthy();
    });

    test("extracts vendor from 'from X' pattern", () => {
      const result = parseSmsForTransaction("₹1000 from Flipkart Ltd on 01-Apr-2026");
      expect(result.vendor).toContain("flipkart");
    });

    test("extracts amount with rupee symbol", () => {
      const result = parseSmsForTransaction("₹5,00,000 transaction confirmed");
      expect(result.amount).toBe(500000);
    });

    test("handles bank-specific format", () => {
      const result = parseSmsForTransaction(
        "ICICI Bank: Your account has been credited with ₹25000 on 31-Mar-2026"
      );
      expect(result.type).toBe("income");
      expect(result.amount).toBe(25000);
    });
  });
});
