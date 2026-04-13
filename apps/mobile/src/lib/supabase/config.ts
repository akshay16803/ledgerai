import Constants from "expo-constants";

type SupabaseConfig = {
  url: string;
  anonKey: string;
  configured: boolean;
};

function readExtra() {
  const extra = (Constants.expoConfig?.extra || {}) as Record<string, string | undefined>;
  return {
    url: String(extra.supabaseUrl || "").trim(),
    anonKey: String(extra.supabaseAnonKey || "").trim(),
  };
}

export function getSupabaseConfig(): SupabaseConfig {
  const envUrl = String(process.env.EXPO_PUBLIC_SUPABASE_URL || "").trim();
  const envAnon = String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  const extra = readExtra();

  const url = envUrl || extra.url;
  const anonKey = envAnon || extra.anonKey;
  const configured = Boolean(url && anonKey);

  return {
    url,
    anonKey,
    configured,
  };
}
