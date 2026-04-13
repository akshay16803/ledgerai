import { useCallback, useEffect, useMemo, useState } from "react";
import { createLedgerRepository } from "@lib/repositories/createLedgerRepository";

/**
 * Tab badge state type
 * Tracks badge information for bottom navigation tabs
 */
export type TabBadges = {
  /** Number of unreviewed inbox items (pending count) */
  inboxCount: number;
  /** Email synchronization status: idle, pending, error, or null */
  emailSyncStatus: "idle" | "pending" | "error" | null;
};

/**
 * Hook to manage tab badge state
 * Fetches and tracks pending inbox count for badge display on the Inbox tab
 *
 * @returns TabBadges object with inboxCount and emailSyncStatus
 *
 * @example
 * ```tsx
 * const { inboxCount } = useTabBadges();
 * // Use inboxCount for badge display on Inbox tab
 * ```
 */
export function useTabBadges(): TabBadges {
  const repo = useMemo(() => createLedgerRepository(), []);
  const [inboxCount, setInboxCount] = useState<number>(0);
  const [emailSyncStatus] = useState<"idle" | "pending" | "error" | null>(null);

  const loadInboxCount = useCallback(async () => {
    try {
      const items = await repo.listInboxItems();
      // Filter for unreviewed items (pending)
      const pendingItems = items.filter((item) => item.reviewStatus !== "reviewed");
      const count = pendingItems.length;
      setInboxCount(count);
      console.debug(`[Navigation] Inbox count updated: ${count} pending items`);
    } catch (err) {
      console.error("[Navigation] Failed to load inbox count:", err);
      // On error, reset to 0 to avoid showing stale badge
      setInboxCount(0);
    }
  }, [repo]);

  useEffect(() => {
    // Load inbox count on mount and when repo changes
    loadInboxCount();

    // Note: Subscription-based updates would be implemented here if the
    // repository supported inbox change subscriptions in the future.
    // For now, we rely on screen focus to trigger refreshes.
  }, [loadInboxCount]);

  return {
    inboxCount,
    emailSyncStatus,
  };
}
