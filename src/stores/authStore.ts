import { create } from 'zustand';
import type { User, Household } from '../types';

interface AuthState {
  // User state
  user: User | null;
  household: Household | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setHousehold: (household: Household | null) => void;
  setLoading: (loading: boolean) => void;
  enterGuestMode: () => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  household: null,
  isAuthenticated: false,
  isGuest: false,
  isLoading: true,

  setUser: (user) => set({
    user,
    isAuthenticated: user !== null,
    isGuest: false,
  }),

  setHousehold: (household) => set({ household }),

  setLoading: (isLoading) => set({ isLoading }),

  enterGuestMode: () => set({
    isGuest: true,
    isAuthenticated: false,
    user: null,
    household: null,
  }),

  signOut: () => set({
    user: null,
    household: null,
    isAuthenticated: false,
    isGuest: false,
    isLoading: false,
  }),
}));
