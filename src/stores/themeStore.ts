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

  toggleTheme: async () => {
    const newIsDark = !get().isDark;
    set({
      isDark: newIsDark,
      colors: newIsDark ? COLORS_DARK : COLORS,
    });
    await SecureStore.setItemAsync('theme', newIsDark ? 'dark' : 'light');
  },

  loadTheme: async () => {
    try {
      const savedTheme = await SecureStore.getItemAsync('theme');
      const isDark = savedTheme === 'dark';
      set({
        isDark,
        colors: isDark ? COLORS_DARK : COLORS,
      });
    } catch (error) {
      logger.error('Error loading theme:', error);
    }
  },
}));
