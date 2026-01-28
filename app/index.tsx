import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';

export default function Index() {
  const { isAuthenticated, isGuest, user, household, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF5E6' }}>
        <ActivityIndicator size="large" color="#8B4513" />
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

  // Authenticated with household -> Main app
  // Phone verification is optional and available in profile/settings
  return <Redirect href="/(app)" />;
}
