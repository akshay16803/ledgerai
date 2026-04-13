import { useEffect, useMemo, useState } from "react";
import * as Linking from "expo-linking";
import type { Session, User } from "@supabase/supabase-js";
import { getProviderRuntimeConfig } from "@lib/email/providerConfig";
import { isSupabaseConfigured, supabase } from "@lib/supabase/client";

type AuthSessionState = {
  loading: boolean;
  configured: boolean;
  session: Session | null;
  user: User | null;
  recoveryMode: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  dismissRecovery: () => void;
  signOut: () => Promise<void>;
};

function parseAuthParams(url: string) {
  const [base, hash = ""] = String(url || "").split("#");
  const searchParams = new URL(base).searchParams;
  const hashParams = new URLSearchParams(hash);
  return {
    accessToken: searchParams.get("access_token") || hashParams.get("access_token") || "",
    refreshToken: searchParams.get("refresh_token") || hashParams.get("refresh_token") || "",
    type: searchParams.get("type") || hashParams.get("type") || "",
  };
}

export function useAuthSession(): AuthSessionState {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      setSession(null);
      setRecoveryMode(false);
      return undefined;
    }

    let active = true;
    const recoveryRedirectUri = getProviderRuntimeConfig().recoveryRedirectUri;

    const handleUrl = async(url: string | null) => {
      if (!url || !supabase) return;
      const params = parseAuthParams(url);
      const isRecoveryUrl = url.startsWith(recoveryRedirectUri) || params.type === "recovery";
      if (!isRecoveryUrl || !params.accessToken || !params.refreshToken) return;
      await supabase.auth.setSession({
        access_token: params.accessToken,
        refresh_token: params.refreshToken,
      });
      if (active) setRecoveryMode(true);
    };

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session ?? null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    Linking.getInitialURL()
      .then((url) => handleUrl(url))
      .catch(() => undefined);

    const urlSub = Linking.addEventListener("url", ({ url }) => {
      handleUrl(url).catch(() => undefined);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession ?? null);
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
      }
      if (event === "SIGNED_OUT") {
        setRecoveryMode(false);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      urlSub.remove();
    };
  }, []);

  const api = useMemo<AuthSessionState>(
    () => ({
      loading,
      configured: isSupabaseConfigured,
      session,
      user: session?.user ?? null,
      recoveryMode,
      async signInWithPassword(email: string, password: string) {
        if (!supabase) throw new Error("Mobile Supabase is not configured.");
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      async signUpWithPassword(email: string, password: string) {
        if (!supabase) throw new Error("Mobile Supabase is not configured.");
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      },
      async sendPasswordReset(email: string) {
        if (!supabase) throw new Error("Mobile Supabase is not configured.");
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: getProviderRuntimeConfig().recoveryRedirectUri,
        });
        if (error) throw error;
      },
      async updatePassword(password: string) {
        if (!supabase) throw new Error("Mobile Supabase is not configured.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setRecoveryMode(false);
      },
      dismissRecovery() {
        setRecoveryMode(false);
      },
      async signOut() {
        if (!supabase) throw new Error("Mobile Supabase is not configured.");
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [loading, recoveryMode, session],
  );

  return api;
}
