import { supabase } from "./supabase";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";
import type { User, Household } from "../types";
import { logger } from "../utils/logger";
import { oauthState } from "./oauthState";

// If you keep this here, be aware it's a module import side-effect.
// Alternatively call it once in your app bootstrap.
WebBrowser.maybeCompleteAuthSession();

export interface AuthResponse {
  success: boolean;
  error?: string;
}

export interface PhoneAuthResponse extends AuthResponse {
  needsVerification?: boolean;
}

export type OAuthProvider = "google" | "facebook" | "apple";

/**
 * Single source of truth for redirect URL.
 * Must match:
 * - Expo scheme config (app.json/app.config)
 * - iOS URL Types
 * - Supabase Auth redirect allowlist
 */
const REDIRECT_URL = "memoryaisle://auth/callback";

/**
 * Avoid logging raw error objects (can include PII / tokens).
 */
function toAuthError(err: unknown, fallback = "Something went wrong"): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const anyErr = err as any;
    return anyErr?.message || anyErr?.error_description || fallback;
  }
  return fallback;
}

function safeLogError(context: string, err: unknown) {
  const anyErr = err as any;
  logger.error(context, {
    message: toAuthError(err),
    code: anyErr?.code,
    status: anyErr?.status,
    name: anyErr?.name,
  });
}

// ==================== PHONE AUTH ====================

function formatPhoneNumberE164Loose(phone: string): string {
  // Best practice: use libphonenumber-js to format/validate E.164.
  // This is a "loose" fallback; consider replacing with a real formatter.
  let cleaned = phone.trim().replace(/[^\d+]/g, "");
  if (!cleaned) return "";

  if (!cleaned.startsWith("+")) {
    // Default to US if 10 digits; otherwise just prefix '+'.
    if (cleaned.length === 10) cleaned = `+1${cleaned}`;
    else cleaned = `+${cleaned}`;
  }
  return cleaned;
}

export async function sendPhoneOTP(phone: string): Promise<PhoneAuthResponse> {
  try {
    const formatted = formatPhoneNumberE164Loose(phone);
    if (!formatted) return { success: false, error: "Invalid phone number" };

    const { error } = await supabase.auth.signInWithOtp({ phone: formatted });
    if (error) throw error;

    return { success: true, needsVerification: true };
  } catch (err) {
    safeLogError("Phone OTP error", err);
    return { success: false, error: toAuthError(err, "Failed to send OTP") };
  }
}

export async function verifyPhoneOTP(phone: string, otp: string): Promise<AuthResponse> {
  try {
    const formatted = formatPhoneNumberE164Loose(phone);
    if (!formatted) return { success: false, error: "Invalid phone number" };

    const { data, error } = await supabase.auth.verifyOtp({
      phone: formatted,
      token: otp,
      type: "sms",
    });

    if (error) throw error;
    if (!data?.user) return { success: false, error: "Verification failed" };

    return { success: true };
  } catch (err) {
    safeLogError("Phone verification error", err);
    return { success: false, error: toAuthError(err, "Failed to verify OTP") };
  }
}

export async function resendPhoneOTP(phone: string): Promise<AuthResponse> {
  return sendPhoneOTP(phone);
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
    if (!data?.user?.id) return { success: false, error: "No user returned" };

    // Make sure your RPC is idempotent (insert-if-not-exists).
    await ensureUserProfile(data.user.id, email, name);
    return { success: true };
  } catch (err) {
    safeLogError("Signup error", err);
    return { success: false, error: toAuthError(err, "Failed to sign up") };
  }
}

async function ensureUserProfile(userId: string, email: string, name?: string): Promise<void> {
  const { error } = await supabase.rpc("create_user_profile", {
    p_user_id: userId,
    p_email: email,
    p_name: name || null,
  });

  if (error) {
    // If your function returns "already exists", handle it server-side or detect it here.
    throw error;
  }
}

export async function signIn(email: string, password: string): Promise<AuthResponse> {
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { success: true };
  } catch (err) {
    safeLogError("Sign in error", err);
    return { success: false, error: toAuthError(err, "Failed to sign in") };
  }
}

// ==================== OAUTH AUTH ====================

export async function isAppleSignInAvailable(): Promise<boolean> {
  return Platform.OS === "ios" && (await AppleAuthentication.isAvailableAsync());
}

export async function signInWithApple(): Promise<AuthResponse> {
  try {
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) return signInWithOAuthWeb("apple");

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return { success: false, error: "Apple Sign-In failed (no token)." };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
    });

    if (error) throw error;
    if (!data?.user) return { success: false, error: "No user returned" };

    // Apple fullName/email may only be provided on first authorization
    const given = credential.fullName?.givenName;
    const family = credential.fullName?.familyName;
    const fullName = [given, family].filter(Boolean).join(" ").trim();

    if (fullName) {
      const { error: updateError } = await supabase.auth.updateUser({ data: { name: fullName } });
      if (updateError) {
        // Non-fatal: don't block login
        safeLogError("Apple name update error", updateError);
      }
    }

    return { success: true };
  } catch (err: any) {
    // Expo AppleAuth cancellation codes can vary by version; keep it user-friendly.
    const msg = err?.code === "ERR_REQUEST_CANCELED" ? "Sign in was cancelled" : toAuthError(err, "Apple Sign-In failed");
    if (msg !== "Sign in was cancelled") safeLogError("Apple Sign-In error", err);
    return { success: false, error: msg };
  }
}

export async function signInWithGoogle(): Promise<AuthResponse> {
  return signInWithOAuthWeb("google");
}

export async function signInWithFacebook(): Promise<AuthResponse> {
  return signInWithOAuthWeb("facebook");
}

export async function signInWithOAuth(provider: OAuthProvider): Promise<AuthResponse> {
  if (provider === "apple" && Platform.OS === "ios") return signInWithApple();
  return signInWithOAuthWeb(provider);
}

/**
 * PKCE-only OAuth web flow.
 * - Avoid implicit flow token parsing (more fragile).
 * - Requires Supabase to be configured for PKCE (default in supabase-js v2).
 */
async function signInWithOAuthWeb(provider: OAuthProvider): Promise<AuthResponse> {
  oauthState.start();
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: REDIRECT_URL,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;
    if (!data?.url) return { success: false, error: "No OAuth URL returned" };

    // Race the browser session against a safety timeout.
    // 60s allows for 2FA / slow typing but doesn't hang forever.
    const BROWSER_TIMEOUT_MS = 60_000;
    let timeoutId: ReturnType<typeof setTimeout>;
    const result = await Promise.race([
      WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URL),
      new Promise<{ type: "timeout" }>((resolve) => {
        timeoutId = setTimeout(() => resolve({ type: "timeout" }), BROWSER_TIMEOUT_MS);
      }),
    ]);
    clearTimeout(timeoutId!);

    if (result.type === "cancel") return { success: false };

    // On iOS, ASWebAuthenticationSession captures the redirect URL exclusively —
    // it does NOT forward the deep link to Expo Router, so callback.tsx never fires.
    // Extract the code from the result URL and exchange it here.
    if (result.type === "success" && (result as any).url) {
      try {
        const returnUrl = new URL((result as any).url);
        const code = returnUrl.searchParams.get("code");
        if (code && oauthState.tryExchange()) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (!exchangeError) {
            return { success: true };
          }
          logger.error("PKCE exchange failed", { message: exchangeError.message });
        }
      } catch (parseErr) {
        logger.warn("Failed to parse OAuth return URL");
      }
    }

    // Fallback: poll in case callback.tsx handled it (e.g. Android)
    return await pollForSession();
  } catch (err) {
    // Even on error, a session may have been established via callback.tsx
    try {
      return await pollForSession();
    } catch {}
    safeLogError("OAuth error", err);
    return { success: false, error: toAuthError(err, "OAuth sign in failed") };
  } finally {
    oauthState.end();
  }
}

/**
 * Poll for an established session with short retries.
 * callback.tsx is the single exchanger; this waits for the session
 * to appear in SecureStore after exchange completes.
 */
async function pollForSession(): Promise<AuthResponse> {
  for (let i = 0; i < 10; i++) {
    const { data: session } = await supabase.auth.getSession();
    if (session?.session) return { success: true };
    await new Promise((r) => setTimeout(r, 600));
  }
  return { success: false, error: "Sign in failed. Please try again." };
}

// ==================== HELPERS ====================

export async function resetPassword(email: string): Promise<AuthResponse> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: REDIRECT_URL,
    });
    if (error) throw error;
    return { success: true };
  } catch (err) {
    safeLogError("Password reset error", err);
    return { success: false, error: toAuthError(err, "Failed to send reset email") };
  }
}

export async function signOut(): Promise<AuthResponse> {
  try {
    // Best effort: close any auth browser
    try {
      await WebBrowser.dismissBrowser();
    } catch {}

    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    return { success: true };
  } catch (err) {
    safeLogError("Sign out error", err);
    return { success: false, error: toAuthError(err, "Failed to sign out") };
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr) throw authErr;

    const authUser = authData?.user;
    if (!authUser?.id) return null;

    const { data, error } = await supabase.from("users").select("*").eq("id", authUser.id).single();

    if (data) return data as User;

    // If not found, try creating profile once (idempotent RPC recommended)
    if (error?.code === "PGRST116") {
      await ensureUserProfile(authUser.id, authUser.email || "", authUser.user_metadata?.name);
      const { data: retry } = await supabase.from("users").select("*").eq("id", authUser.id).single();
      return (retry as User) ?? null;
    }

    if (error) throw error;
    return null;
  } catch (err) {
    safeLogError("Error getting current user", err);
    return null;
  }
}

export async function getUserHousehold(user?: User | null): Promise<Household | null> {
  try {
    const resolved = user ?? (await getCurrentUser());
    if (!resolved?.household_id) return null;

    const { data, error } = await supabase
      .from("households")
      .select("*")
      .eq("id", resolved.household_id)
      .single();

    if (error) throw error;
    if (!data) return null;

    // Fetch actual family members
    const { data: members } = await supabase
      .from("family_members")
      .select("id, name, role, allergies, dietary_preferences")
      .eq("household_id", data.id);

    return {
      ...(data as any),
      members: members || [],
      familyProfile: (data as any).family_profile ?? undefined,
    } as Household;
  } catch (err) {
    safeLogError("Error getting household", err);
    return null;
  }
}

/**
 * SECURITY NOTE:
 * These two should be server-side (RPC) to be atomic + enforce limits with RLS.
 * The client multi-step approach is bypassable and race-prone.
 */

export async function createHousehold(
  name: string,
  size?: number
): Promise<{ household: Household | null; error?: string }> {
  try {
    // Prefer: supabase.rpc("create_household_and_link_user", { ... })
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return { household: null, error: "Not authenticated" };

    const { data: household, error: householdError } = await supabase
      .from("households")
      .insert({ name, created_by: userId, member_count: size })
      .select()
      .single();

    if (householdError) throw householdError;

    // Link user to household
    const { error: linkError } = await supabase
      .from("users")
      .update({ household_id: household.id })
      .eq("id", userId);
    if (linkError) throw linkError;

    // Create initial grocery list (previously in DB trigger, now here)
    const { error: listError } = await supabase
      .from("grocery_lists")
      .insert({ household_id: household.id, name: "Grocery List" });
    if (listError) {
      safeLogError("Failed to create initial grocery list", listError);
      // Non-fatal — household still usable
    }

    return {
      household: {
        ...(household as any),
        members: [],
        familyProfile: (household as any).family_profile ?? undefined,
      } as Household,
    };
  } catch (err) {
    safeLogError("Create household error", err);
    return { household: null, error: toAuthError(err, "Failed to create household") };
  }
}

export async function joinHousehold(
  inviteCode: string
): Promise<{ household: Household | null; error?: string; needsPremium?: boolean }> {
  try {
    // Prefer: supabase.rpc("join_household_by_invite", { p_invite_code })
    // which checks capacity + joins atomically.
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return { household: null, error: "Not authenticated" };

    const code = inviteCode.trim().toLowerCase();
    if (!code) return { household: null, error: "Invalid invite code" };

    const { data: household, error: findError } = await supabase
      .from("households")
      .select("*")
      .eq("invite_code", code)
      .single();

    if (findError || !household) return { household: null, error: "Invalid invite code" };

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("tier, status")
      .eq("user_id", household.created_by)
      .single();

    const isPremium = sub?.tier === "premium" && sub?.status === "active";
    const limit = isPremium ? 7 : 1;

    // Race-prone, client enforced:
    const { count, error: countErr } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("household_id", household.id);

    if (countErr) throw countErr;

    if (count !== null && count >= limit) {
      return {
        household: null,
        error: isPremium ? "Household at max capacity (7)." : "Free accounts limited to 1 member.",
        needsPremium: !isPremium,
      };
    }

    const { error: linkError } = await supabase.from("users").update({ household_id: household.id }).eq("id", userId);
    if (linkError) throw linkError;

    // Fetch existing family members so the store is properly initialized
    const { data: members } = await supabase
      .from("family_members")
      .select("id, name, role, allergies, dietary_preferences")
      .eq("household_id", household.id);

    return {
      household: {
        ...(household as any),
        members: members || [],
        familyProfile: (household as any).family_profile ?? undefined,
      } as Household,
    };
  } catch (err) {
    safeLogError("Join household error", err);
    return { household: null, error: toAuthError(err, "Failed to join household") };
  }
}

export async function linkPhoneNumber(phone: string): Promise<PhoneAuthResponse> {
  try {
    const formatted = formatPhoneNumberE164Loose(phone);
    if (!formatted) return { success: false, error: "Invalid phone number" };

    const { error } = await supabase.auth.updateUser({ phone: formatted });
    if (error) throw error;

    return { success: true, needsVerification: true };
  } catch (err) {
    safeLogError("Link phone error", err);
    return { success: false, error: toAuthError(err, "Failed to link phone") };
  }
}

export async function verifyPhoneForAccount(phone: string, otp: string): Promise<AuthResponse> {
  try {
    const formatted = formatPhoneNumberE164Loose(phone);
    if (!formatted) return { success: false, error: "Invalid phone number" };

    const { data, error } = await supabase.auth.verifyOtp({
      phone: formatted,
      token: otp,
      type: "phone_change",
    });

    if (error) throw error;
    const userId = data?.user?.id;
    if (!userId) return { success: false, error: "Verification failed" };

    // Make sure RLS only allows user to update their own row.
    const { error: updateErr } = await supabase
      .from("users")
      .update({ phone: formatted, phone_verified: true, phone_verified_at: new Date().toISOString() })
      .eq("id", userId);

    if (updateErr) throw updateErr;

    return { success: true };
  } catch (err) {
    safeLogError("Phone verification error", err);
    return { success: false, error: toAuthError(err, "Failed to verify phone") };
  }
}

export async function resendPhoneLinkOTP(phone: string): Promise<AuthResponse> {
  return linkPhoneNumber(phone);
}

export async function saveDietaryPreferences(
  householdId: string,
  dietaryPreferences: string[],
  culturalPreferences: string[],
  familyProfile: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Security: Ensure RLS only allows household members to update this row.
    const { error } = await supabase
      .from("households")
      .update({
        dietary_preferences: dietaryPreferences,
        cultural_preferences: culturalPreferences,
        family_profile: familyProfile,
      })
      .eq("id", householdId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    safeLogError("Error saving dietary preferences", err);
    return { success: false, error: toAuthError(err, "Failed to save preferences") };
  }
}

export async function loadDietaryPreferences(householdId: string) {
  try {
    const { data, error } = await supabase
      .from("households")
      .select("dietary_preferences, cultural_preferences, family_profile")
      .eq("id", householdId)
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    safeLogError("Error loading dietary preferences", err);
    return { success: false, data: null, error: toAuthError(err, "Failed to load preferences") };
  }
}

export function onAuthStateChange(callback: (user: any) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}