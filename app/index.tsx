// app/index.tsx
import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../src/stores/authStore";

export default function Index() {
  const router = useRouter();

  const { user, household, isAuthenticated, isLoading, isGuest } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    if (isGuest) {
      router.replace("/(app)");
      return;
    }

    if (!isAuthenticated) {
      router.replace("/(auth)/landing");
      return;
    }

    if (!user || !household) {
      router.replace("/(auth)/household");
      return;
    }

    router.replace("/(app)");
  }, [isLoading, user, household, isGuest, isAuthenticated, router]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Optional: avoid flashing blank UI if a replace is about to happen
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
