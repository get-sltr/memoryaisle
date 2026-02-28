import { useEffect, useRef } from 'react';
import { useRouter, useRootNavigationState } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { COLORS } from '../src/constants/theme';

export default function Index() {
  const { isAuthenticated, isGuest, household, isLoading } = useAuthStore();
  const rootNavigationState = useRootNavigationState();
  const router = useRouter();
  const hasNavigated = useRef(false);

  useEffect(() => {
    // Wait for navigation tree and auth to be ready
    if (!rootNavigationState?.key || isLoading) return;

    // Only navigate once — prevents the household/dietary screen from flashing away
    if (hasNavigated.current) return;
    hasNavigated.current = true;

    if (isGuest) {
      router.replace('/(app)');
      return;
    }

    if (!isAuthenticated) {
      router.replace('/(auth)/landing');
      return;
    }

    if (!household) {
      router.replace('/(auth)/household');
      return;
    }

    const dietarySetupDone =
      (household.dietary_preferences && household.dietary_preferences.length > 0) ||
      household.familyProfile?.dietarySetupCompleted === true;

    if (!dietarySetupDone) {
      router.replace('/(auth)/dietary-setup');
      return;
    }

    router.replace('/(app)');
  }, [rootNavigationState?.key, isLoading, isAuthenticated, isGuest, household]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF5E6' }}>
      <ActivityIndicator size="large" color={COLORS.gold.base} />
    </View>
  );
}
