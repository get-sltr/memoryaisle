import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import "react-native-url-polyfill/auto";

type ExtraConfig = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;

const SUPABASE_URL = (extra.supabaseUrl ?? "").trim();
const SUPABASE_ANON_KEY = (extra.supabaseAnonKey ?? "").trim();

function isValidHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !!u.host;
  } catch {
    return false;
  }
}

/**
 * Expo SecureStore adapter for supabase-js.
 * We set conservative iOS Keychain accessibility to reduce leakage via backups.
 */
const ExpoSecureStoreAdapter = {
  async getItem(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string) {
    // Note: Not all platforms honor all options, but safe to pass.
    return SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  },
  async removeItem(key: string) {
    return SecureStore.deleteItemAsync(key);
  },
};

export const isSupabaseConfigured = (): boolean => {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && isValidHttpsUrl(SUPABASE_URL));
};

let _supabase: SupabaseClient | null = null;

/**
 * Use getSupabase() so you can fail fast and avoid half-configured clients.
 * If you prefer your current style (export const supabase = createClient...), you can,
 * but this pattern prevents confusing runtime failures.
 */
export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;

  if (!isSupabaseConfigured()) {
    // In production you may want to return a "disabled client" instead of throwing.
    const msg =
      "[MemoryAisle] Supabase not configured. " +
      "Check app config extra.supabaseUrl and extra.supabaseAnonKey.";
    // Throwing in dev helps you catch issues immediately.
    if (__DEV__) throw new Error(msg);
    // In prod, log and still create a client to avoid hard crash,
    // but requests will fail; consider handling this in UI.
    console.warn(msg);
  }

  _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
    // Optional: You can set a global schema here if you use multiple.
    // db: { schema: "public" },
  });

  return _supabase;
}

// Backwards compatible export (if your code expects `supabase` directly).
export const supabase = getSupabase();