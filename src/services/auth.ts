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
export async function verifyPhoneOTP(
  phone: string,
  otp: string
): Promise<AuthResponse> {
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

// Resend phone OTP (uses same send function)
export async function resendPhoneOTP(phone: string): Promise<AuthResponse> {
  return sendPhoneOTP(phone);
}

// Format phone number to E.164 format
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

// Sign up with email/password
export async function signUp(
  email: string,
  password: string,
  name: string
): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (error) throw error;
    if (!data.user) throw new Error('No user returned');

    // Create user profile (trigger may not work in Supabase)
    await ensureUserProfile(data.user.id, email, name);

    return { success: true };
  } catch (error: any) {
    logger.error('Signup error:', error);
    return { success: false, error: error.message };
  }
}

// Ensure user profile exists (creates if missing)
// Uses database function with SECURITY DEFINER to bypass RLS
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

    logger.log('User profile result:', data);
  } catch (error) {
    logger.error('ensureUserProfile error:', error);
    throw error;
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

// Check if native Apple Sign-In is available
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return await AppleAuthentication.isAvailableAsync();
}

// Native Apple Sign-In (iOS only)
export async function signInWithApple(): Promise<AuthResponse> {
  try {
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      return signInWithOAuthWeb('apple');
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('No identity token returned from Apple');
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });

    if (error) throw error;
    if (!data.user) throw new Error('No user returned');

    // Update user metadata with Apple-provided name if available
    if (credential.fullName?.givenName || credential.fullName?.familyName) {
      const name = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ');

      if (name) {
        await supabase.auth.updateUser({
          data: { name },
        });
      }
    }

    return { success: true };
  } catch (error: any) {
    if (error.code === 'ERR_REQUEST_CANCELED') {
      return { success: false, error: 'Sign in was cancelled' };
    }
    logger.error('Apple Sign-In error:', error);
    return { success: false, error: error.message };
  }
}

// Sign in with Google using native Google Sign-In or web fallback
export async function signInWithGoogle(): Promise<AuthResponse> {
  return signInWithOAuthWeb('google');
}

// Sign in with Facebook using web OAuth
export async function signInWithFacebook(): Promise<AuthResponse> {
  return signInWithOAuthWeb('facebook');
}

// Generic OAuth sign in (unified entry point)
export async function signInWithOAuth(provider: OAuthProvider): Promise<AuthResponse> {
  switch (provider) {
    case 'apple':
      if (Platform.OS === 'ios') {
        return signInWithApple();
      }
      return signInWithOAuthWeb('apple');
    case 'google':
      return signInWithGoogle();
    case 'facebook':
      return signInWithFacebook();
    default:
      return signInWithOAuthWeb(provider);
  }
}

// Web-based OAuth sign in (fallback for all providers)
async function signInWithOAuthWeb(provider: OAuthProvider): Promise<AuthResponse> {
  try {
    const redirectUrl = 'memoryaisle://auth/callback';

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;
    if (!data.url) throw new Error('No OAuth URL returned');

    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      redirectUrl
    );

    if (result.type === 'success' && result.url) {
      const url = new URL(result.url);
      const params = new URLSearchParams(url.hash.substring(1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) throw sessionError;
        return { success: true };
      }
    }

    if (result.type === 'cancel') {
      return { success: false, error: 'Sign in was cancelled' };
    }

    return { success: false, error: 'OAuth sign in failed' };
  } catch (error: any) {
    logger.error('OAuth error:', error);
    return { success: false, error: error.message };
  }
}

// Reset password via email
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

// Get current user profile (auto-creates if missing)
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Try to get existing profile
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    // If profile exists, return it
    if (data) return data;

    // If no profile, create one (handles case where trigger failed)
    if (error?.code === 'PGRST116') {
      logger.log('User profile missing, creating...');

      const { data: result, error: rpcError } = await supabase.rpc('create_user_profile', {
        p_user_id: user.id,
        p_email: user.email || '',
        p_name: user.user_metadata?.name || null,
      });

      if (rpcError) {
        logger.error('Failed to create user profile:', rpcError);
        return null;
      }

      // Fetch the created profile
      const { data: newProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      return newProfile;
    }

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Error getting current user:', error);
    return null;
  }
}

// Get user's household
// Accepts an optional user to avoid a redundant getCurrentUser call.
// If no user is passed, it fetches the current user internally.
export async function getUserHousehold(user?: User | null): Promise<Household | null> {
  try {
    const resolvedUser = user ?? await getCurrentUser();
    if (!resolvedUser?.household_id) return null;

    const { data, error } = await supabase
      .from('households')
      .select('*')
      .eq('id', resolvedUser.household_id)
      .single();

    if (error) throw error;
    if (!data) return null;

    return {
      ...data,
      familyProfile: data.family_profile ?? undefined,
    };
  } catch (error) {
    logger.error('Error getting household:', error);
    return null;
  }
}

// Create a new household
export async function createHousehold(name: string, size?: number): Promise<{ household: Household | null; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const householdData: { name: string; created_by: string; member_count?: number } = {
      name,
      created_by: user.id,
    };
    if (size) {
      householdData.member_count = size;
    }

    const { data: household, error: householdError } = await supabase
      .from('households')
      .insert(householdData)
      .select()
      .single();

    if (householdError) throw householdError;

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
export async function joinHousehold(inviteCode: string): Promise<{ household: Household | null; error?: string; needsPremium?: boolean }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: household, error: findError } = await supabase
      .from('households')
      .select('*')
      .eq('invite_code', inviteCode.toLowerCase())
      .single();

    if (findError || !household) {
      return { household: null, error: 'Invalid invite code' };
    }

    // Check member limit based on household owner's subscription
    const { data: ownerSubscription } = await supabase
      .from('subscriptions')
      .select('tier, status')
      .eq('user_id', household.created_by)
      .single();

    const isPremium = ownerSubscription?.tier === 'premium' &&
      ownerSubscription?.status === 'active';

    const memberLimit = isPremium ? 7 : 1;

    const { count: currentMemberCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('household_id', household.id);

    if (currentMemberCount !== null && currentMemberCount >= memberLimit) {
      return {
        household: null,
        error: isPremium
          ? 'This household has reached its maximum capacity (7 members).'
          : 'Free accounts are limited to 1 member. Upgrade to Premium to add up to 7 family members.',
        needsPremium: !isPremium,
      };
    }

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

// ==================== 2-STEP AUTH: PHONE VERIFICATION ====================

// Send OTP to link phone to existing authenticated user
export async function linkPhoneNumber(phone: string): Promise<PhoneAuthResponse> {
  try {
    const formattedPhone = formatPhoneNumber(phone);

    const { error } = await supabase.auth.updateUser({
      phone: formattedPhone,
    });

    if (error) throw error;

    return { success: true, needsVerification: true };
  } catch (error: any) {
    logger.error('Link phone error:', error);
    return { success: false, error: error.message };
  }
}

// Verify OTP and mark phone as verified in user profile
export async function verifyPhoneForAccount(
  phone: string,
  otp: string
): Promise<AuthResponse> {
  try {
    const formattedPhone = formatPhoneNumber(phone);

    const { data, error } = await supabase.auth.verifyOtp({
      phone: formattedPhone,
      token: otp,
      type: 'phone_change',
    });

    if (error) throw error;
    if (!data.user) throw new Error('Verification failed');

    const { error: updateError } = await supabase
      .from('users')
      .update({
        phone: formattedPhone,
        phone_verified: true,
        phone_verified_at: new Date().toISOString(),
      })
      .eq('id', data.user.id);

    if (updateError) {
      logger.error('Failed to update phone_verified:', updateError);
    }

    return { success: true };
  } catch (error: any) {
    logger.error('Phone verification error:', error);
    return { success: false, error: error.message };
  }
}

// Resend OTP for phone linking
export async function resendPhoneLinkOTP(phone: string): Promise<AuthResponse> {
  return linkPhoneNumber(phone);
}

// Save dietary preferences for a household
export async function saveDietaryPreferences(
  householdId: string,
  dietaryPreferences: string[],
  culturalPreferences: string[],
  familyProfile: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('households')
      .update({
        dietary_preferences: dietaryPreferences,
        cultural_preferences: culturalPreferences,
        family_profile: familyProfile,
      })
      .eq('id', householdId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    logger.error('Error saving dietary preferences:', error);
    return { success: false, error: error.message };
  }
}

// Load dietary preferences for a household
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

// Listen to auth state changes
export function onAuthStateChange(callback: (user: any) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null);
  });
}