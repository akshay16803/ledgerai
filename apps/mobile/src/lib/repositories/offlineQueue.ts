import * as SecureStore from "expo-secure-store";
import type {
  LedgerRepository,
  LedgerTransaction,
  LedgerTransactionDraft,
  PendingTransaction,
} from "@lib/repositories/types";

const OFFLINE_QUEUE_KEY = "pending_transactions";
const MAX_RETRIES = 3;

/**
 * Generate a simple UUID v4-like ID
 */
function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Parse pending transaction from stored data
 */
function parsePendingTransaction(data: unknown): PendingTransaction | null {
  try {
    const tx = data as any;
    if (tx?.id && tx?.action && tx?.data && tx?.createdAt) {
      return {
        id: tx.id,
        action: tx.action,
        data: tx.data,
        createdAt: tx.createdAt,
        retryCount: tx.retryCount || 0,
        lastError: tx.lastError,
      };
    }
  } catch (e) { // Storage read fallback
  }
  return null;
}

/**
 * Enqueue a pending transaction for offline processing
 */
export async function enqueuePendingTransaction(
  action: "create" | "update" | "delete",
  data: Partial<LedgerTransaction>,
  transactionId?: string
): Promise<string> {
  try {
    const id = transactionId || generateId();
    const pending: PendingTransaction = {
      id,
      action,
      data,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    const queue = await readOfflineQueue();
    queue.push(pending);

    const json = JSON.stringify(queue);
    await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, json);

    console.log(`[SYNC] Enqueued ${action} for transaction ${id}`);

    return id;
  } catch (err) {
    console.warn("[SYNC] Error enqueueing pending transaction:", err);
    throw err;
  }
}

/**
 * Read all pending transactions from offline queue
 */
export async function readOfflineQueue(): Promise<PendingTransaction[]> {
  try {
    const json = await SecureStore.getItemAsync(OFFLINE_QUEUE_KEY);

    if (!json) {
      return [];
    }

    const data = JSON.parse(json);

    if (!Array.isArray(data)) {
      return [];
    }

    const queue: PendingTransaction[] = [];
    for (const item of data) {
      const parsed = parsePendingTransaction(item);
      if (parsed) {
        queue.push(parsed);
      }
    }

    return queue;
  } catch (err) {
    console.warn("[SYNC] Error reading offline queue:", err);
    return [];
  }
}

/**
 * Write offline queue back to storage
 */
async function writeOfflineQueue(queue: PendingTransaction[]): Promise<void> {
  try {
    const json = JSON.stringify(queue);
    await SecureStore.setItemAsync(OFFLINE_QUEUE_KEY, json);
  } catch (err) {
    console.warn("[SYNC] Error writing offline queue:", err);
    throw err;
  }
}

/**
 * Process all pending transactions in the offline queue
 */
export async function processPendingQueue(
  repo: LedgerRepository
): Promise<{ successful: number; failed: number; remaining: PendingTransaction[] }> {
  try {
    console.log("[SYNC] Processing offline queue");

    let queue = await readOfflineQueue();

    if (queue.length === 0) {
      console.log("[SYNC] Offline queue is empty");
      return { successful: 0, failed: 0, remaining: [] };
    }

    let successful = 0;
    let failed = 0;
    const remaining: PendingTransaction[] = [];

    for (const pending of queue) {
      try {
        console.log(`[SYNC] Processing pending ${pending.action}: ${pending.id}`);

        if (pending.action === "create") {
          await repo.saveTransaction(pending.data as LedgerTransactionDraft);
          successful++;
          console.log(`[SYNC] Successfully created transaction ${pending.id}`);
        } else if (pending.action === "update") {
          const draft = pending.data as LedgerTransaction;
          if (draft.id) {
            await repo.saveTransaction(draft);
            successful++;
            console.log(`[SYNC] Successfully updated transaction ${pending.id}`);
          } else {
            throw new Error("Update without transaction ID");
          }
        } else if (pending.action === "delete") {
          if (pending.id) {
            await repo.deleteTransaction(pending.id);
            successful++;
            console.log(`[SYNC] Successfully deleted transaction ${pending.id}`);
          } else {
            throw new Error("Delete without transaction ID");
          }
        }
      } catch (err) {
        pending.retryCount++;
        pending.lastError = String((err as Error)?.message || "Unknown error");

        if (pending.retryCount >= MAX_RETRIES) {
          failed++;
          console.error(
            `[SYNC] Failed to process ${pending.action} ${pending.id} after ${MAX_RETRIES} retries:`,
            err
          );
        } else {
          console.warn(
            `[SYNC] Retrying ${pending.action} ${pending.id} (attempt ${pending.retryCount}/${MAX_RETRIES}):`,
            err
          );
          remaining.push(pending);
        }
      }
    }

    // Write back remaining transactions - critical to preserve state
    try {
      await writeOfflineQueue(remaining);
    } catch (writeErr) {
      console.error("[SYNC] CRITICAL: Failed to persist offline queue state:", writeErr);
      console.error(`[SYNC] ${remaining.length} pending transactions may be lost if app crashes`);
      // Continue despite write failure to allow processing to complete
    }

    console.log(
      `[SYNC] Processed offline queue: ${successful} successful, ${failed} failed, ${remaining.length} remaining`
    );

    return { successful, failed, remaining };
  } catch (err) {
    console.error("[SYNC] Error processing offline queue - attempting recovery:", err);
    // Return current queue state to caller so they can retry
    return { successful: 0, failed: 0, remaining: await readOfflineQueue() };
  }
}

/**
 * Clear all pending transactions from the offline queue
 */
export async function clearOfflineQueue(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(OFFLINE_QUEUE_KEY);
    console.log("[SYNC] Offline queue cleared");
  } catch (err) {
    console.warn("[SYNC] Error clearing offline queue:", err);
  }
}

/**
 * Get status of the offline queue
 */
export async function getOfflineQueueStatus(): Promise<{
  pending: number;
  processing: number;
  failed: number;
  lastProcessedAt?: string;
}> {
  try {
    const queue = await readOfflineQueue();

    let pending = 0;
    let failed = 0;

    for (const item of queue) {
      if (item.retryCount >= MAX_RETRIES) {
        failed++;
      } else {
        pending++;
      }
    }

    return {
      pending,
      processing: 0, // Could be enhanced with a "processing" state
      failed,
      lastProcessedAt: undefined, // Could be stored and retrieved
    };
  } catch (err) {
    console.warn("[SYNC] Error getting offline queue status:", err);
    return {
      pending: 0,
      processing: 0,
      failed: 0,
    };
  }
}

/**
 * Remove a specific pending transaction by ID
 */
export async function removePendingTransaction(id: string): Promise<void> {
  try {
    let queue = await readOfflineQueue();
    queue = queue.filter((item) => item.id !== id);
    await writeOfflineQueue(queue);
    console.log(`[SYNC] Removed pending transaction ${id}`);
  } catch (err) {
    console.warn("[SYNC] Error removing pending transaction:", err);
  }
}
