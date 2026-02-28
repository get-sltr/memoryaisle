import { supabase } from './supabase';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import type { User, Household } from '../types';
import { logger } from '../utils/logger';

// Complete any pending auth sessions
WebBrowser.maybeCompleteAuthSession();

export interface AuthResponse {
  success: boolean;
  error?: string;
}

// OAuth provider types
export type OAuthProvider = 'google' | 'facebook' | 'apple';

// Phone auth response types
export interface PhoneAuthResponse extends AuthResponse {
  needsVerification?: boolean;
}

// ==================== PHONE AUTH ====================

// Send OTP to phone number via Supabase (Twilio)
export async function sendPhoneOTP(phone: string): Promise<PhoneAuthResponse> {
  try {
    const formattedPhone = formatPhoneNumber(phone);
    const { error } = await supabase.auth.signInWithOtp({
      phone: formattedPhone,
    });

    if (error) throw error;
    return { success: true, needsVerification: true };
  } catch (error: any) {
    logger.error('Phone OTP error:', error);
    return { success: false, error: error.message };
  }
}

// Verify phone OTP via Supabase (Twilio)
export async function verifyPhoneOTP(phone: string, otp: string): Promise<AuthResponse> {
  try {
    const formattedPhone = formatPhoneNumber(phone);
    const { data, error } = await supabase.auth.verifyOtp({
      phone: formattedPhone,
      token: otp,
      type: 'sms',
    });

    if (error) throw error;
    if (!data.user) throw new Error('Verification failed');
    return { success: true };
  } catch (error: any) {
    logger.error('Phone verification error:', error);
    return { success: false, error: error.message };
  }
}

export async function resendPhoneOTP(phone: string): Promise<AuthResponse> {
  return sendPhoneOTP(phone);
}

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      cleaned = '+' + cleaned;
    } else if (cleaned.length === 10) {
      cleaned = '+1' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }
  return cleaned;
}

// ==================== EMAIL AUTH ====================

export async function signUp(email: string, password: string, name: string): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (error) throw error;
    if (!data.user) throw new Error('No user returned');

    await ensureUserProfile(data.user.id, email, name);
    return { success: true };
  } catch (error: any) {
    logger.error('Signup error:', error);
    return { success: false, error: error.message };
  }
}

async function ensureUserProfile(userId: string, email: string, name?: string): Promise<void> {
  try {
    const { data, error } = await supabase.rpc('create_user_profile', {
      p_user_id: userId,
      p_email: email,
      p_name: name || null,
    });
    if (error) {
      logger.error('Error creating user profile:', error);
      throw error;
    }
    logger.info('User profile result:', data);
  } catch (error) {
    logger.error('ensureUserProfile error:', error);
    throw error;
  }
}

export async function signIn(email: string, password: string): Promise<AuthResponse> {
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ==================== OAUTH AUTH ====================

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return await AppleAuthentication.isAvailableAsync();
}

export async function signInWithApple(): Promise<AuthResponse> {
  try {
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) return signInWithOAuthWeb('apple');

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) throw new Error('No identity token returned from Apple');

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });

    if (error) throw error;
    if (!data.user) throw new Error('No user returned');

    if (credential.fullName?.givenName || credential.fullName?.familyName) {
      const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
      if (name) await supabase.auth.updateUser({ data: { name } });
    }
    return { success: true };
  } catch (error: any) {
    if (error.code === 'ERR_REQUEST_CANCELED') return { success: false, error: 'Sign in was cancelled' };
    logger.error('Apple Sign-In error:', error);
    return { success: false, error: error.message };
  }
}

export async function signInWithGoogle(): Promise<AuthResponse> {
  return signInWithOAuthWeb('google');
}

export async function signInWithFacebook(): Promise<AuthResponse> {
  return signInWithOAuthWeb('facebook');
}

export async function signInWithOAuth(provider: OAuthProvider): Promise<AuthResponse> {
  if (provider === 'apple' && Platform.OS === 'ios') return signInWithApple();
  return signInWithOAuthWeb(provider);
}

async function signInWithOAuthWeb(provider: OAuthProvider): Promise<AuthResponse> {
  try {
    const redirectUrl = 'memoryaisle://auth/callback';
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
    });

    if (error) throw error;
    if (!data.url) throw new Error('No OAuth URL returned');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    if (result.type === 'success' && result.url) {
      const url = new URL(result.url);

      // PKCE flow (Supabase JS v2 default): code is in query params
      const code = new URLSearchParams(url.search).get('code');
      if (code) {
        const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
        if (sessionError) throw sessionError;
        return { success: true };
      }

      // Implicit flow fallback: tokens in hash fragment
      const hashParams = new URLSearchParams(url.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) throw sessionError;
        return { success: true };
      }

      logger.error('OAuth: No code or tokens in callback URL', result.url);
    }
    return { success: false, error: result.type === 'cancel' ? 'Sign in was cancelled' : 'Sign in failed. Please try again.' };
  } catch (error: any) {
    logger.error('OAuth error:', error);
    return { success: false, error: error.message };
  }
}

// ==================== HELPERS ====================

export async function resetPassword(email: string): Promise<AuthResponse> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'memoryaisle://auth/callback',
    });
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    logger.error('Password reset error:', error);
    return { success: false, error: error.message };
  }
}

export async function signOut(): Promise<AuthResponse> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (data) return data;

    if (error?.code === 'PGRST116') {
      await ensureUserProfile(user.id, user.email || '', user.user_metadata?.name);
      const { data: retry } = await supabase.from('users').select('*').eq('id', user.id).single();
      return retry;
    }
    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Error getting current user:', error);
    return null;
  }
}

export async function getUserHousehold(user?: User | null): Promise<Household | null> {
  try {
    const resolvedUser = user ?? await getCurrentUser();
    if (!resolvedUser?.household_id) return null;

    const { data, error } = await supabase.from('households').select('*').eq('id', resolvedUser.household_id).single();
    if (error) throw error;
    return data ? { ...data, familyProfile: data.family_profile ?? undefined } : null;
  } catch (error) {
    logger.error('Error getting household:', error);
    return null;
  }
}

export async function createHousehold(name: string, size?: number): Promise<{ household: Household | null; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: household, error: householdError } = await supabase
      .from('households')
      .insert({ name, created_by: user.id, member_count: size })
      .select().single();

    if (householdError) throw householdError;
    const { error: linkError } = await supabase.from('users').update({ household_id: household.id }).eq('id', user.id);
    if (linkError) throw linkError;
    return { household };
  } catch (error: any) {
    return { household: null, error: error.message };
  }
}

export async function joinHousehold(inviteCode: string): Promise<{ household: Household | null; error?: string; needsPremium?: boolean }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: household, error: findError } = await supabase.from('households').select('*').eq('invite_code', inviteCode.toLowerCase()).single();
    if (findError || !household) return { household: null, error: 'Invalid invite code' };

    const { data: sub } = await supabase.from('subscriptions').select('tier, status').eq('user_id', household.created_by).single();
    const isPremium = sub?.tier === 'premium' && sub?.status === 'active';
    const limit = isPremium ? 7 : 1;

    const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('household_id', household.id);
    if (count !== null && count >= limit) {
      return {
        household: null,
        error: isPremium ? 'Household at max capacity (7).' : 'Free accounts limited to 1 member.',
        needsPremium: !isPremium
      };
    }

    const { error: linkError } = await supabase.from('users').update({ household_id: household.id }).eq('id', user.id);
    if (linkError) throw linkError;
    return { household };
  } catch (error: any) {
    return { household: null, error: error.message };
  }
}

export async function linkPhoneNumber(phone: string): Promise<PhoneAuthResponse> {
  try {
    const { error } = await supabase.auth.updateUser({ phone: formatPhoneNumber(phone) });
    if (error) throw error;
    return { success: true, needsVerification: true };
  } catch (error: any) {
    logger.error('Link phone error:', error);
    return { success: false, error: error.message };
  }
}

export async function verifyPhoneForAccount(phone: string, otp: string): Promise<AuthResponse> {
  try {
    const formatted = formatPhoneNumber(phone);
    const { data, error } = await supabase.auth.verifyOtp({ phone: formatted, token: otp, type: 'phone_change' });
    if (error) throw error;

    await supabase.from('users').update({ phone: formatted, phone_verified: true, phone_verified_at: new Date().toISOString() }).eq('id', data.user!.id);
    return { success: true };
  } catch (error: any) {
    logger.error('Phone verification error:', error);
    return { success: false, error: error.message };
  }
}

export async function resendPhoneLinkOTP(phone: string): Promise<AuthResponse> {
  return linkPhoneNumber(phone);
}

export async function saveDietaryPreferences(householdId: string, dietaryPreferences: string[], culturalPreferences: string[], familyProfile: Record<string, any>): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('households').update({ dietary_preferences: dietaryPreferences, cultural_preferences: culturalPreferences, family_profile: familyProfile }).eq('id', householdId);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    logger.error('Error saving dietary preferences:', error);
    return { success: false, error: error.message };
  }
}

// 🪄 NEW GETTER RESTORED 🪄
export async function loadDietaryPreferences(householdId: string) {
  try {
    const { data, error } = await supabase
      .from('households')
      .select('dietary_preferences, cultural_preferences, family_profile')
      .eq('id', householdId)
      .single();

    if (error) {
      logger.error('Supabase error loading dietary preferences:', error);
      return { success: false, data: null, error: error.message };
    }
    return { success: true, data };
  } catch (err: any) {
    logger.error('Unexpected error loading dietary preferences:', err);
    return { success: false, data: null, error: err?.message };
  }
}

export function onAuthStateChange(callback: (user: any) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null);
  });
}