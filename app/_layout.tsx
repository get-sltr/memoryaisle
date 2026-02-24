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

SplashScreen.preventAutoHideAsync();

// Safety timeout: force-hide splash after 8 seconds no matter what
const SPLASH_TIMEOUT_MS = 8000;

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const { setUser, setHousehold, setLoading } = useAuthStore();
  const router = useRouter();
  const notificationsInitialized = useRef(false);
  const geofenceInitialized = useRef(false);
  const iapInitialized = useRef(false);

  // Initialize In-App Purchases (non-blocking)
  async function initIAP(userId: string) {
    if (iapInitialized.current) return;
    iapInitialized.current = true;

    try {
      const connected = await iapService.initialize();
      if (connected) {
        // Start listening for transactions (renewals, deferred purchases, etc.)
        iapService.startTransactionListener(userId, () => {
          iapService.syncSubscriptionOnLaunch().catch(() => {});
        });
        // Sync subscription with Apple via server verification on launch
        iapService.syncSubscriptionOnLaunch().catch(() => {});
      }
    } catch (error) {
      console.warn('IAP init failed:', error);
    }
  }

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
          // Store departure - no action needed
        }
      );
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
          // Notification received in foreground - handled by notification service
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
        router.push('/(app)/mira');
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

          // Initialize services for logged-in user (all non-blocking)
          initIAP(user.id);
          initNotifications(user.id);

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

            // Initialize services after sign-in (all non-blocking)
            initIAP(user.id);
            initNotifications(user.id);

            if (household?.id) {
              initGeofencing(household.id);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setHousehold(null);
          // Reset service state on sign out
          iapInitialized.current = false;
          notificationsInitialized.current = false;
          geofenceInitialized.current = false;
          iapService.removeTransactionListeners();
          notificationService.removeNotificationListeners();
          geofenceService.stopMonitoring();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      iapService.disconnect();
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
