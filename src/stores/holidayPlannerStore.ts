import { create } from 'zustand';
import { holidayPlannerService, type HolidayPlan } from '../services/holidayPlanner';
import { logger } from '../utils/logger';

interface HolidayPlannerState {
  plans: HolidayPlan[];
  upcomingPlans: HolidayPlan[];
  isLoading: boolean;
  requestSeq: number;

  initialize: (householdId: string) => Promise<void>;
  refresh: (householdId: string) => Promise<void>;
  addPlan: (plan: HolidayPlan) => void;
  removePlan: (planId: string) => void;
  updatePlan: (planId: string, updates: Partial<HolidayPlan>) => void;
  cleanup: () => void;
}

export const useHolidayPlannerStore = create<HolidayPlannerState>((set, get) => ({
  plans: [],
  upcomingPlans: [],
  isLoading: false,
  requestSeq: 0,

  initialize: async (householdId: string) => {
    const seq = get().requestSeq + 1;
    set({ isLoading: true, requestSeq: seq });

    try {
      const [all, upcoming] = await Promise.all([
        holidayPlannerService.getPlans(householdId),
        holidayPlannerService.getPlans(householdId, { upcoming: true }),
      ]);

      if (get().requestSeq !== seq) return;

      set({
        plans: all,
        upcomingPlans: upcoming,
        isLoading: false,
      });
    } catch (error) {
      logger.error('Error initializing holiday planner:', error);
      if (get().requestSeq === seq) {
        set({ isLoading: false });
      }
    }
  },

  refresh: async (householdId: string) => {
    try {
      const [all, upcoming] = await Promise.all([
        holidayPlannerService.getPlans(householdId),
        holidayPlannerService.getPlans(householdId, { upcoming: true }),
      ]);
      set({ plans: all, upcomingPlans: upcoming });
    } catch (error) {
      logger.error('Error refreshing holiday planner:', error);
    }
  },

  addPlan: (plan: HolidayPlan) => {
    set((state) => ({
      plans: [plan, ...state.plans],
      upcomingPlans: new Date(plan.holiday_date) >= new Date()
        ? [plan, ...state.upcomingPlans].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date))
        : state.upcomingPlans,
    }));
  },

  removePlan: (planId: string) => {
    set((state) => ({
      plans: state.plans.filter((p) => p.id !== planId),
      upcomingPlans: state.upcomingPlans.filter((p) => p.id !== planId),
    }));
  },

  updatePlan: (planId: string, updates: Partial<HolidayPlan>) => {
    set((state) => ({
      plans: state.plans.map((p) => p.id === planId ? { ...p, ...updates } : p),
      upcomingPlans: state.upcomingPlans.map((p) => p.id === planId ? { ...p, ...updates } : p),
    }));
  },

  cleanup: () => {
    set({
      plans: [],
      upcomingPlans: [],
      isLoading: false,
    });
  },
}));
