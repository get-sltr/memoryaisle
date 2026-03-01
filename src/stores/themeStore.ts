import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { COLORS, COLORS_DARK, ThemeColors } from '../constants/theme';
import { logger } from '../utils/logger';

interface ThemeState {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: false,
  colors: COLORS,

  toggleTheme: () => {
    // Dark mode disabled — light mode only for now
  },

  loadTheme: async () => {
    // Force light mode; clear any saved dark preference
    try {
      await SecureStore.deleteItemAsync('theme');
    } catch {}
    set({ isDark: false, colors: COLORS });
  },
}));
