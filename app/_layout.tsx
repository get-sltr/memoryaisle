// app/_layout.tsx
import { useEffect, useState, useRef } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { getCurrentUser, getUserHousehold } from '../src/services/auth';
import { errorTracking } from '../src/services/errorTracking';
import { notificationService } from '../src/services/notifications';
import { geofenceService } from '../src/services/geofence';
import { iapService } from '../src/services/iap';
import { useSubscriptionStore } from '../src/stores/subscriptionStore';

SplashScreen.preventAutoHideAsync();

const SPLASH_TIMEOUT_MS = 8000;

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const { setUser, setHousehold, setLoading } = useAuthStore();
  const router = useRouter();
  
  const notificationsInitialized = useRef(false);
  const geofenceInitialized = useRef(false);
  const iapInitialized = useRef(false);

  // Initialize In-App Purchases (non-blocking, delayed for iPad M3 safety)
  function initIAP(userId: string) {
    if (iapInitialized.current) return;
    iapInitialized.current = true;

    // Fixes Apple Review Guideline 2.1 (M3 iPad Crash)
    setTimeout(() => {
      iapService.setup().catch(() => {});
      useSubscriptionStore.getState().initialize(userId);
    }, 1500);
  }

  // Initialize background geofencing
  // The background task (GEOFENCE_TASK_NAME) handles all proximity
  // checks, DB queries, and push notifications automatically.
  async function initGeofencing(householdId: string) {
    if (geofenceInitialized.current) return;
    geofenceInitialized.current = true;

    try {
      await geofenceService.startMonitoring(householdId);
    } catch (error) {
      console.warn('Geofence init failed:', error);
    }
  }

  // Initialize notifications and register push token
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
          switch (data.type) {
            case 'list_shared': case 'item_added': case 'item_checked': if (data.listId) router.push(`/(app)/list/${data.listId}`); break;
            case 'meal_plan_ready': router.push('/(app)/meal-plans'); break;
            case 'store_nearby': router.push('/(app)'); break;
            case 'family_joined': router.push('/(app)/household'); break;
            case 'mira_suggestion': router.push('/(app)/mira'); break;
          }
        }
      );
    } catch {}
  }

  useEffect(() => {
    let splashHidden = false;

    function finishInit() {
      if (splashHidden) return;
      splashHidden = true;
      setLoading(false);
      setIsReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }

    const timeout = setTimeout(() => {
      finishInit();
    }, SPLASH_TIMEOUT_MS);

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
        clearTimeout(timeout);
        finishInit();
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const user = await getCurrentUser();
        setUser(user);
        if (user) {
          const household = await getUserHousehold(user);
          setHousehold(household);
          initNotifications(user.id);
          if (household?.id) initGeofencing(household.id);
          initIAP(user.id);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setHousehold(null);
        
        iapInitialized.current = false;
        notificationsInitialized.current = false;
        geofenceInitialized.current = false;
        
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

  if (!isReady) return null;

  return (
    <View style={{ flex: 1, backgroundColor: '#FDF5E6' }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}