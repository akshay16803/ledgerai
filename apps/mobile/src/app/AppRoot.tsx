import { useEffect, useState } from "react";
import { AppProviders } from "@app/providers/AppProviders";
import { RootNavigator } from "@app/navigation/RootNavigator";
import { FirstLaunchModal } from "@features/navigation/modals/FirstLaunchModal";
import { isFirstLaunch, markFirstLaunchComplete } from "@lib/onboarding/firstLaunchStorage";

export function AppRoot() {
  const [showSmsPrompt, setShowSmsPrompt] = useState(false);

  useEffect(() => {
    async function checkFirstLaunch() {
      try {
        const isFirst = await isFirstLaunch();
        if (isFirst) {
          setShowSmsPrompt(true);
          await markFirstLaunchComplete();
        }
      } catch (err) {
        console.error("[FirstLaunch] Failed to check first launch status:", err);
        // Don't show modal if check fails; user can request in Settings
      }
    }

    checkFirstLaunch();
  }, []);

  return (
    <AppProviders>
      <FirstLaunchModal
        visible={showSmsPrompt}
        onDismiss={() => setShowSmsPrompt(false)}
      />
      <RootNavigator />
    </AppProviders>
  );
}

