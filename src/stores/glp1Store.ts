// GLP-1 Zustand Store — follows subscriptionStore.ts pattern
// Holds profile, cycle info, today's log, last injection, active status

import { create } from 'zustand';
import {
  getGLP1Profile,
  getLastInjection,
  getTodaysLog,
  type GLP1ProfileRow,
  type GLP1InjectionRow,
  type GLP1DailyLogRow,
} from '../services/glp1';
import {
  calculateCyclePhase,
  type CyclePhaseInfo,
  type GLP1Profile,
} from '../services/glp1Engine';
import { logger } from '../utils/logger';

interface GLP1State {
  profile: GLP1ProfileRow | null;
  cycleInfo: CyclePhaseInfo | null;
  todaysLog: GLP1DailyLogRow | null;
  lastInjection: GLP1InjectionRow | null;
  isActive: boolean;
  isLoading: boolean;

  initialize: (userId: string) => Promise<void>;
  refresh: (userId: string) => Promise<void>;
  cleanup: () => void;
}

export const useGLP1Store = create<GLP1State>((set, get) => ({
  profile: null,
  cycleInfo: null,
  todaysLog: null,
  lastInjection: null,
  isActive: false,
  isLoading: false,

  initialize: async (userId: string) => {
    set({ isLoading: true });

    try {
      const profileResult = await getGLP1Profile(userId);

      if (!profileResult.success || !profileResult.data || !profileResult.data.is_active) {
        set({
          profile: null,
          cycleInfo: null,
          todaysLog: null,
          lastInjection: null,
          isActive: false,
          isLoading: false,
        });
        return;
      }

      const profile = profileResult.data;

      // Fetch last injection and today's log in parallel
      const [injectionResult, logResult] = await Promise.all([
        getLastInjection(userId),
        getTodaysLog(userId),
      ]);

      const lastInjection = injectionResult.success ? injectionResult.data : null;
      const todaysLog = logResult.success ? logResult.data : null;

      // Calculate cycle phase
      const glp1Profile: GLP1Profile = {
        medication: profile.medication,
        dose: profile.dose,
        injection_day: profile.injection_day,
        duration: profile.duration,
        food_triggers: profile.food_triggers,
        is_active: profile.is_active,
      };

      const cycleInfo = calculateCyclePhase(
        glp1Profile,
        lastInjection ? { injection_date: lastInjection.injection_date, dose: lastInjection.dose } : null,
      );

      set({
        profile,
        cycleInfo,
        todaysLog,
        lastInjection,
        isActive: true,
        isLoading: false,
      });
    } catch (e: any) {
      logger.error('GLP1Store: initialize failed', { message: e?.message });
      set({ isLoading: false });
    }
  },

  refresh: async (userId: string) => {
    // Same as initialize but doesn't reset state to loading first
    // Prevents UI flicker on refresh
    try {
      const profileResult = await getGLP1Profile(userId);

      if (!profileResult.success || !profileResult.data || !profileResult.data.is_active) {
        set({
          profile: null,
          cycleInfo: null,
          todaysLog: null,
          lastInjection: null,
          isActive: false,
        });
        return;
      }

      const profile = profileResult.data;

      const [injectionResult, logResult] = await Promise.all([
        getLastInjection(userId),
        getTodaysLog(userId),
      ]);

      const lastInjection = injectionResult.success ? injectionResult.data : null;
      const todaysLog = logResult.success ? logResult.data : null;

      const glp1Profile: GLP1Profile = {
        medication: profile.medication,
        dose: profile.dose,
        injection_day: profile.injection_day,
        duration: profile.duration,
        food_triggers: profile.food_triggers,
        is_active: profile.is_active,
      };

      const cycleInfo = calculateCyclePhase(
        glp1Profile,
        lastInjection ? { injection_date: lastInjection.injection_date, dose: lastInjection.dose } : null,
      );

      set({
        profile,
        cycleInfo,
        todaysLog,
        lastInjection,
        isActive: true,
      });
    } catch (e: any) {
      logger.error('GLP1Store: refresh failed', { message: e?.message });
    }
  },

  cleanup: () => {
    set({
      profile: null,
      cycleInfo: null,
      todaysLog: null,
      lastInjection: null,
      isActive: false,
      isLoading: false,
    });
  },
}));
