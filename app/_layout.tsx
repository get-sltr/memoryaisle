import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { getCurrentUser, getUserHousehold } from '../src/services/auth';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const { setUser, setHousehold, setLoading } = useAuthStore();

  useEffect(() => {
    async function initAuth() {
      try {
        const user = await getCurrentUser();
        setUser(user);

        if (user) {
          const household = await getUserHousehold();
          setHousehold(household);
        }
      } catch (error) {
        console.error('Auth init error:', error);
      } finally {
        setLoading(false);
        setIsReady(true);
        SplashScreen.hideAsync();
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
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setHousehold(null);
        }
      }
    );

    return () => subscription.unsubscribe();
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
