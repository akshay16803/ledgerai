/**
 * SMS Permission Status
 * - "checking": Initial state, checking permission status
 * - "granted": User has granted READ_SMS permission
 * - "denied": User has explicitly denied permission
 * - "unavailable": Platform does not support SMS (iOS)
 */
export type SmsPermissionStatus = "checking" | "granted" | "denied" | "unavailable";

/**
 * Tracks SMS permission state and request history
 */
export type SmsPermissionState = {
  /** Current permission status */
  status: SmsPermissionStatus;
  /** Whether permission has been requested from user */
  requested: boolean;
  /** ISO 8601 timestamp of last permission request, or null if never requested */
  requestedAt: string | null;
  /** Error message from last failed permission operation, or null */
  lastError: string | null;
};

/**
 * Normalized SMS message (mirrors email pattern)
 * Used for consistent transaction analysis across email and SMS sources
 */
export type NormalizedSmsMessage = {
  /** Unique identifier for this SMS message */
  id: string;
  /** Phone number or contact name of SMS sender */
  sender: string;
  /** Full text content of the SMS message */
  body: string;
  /** ISO 8601 timestamp of when message was received */
  timestamp: string;
  /** Normalized date in YYYY-MM-DD format for transaction grouping */
  normalizedDate: string;
  /** Processing status: pending analysis, analyzed, or failed during processing */
  status: "pending" | "analyzed" | "failed";
  /** SHA-256 hash of message content for deduplication */
  hash: string;
};

/**
 * Raw SMS message as read from Android content provider
 * Format matches Android SMS ContentProvider schema
 */
export type RawSmsMessage = {
  /** Message ID from Android SMS provider */
  _id: string;
  /** Phone number of message sender */
  address: string;
  /** Full text content of message */
  body: string;
  /** Timestamp in milliseconds since epoch */
  date: number;
};

/**
 * Interface for native SMS module
 * Provides permission management and SMS reading with platform-specific implementations
 */
export interface SmsNativeModule {
  /**
   * Check if SMS functionality is available on this platform
   * @returns true on Android, false on iOS or unsupported platforms
   */
  isAvailable(): boolean;

  /**
   * Request READ_SMS permission from user
   * Shows native Android permission dialog
   * @returns true if permission was granted, false otherwise
   */
  requestPermission(): Promise<boolean>;

  /**
   * Check if READ_SMS permission is currently granted
   * Performs silent check without showing dialog
   * @returns true if permission is granted, false otherwise
   */
  checkPermission(): Promise<boolean>;

  /**
   * Query SMS messages from device
   * Requires READ_SMS permission to be granted
   * @param limit Maximum number of messages to return (default 100)
   * @returns Array of raw SMS messages, empty array if unavailable or error occurs
   */
  querySmsMessages(limit: number): Promise<RawSmsMessage[]>;
}
