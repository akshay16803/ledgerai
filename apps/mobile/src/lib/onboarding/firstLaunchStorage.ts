import * as SecureStore from "expo-secure-store";

const KEY_PREFIX = "ledgerai-mobile:";
const FIRST_LAUNCH_KEY = KEY_PREFIX + "firstLaunch";

/**
 * Check if this is the first launch of the app
 * Returns true if the first launch flag has not been set
 *
 * @returns Promise<boolean> - true if first launch, false otherwise
 */
export async function isFirstLaunch(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(FIRST_LAUNCH_KEY);
    const isFirst = !value; // true if not found (first launch)
    if (isFirst) {
      console.debug("[FirstLaunch] App is on first launch");
    }
    return isFirst;
  } catch (err) {
    console.error("[FirstLaunch] Storage error while checking first launch:", err);
    // Safe default: treat as not first launch if check fails
    // This prevents modal from showing if there's a storage issue
    return false;
  }
}

/**
 * Mark the app as having completed its first launch
 * Sets the first launch flag in secure storage
 *
 * @returns Promise<void>
 */
export async function markFirstLaunchComplete(): Promise<void> {
  try {
    await SecureStore.setItemAsync(FIRST_LAUNCH_KEY, "true");
    console.debug("[FirstLaunch] First launch marked as complete");
  } catch (err) {
    console.error("[FirstLaunch] Failed to save first launch flag:", err);
    // Don't throw; gracefully handle storage errors
  }
}

/**
 * Reset the first launch flag
 * Used for testing only - allows re-triggering the first launch flow
 *
 * @returns Promise<void>
 */
export async function resetFirstLaunchFlag(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(FIRST_LAUNCH_KEY);
    console.debug("[FirstLaunch] First launch flag reset (testing)");
  } catch (err) {
    console.error("[FirstLaunch] Failed to reset first launch flag:", err);
    // Don't throw; gracefully handle storage errors
  }
}
