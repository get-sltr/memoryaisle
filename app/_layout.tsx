import * as Linking from "expo-linking";
// app/_layout.tsx
import { useEffect, useRef, useState, useCallback } from "react";
import { View, Platform, Dimensions } from "react-native";
import { Stack, useRouter, useRootNavigationState } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";

import { supabase } from "../src/services/supabase";
import { useAuthStore } from "../src/stores/authStore";
import { getCurrentUser, getUserHousehold } from "../src/services/auth";
import { errorTracking } from "../src/services/errorTracking";
import { logger } from "../src/utils/logger";
import { notificationService } from "../src/services/notifications";
import { geofenceService } from "../src/services/geofence";
import { iapService } from "../src/services/iap";
import { useSubscriptionStore } from "../src/stores/subscriptionStore";

SplashScreen.preventAutoHideAsync().catch(() => {});

const SPLASH_TIMEOUT_MS = 6000;
const AUTH_SAFETY_TIMEOUT_MS = 8000;

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  const { setUser, setHousehold, setLoading } = useAuthStore();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  // Track lifecycle / state
  const isMountedRef = useRef(true);
  const isAuthedRef = useRef(false);

  // Notification routing queue
  const pendingNotificationRoute = useRef<string | null>(null);

  // Init guards + cleanup handles
  const notificationsInitialized = useRef(false);
  const geofenceInitialized = useRef(false);
  const iapInitialized = useRef(false);
  const iapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearIapTimer = () => {
    if (iapTimer.current) {
      clearTimeout(iapTimer.current);
      iapTimer.current = null;
    }
  };

  const shutdownServices = useCallback(() => {
    clearIapTimer();

    // reset flags
    iapInitialized.current = false;
    notificationsInitialized.current = false;
    geofenceInitialized.current = false;
    pendingNotificationRoute.current = null;

    // make safe to call multiple times
    try { iapService.disconnect(); } catch {}
    try { notificationService.removeNotificationListeners(); } catch {}
    try { geofenceService.stopMonitoring(); } catch {}
    try { useSubscriptionStore.getState().cleanup(); } catch {}
  }, []);

  const initIAP = useCallback((userId: string) => {
    if (iapInitialized.current) return;

    const isIPad = (Platform as any).isPad || Dimensions.get("window").width >= 768;
    const startupDelay = isIPad ? 4000 : 1500;

    // Schedule once; clear on sign-out/unmount
    clearIapTimer();
    iapTimer.current = setTimeout(async () => {
      // If signed out while waiting, don't init.
      if (!isMountedRef.current || !isAuthedRef.current) return;
      try {
        await iapService.setup();
        useSubscriptionStore.getState().initialize(userId);
        iapInitialized.current = true;
      } catch (e) {
        logger.error("IAP setup failed", { message: (e as any)?.message });
        // Allow retry later
        iapInitialized.current = false;
      }
    }, startupDelay);
  }, []);

  const initGeofencing = useCallback(async (householdId: string) => {
    if (geofenceInitialized.current) return;
    try {
      await geofenceService.startMonitoring(householdId, () => {}, () => {});
      geofenceInitialized.current = true;
    } catch (e) {
      logger.warn("Geofence init failed", { message: (e as any)?.message });
      geofenceInitialized.current = false;
    }
  }, []);

  const initNotifications = useCallback(async (userId: string) => {
    if (notificationsInitialized.current) return;

    try {
      // Always ensure we don't stack listeners
      try { notificationService.removeNotificationListeners(); } catch {}

      const token = await notificationService.initialize();
      if (token && userId) {
        await notificationService.registerPushToken(userId);
      }

      notificationService.addNotificationListeners(
        () => {},
        (response) => {
          // Only route if authenticated; otherwise ignore or route to login.
          if (!isAuthedRef.current) return;

          const data = response.notification.request.content.data as any;
          if (!data?.type) return;

          let targetRoute: string | null = null;
          switch (data.type) {
            case "list_shared":
            case "item_added":
            case "item_checked":
            case "store_nearby":
            case "mira_suggestion":
              targetRoute = "/(app)";
              break;
            case "meal_plan_ready":
              targetRoute = "/(app)/meal-plans";
              break;
            case "family_joined":
              targetRoute = "/(app)/family";
              break;
            default:
              targetRoute = null;
          }

          if (!targetRoute) return;

          if (!isReady || !rootNavigationState?.key) {
            pendingNotificationRoute.current = targetRoute;
          } else {
            router.push(targetRoute as any);
          }
        }
      );

      notificationsInitialized.current = true;
    } catch (e) {
      logger.error("Notification init failed", { message: (e as any)?.message });
      notificationsInitialized.current = false;
    }
  }, [isReady, rootNavigationState?.key, router]);

  const initServicesForUser = useCallback(async (userId: string, householdId?: string | null) => {
    // Order: errorTracking -> notifications -> geofence -> IAP
    try {
      await initNotifications(userId);
    } catch {}

    if (householdId) {
      await initGeofencing(householdId);
    }

    initIAP(userId);
  }, [initNotifications, initGeofencing, initIAP]);

  useEffect(() => {
    isMountedRef.current = true;

    let splashHidden = false;
    const hideSplashOnce = () => {
      if (splashHidden) return;
      splashHidden = true;
      SplashScreen.hideAsync().catch(() => {});
    };

    const splashTimeout = setTimeout(() => {
      if (!isMountedRef.current) return;
      setLoading(false);
      setIsReady(true);
      hideSplashOnce();
    }, SPLASH_TIMEOUT_MS);

    const bootstrap = async () => {
      setLoading(true);

      try {
        // Initialize error tracking early, but don’t block UI
        errorTracking.initialize().catch(() => {});

        const user = await getCurrentUser();
        setUser(user);

        isAuthedRef.current = !!user;

        if (user) {
          errorTracking.setUserId(user.id);

          const household = await getUserHousehold(user);
          setHousehold(household);

          await initServicesForUser(user.id, household?.id ?? null);
        } else {
          setHousehold(null);
          shutdownServices();
        }
      } catch (e) {
        logger.error("Bootstrap auth failed", { message: (e as any)?.message });
        // In case of error, still allow app to render a login screen
        setUser(null);
        setHousehold(null);
        isAuthedRef.current = false;
        shutdownServices();
      } finally {
        clearTimeout(splashTimeout);
        if (!isMountedRef.current) return;

        setLoading(false);
        setIsReady(true);
        hideSplashOnce();
      }
    };

    bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMountedRef.current) return;

      if (event === "PASSWORD_RECOVERY" && session?.user) {
        isAuthedRef.current = true;
        router.replace("/(auth)/reset-password");
        return;
      }

      if (event === "SIGNED_IN" && session?.user) {
        isAuthedRef.current = true;
        setLoading(true);

        const safety = setTimeout(() => {
          logger.warn("Auth state change safety timeout triggered");
          if (isMountedRef.current) setLoading(false);
        }, AUTH_SAFETY_TIMEOUT_MS);

        try {
          const user = await getCurrentUser();
          setUser(user);

          if (user) {
            const household = await getUserHousehold(user);
            setHousehold(household);

            await initServicesForUser(user.id, household?.id ?? null);
          }
        } catch (e) {
          logger.error("Auth SIGNED_IN handler failed", { message: (e as any)?.message });
        } finally {
          clearTimeout(safety);
          if (isMountedRef.current) setLoading(false);
        }
      }

      if (event === "SIGNED_OUT") {
        isAuthedRef.current = false;
        setUser(null);
        setHousehold(null);
        shutdownServices();
      }
    });

    return () => {
      isMountedRef.current = false;
      clearTimeout(splashTimeout);
      subscription.unsubscribe();
      shutdownServices();
    };
  }, [initServicesForUser, setHousehold, setLoading, setUser, shutdownServices]);

  useEffect(() => {
    if (isReady && rootNavigationState?.key && pendingNotificationRoute.current) {
      // Only navigate if user is authenticated
      if (isAuthedRef.current) {
        router.push(pendingNotificationRoute.current as any);
      }
      pendingNotificationRoute.current = null;
    }
  }, [isReady, rootNavigationState?.key, router]);

  
  // Deep link handler for password reset and auth callbacks
  useEffect(() => {
    const handleDeepLink = (event) => {
      const url = event.url || event;
      if (!url) return;

      try {
        const parsed = new URL(url);
        const hash = parsed.hash ? parsed.hash.substring(1) : '';
        const hashParams = new URLSearchParams(hash);
        const searchParams = new URLSearchParams(parsed.search);

        const type = hashParams.get('type') || searchParams.get('type');

        if (type === 'recovery') {
          // Supabase will fire PASSWORD_RECOVERY via onAuthStateChange
          // but we also handle it here as a fallback
          const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');

          if (accessToken) {
            supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            }).then(() => {
              router.replace("/(auth)/reset-password");
            }).catch((err) => {
              logger.error("Failed to set recovery session", { message: err?.message });
            });
          }
        }
      } catch (err) {
        logger.error("Deep link parse error", { message: (err as any)?.message });
      }
    };

    // Handle URL that opened the app
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    // Handle URLs while app is running
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, [router]);

  if (!isReady) return null;

  return (
    <View style={{ flex: 1, backgroundColor: "#FDF5E6" }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}