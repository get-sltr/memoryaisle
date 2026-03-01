// app/index.tsx
// Root route — decides where to send users based on auth + household state.
// Without this file, Expo Router defaults ALL users to /(app)/index.tsx.
import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';

export default function RootIndex() {
  const { user, household, isLoading, isGuest } = useAuthStore();

  // Still bootstrapping — show loading (splash screen handles visual)
  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  // Guest mode — limited app access
  if (isGuest) {
    return <Redirect href="/(app)" />;
  }

  // Not authenticated — go to sign in
  if (!user) {
    return <Redirect href="/(auth)/landing" />;
  }

  // Authenticated but no household — onboarding
  if (!household) {
    return <Redirect href="/(auth)/household" />;
  }

  // Fully set up — main app
  return <Redirect href="/(app)" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FDF5E6',
  },
});
