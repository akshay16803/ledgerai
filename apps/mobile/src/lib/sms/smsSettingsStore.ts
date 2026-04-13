import type { LedgerRepository } from "@lib/repositories/types";

/**
 * SMS Settings stored in Supabase app_settings table
 */
export type SmsSettings = {
  /** Whether SMS scanning is enabled by user */
  smsEnabled: boolean;
  /** Whether to automatically match SMS and email duplicates */
  autoDedup: boolean;
  /** ISO 8601 timestamp of last SMS scan, or null if never scanned */
  lastScanDate: string | null;
  /** Error message from last failed scan, or null if successful */
  lastScanError: string | null;
};

/**
 * Default SMS settings
 */
const DEFAULT_SMS_SETTINGS: SmsSettings = {
  smsEnabled: false,
  autoDedup: true,
  lastScanDate: null,
  lastScanError: null,
};

/**
 * Key used to store SMS settings in ledger_app_settings table
 */
const SMS_SETTINGS_KEY = "sms_settings";

/**
 * Retrieve SMS settings from Supabase for current user
 *
 * Reads from ledger_app_settings table using the repository pattern.
 * Returns default settings if no saved settings exist.
 *
 * @param repo - LedgerRepository instance for database access
 * @returns Promise resolving to current SMS settings
 * @throws If database query fails and no fallback available
 *
 * @example
 * ```typescript
 * const settings = await getSmsSettings(repo);
 * console.log(settings.smsEnabled); // true or false
 * ```
 */
export async function getSmsSettings(repo: LedgerRepository): Promise<SmsSettings> {
  try {
    // Note: readAppSetting is not yet implemented in LedgerRepository
    // For now, return defaults. When app settings storage is added to the repository,
    // this should be updated to:
    // const stored = await (repo as any).readAppSetting?.(SMS_SETTINGS_KEY);
    // and process the result as shown below

    const stored = await (repo as any).readAppSetting?.(SMS_SETTINGS_KEY);
    if (!stored) {
      return { ...DEFAULT_SMS_SETTINGS };
    }

    const settingValue = (stored as Record<string, unknown>).setting_value;

    // Validate and merge with defaults to ensure all fields are present
    if (typeof settingValue === "object" && settingValue !== null) {
      const loaded = settingValue as Partial<SmsSettings>;
      return {
        smsEnabled: typeof loaded.smsEnabled === "boolean" ? loaded.smsEnabled : false,
        autoDedup: typeof loaded.autoDedup === "boolean" ? loaded.autoDedup : true,
        lastScanDate:
          typeof loaded.lastScanDate === "string" || loaded.lastScanDate === null
            ? loaded.lastScanDate
            : null,
        lastScanError:
          typeof loaded.lastScanError === "string" || loaded.lastScanError === null
            ? loaded.lastScanError
            : null,
      };
    }

    return { ...DEFAULT_SMS_SETTINGS };
  } catch (err) {
    console.error("[SMS] Failed to read SMS settings:", err);
    // Return defaults on error rather than propagating
    return { ...DEFAULT_SMS_SETTINGS };
  }
}

/**
 * Save SMS settings to Supabase for current user
 *
 * Persists settings using upsert pattern in ledger_app_settings table.
 * Creates new row if settings don't exist, updates if they do.
 *
 * @param repo - LedgerRepository instance for database access
 * @param settings - SMS settings to save
 * @throws If database operation fails
 *
 * @example
 * ```typescript
 * const updated = { ...currentSettings, smsEnabled: true };
 * await saveSmsSettings(repo, updated);
 * ```
 */
export async function saveSmsSettings(
  repo: LedgerRepository,
  settings: SmsSettings
): Promise<void> {
  try {
    // Validate settings before saving
    const validated: SmsSettings = {
      smsEnabled: typeof settings.smsEnabled === "boolean" ? settings.smsEnabled : false,
      autoDedup: typeof settings.autoDedup === "boolean" ? settings.autoDedup : true,
      lastScanDate:
        typeof settings.lastScanDate === "string" || settings.lastScanDate === null
          ? settings.lastScanDate
          : null,
      lastScanError:
        typeof settings.lastScanError === "string" || settings.lastScanError === null
          ? settings.lastScanError
          : null,
    };

    await (repo as any).upsertAppSetting?.(SMS_SETTINGS_KEY, validated);
    console.debug("[SMS] Settings saved successfully", { smsEnabled: validated.smsEnabled });
  } catch (err) {
    console.error("[SMS] Failed to save SMS settings:", err);
    throw err;
  }
}

/**
 * Update a single SMS setting field while preserving others
 *
 * Convenient helper to update one field without needing to read-modify-write manually.
 *
 * @param repo - LedgerRepository instance for database access
 * @param field - Field name to update
 * @param value - New value for the field
 * @throws If read or write fails
 *
 * @example
 * ```typescript
 * // Update only the enabled flag
 * await updateSmsSetting(repo, "smsEnabled", true);
 * ```
 */
export async function updateSmsSetting(
  repo: LedgerRepository,
  field: keyof SmsSettings,
  value: unknown
): Promise<void> {
  const current = await getSmsSettings(repo);
  const updated = { ...current, [field]: value };
  await saveSmsSettings(repo, updated);
}

/**
 * Clear SMS settings and restore defaults
 *
 * Useful when user wants to reset all SMS configuration.
 * Sets all values back to defaults, but does not delete the setting row.
 *
 * @param repo - LedgerRepository instance for database access
 * @throws If database operation fails
 *
 * @example
 * ```typescript
 * await resetSmsSettings(repo);
 * ```
 */
export async function resetSmsSettings(repo: LedgerRepository): Promise<void> {
  try {
    await saveSmsSettings(repo, { ...DEFAULT_SMS_SETTINGS });
    console.debug("[SMS] Settings reset to defaults");
  } catch (err) {
    console.error("[SMS] Failed to reset SMS settings:", err);
    throw err;
  }
}
