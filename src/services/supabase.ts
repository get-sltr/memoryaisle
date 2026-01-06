import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import 'react-native-url-polyfill/auto';

// TODO: Move to environment variables
const SUPABASE_URL = 'https://eponitwsgjjgrdbmgwyr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwb25pdHdzZ2pqZ3JkYm1nd3lyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2NTU4ODIsImV4cCI6MjA4MzIzMTg4Mn0.xTrw44O7gua7mnLhDMmm3TtrmJonN5eysI1FwG6W09M';

// Custom storage adapter for React Native using SecureStore
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    return await SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Helper to check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return SUPABASE_URL.includes('supabase.co') && SUPABASE_ANON_KEY.length > 10;
};
