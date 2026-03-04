import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { router, useLocalSearchParams, useGlobalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../../../src/services/supabase";
import { logger } from "../../../src/utils/logger";
import { oauthState } from "../../../src/services/oauthState";
import { getCurrentUser, getUserHousehold } from "../../../src/services/auth";
import { useAuthStore } from "../../../src/stores/authStore";
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from "../../../src/constants/theme";

/**
 * CALLBACK SCREEN — CODE AUDIT NOTES
 *
 * ✅ Password recovery:
 *  - It's valid to accept access_token/refresh_token via deep link ONLY for `type=recovery`.
 *
 * ✅ OAuth PKCE:
 *  - Do NOT accept implicit flow tokens.
 *  - DO exchange PKCE using the FULL callback URL (not just the `code`).
 *
 * CRITICAL BUG FIXES in this rewrite:
 *  1) exchangeCodeForSession(): pass FULL URL (returnedUrl) not `code`
 *  2) safety timeout: avoid stale closure on `mode` by using a ref
 *  3) no "defer navigation and return to spinner" when oauthState.inProgress:
 *     after successful exchange, ALWAYS route away (RootIndex can handle bootstrapping)
 */

type Mode = "loading" | "recovery";

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function pollForSession(maxMs = 2500) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const { data } = await supabase.auth.getSession();
    if (data?.session) return data.session;
    await sleep(150);
  }
  return null;
}

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();
  const globalParams = useGlobalSearchParams();

  const [mode, setMode] = useState<Mode>("loading");
  const modeRef = useRef<Mode>("loading");
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Extract stable primitives (prevents effect thrash)
  const paramCode = useMemo(() => String(params.code || globalParams.code || ""), [params.code, globalParams.code]);
  const paramType = useMemo(() => String(params.type || globalParams.type || ""), [params.type, globalParams.type]);
  const paramAccessToken = useMemo(
    () => String(params.access_token || globalParams.access_token || ""),
    [params.access_token, globalParams.access_token]
  );
  const paramRefreshToken = useMemo(
    () => String(params.refresh_token || globalParams.refresh_token || ""),
    [params.refresh_token, globalParams.refresh_token]
  );

  useEffect(() => {
    let isMounted = true;

    // Safety timeout — only fire if we're STILL on loading
    const safetyTimeout = setTimeout(() => {
      if (!isMounted) return;
      if (modeRef.current === "loading") {
        logger.warn("Auth callback safety timeout — redirecting to sign-in");
        router.replace("/(auth)/sign-in");
      }
    }, 10_000);

    const handleUrl = async (url: string | null) => {
      if (!isMounted) return;

      try {
        // ---------- 1) Gather inputs ----------
        let type = paramType || null;

        // Only used for recovery
        let accessToken = paramAccessToken || null;
        let refreshToken = paramRefreshToken || null;

        // Parse from raw URL if router didn't populate them
        if (url) {
          try {
            const urlObj = new URL(url);
            const hashParams = new URLSearchParams(urlObj.hash.startsWith("#") ? urlObj.hash.slice(1) : urlObj.hash);
            const queryParams = new URLSearchParams(urlObj.search);

            type = type || hashParams.get("type") || queryParams.get("type");

            // Only relevant for recovery (implicit tokens)
            accessToken = accessToken || hashParams.get("access_token") || null;
            refreshToken = refreshToken || hashParams.get("refresh_token") || null;
          } catch (parseError) {
            logger.warn("Failed to parse deep link URL", { message: (parseError as any)?.message });
          }
        }

        // ---------- 2) Password recovery flow ----------
        if (type === "recovery" && accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            Alert.alert("Link Expired", "This password reset link has expired. Please request a new one.", [
              { text: "OK", onPress: () => router.replace("/(auth)/sign-in") },
            ]);
            return;
          }

          if (isMounted) setMode("recovery");
          return;
        }

        // ---------- 3) PKCE OAuth flow ----------
        // We need a FULL callback URL for exchangeCodeForSession().
        // Your previous code used only `code` — that can fail / be inconsistent.
        let returnedUrl: string | null = null;

        // Prefer router param code, but still build full URL
        const codeFromParams = paramCode || null;

        if (url) {
          // If we got the full URL, use it.
          returnedUrl = url;
        } else if (codeFromParams) {
          // If router only gave code, reconstruct a full URL.
          // IMPORTANT: must match your redirectTo.
          returnedUrl = `memoryaisle://auth/callback?code=${encodeURIComponent(codeFromParams)}`;
        }

        // Validate there is a code
        let code: string | null = null;
        if (returnedUrl) {
          try {
            const u = new URL(returnedUrl);
            code = new URLSearchParams(u.search).get("code");
          } catch {
            // ignore
          }
        }

        if (code && returnedUrl) {
          // Listen for auth event to detect PASSWORD_RECOVERY (PKCE password resets
          // don't include type=recovery in the URL — the event fires after code exchange).
          let isRecoveryExchange = false;
          const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event) => {
            if (event === "PASSWORD_RECOVERY") {
              isRecoveryExchange = true;
            }
          });

          // Acquire exchange lock — prevents double exchange across rerenders / races
          if (oauthState.tryExchange()) {
            const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(returnedUrl);

            if (exchangeErr) {
              // If something else already exchanged, session might still exist
              logger.error("PKCE exchange failed", { message: exchangeErr.message });
            }
          }

          // Clean up the temporary listener
          authSub.unsubscribe();

          // If this was a password recovery exchange, let _layout.tsx's
          // PASSWORD_RECOVERY handler navigate to the reset-password screen.
          if (isRecoveryExchange) {
            logger.info("PKCE recovery exchange detected — deferring to PASSWORD_RECOVERY handler");
            return;
          }

          // Wait briefly for session persistence
          const session = await pollForSession(2500);

          if (!session) {
            router.replace("/(auth)/sign-in");
            return;
          }

          /**
           * IMPORTANT NAV FIX:
           * Do NOT "return and wait" when oauthState.isInProgress().
           * This screen will just sit on the spinner.
           *
           * Let RootIndex decide where to go next; it can show loading while store bootstraps.
           */
          try {
            // Optional: warm the store to avoid brief bounce if your RootIndex uses user/household.
            // If your RootIndex is properly gated on session/hydrated, you can remove this block.
            const { setUser, setHousehold } = useAuthStore.getState();
            const appUser = await getCurrentUser();
            setUser(appUser);
            if (appUser) {
              const hh = await getUserHousehold(appUser);
              setHousehold(hh);
            }
          } catch (e) {
            logger.warn("Callback preload user/household failed", { message: (e as any)?.message });
          }

          router.replace("/");
          return;
        }

        // ---------- 4) No valid recovery tokens or PKCE code ----------
        router.replace("/(auth)/sign-in");
      } catch (err) {
        logger.error("Auth callback error", { message: (err as any)?.message });
        router.replace("/(auth)/sign-in");
      }
    };

    // Cold boot
    Linking.getInitialURL().then(handleUrl);

    // Warm boot
    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      sub.remove();
    };
  }, [paramCode, paramType, paramAccessToken, paramRefreshToken]);

  const handleResetPassword = async () => {
    setError("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      Alert.alert("Password Updated", "Your password has been reset. Please sign in with your new password.", [
        {
          text: "Sign In",
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace("/(auth)/sign-in");
          },
        },
      ]);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (mode === "loading") {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.gold.base} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardView}>
        <View style={styles.content}>
          <Text style={styles.title}>Set New Password</Text>
          <Text style={styles.subtitle}>Enter your new password below.</Text>

          <View style={styles.formCard}>
            <BlurView intensity={40} tint="light" style={styles.cardBlur} />
            <LinearGradient colors={["rgba(255, 255, 255, 0.7)", "rgba(255, 255, 255, 0.4)"]} style={styles.cardGradient} />
            <View style={styles.cardBorder} />

            <View style={styles.formContent}>
              <View style={styles.inputContainer}>
                <BlurView intensity={20} tint="light" style={styles.inputBlur} />
                <View style={styles.inputBorder} />
                <TextInput
                  style={styles.input}
                  placeholder="New password"
                  placeholderTextColor={COLORS.text.tertiary}
                  secureTextEntry
                  autoComplete="new-password"
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    setError("");
                  }}
                />
              </View>

              <View style={styles.inputContainer}>
                <BlurView intensity={20} tint="light" style={styles.inputBlur} />
                <View style={styles.inputBorder} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm password"
                  placeholderTextColor={COLORS.text.tertiary}
                  secureTextEntry
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    setError("");
                  }}
                  onSubmitEditing={handleResetPassword}
                />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Pressable
                style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed, isSubmitting && styles.buttonDisabled]}
                onPress={handleResetPassword}
                disabled={isSubmitting}
              >
                <LinearGradient colors={[COLORS.gold.base, COLORS.gold.dark]} style={styles.primaryButtonGradient} />
                <View style={styles.primaryButtonBorder} />
                {isSubmitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryButtonText}>Update Password</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.platinum.lightest },
  keyboardView: { flex: 1, width: "100%", justifyContent: "center" },
  content: { paddingHorizontal: SPACING.lg },
  title: { fontFamily: "Georgia", fontSize: 28, fontWeight: "500", color: COLORS.text.primary, textAlign: "center", marginBottom: SPACING.xs },
  subtitle: { fontSize: FONT_SIZES.md, color: COLORS.text.secondary, textAlign: "center", marginBottom: SPACING.xl },
  formCard: { borderRadius: BORDER_RADIUS.xxl, overflow: "hidden", ...SHADOWS.glassElevated },
  cardBlur: { ...StyleSheet.absoluteFillObject },
  cardGradient: { ...StyleSheet.absoluteFillObject },
  cardBorder: { ...StyleSheet.absoluteFillObject, borderRadius: BORDER_RADIUS.xxl, borderWidth: 1, borderColor: COLORS.frost.border },
  formContent: { padding: SPACING.xl },
  inputContainer: { borderRadius: BORDER_RADIUS.lg, overflow: "hidden", marginBottom: SPACING.md },
  inputBlur: { ...StyleSheet.absoluteFillObject },
  inputBorder: { ...StyleSheet.absoluteFillObject, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.frost.border },
  input: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md + 2, fontSize: FONT_SIZES.md, color: COLORS.text.primary },
  errorText: { fontSize: FONT_SIZES.sm, color: "#E53E3E", marginBottom: SPACING.sm },
  primaryButton: { borderRadius: BORDER_RADIUS.lg, paddingVertical: SPACING.md + 4, alignItems: "center", overflow: "hidden", marginTop: SPACING.sm, ...SHADOWS.goldGlow },
  primaryButtonGradient: { ...StyleSheet.absoluteFillObject },
  primaryButtonBorder: { ...StyleSheet.absoluteFillObject, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: "rgba(255, 220, 180, 0.5)" },
  primaryButtonText: { fontSize: FONT_SIZES.md, fontWeight: "600", color: COLORS.white },
  buttonPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  buttonDisabled: { opacity: 0.6 },
});