import { supabase } from './supabase';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
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
    // Format phone number (ensure it has country code)
    const formattedPhone = formatPhoneNumber(phone);

    // Use Supabase's built-in phone auth (powered by Twilio)
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

    // Use Supabase's built-in phone verification
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
  // Just call sendPhoneOTP again - it clears old codes and sends new one
  return sendPhoneOTP(phone);
}

// Format phone number to E.164 format
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // If no country code, assume US (+1)
  if (!cleaned.startsWith('+')) {
    // Remove leading 1 if present (US number without +)
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
    logger.log('Attempting signup for:', email);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    logger.log('Signup response:', { data, error });

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
    // Check if Apple Sign-In is available
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      // Fallback to web OAuth
      return signInWithOAuthWeb('apple');
    }

    // Request Apple credential
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    // Get the identity token
    if (!credential.identityToken) {
      throw new Error('No identity token returned from Apple');
    }

    // Sign in to Supabase with the Apple ID token
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
  // For now, use web OAuth for Google
  // Native Google Sign-In can be added with expo-auth-session Google provider
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
      // Use native Apple Sign-In on iOS
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
    // Use the custom scheme directly - makeRedirectUri generates localhost in dev
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

    // Open the OAuth URL in a browser
    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      redirectUrl
    );

    if (result.type === 'success' && result.url) {
      // Extract the tokens from the URL
      const url = new URL(result.url);
      const params = new URLSearchParams(url.hash.substring(1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        // Set the session with the tokens
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

      // Use RPC function to bypass RLS
      const { data: result, error: rpcError } = await supabase.rpc('create_user_profile', {
        p_user_id: user.id,
        p_email: user.email || '',
        p_name: user.user_metadata?.name || null,
      });

      if (rpcError) {
        logger.error('Failed to create user profile:', rpcError);
        return null;
      }

      // Now fetch the created profile
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
    logger.error('Error getting household:', error);
    return null;
  }
}

// Create a new household
export async function createHousehold(name: string, size?: number): Promise<{ household: Household | null; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Create household with size (member_count)
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
export async function joinHousehold(inviteCode: string): Promise<{ household: Household | null; error?: string; needsPremium?: boolean }> {
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

    // Check member limit based on household owner's subscription
    const { data: ownerSubscription } = await supabase
      .from('subscriptions')
      .select('tier, status')
      .eq('user_id', household.created_by)
      .single();

    // Determine if owner is premium
    const isPremium = ownerSubscription?.tier === 'premium' &&
      (ownerSubscription?.status === 'active' || ownerSubscription?.status === 'trialing');

    // Get member limit: 2 for free, 12 for premium
    const memberLimit = isPremium ? 12 : 2;

    // Count current members in the household
    const { count: currentMemberCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('household_id', household.id);

    // Check if household is at capacity
    if (currentMemberCount !== null && currentMemberCount >= memberLimit) {
      return {
        household: null,
        error: isPremium
          ? 'This household has reached its maximum capacity (12 members).'
          : 'This household has reached its free tier limit (2 members). The household owner needs to upgrade to Premium to add more members.',
        needsPremium: !isPremium,
      };
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

// ==================== 2-STEP AUTH: PHONE VERIFICATION ====================

// Send OTP to link phone to existing authenticated user
// Different from sendPhoneOTP which creates a new user
export async function linkPhoneNumber(phone: string): Promise<PhoneAuthResponse> {
  try {
    const formattedPhone = formatPhoneNumber(phone);

    // Update the authenticated user's phone number
    // This will trigger Supabase to send an OTP via Twilio
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

    // Verify the OTP with Supabase
    const { data, error } = await supabase.auth.verifyOtp({
      phone: formattedPhone,
      token: otp,
      type: 'phone_change',
    });

    if (error) throw error;
    if (!data.user) throw new Error('Verification failed');

    // Update the user's phone_verified status in public.users
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
      // Don't fail the verification - the phone is linked to auth.users
      // The user profile update might fail if the row doesn't exist yet
    }

    return { success: true };
  } catch (error: any) {
    logger.error('Phone verification error:', error);
    return { success: false, error: error.message };
  }
}

// Resend OTP for phone linking (uses same link function)
export async function resendPhoneLinkOTP(phone: string): Promise<AuthResponse> {
  return linkPhoneNumber(phone);
}

// Listen to auth state changes
export function onAuthStateChange(callback: (user: any) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null);
  });
}
