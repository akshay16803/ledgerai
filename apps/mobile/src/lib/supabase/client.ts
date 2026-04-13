import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { authStorage } from "@lib/supabase/authStorage";
import { getSupabaseConfig } from "@lib/supabase/config";

const cfg = getSupabaseConfig();

export const supabase: SupabaseClient | null = cfg.configured
  ? createClient(cfg.url, cfg.anonKey, {
    auth: {
      storage: authStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  })
  : null;

export const isSupabaseConfigured = cfg.configured;

export function requireSupabaseClient() {
  if (!supabase) {
    throw new Error("Mobile Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return supabase;
}
