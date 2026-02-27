import { Redirect, useRootNavigationState } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { COLORS } from '../src/constants/theme';

export default function Index() {
  const { isAuthenticated, isGuest, user, household, isLoading } = useAuthStore();
  const rootNavigationState = useRootNavigationState();

  // 1. Wait for Expo Router's navigation tree to mount before trying to redirect
  if (!rootNavigationState?.key) {
    return <View style={{ flex: 1, backgroundColor: '#FDF5E6' }} />;
  }

  // 2. Handle Auth loading state
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF5E6' }}>
        <ActivityIndicator size="large" color={COLORS.gold.base} />
      </View>
    );
  }

  // Guest mode -> Allow browsing the app without account
  if (isGuest) {
    return <Redirect href="/(app)" />;
  }

  // Not authenticated -> Landing page
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/landing" />;
  }

  // Authenticated but no household -> Household setup
  if (!household) {
    return <Redirect href="/(auth)/household" />;
  }

  // Authenticated with household but no dietary setup done -> Dietary setup
  const dietarySetupDone =
    (household?.dietary_preferences && household.dietary_preferences.length > 0) ||
    household?.familyProfile?.dietarySetupCompleted === true;
    
  if (!dietarySetupDone) {
    return <Redirect href="/(auth)/dietary-setup" />;
  }

  // Authenticated with household -> Main app
  // Phone verification is optional and available in profile/settings
  return <Redirect href="/(app)" />;
}