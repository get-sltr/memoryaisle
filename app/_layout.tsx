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

SplashScreen.preventAutoHideAsync();

// Safety timeout: force-hide splash after 8 seconds no matter what
const SPLASH_TIMEOUT_MS = 8000;

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const { setUser, setHousehold, setLoading } = useAuthStore();
  const router = useRouter();
  const notificationsInitialized = useRef(false);
  const geofenceInitialized = useRef(false);

  // Initialize geofencing with notification callbacks
  async function initGeofencing(householdId: string) {
    if (geofenceInitialized.current) return;
    geofenceInitialized.current = true;

    try {
      // Count items in lists for this household to include in notification
      const getListItemCount = async (storeName: string): Promise<number> => {
        try {
          const { data, error } = await supabase
            .from('grocery_lists')
            .select('id, list_items(count)')
            .eq('household_id', householdId)
            .ilike('store_name', `%${storeName}%`)
            .eq('list_items.checked', false);

          if (error || !data) return 0;
          return data.reduce((sum, list) => {
            const itemCount = (list.list_items as any)?.[0]?.count || 0;
            return sum + itemCount;
          }, 0);
        } catch {
          return 0;
        }
      };

      await geofenceService.startMonitoring(
        householdId,
        // On arrival at store
        async (store) => {
          const itemCount = await getListItemCount(store.name);
          if (itemCount > 0) {
            await notificationService.notifyStoreNearby(store.name, itemCount);
          }
        },
        // On departure from store (optional)
        (store) => {
          console.log(`Left ${store.name}`);
        }
      );
      console.log('Geofence monitoring started');
    } catch (error) {
      console.warn('Geofence init failed:', error);
    }
  }

  // Initialize notifications and register push token
  async function initNotifications(userId: string) {
    if (notificationsInitialized.current) return;
    notificationsInitialized.current = true;

    try {
      // Initialize and request permission
      const token = await notificationService.initialize();

      if (token && userId) {
        // Register token with backend
        await notificationService.registerPushToken(userId);
      }

      // Add listeners for notification handling
      notificationService.addNotificationListeners(
        // On notification received (app in foreground)
        (notification) => {
          console.log('Notification received:', notification.request.content.title);
        },
        // On notification tapped
        (response) => {
          const data = response.notification.request.content.data;
          handleNotificationNavigation(data);
        }
      );
    } catch (error) {
      console.warn('Notification init failed:', error);
    }
  }

  // Handle navigation from notification tap
  function handleNotificationNavigation(data: Record<string, any>) {
    if (!data?.type) return;

    switch (data.type) {
      case 'list_shared':
      case 'item_added':
      case 'item_checked':
        if (data.listId) {
          router.push(`/(app)/list/${data.listId}`);
        }
        break;
      case 'meal_plan_ready':
        router.push('/(app)/meal-plans');
        break;
      case 'store_nearby':
        // Open the app to the main lists view
        router.push('/(app)');
        break;
      case 'family_joined':
        router.push('/(app)/household');
        break;
      case 'mira_suggestion':
        router.push('/(app)/chat');
        break;
      default:
        break;
    }
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

    // Safety timeout — if init hangs for any reason, still show the app
    const timeout = setTimeout(() => {
      console.warn('Splash timeout reached — forcing app to show');
      finishInit();
    }, SPLASH_TIMEOUT_MS);

    async function initAuth() {
      try {
        // Initialize error tracking (non-blocking — don't let Sentry block app startup)
        errorTracking.initialize().catch((err) =>
          console.warn('Error tracking init failed:', err)
        );

        const user = await getCurrentUser();
        setUser(user);

        if (user) {
          errorTracking.setUserId(user.id);
          const household = await getUserHousehold();
          setHousehold(household);

          // Initialize notifications for logged-in user
          initNotifications(user.id);

          // Initialize geofencing if user has a household
          if (household?.id) {
            initGeofencing(household.id);
          }
        }
      } catch (error) {
        console.error('Auth init error:', error);
      } finally {
        clearTimeout(timeout);
        finishInit();
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const user = await getCurrentUser();
          setUser(user);
          if (user) {
            const household = await getUserHousehold();
            setHousehold(household);

            // Initialize notifications after sign-in
            initNotifications(user.id);

            // Initialize geofencing if user has a household
            if (household?.id) {
              initGeofencing(household.id);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setHousehold(null);
          // Reset notification state on sign out
          notificationsInitialized.current = false;
          geofenceInitialized.current = false;
          notificationService.removeNotificationListeners();
          geofenceService.stopMonitoring();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      notificationService.removeNotificationListeners();
      geofenceService.stopMonitoring();
    };
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FDF5E6' }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
