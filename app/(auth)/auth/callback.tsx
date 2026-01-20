import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useLocalSearchParams, useGlobalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../../../src/services/supabase';
import { COLORS } from '../../../src/constants/theme';

/**
 * OAuth Callback Handler
 * This route handles the redirect back from OAuth providers (Google, Facebook, Apple web)
 * The URL will contain access_token and refresh_token in the hash fragment
 */
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();
  const globalParams = useGlobalSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the current URL to extract tokens
        const url = await Linking.getInitialURL();

        if (url) {
          // Parse the URL to extract tokens from the hash fragment
          const urlObj = new URL(url);
          const hashParams = new URLSearchParams(urlObj.hash.substring(1));

          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken && refreshToken) {
            // Set the session with the tokens
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error('Failed to set session:', error);
              router.replace('/(auth)/landing');
              return;
            }

            // Successfully authenticated, redirect to home
            router.replace('/');
            return;
          }
        }

        // Check if we have tokens in the URL params (some providers pass them this way)
        const accessTokenParam = params.access_token || globalParams.access_token;
        const refreshTokenParam = params.refresh_token || globalParams.refresh_token;

        if (accessTokenParam && refreshTokenParam) {
          const { error } = await supabase.auth.setSession({
            access_token: accessTokenParam as string,
            refresh_token: refreshTokenParam as string,
          });

          if (error) {
            console.error('Failed to set session:', error);
            router.replace('/(auth)/landing');
            return;
          }

          router.replace('/');
          return;
        }

        // No valid tokens found, redirect to landing
        console.log('No tokens found in callback URL');
        router.replace('/(auth)/landing');
      } catch (error) {
        console.error('Auth callback error:', error);
        router.replace('/(auth)/landing');
      }
    };

    handleCallback();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.gold.base} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background.primary,
  },
});
