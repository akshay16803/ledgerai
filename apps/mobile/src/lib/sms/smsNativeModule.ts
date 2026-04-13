import { Platform, PermissionsAndroid } from "react-native";
import type { SmsNativeModule, RawSmsMessage } from "./types";

// Permission dialog text constants
const SMS_PERMISSION_REQUEST_TITLE = "SMS Access Needed";
const SMS_PERMISSION_REQUEST_MESSAGE =
  "LedgerAI needs permission to read SMS messages for transaction analysis.";
const SMS_PERMISSION_POSITIVE = "Grant";
const SMS_PERMISSION_NEGATIVE = "Cancel";
const SMS_PERMISSION_NEUTRAL = "Ask Me Later";

/**
 * Check if SMS reading is available on this platform
 * Android: true (native READ_SMS permission available)
 * iOS: false (Apple privacy restrictions prevent SMS reading)
 */
export const SMS_AVAILABLE_ON_PLATFORM = Platform.OS === "android";

/**
 * Native SMS module implementation
 * Provides permission management and message reading for Android
 * Gracefully returns false/empty for iOS
 */
export const smsNativeModule: SmsNativeModule = {
  isAvailable(): boolean {
    return SMS_AVAILABLE_ON_PLATFORM;
  },

  async requestPermission(): Promise<boolean> {
    if (!SMS_AVAILABLE_ON_PLATFORM) {
      return false;
    }

    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        {
          title: SMS_PERMISSION_REQUEST_TITLE,
          message: SMS_PERMISSION_REQUEST_MESSAGE,
          buttonNeutral: SMS_PERMISSION_NEUTRAL,
          buttonNegative: SMS_PERMISSION_NEGATIVE,
          buttonPositive: SMS_PERMISSION_POSITIVE,
        }
      );

      const granted = result === PermissionsAndroid.RESULTS.GRANTED;
      if (!granted) {
        console.warn(
          "[SMS] User did not grant READ_SMS permission:",
          result
        );
      }
      return granted;
    } catch (err) {
      console.error("[SMS] Permission request failed:", err);
      return false;
    }
  },

  async checkPermission(): Promise<boolean> {
    if (!SMS_AVAILABLE_ON_PLATFORM) {
      return false;
    }

    try {
      const result = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_SMS
      );
      return result === true;
    } catch (err) {
      console.error("[SMS] Permission check failed:", err);
      return false;
    }
  },

  async querySmsMessages(limit: number = 100): Promise<RawSmsMessage[]> {
    if (!SMS_AVAILABLE_ON_PLATFORM) {
      return [];
    }

    try {
      // TODO (Phase 2): Implement actual SMS provider query via ContentResolver
      // For now, return empty (permission request is Feature 1 scope)
      // Phase 2 will add native module to query content://sms/ and normalize messages
      return [];
    } catch (err) {
      console.error("[SMS] Query failed:", err);
      return [];
    }
  },
};

/**
 * Check if SMS is available on this platform
 * @returns true if SMS reading is available (Android), false otherwise
 */
export function isSmsAvailable(): boolean {
  return smsNativeModule.isAvailable();
}

/**
 * Get user-facing reason why SMS is unavailable
 * @returns descriptive message about SMS availability on current platform
 */
export function getSmsUnavailabilityReason(): string {
  if (SMS_AVAILABLE_ON_PLATFORM) {
    return "SMS reading is available on this device.";
  }
  return "iOS requires SMS forwarding via Mail rules (feature coming soon).";
}
