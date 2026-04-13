import { useCallback, useEffect, useMemo, useState } from "react";
import { smsNativeModule } from "@lib/sms/smsNativeModule";
import type { NormalizedSmsMessage, SmsPermissionState } from "@lib/sms/types";

/**
 * Initial empty permission state
 */
const EMPTY_PERMISSION_STATE: SmsPermissionState = {
  status: "unavailable",
  requested: false,
  requestedAt: null,
  lastError: null,
};

/**
 * State returned by useSmsMessages hook
 */
export type UseSmsMessagesState = {
  /** Current SMS permission state */
  permissionState: SmsPermissionState;
  /** Array of normalized SMS messages */
  messages: NormalizedSmsMessage[];
  /** Whether a request is currently in progress */
  loading: boolean;
  /** Error message from last failed operation, or null */
  error: string | null;
  /** Trigger SMS permission request dialog */
  requestPermission: () => Promise<void>;
  /** Refresh SMS messages from device */
  refreshMessages: () => Promise<void>;
};

/**
 * Hook for managing SMS permissions and message retrieval
 *
 * Lifecycle:
 * 1. On mount: Check current permission status
 * 2. User can call requestPermission() to trigger permission dialog
 * 3. Once granted, user can call refreshMessages() to fetch SMS
 * 4. All state updates respect unmount cleanup
 *
 * @returns SMS state object with permission status, messages, and control functions
 */
export function useSmsMessages(): UseSmsMessagesState {
  const [permissionState, setPermissionState] = useState<SmsPermissionState>(
    EMPTY_PERMISSION_STATE
  );
  const [messages, setMessages] = useState<NormalizedSmsMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize: Check current permission state on mount
  useEffect(() => {
    let active = true;

    async function initSmsState(): Promise<void> {
      try {
        if (!smsNativeModule.isAvailable()) {
          if (active) {
            setPermissionState({
              ...EMPTY_PERMISSION_STATE,
              status: "unavailable",
            });
          }
          return;
        }

        const hasPermission = await smsNativeModule.checkPermission();
        if (active) {
          setPermissionState({
            status: hasPermission ? "granted" : "denied",
            requested: hasPermission,
            requestedAt: hasPermission ? new Date().toISOString() : null,
            lastError: null,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (active) {
          console.error("[SMS] Failed to initialize SMS state:", err);
          setPermissionState({
            status: "denied",
            requested: false,
            requestedAt: null,
            lastError: message,
          });
        }
      }
    }

    initSmsState();
    return () => {
      active = false;
    };
  }, []);

  /**
   * Trigger permission request dialog
   */
  const requestPermission = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      if (!smsNativeModule.isAvailable()) {
        throw new Error("SMS is not available on this platform");
      }

      const granted = await smsNativeModule.requestPermission();
      setPermissionState({
        status: granted ? "granted" : "denied",
        requested: true,
        requestedAt: new Date().toISOString(),
        lastError: null,
      });

      if (!granted) {
        setError("SMS permission was not granted");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to request SMS permission";
      console.error("[SMS] Permission request error:", err);
      setError(message);
      setPermissionState((prev) => ({
        ...prev,
        lastError: message,
      }));
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Refresh SMS messages from device
   * Requires permission to be granted first
   */
  const refreshMessages = useCallback(async (): Promise<void> => {
    if (permissionState.status !== "granted") {
      setError("SMS permission required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const raw = await smsNativeModule.querySmsMessages(100);
      // TODO (Phase 2): Normalize raw SMS messages to NormalizedSmsMessage[]
      // For now, empty (actual SMS reading deferred to Phase 2)
      // Phase 2 will implement:
      // - Normalize raw messages to NormalizedSmsMessage format
      // - Compute SHA-256 hash for each message
      // - Filter for transaction-relevant messages
      if (raw.length > 0) {
        console.info("[SMS] Read", raw.length, "raw SMS messages");
      }
      setMessages([]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to refresh SMS messages";
      console.error("[SMS] Refresh messages error:", err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [permissionState.status]);

  /**
   * Memoize return object to prevent unnecessary re-renders
   */
  const api = useMemo<UseSmsMessagesState>(
    () => ({
      permissionState,
      messages,
      loading,
      error,
      requestPermission,
      refreshMessages,
    }),
    [permissionState, messages, loading, error, requestPermission, refreshMessages]
  );

  return api;
}
