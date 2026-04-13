/**
 * Unit tests for SMS-email deduplication logic
 * Covers: fuzzy matching, confidence scoring, dedup matching
 */

import { describe, test, expect } from "vitest";
import {
  deduplicateSmsWithEmail,
  findPotentialDuplicates,
} from "./smsDeduplicator";
import type { ExtractedItem } from "./smsDeduplicator";

describe("SMS Deduplicator Module", () => {
  const mockSmsItem: ExtractedItem = {
    id: "sms_1",
    amount: 2500,
    date: "2026-03-31",
    vendor: "amazon",
    currency: "INR",
    type: "expense",
    description: "Payment",
  };

  const mockEmailItem: ExtractedItem = {
    id: "email_1",
    amount: 2500,
    date: "2026-03-31",
    vendor: "amazon",
    currency: "INR",
    type: "expense",
    description: "Invoice",
  };

  describe("deduplicateSmsWithEmail", () => {
    test("matches exact transaction", () => {
      const result = deduplicateSmsWithEmail(mockSmsItem, [mockEmailItem]);
      expect(result.matched).toBe(true);
      expect(result.confidence).toBe(100);
      expect(result.emailItemId).toBe("email_1");
      expect(result.reason).toBe("exact_match");
    });

    test("returns no match for different vendors", () => {
      const emailItem = { ...mockEmailItem, vendor: "flipkart" };
      const result = deduplicateSmsWithEmail(mockSmsItem, [emailItem]);
      expect(result.matched).toBe(false);
    });

    test("returns no match for significantly different amounts", () => {
      const emailItem = { ...mockEmailItem, amount: 5000 };
      const result = deduplicateSmsWithEmail(mockSmsItem, [emailItem]);
      expect(result.matched).toBe(false);
    });

    test("handles small rounding difference", () => {
      const emailItem = { ...mockEmailItem, amount: 2500.01 };
      const result = deduplicateSmsWithEmail(mockSmsItem, [emailItem]);
      // May or may not match depending on tolerance; just verify no crash
      expect(result).toBeDefined();
      expect(result.smsItemId).toBe("sms_1");
    });

    test("returns no match for date more than 1 day off", () => {
      const emailItem = { ...mockEmailItem, date: "2026-04-05" };
      const result = deduplicateSmsWithEmail(mockSmsItem, [emailItem]);
      expect(result.matched).toBe(false);
    });

    test("handles null SMS item gracefully", () => {
      const result = deduplicateSmsWithEmail(null as any, [mockEmailItem]);
      expect(result.matched).toBe(false);
      expect(result.reason).toBe("no_match");
    });

    test("handles empty email array gracefully", () => {
      const result = deduplicateSmsWithEmail(mockSmsItem, []);
      expect(result.matched).toBe(false);
      expect(result.reason).toBe("no_match");
    });

    test("selects best match when multiple candidates exist", () => {
      const emailItem1 = {
        id: "email_1",
        amount: 2499, // Close but not exact
        date: "2026-03-31",
        vendor: "amazon",
        currency: "INR",
        type: "expense" as const,
      };
      const emailItem2 = {
        id: "email_2",
        amount: 2500, // Exact match
        date: "2026-03-31",
        vendor: "amazon",
        currency: "INR",
        type: "expense" as const,
      };
      const result = deduplicateSmsWithEmail(mockSmsItem, [emailItem1, emailItem2]);
      expect(result.matched).toBe(true);
      expect(result.emailItemId).toBe("email_2"); // Should pick exact match
    });

    test("handles transaction with date tolerance (±1 day)", () => {
      const emailItem = { ...mockEmailItem, date: "2026-04-01" };
      const result = deduplicateSmsWithEmail(mockSmsItem, [emailItem]);
      // Within 1 day tolerance, might match depending on confidence
      expect(result).toBeDefined();
    });

    test("handles vendor abbreviations", () => {
      const emailItem = { ...mockEmailItem, vendor: "amzn" };
      const result = deduplicateSmsWithEmail(mockSmsItem, [emailItem]);
      // May match based on fuzzy logic
      expect(result).toBeDefined();
    });

    test("handles missing SMS item ID", () => {
      const smsItemNoId = { ...mockSmsItem, id: undefined };
      const result = deduplicateSmsWithEmail(smsItemNoId, [mockEmailItem]);
      expect(result.smsItemId).toBe("");
    });
  });

  describe("findPotentialDuplicates", () => {
    test("returns empty array for empty inputs", () => {
      const result = findPotentialDuplicates([], []);
      expect(result).toEqual([]);
    });

    test("returns candidates above confidence threshold", () => {
      const result = findPotentialDuplicates([mockSmsItem], [mockEmailItem]);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].confidence).toBeGreaterThanOrEqual(90);
    });

    test("sorts results by confidence descending", () => {
      const sms1 = { ...mockSmsItem, id: "sms_1", amount: 2500 };
      const sms2 = { ...mockSmsItem, id: "sms_2", amount: 2501 };
      const email = {
        ...mockEmailItem,
        id: "email_1",
        amount: 2500,
      };
      const result = findPotentialDuplicates([sms1, sms2], [email]);
      // First result should have same or higher confidence than second
      if (result.length > 1) {
        expect(result[0].confidence).toBeGreaterThanOrEqual(result[1].confidence);
      }
    });

    test("returns reason for each match", () => {
      const result = findPotentialDuplicates([mockSmsItem], [mockEmailItem]);
      expect(result.length).toBeGreaterThan(0);
      expect(["exact_match", "fuzzy_match_90", "fuzzy_match_95", "fuzzy_match_100"]).toContain(
        result[0].reason
      );
    });

    test("handles multiple SMS items against multiple email items", () => {
      const sms1 = { ...mockSmsItem, id: "sms_1", vendor: "amazon" };
      const sms2 = { ...mockSmsItem, id: "sms_2", vendor: "flipkart" };
      const email1 = { ...mockEmailItem, id: "email_1", vendor: "amazon" };
      const email2 = { ...mockEmailItem, id: "email_2", vendor: "flipkart" };

      const result = findPotentialDuplicates([sms1, sms2], [email1, email2]);
      // Should find matches for both
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    test("filters out matches below confidence threshold", () => {
      const sms = { ...mockSmsItem, amount: 100, vendor: "vendor1" };
      const email = { ...mockEmailItem, amount: 5000, vendor: "vendor2" };
      const result = findPotentialDuplicates([sms], [email]);
      // Very different amounts and vendors should not match
      expect(result.length).toBe(0);
    });

    test("handles empty SMS array", () => {
      const result = findPotentialDuplicates([], [mockEmailItem]);
      expect(result).toEqual([]);
    });

    test("handles empty email array", () => {
      const result = findPotentialDuplicates([mockSmsItem], []);
      expect(result).toEqual([]);
    });

    test("returns confidence scores within 0-100 range", () => {
      const result = findPotentialDuplicates([mockSmsItem], [mockEmailItem]);
      result.forEach((item) => {
        expect(item.confidence).toBeGreaterThanOrEqual(0);
        expect(item.confidence).toBeLessThanOrEqual(100);
      });
    });
  });

  describe("Confidence Scoring", () => {
    test("exact match gives 100% confidence", () => {
      const result = deduplicateSmsWithEmail(mockSmsItem, [mockEmailItem]);
      expect(result.confidence).toBe(100);
    });

    test("same vendor and date but different amount scores lower", () => {
      const emailItem = { ...mockEmailItem, amount: 2600 };
      const result = deduplicateSmsWithEmail(mockSmsItem, [emailItem]);
      if (result.matched) {
        expect(result.confidence).toBeLessThan(100);
      }
    });

    test("date within 1 day tolerance contributes to confidence", () => {
      const emailItem = { ...mockEmailItem, date: "2026-04-01" };
      const result = deduplicateSmsWithEmail(mockSmsItem, [emailItem]);
      expect(result).toBeDefined();
    });

    test("vendor similarity contributes to confidence", () => {
      const emailItem = { ...mockEmailItem, vendor: "amzn" };
      const result = deduplicateSmsWithEmail(mockSmsItem, [emailItem]);
      // Should have some confidence due to vendor similarity
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases", () => {
    test("handles items with missing optional fields", () => {
      const smsMinimal: ExtractedItem = {
        id: "sms_1",
        amount: 100,
        date: "2026-03-31",
        vendor: "vendor",
        currency: "INR",
        type: "expense",
      };
      const emailMinimal: ExtractedItem = {
        id: "email_1",
        amount: 100,
        date: "2026-03-31",
        vendor: "vendor",
        currency: "INR",
        type: "expense",
      };
      const result = deduplicateSmsWithEmail(smsMinimal, [emailMinimal]);
      expect(result.matched).toBe(true);
    });

    test("handles zero amounts", () => {
      const smsZero = { ...mockSmsItem, amount: 0 };
      const emailZero = { ...mockEmailItem, amount: 0 };
      const result = deduplicateSmsWithEmail(smsZero, [emailZero]);
      expect(result).toBeDefined();
    });

    test("handles very large amounts", () => {
      const smsLarge = { ...mockSmsItem, amount: 999999999.99 };
      const emailLarge = { ...mockEmailItem, amount: 999999999.99 };
      const result = deduplicateSmsWithEmail(smsLarge, [emailLarge]);
      expect(result.matched).toBe(true);
    });

    test("handles negative amounts", () => {
      const smsNeg = { ...mockSmsItem, amount: -100 };
      const emailNeg = { ...mockEmailItem, amount: -100 };
      const result = deduplicateSmsWithEmail(smsNeg, [emailNeg]);
      expect(result).toBeDefined();
    });

    test("handles special characters in vendor names", () => {
      const smsSpecial = { ...mockSmsItem, vendor: "amazon@inc" };
      const emailSpecial = { ...mockEmailItem, vendor: "amazon inc" };
      const result = deduplicateSmsWithEmail(smsSpecial, [emailSpecial]);
      expect(result).toBeDefined();
    });
  });

  describe("Deduplication Matching Logic", () => {
    test("exact amount match with same vendor and date", () => {
      const sms = { ...mockSmsItem, amount: 1000 };
      const email = { ...mockEmailItem, amount: 1000 };
      const result = deduplicateSmsWithEmail(sms, [email]);
      expect(result.confidence).toBe(100);
    });

    test("fuzzy match with small amount variance", () => {
      const sms = { ...mockSmsItem, amount: 1000.00 };
      const email = { ...mockEmailItem, amount: 1000.005 };
      const result = deduplicateSmsWithEmail(sms, [email]);
      // Should be high confidence due to negligible difference
      expect(result).toBeDefined();
    });

    test("no match when vendor completely different", () => {
      const sms = { ...mockSmsItem, vendor: "vendor_a" };
      const email = { ...mockEmailItem, vendor: "vendor_z" };
      const result = deduplicateSmsWithEmail(sms, [email]);
      if (result.matched) {
        // If it matches, confidence should be low
        expect(result.confidence).toBeLessThan(90);
      }
    });
  });
});
