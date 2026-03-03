// GLP-1 Data Service — CRUD for profiles, injections, daily logs
// Follows existing service patterns: supabase calls, { success, error } returns

import { supabase } from './supabase';
import { logger } from '../utils/logger';
import type { GLP1Medication, Duration } from './glp1Engine';

// ─── Types ─────────────────────────────────────────────────────

export interface GLP1ProfileRow {
  id: string;
  user_id: string;
  medication: GLP1Medication;
  dose: string | null;
  injection_day: number | null;
  duration: Duration;
  food_triggers: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GLP1InjectionRow {
  id: string;
  user_id: string;
  injection_date: string;
  dose: string | null;
  injection_site: string | null;
  side_effects: string[];
  appetite_level: number | null;
  notes: string | null;
  created_at: string;
}

export interface GLP1DailyLogRow {
  id: string;
  user_id: string;
  log_date: string;
  appetite: number | null;
  nausea: number | null;
  energy: number | null;
  protein_servings: number;
  water_glasses: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

type Result<T> = { success: true; data: T } | { success: false; error: string };

// ─── Profile ───────────────────────────────────────────────────

export async function getGLP1Profile(userId: string): Promise<Result<GLP1ProfileRow | null>> {
  try {
    const { data, error } = await supabase
      .from('glp1_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return { success: true, data };
  } catch (e: any) {
    logger.error('GLP1: getProfile failed', { message: e?.message });
    return { success: false, error: e?.message || 'Failed to get profile' };
  }
}

export async function saveGLP1Profile(
  userId: string,
  profile: {
    medication: GLP1Medication;
    dose?: string | null;
    injection_day?: number | null;
    duration: Duration;
    food_triggers?: string[];
  },
): Promise<Result<GLP1ProfileRow>> {
  try {
    const { data, error } = await supabase
      .from('glp1_profiles')
      .upsert(
        {
          user_id: userId,
          medication: profile.medication,
          dose: profile.dose ?? null,
          injection_day: profile.injection_day ?? null,
          duration: profile.duration,
          food_triggers: profile.food_triggers ?? [],
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (e: any) {
    logger.error('GLP1: saveProfile failed', { message: e?.message });
    return { success: false, error: e?.message || 'Failed to save profile' };
  }
}

export async function deactivateGLP1Profile(userId: string): Promise<Result<null>> {
  try {
    const { error } = await supabase
      .from('glp1_profiles')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true, data: null };
  } catch (e: any) {
    logger.error('GLP1: deactivate failed', { message: e?.message });
    return { success: false, error: e?.message || 'Failed to deactivate' };
  }
}

// ─── Injections ────────────────────────────────────────────────

export async function logInjection(
  userId: string,
  injection: {
    injection_date?: string;
    dose?: string | null;
    injection_site?: string | null;
    side_effects?: string[];
    appetite_level?: number | null;
    notes?: string | null;
  },
): Promise<Result<GLP1InjectionRow>> {
  try {
    const { data, error } = await supabase
      .from('glp1_injection_log')
      .insert({
        user_id: userId,
        injection_date: injection.injection_date || new Date().toISOString(),
        dose: injection.dose ?? null,
        injection_site: injection.injection_site ?? null,
        side_effects: injection.side_effects ?? [],
        appetite_level: injection.appetite_level ?? null,
        notes: injection.notes ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (e: any) {
    logger.error('GLP1: logInjection failed', { message: e?.message });
    return { success: false, error: e?.message || 'Failed to log injection' };
  }
}

export async function getRecentInjections(
  userId: string,
  limit = 10,
): Promise<Result<GLP1InjectionRow[]>> {
  try {
    const { data, error } = await supabase
      .from('glp1_injection_log')
      .select('*')
      .eq('user_id', userId)
      .order('injection_date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (e: any) {
    logger.error('GLP1: getRecentInjections failed', { message: e?.message });
    return { success: false, error: e?.message || 'Failed to get injections' };
  }
}

export async function getLastInjection(userId: string): Promise<Result<GLP1InjectionRow | null>> {
  try {
    const { data, error } = await supabase
      .from('glp1_injection_log')
      .select('*')
      .eq('user_id', userId)
      .order('injection_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return { success: true, data };
  } catch (e: any) {
    logger.error('GLP1: getLastInjection failed', { message: e?.message });
    return { success: false, error: e?.message || 'Failed to get last injection' };
  }
}

// ─── Daily Logs ────────────────────────────────────────────────

export async function logDailyCheckin(
  userId: string,
  checkin: {
    log_date?: string;
    appetite?: number | null;
    nausea?: number | null;
    energy?: number | null;
    protein_servings?: number;
    water_glasses?: number;
    notes?: string | null;
  },
): Promise<Result<GLP1DailyLogRow>> {
  try {
    const logDate = checkin.log_date || new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('glp1_daily_logs')
      .upsert(
        {
          user_id: userId,
          log_date: logDate,
          appetite: checkin.appetite ?? null,
          nausea: checkin.nausea ?? null,
          energy: checkin.energy ?? null,
          protein_servings: checkin.protein_servings ?? 0,
          water_glasses: checkin.water_glasses ?? 0,
          notes: checkin.notes ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,log_date' },
      )
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (e: any) {
    logger.error('GLP1: logDailyCheckin failed', { message: e?.message });
    return { success: false, error: e?.message || 'Failed to log check-in' };
  }
}

export async function getTodaysLog(userId: string): Promise<Result<GLP1DailyLogRow | null>> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('glp1_daily_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('log_date', today)
      .maybeSingle();

    if (error) throw error;
    return { success: true, data };
  } catch (e: any) {
    logger.error('GLP1: getTodaysLog failed', { message: e?.message });
    return { success: false, error: e?.message || 'Failed to get today\'s log' };
  }
}

export async function getWeeklyLogs(userId: string): Promise<Result<GLP1DailyLogRow[]>> {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const startDate = weekAgo.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('glp1_daily_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('log_date', startDate)
      .order('log_date', { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (e: any) {
    logger.error('GLP1: getWeeklyLogs failed', { message: e?.message });
    return { success: false, error: e?.message || 'Failed to get weekly logs' };
  }
}
