// app/_layout.tsx
import { useEffect, useState, useRef } from 'react';
import { View, Platform, Dimensions } from 'react-native';
import { Stack, useRouter, useRootNavigationState } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { getCurrentUser, getUserHousehold } from '../src/services/auth';
import { errorTracking } from '../src/services/errorTracking';
import { logger } from '../src/utils/logger';
import { notificationService } from '../src/services/notifications';
import { geofenceService } from '../src/services/geofence';
import { iapService } from '../src/services/iap';
import { useSubscriptionStore } from '../src/stores/subscriptionStore';

SplashScreen.preventAutoHideAsync();

const SPLASH_TIMEOUT_MS = 6000; // Reduced to 6s for App Store review

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const { setUser, setHousehold, setLoading } = useAuthStore();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  const notificationsInitialized = useRef(false);
  const geofenceInitialized = useRef(false);
  const iapInitialized = useRef(false);
  const pendingNotificationRoute = useRef<string | null>(null);

  function initIAP(userId: string) {
    if (iapInitialized.current) return;
    iapInitialized.current = true;

    // iPad M-series safe delay
    const isIPad = (Platform as any).isPad || (Dimensions.get('window').width >= 768);
    const startupDelay = isIPad ? 4000 : 1500;

    setTimeout(async () => {
      try {
        await iapService.setup();
        useSubscriptionStore.getState().initialize(userId);
      } catch (e) {
        logger.error('IAP setup failed', e);
      }
    }, startupDelay);
  }

  async function initGeofencing(householdId: string) {
    if (geofenceInitialized.current) return;
    geofenceInitialized.current = true;
    try {
      await geofenceService.startMonitoring(householdId, () => {}, () => {});
    } catch (error) {
      logger.warn('Geofence init failed:', error);
    }
  }

  async function initNotifications(userId: string) {
    if (notificationsInitialized.current) return;
    notificationsInitialized.current = true;
    try {
      const token = await notificationService.initialize();
      if (token && userId) await notificationService.registerPushToken(userId);

      notificationService.addNotificationListeners(
        () => {},
        (response) => {
          const data = response.notification.request.content.data;
          if (!data?.type) return;

          let targetRoute = '';
          switch (data.type) {
            case 'list_shared': case 'item_added': case 'item_checked': targetRoute = '/(app)'; break;
            case 'meal_plan_ready': targetRoute = '/(app)/meal-plans'; break;
            case 'store_nearby': targetRoute = '/(app)'; break;
            case 'family_joined': targetRoute = '/(app)/family'; break;
            case 'mira_suggestion': targetRoute = '/(app)'; break;
          }

          if (targetRoute) {
            if (!isReady || !rootNavigationState?.key) {
              pendingNotificationRoute.current = targetRoute;
            } else {
              router.push(targetRoute as any);
            }
          }
        }
      );
    } catch (error) {
      logger.error('Notification init failed:', error);
    }
  }

  useEffect(() => {
    let splashHidden = false;
    let initAuthComplete = false;

    function finishInit() {
      if (splashHidden) return;
      splashHidden = true;
      setLoading(false);
      setIsReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }

    const timeout = setTimeout(() => finishInit(), SPLASH_TIMEOUT_MS);

    async function initAuth() {
      try {
        errorTracking.initialize().catch(() => {});
        const user = await getCurrentUser();
        setUser(user);

        if (user) {
          errorTracking.setUserId(user.id);
          const household = await getUserHousehold(user);
          setHousehold(household);

          initNotifications(user.id);
          if (household?.id) initGeofencing(household.id);
          initIAP(user.id);
        }
      } finally {
        initAuthComplete = true;
        clearTimeout(timeout);
        finishInit();
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Skip if initAuth is still running (it handles the initial session)
        if (!initAuthComplete) return;
        // Signal loading so root index waits for full user+household state
        setLoading(true);
        try {
          const user = await getCurrentUser();
          setUser(user);
          if (user) {
            const household = await getUserHousehold(user);
            setHousehold(household);
            initNotifications(user.id);
            if (household?.id) initGeofencing(household.id);
            initIAP(user.id);
          }
        } finally {
          setLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setHousehold(null);
        iapInitialized.current = false;
        notificationsInitialized.current = false;
        geofenceInitialized.current = false;
        pendingNotificationRoute.current = null;
        iapService.disconnect();
        notificationService.removeNotificationListeners();
        geofenceService.stopMonitoring();
        useSubscriptionStore.getState().cleanup();
      }
    });

    return () => {
      subscription.unsubscribe();
      iapService.disconnect();
      notificationService.removeNotificationListeners();
      geofenceService.stopMonitoring();
    };
  }, []);

  useEffect(() => {
    if (isReady && rootNavigationState?.key && pendingNotificationRoute.current) {
      router.push(pendingNotificationRoute.current as any);
      pendingNotificationRoute.current = null;
    }
  }, [isReady, rootNavigationState?.key]);

  if (!isReady) return null;

  return (
    <View style={{ flex: 1, backgroundColor: '#FDF5E6' }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}