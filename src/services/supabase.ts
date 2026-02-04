import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import 'react-native-url-polyfill/auto';

// Load configuration from environment variables via expo-constants
const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || '';
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey || '';

// Simple SecureStore adapter for Supabase auth session persistence.
// SecureStore uses iOS Keychain / Android Keystore (hardware-backed encryption).
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Validate configuration on startup
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[MemoryAisle] Supabase not configured. ' +
    'Create a .env file with SUPABASE_URL and SUPABASE_ANON_KEY. ' +
    'See .env.example for details.'
  );
}

// Helper to check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL.includes('supabase.co'));
};
