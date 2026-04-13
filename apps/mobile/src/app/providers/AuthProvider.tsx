import { createContext, PropsWithChildren, useContext, useEffect } from "react";
import { useAuthSession } from "@features/auth/hooks/useAuthSession";
import { smsNativeModule } from "@lib/sms/smsNativeModule";

type AuthContextValue = ReturnType<typeof useAuthSession>;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const value = useAuthSession();

  // Initialize SMS module when Supabase auth is ready
  useEffect(() => {
    if (!value.configured || value.loading) return;

    async function initializeSmsModule(): Promise<void> {
      try {
        if (!smsNativeModule.isAvailable()) {
          return;  // iOS or unsupported platform
        }

        // Check current SMS permission status
        const hasPermission = await smsNativeModule.checkPermission();
        if (!hasPermission) {
          // Request SMS permission on first app launch
          await smsNativeModule.requestPermission();
        }
      } catch (err) {
        console.error("[SMS] Failed to initialize SMS module:", err);
      }
    }

    initializeSmsModule();
  }, [value.configured, value.loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
