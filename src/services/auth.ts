import { supabase } from './supabase';
import type { User, Household } from '../types';

export interface AuthResponse {
  success: boolean;
  error?: string;
}

// Sign up with email/password
export async function signUp(
  email: string,
  password: string,
  name: string
): Promise<AuthResponse> {
  try {
    console.log('Attempting signup for:', email);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    console.log('Signup response:', { data, error });

    if (error) throw error;
    if (!data.user) throw new Error('No user returned');

    return { success: true };
  } catch (error: any) {
    console.error('Signup error:', error);
    return { success: false, error: error.message };
  }
}

// Sign in with email/password
export async function signIn(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Sign out
export async function signOut(): Promise<AuthResponse> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Get current user profile
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Get user's household
export async function getUserHousehold(): Promise<Household | null> {
  try {
    const user = await getCurrentUser();
    if (!user?.household_id) return null;

    const { data, error } = await supabase
      .from('households')
      .select('*')
      .eq('id', user.household_id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting household:', error);
    return null;
  }
}

// Create a new household
export async function createHousehold(name: string): Promise<{ household: Household | null; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Create household
    const { data: household, error: householdError } = await supabase
      .from('households')
      .insert({ name, created_by: user.id })
      .select()
      .single();

    if (householdError) throw householdError;

    // Update user with household_id
    const { error: userError } = await supabase
      .from('users')
      .update({ household_id: household.id })
      .eq('id', user.id);

    if (userError) throw userError;

    return { household };
  } catch (error: any) {
    return { household: null, error: error.message };
  }
}

// Join a household by invite code
export async function joinHousehold(inviteCode: string): Promise<{ household: Household | null; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Find household by invite code
    const { data: household, error: findError } = await supabase
      .from('households')
      .select('*')
      .eq('invite_code', inviteCode.toLowerCase())
      .single();

    if (findError || !household) {
      return { household: null, error: 'Invalid invite code' };
    }

    // Update user with household_id
    const { error: userError } = await supabase
      .from('users')
      .update({ household_id: household.id })
      .eq('id', user.id);

    if (userError) throw userError;

    return { household };
  } catch (error: any) {
    return { household: null, error: error.message };
  }
}

// Listen to auth state changes
export function onAuthStateChange(callback: (user: any) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null);
  });
}
