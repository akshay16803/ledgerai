import { requireSupabaseClient } from "@lib/supabase/client";
import * as SecureStore from "expo-secure-store";
import type {
  BookkeepingAccount,
  ConflictResolutionEvent,
  InboxReviewItem,
  LedgerRepository,
  LedgerTransaction,
  SyncDelta,
  SyncState,
} from "@lib/repositories/types";

const LAST_SYNC_TIME_KEY = "last_sync_time";
const SYNC_CONFLICT_KEY = "sync_conflicts";

/**
 * Fetch all changes since the last sync timestamp
 */
export async function getChangesSinceLast(
  repo: LedgerRepository,
  lastSyncTime: string
): Promise<SyncDelta> {
  try {
    const client = requireSupabaseClient();

    console.log(`[SYNC] Fetching changes since ${lastSyncTime}`);

    // Query changed transactions
    const transactionsQuery = client
      .from("ledger_transactions")
      .select("*")
      .gt("updated_at", lastSyncTime);

    // Query changed inbox items
    const inboxQuery = client
      .from("ledger_inbox")
      .select("*")
      .gt("updated_at", lastSyncTime);

    // Query changed accounts
    const accountsQuery = client
      .from("ledger_accounts")
      .select("*")
      .gt("updated_at", lastSyncTime);

    // Query deleted transactions (marked with is_deleted flag)
    const deletedTransactionsQuery = client
      .from("ledger_transactions")
      .select("id")
      .eq("is_deleted", true)
      .gt("deleted_at", lastSyncTime);

    // Query deleted accounts
    const deletedAccountsQuery = client
      .from("ledger_accounts")
      .select("id")
      .eq("is_deleted", true)
      .gt("deleted_at", lastSyncTime);

    // Query deleted inbox items
    const deletedInboxQuery = client
      .from("ledger_inbox")
      .select("id")
      .eq("is_deleted", true)
      .gt("deleted_at", lastSyncTime);

    const [
      { data: transactions, error: txError },
      { data: inboxItems, error: inboxError },
      { data: accounts, error: accountError },
      { data: deletedTxs, error: deletedTxError },
      { data: deletedAccounts, error: deletedAccError },
      { data: deletedInbox, error: deletedInboxError },
    ] = await Promise.all([
      transactionsQuery,
      inboxQuery,
      accountsQuery,
      deletedTransactionsQuery,
      deletedAccountsQuery,
      deletedInboxQuery,
    ]);

    if (txError || inboxError || accountError) {
      throw new Error(`[SYNC] Query failed: ${txError?.message || inboxError?.message || accountError?.message}`);
    }

    const syncedAt = new Date().toISOString();

    const delta: SyncDelta = {
      transactions: (transactions || []) as LedgerTransaction[],
      inboxItems: (inboxItems || []) as InboxReviewItem[],
      accounts: (accounts || []) as BookkeepingAccount[],
      deletedTransactionIds: ((deletedTxs || []) as any[]).map((row) => row.id),
      deletedAccountIds: ((deletedAccounts || []) as any[]).map((row) => row.id),
      deletedInboxItemIds: ((deletedInbox || []) as any[]).map((row) => row.id),
      lastSyncTime: syncedAt,
      syncedAt,
    };

    console.log(
      `[SYNC] Fetched ${delta.transactions.length} transactions, ` +
        `${delta.inboxItems.length} inbox items, ` +
        `${delta.accounts.length} accounts`
    );

    return delta;
  } catch (err) {
    console.warn("[SYNC] Error fetching changes:", err);
    throw err;
  }
}

/**
 * Merge a sync delta into local state, resolving conflicts
 */
export function mergeDelta(
  localTransactions: LedgerTransaction[],
  localInboxItems: InboxReviewItem[],
  localAccounts: BookkeepingAccount[],
  delta: SyncDelta,
  conflictResolution: "last-modified" | "local-first" = "last-modified"
): {
  transactions: LedgerTransaction[];
  inboxItems: InboxReviewItem[];
  accounts: BookkeepingAccount[];
  conflicts: ConflictResolutionEvent[];
} {
  const conflicts: ConflictResolutionEvent[] = [];

  // Merge transactions
  let mergedTransactions = [...localTransactions];
  for (const remoteTx of delta.transactions) {
    const localIdx = mergedTransactions.findIndex((t) => t.id === remoteTx.id);

    if (localIdx >= 0) {
      const localTx = mergedTransactions[localIdx];
      const event = resolveConflict(localTx, remoteTx);

      if (event) {
        conflicts.push(event);
        const winner = event.resolution === "remote-applied" ? remoteTx : localTx;
        mergedTransactions[localIdx] = winner;
      } else {
        mergedTransactions[localIdx] = remoteTx;
      }
    } else {
      mergedTransactions.push(remoteTx);
    }
  }

  // Remove deleted transactions
  mergedTransactions = mergedTransactions.filter(
    (t) => !delta.deletedTransactionIds.includes(t.id)
  );

  // Merge inbox items
  let mergedInboxItems = [...localInboxItems];
  for (const remoteItem of delta.inboxItems) {
    const localIdx = mergedInboxItems.findIndex((i) => i.id === remoteItem.id);

    if (localIdx >= 0) {
      const localItem = mergedInboxItems[localIdx];
      const event = resolveConflict(localItem, remoteItem);

      if (event) {
        conflicts.push(event);
        const winner = event.resolution === "remote-applied" ? remoteItem : localItem;
        mergedInboxItems[localIdx] = winner;
      } else {
        mergedInboxItems[localIdx] = remoteItem;
      }
    } else {
      mergedInboxItems.push(remoteItem);
    }
  }

  // Remove deleted inbox items
  mergedInboxItems = mergedInboxItems.filter(
    (i) => !delta.deletedInboxItemIds.includes(i.id)
  );

  // Merge accounts
  let mergedAccounts = [...localAccounts];
  for (const remoteAccount of delta.accounts) {
    const localIdx = mergedAccounts.findIndex((a) => a.id === remoteAccount.id);

    if (localIdx >= 0) {
      const localAccount = mergedAccounts[localIdx];
      const event = resolveConflict(localAccount, remoteAccount);

      if (event) {
        conflicts.push(event);
        const winner = event.resolution === "remote-applied" ? remoteAccount : localAccount;
        mergedAccounts[localIdx] = winner;
      } else {
        mergedAccounts[localIdx] = remoteAccount;
      }
    } else {
      mergedAccounts.push(remoteAccount);
    }
  }

  // Remove deleted accounts
  mergedAccounts = mergedAccounts.filter(
    (a) => !delta.deletedAccountIds.includes(a.id)
  );

  console.log(`[SYNC] Merged delta; resolved ${conflicts.length} conflicts`);

  return {
    transactions: mergedTransactions,
    inboxItems: mergedInboxItems,
    accounts: mergedAccounts,
    conflicts,
  };
}

/**
 * Resolve conflict between local and remote rows using updated_at timestamp
 *
 * LIMITATION: Uses timestamp-based conflict resolution. If two modifications occur
 * within the same millisecond, this approach cannot distinguish between them.
 * In practice, this is extremely rare. For critical data, consider implementing
 * vector clocks or operational transformation.
 *
 * @param localRow - Local record
 * @param remoteRow - Remote record
 * @returns Conflict event if detected, null otherwise
 */
export function resolveConflict(
  localRow: Record<string, unknown>,
  remoteRow: Record<string, unknown>
): ConflictResolutionEvent | null {
  const localUpdated = (localRow as any)?.updated_at || (localRow as any)?.createdAt || "";
  const remoteUpdated = (remoteRow as any)?.updated_at || (remoteRow as any)?.createdAt || "";

  if (!localUpdated || !remoteUpdated || localUpdated === remoteUpdated) {
    // No conflict (same timestamp or missing dates)
    return null;
  }

  const localTime = new Date(localUpdated).getTime();
  const remoteTime = new Date(remoteUpdated).getTime();

  if (!Number.isFinite(localTime) || !Number.isFinite(remoteTime)) {
    // Invalid timestamps - cannot resolve
    console.warn("[SYNC] Invalid timestamps in conflict resolution:", {
      localUpdated,
      remoteUpdated,
      localTimeMs: localTime,
      remoteTimeMs: remoteTime,
    });
    return null;
  }

  if (localTime === remoteTime) {
    return null; // No conflict (same millisecond)
  }

  const id = (localRow.id || remoteRow.id) as string;
  const table = (localRow.table || remoteRow.table || "unknown") as string;

  const event: ConflictResolutionEvent = {
    table,
    id,
    conflictType: "update-vs-update",
    localModified: localUpdated,
    remoteModified: remoteUpdated,
    resolution: remoteTime > localTime ? "remote-applied" : "local-kept",
    timestamp: new Date().toISOString(),
  };

  console.log("[SYNC] Conflict detected and resolved:", {
    table,
    id,
    localMs: localTime,
    remoteMs: remoteTime,
    resolution: event.resolution,
  });

  return event;
}

/**
 * Get the last sync time from storage
 */
export async function getLastSyncTime(repo: LedgerRepository): Promise<string> {
  try {
    const stored = await SecureStore.getItemAsync(LAST_SYNC_TIME_KEY);

    if (stored) {
      return stored;
    }

    // Default to 24 hours ago if not set
    const fallback = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    console.log(`[SYNC] No last sync time found; using fallback: ${fallback}`);
    return fallback;
  } catch (err) {
    console.warn("[SYNC] Error reading last sync time:", err);
    return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  }
}

/**
 * Record the current sync time to storage
 */
export async function recordSyncTime(repo: LedgerRepository, timestamp: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(LAST_SYNC_TIME_KEY, timestamp);
    console.log(`[SYNC] Recorded sync time: ${timestamp}`);
  } catch (err) {
    console.warn("[SYNC] Error recording sync time:", err);
  }
}

/**
 * Get current sync state including last sync time and pending counts
 */
export async function getSyncState(repo: LedgerRepository): Promise<SyncState> {
  try {
    const lastSyncTime = await getLastSyncTime(repo);
    const queueStatus = await repo.getOfflineQueueStatus();

    const state: SyncState = {
      lastSyncTime,
      lastSyncAt: new Date().toISOString(),
      isSubscribed: false, // Set by caller based on subscription state
      isPolling: false, // Set by caller based on polling state
      pendingCount: queueStatus.pending,
      conflictCount: 0, // Could be enhanced to track stored conflicts
      lastError: undefined,
    };

    return state;
  } catch (err) {
    console.warn("[SYNC] Error getting sync state:", err);
    return {
      lastSyncTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      lastSyncAt: new Date().toISOString(),
      isSubscribed: false,
      isPolling: false,
      pendingCount: 0,
      conflictCount: 0,
      lastError: String(err),
    };
  }
}
