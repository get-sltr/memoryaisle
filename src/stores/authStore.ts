import { create } from 'zustand';
import type { User, Household } from '../types';

interface AuthState {
  // User state
  user: User | null;
  household: Household | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setHousehold: (household: Household | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  household: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({
    user,
    isAuthenticated: user !== null,
  }),

  setHousehold: (household) => set({ household }),

  setLoading: (isLoading) => set({ isLoading }),

  signOut: () => set({
    user: null,
    household: null,
    isAuthenticated: false,
  }),
}));
