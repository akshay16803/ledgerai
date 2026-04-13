import * as SecureStore from "expo-secure-store";
import type { LedgerRepository, PollingConfig } from "@lib/repositories/types";
import { getLastSyncTime, recordSyncTime, getChangesSinceLast, mergeDelta } from "./deltaSync";

const POLLING_CONFIG_KEY = "polling_config";
const DEFAULT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

let pollingInterval: ReturnType<typeof setInterval> | null = null;
let isPolling = false;
let currentIntervalMs = DEFAULT_INTERVAL_MS;

/**
 * Start background polling for sync
 *
 * IMPORTANT: Calling this multiple times will stop any existing polling and start new polling.
 * The returned unsubscribe function is the preferred way to stop polling.
 *
 * @param repo - Ledger repository instance
 * @param intervalMs - Polling interval in milliseconds (default: 30 minutes)
 * @returns Function to stop polling
 */
export function startBackgroundPolling(
  repo: LedgerRepository,
  intervalMs: number = DEFAULT_INTERVAL_MS
): () => void {
  // If polling is already running with same interval, reuse it
  if (isPolling && pollingInterval && currentIntervalMs === intervalMs) {
    console.log("[SYNC] Background polling already running with same interval");
    return () => {
      stopBackgroundPolling();
    };
  }

  // If polling is running with different interval, stop and restart
  if (isPolling && pollingInterval) {
    console.log("[SYNC] Stopping existing polling to restart with new interval");
    stopBackgroundPolling();
  }

  console.log(`[SYNC] Starting background polling with interval ${intervalMs}ms`);

  isPolling = true;
  currentIntervalMs = intervalMs;

  // Perform first sync immediately
  performBackgroundSync(repo).catch((err) => {
    console.warn("[SYNC] Initial background sync failed:", err);
  });

  // Schedule recurring polls
  pollingInterval = setInterval(() => {
    performBackgroundSync(repo).catch((err) => {
      console.warn("[SYNC] Background poll error:", err);
    });
  }, intervalMs);

  return () => {
    stopBackgroundPolling();
  };
}

/**
 * Stop background polling
 */
export function stopBackgroundPolling(): void {
  if (pollingInterval) {
    console.log("[SYNC] Stopping background polling");
    clearInterval(pollingInterval);
    pollingInterval = null;
    isPolling = false;
  }
}

/**
 * Perform a single background sync
 */
export async function performBackgroundSync(
  repo: LedgerRepository
): Promise<{
  changeCount: number;
  conflictCount: number;
  syncedAt: string;
  error?: string;
}> {
  try {
    console.log("[SYNC] Performing background sync");

    const lastSyncTime = await getLastSyncTime(repo);

    // Fetch changes since last sync
    const delta = await getChangesSinceLast(repo, lastSyncTime);

    const changeCount =
      delta.transactions.length +
      delta.inboxItems.length +
      delta.accounts.length +
      delta.deletedTransactionIds.length +
      delta.deletedAccountIds.length +
      delta.deletedInboxItemIds.length;

    console.log(`[SYNC] Background sync found ${changeCount} changes`);

    // Update sync timestamp
    await recordSyncTime(repo, delta.syncedAt);

    const result = {
      changeCount,
      conflictCount: 0, // Would need to track conflicts separately
      syncedAt: delta.syncedAt,
    };

    console.log("[SYNC] Background sync completed:", result);

    return result;
  } catch (err) {
    const errorMsg = String((err as Error)?.message || "Unknown error");
    console.warn("[SYNC] Background sync failed:", err);

    return {
      changeCount: 0,
      conflictCount: 0,
      syncedAt: new Date().toISOString(),
      error: errorMsg,
    };
  }
}

/**
 * Get current polling configuration
 */
export async function getPollingConfig(repo: LedgerRepository): Promise<PollingConfig> {
  try {
    const json = await SecureStore.getItemAsync(POLLING_CONFIG_KEY);

    if (json) {
      const config = JSON.parse(json);
      return config as PollingConfig;
    }

    const defaultConfig: PollingConfig = {
      intervalMs: DEFAULT_INTERVAL_MS,
      enabled: true,
    };

    return defaultConfig;
  } catch (err) {
    console.warn("[SYNC] Error reading polling config:", err);
    return {
      intervalMs: DEFAULT_INTERVAL_MS,
      enabled: true,
    };
  }
}

/**
 * Update polling configuration
 */
export async function updatePollingConfig(
  repo: LedgerRepository,
  config: Partial<PollingConfig>
): Promise<void> {
  try {
    const current = await getPollingConfig(repo);
    const updated: PollingConfig = {
      ...current,
      ...config,
    };

    const json = JSON.stringify(updated);
    await SecureStore.setItemAsync(POLLING_CONFIG_KEY, json);

    console.log("[SYNC] Updated polling config:", updated);
  } catch (err) {
    console.warn("[SYNC] Error updating polling config:", err);
  }
}
