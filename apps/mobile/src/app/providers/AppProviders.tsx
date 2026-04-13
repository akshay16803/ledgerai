import { PropsWithChildren, useEffect, useMemo } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { navTheme } from "@design/theme";
import { AuthProvider } from "@app/providers/AuthProvider";
import { createLedgerRepository } from "@lib/repositories/createLedgerRepository";

export function AppProviders({ children }: PropsWithChildren) {
  const repo = useMemo(() => createLedgerRepository(), []);

  // Initialize background polling on app start
  useEffect(() => {
    console.log("[APP] Initializing background polling");
    const stopPolling = repo.startBackgroundPolling(30 * 60 * 1000); // 30 minutes

    return () => {
      console.log("[APP] Stopping background polling on unmount");
      stopPolling();
    };
  }, [repo]);

  // Process offline queue when connection detected or app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();

    async function handleAppStateChange(state: AppStateStatus) {
      if (state === "active") {
        console.log("[APP] Processing offline queue on app focus");
        try {
          const status = await repo.getOfflineQueueStatus();
          if (status.pending > 0) {
            const result = await repo.processPendingQueue();
            console.log(
              `[APP] Offline queue processed: ${result.successful} successful, ${result.failed} failed`
            );
            if (result.failed > 0) {
              console.warn(
                `[APP] ${result.failed} transactions failed to sync; will retry on next focus`
              );
            }
          }
        } catch (err) {
          console.warn("[APP] Error processing offline queue:", err);
        }
      }
    }
  }, [repo]);

  return (
    <AuthProvider>
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" />
        {children}
      </NavigationContainer>
    </AuthProvider>
  );
}
