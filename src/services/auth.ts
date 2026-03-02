/**
 * auth.ts — rewritten with explicit code audit notes embedded.
 *
 * GOAL: Fix “stuck on Signing in…” and make OAuth reliable on iOS + Android.
 *
 * KEY FINDINGS (what was breaking):
 * 1) iOS WebBrowser.openAuthSessionAsync uses ASWebAuthenticationSession.
 *    It usually CAPTURES the deep link and returns it via `result.url`,
 *    meaning Expo Router callback route often DOES NOT fire.
 *
 * 2) Your exchange was wrong for PKCE:
 *    You called `exchangeCodeForSession(code)` with only the raw `code`.
 *    In Supabase JS v2 PKCE flows, you should pass the *full callback URL*
 *    (the one containing `?code=...`) so the library can complete the PKCE exchange.
 *
 * 3) You returned `{ success: true }` immediately after exchange without ensuring
 *    the session was actually persisted/available yet. SecureStore writes can lag,
 *    causing UI/auth-guard to still see “no session” and get stuck / bounce.
 *
 * 4) Timeout wasn’t handled explicitly, so timeouts fell into the “poll” path,
 *    often leaving UI in an ambiguous loading state with generic error.
 *
 * FIX STRATEGY:
 * - Keep PKCE-only (no implicit token parsing).
 * - On iOS: exchange inside `signInWithOAuthWeb()` using `result.url`.
 * - Keep polling as a fallback and to bridge storage timing.
 * - Make errors deterministic and logs safe.
 *
 * NOTE:
 * - This file assumes `oauthState` has:
 *   - start(): marks flow started
 *   - end(): marks flow ended AND resets any exchange lock
 *   - tryExchange(): returns true only once per flow (mutex)
 *   If `oauthState.end()` does NOT reset the exchange lock, you can get “stuck forever”
 *   on future attempts. Make sure it resets.
 */

import { supabase } from "./supabase";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";
import type { User, Household } from "../types";
import { logger } from "../utils/logger";
import { oauthState } from "./oauthState";

// If you keep this here, be aware it's a module import side-effect.
// Best practice: call once in app bootstrap (App.tsx / root layout).
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
 * Single source of truth for OAuth redirect.
 * Must match:
 * - Expo scheme config (app.json/app.config)
 * - iOS URL Types
 * - Supabase Auth redirect allowlist
 *
 * IMPORTANT:
 * If you use Expo dev/preview URLs (exp://...), you may want to generate this
 * dynamically with Linking.createURL(...). Hardcoding works for production builds.
 */
const REDIRECT_URL = "memoryaisle://auth/callback";

/**
 * Password reset redirects to the same callback route, which already handles
 * type=recovery with access_token and refresh_token params.
 */
const PASSWORD_RESET_REDIRECT_URL = "memoryaisle://auth/callback";

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
  // This is a "loose" fallback.
  let cleaned = phone.trim().replace(/[^\d+]/g, "");
  if (!cleaned) return "";

  if (!cleaned.startsWith("+")) {
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
        // Non-fatal
        safeLogError("Apple name update error", updateError);
      }
    }

    return { success: true };
  } catch (err: any) {
    const msg =
      err?.code === "ERR_REQUEST_CANCELED"
        ? "Sign in was cancelled"
        : toAuthError(err, "Apple Sign-In failed");
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
 *
 * IMPORTANT PLATFORM NOTE:
 * On iOS, WebBrowser.openAuthSessionAsync() uses ASWebAuthenticationSession which
 * often captures the redirect URL and returns it in `result.url` WITHOUT forwarding
 * the deep link to your app’s URL handler. That means your Expo Router callback route
 * may NOT run. Therefore: exchange must happen here on iOS using result.url.
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

    const BROWSER_TIMEOUT_MS = 60_000;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    // Race browser session against timeout, but be careful to ALWAYS clear the timer.
    const result = await Promise.race([
      WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URL),
      new Promise<{ type: "timeout" }>((resolve) => {
        timeoutId = setTimeout(() => resolve({ type: "timeout" }), BROWSER_TIMEOUT_MS);
      }),
    ]);

    if (timeoutId) clearTimeout(timeoutId);

    // Normalize result typing
    const type = (result as any)?.type as string | undefined;

    if (type === "timeout") {
      // Explicit message prevents “mysterious stuck spinner”
      return { success: false, error: "Sign in timed out. Please try again." };
    }

    if (type === "cancel" || type === "dismiss") {
      // Some environments return "dismiss"
      return { success: false };
    }

    /**
     * CRITICAL FIX:
     * If we received a success URL from openAuthSessionAsync, exchange PKCE here.
     *
     * DO NOT pass just `code` into exchangeCodeForSession.
     * Pass the FULL callback URL containing `?code=...`.
     */
    const returnedUrl = (result as any)?.url as string | undefined;
    if (type === "success" && returnedUrl) {
      if (oauthState.tryExchange()) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(returnedUrl);

        if (exchangeError) {
          // If Android/callback already exchanged, you may see “already used”.
          // We treat that as non-fatal and fall through to poll.
          logger.error("PKCE exchange failed", { message: exchangeError.message });
        } else {
          // Don’t return immediately; wait for session to be present.
          return await pollForSession();
        }
      }
    }

    /**
     * FALLBACK:
     * If another path handled the exchange (Android deep link, router callback, etc.),
     * session may appear shortly. Poll briefly.
     */
    return await pollForSession();
  } catch (err) {
    /**
     * Even on error, a session could have been established by another path.
     * Poll first, then report error.
     */
    try {
      const maybe = await pollForSession();
      if (maybe.success) return maybe;
    } catch {
      // ignore
    }

    safeLogError("OAuth error", err);
    return { success: false, error: toAuthError(err, "OAuth sign in failed") };
  } finally {
    // MUST reset flow + exchange lock. If end() doesn't reset lock, future attempts may break.
    oauthState.end();
  }
}

/**
 * Poll for an established session with short retries.
 * This is mainly to bridge the SecureStore write timing after exchange.
 */
async function pollForSession(): Promise<AuthResponse> {
  for (let i = 0; i < 10; i++) {
    const { data } = await supabase.auth.getSession();
    if (data?.session) return { success: true };
    await new Promise((r) => setTimeout(r, 600));
  }
  return { success: false, error: "Sign in failed. Please try again." };
}

// ==================== HELPERS ====================

export async function resetPassword(email: string): Promise<AuthResponse> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: PASSWORD_RESET_REDIRECT_URL,
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
    } catch {
      // ignore
    }

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

    const { data, error } = await supabase.from("households").select("*").eq("id", resolved.household_id).single();
    if (error) throw error;
    if (!data) return null;

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
 * These should ideally be server-side (RPC) to be atomic + enforce limits with RLS.
 * The client multi-step approach is bypassable and race-prone.
 */
export async function createHousehold(
  name: string,
  size?: number
): Promise<{ household: Household | null; error?: string }> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return { household: null, error: "Not authenticated" };

    const { data: household, error: householdError } = await supabase
      .from("households")
      .insert({ name, created_by: userId, member_count: size })
      .select()
      .single();

    if (householdError) throw householdError;

    const { error: linkError } = await supabase.from("users").update({ household_id: household.id }).eq("id", userId);
    if (linkError) throw linkError;

    const { error: listError } = await supabase
      .from("grocery_lists")
      .insert({ household_id: household.id, name: "Grocery List" });

    if (listError) safeLogError("Failed to create initial grocery list", listError);

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

    const { data: sub } = await supabase.from("subscriptions").select("tier, status").eq("user_id", household.created_by).single();

    const isPremium = sub?.tier === "premium" && sub?.status === "active";
    const limit = isPremium ? 7 : 1;

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