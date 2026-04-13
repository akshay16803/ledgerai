import { requireSupabaseClient } from "@lib/supabase/client";
import type {
  BookkeepingAccount,
  InboxReviewItem,
  LedgerTransaction,
} from "@lib/repositories/types";

export type UnsubscribeFn = () => void;

export type RealtimePayload<T> = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T | null;
  old: T | null;
  schema: string;
  table: string;
  commit_timestamp: string;
};

/**
 * Creates subscription helpers for a given table
 *
 * IMPORTANT: Always call unsubscribeAll() when done to prevent memory leaks from
 * unreleased WebSocket connections and event listeners.
 */
export function createRealtimeSubscriptions() {
  const subscriptions: Array<{ table: string; unsubscribe: UnsubscribeFn }> = [];

  const subscribe = <T extends { id: string }>(
    tableName: string,
    onUpdate: (payload: RealtimePayload<T>) => void
  ): UnsubscribeFn => {
    try {
      const client = requireSupabaseClient();

      console.log(`[SYNC] Subscribing to ${tableName}`);

      const channel = client.channel(`${tableName}:*`);

      channel
        .on<T>(
          "postgres_changes",
          { event: "*", schema: "public", table: tableName },
          (payload: any) => {
            const realtimePayload: RealtimePayload<T> = {
              eventType: payload.eventType,
              new: (payload.new as T) || null,
              old: (payload.old as T) || null,
              schema: payload.schema,
              table: payload.table,
              commit_timestamp: payload.commit_timestamp,
            };

            console.log(
              `[SYNC] Event on ${tableName}:`,
              realtimePayload.eventType,
              realtimePayload.new?.id || realtimePayload.old?.id
            );

            try {
              onUpdate(realtimePayload);
            } catch (err) {
              console.warn(`[SYNC] Error processing ${tableName} update:`, err);
            }
          }
        )
        .subscribe((status: string) => {
          console.log(`[SYNC] Subscription status for ${tableName}:`, status);
        });

      const unsubscribe: UnsubscribeFn = () => {
        console.log(`[SYNC] Unsubscribing from ${tableName}`);
        channel.unsubscribe();
        // Remove from tracking array to prevent memory leak if unsubscribe is called multiple times
        const idx = subscriptions.findIndex((s) => s.table === tableName);
        if (idx >= 0) {
          subscriptions.splice(idx, 1);
        }
      };

      subscriptions.push({ table: tableName, unsubscribe });

      return unsubscribe;
    } catch (err) {
      console.warn(`[SYNC] Failed to subscribe to ${tableName}:`, err);
      return () => {
        /* no-op */
      };
    }
  };

  const unsubscribeAll = (): void => {
    console.log(`[SYNC] Unsubscribing from all ${subscriptions.length} subscriptions`);
    for (const { unsubscribe } of subscriptions) {
      try {
        unsubscribe();
      } catch (err) {
        console.warn("[SYNC] Error during unsubscribe:", err);
      }
    }
    subscriptions.length = 0;
  };

  return { subscribe, unsubscribeAll };
}

/**
 * Subscribe to transaction changes with automatic retry
 */
export async function subscribeToTransactionsWithRetry(
  onUpdate: (payload: RealtimePayload<LedgerTransaction>) => void,
  maxRetries: number = 3
): Promise<UnsubscribeFn> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const { subscribe } = createRealtimeSubscriptions();
      return subscribe("ledger_transactions", onUpdate);
    } catch (err) {
      lastError = err as Error;
      if (i < maxRetries - 1) {
        const delayMs = 1000 * Math.pow(2, i);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  console.warn("[SYNC] Failed to subscribe to transactions after retries:", lastError);
  return () => {
    /* no-op */
  };
}

/**
 * Subscribe to inbox item changes with automatic retry
 */
export async function subscribeToInboxItemsWithRetry(
  onUpdate: (payload: RealtimePayload<InboxReviewItem>) => void,
  maxRetries: number = 3
): Promise<UnsubscribeFn> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const { subscribe } = createRealtimeSubscriptions();
      return subscribe("ledger_inbox", onUpdate);
    } catch (err) {
      lastError = err as Error;
      if (i < maxRetries - 1) {
        const delayMs = 1000 * Math.pow(2, i);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  console.warn("[SYNC] Failed to subscribe to inbox items after retries:", lastError);
  return () => {
    /* no-op */
  };
}

/**
 * Subscribe to account changes with automatic retry
 */
export async function subscribeToAccountsWithRetry(
  onUpdate: (payload: RealtimePayload<BookkeepingAccount>) => void,
  maxRetries: number = 3
): Promise<UnsubscribeFn> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const { subscribe } = createRealtimeSubscriptions();
      return subscribe("ledger_accounts", onUpdate);
    } catch (err) {
      lastError = err as Error;
      if (i < maxRetries - 1) {
        const delayMs = 1000 * Math.pow(2, i);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  console.warn("[SYNC] Failed to subscribe to accounts after retries:", lastError);
  return () => {
    /* no-op */
  };
}
