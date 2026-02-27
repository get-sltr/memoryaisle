import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams, useGlobalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../src/services/supabase';
import { logger } from '../../../src/utils/logger';
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../../../src/constants/theme';

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();
  const globalParams = useGlobalSearchParams();

  const [mode, setMode] = useState<'loading' | 'recovery' | 'oauth'>('loading');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const handleUrl = async (url: string | null) => {
      if (!isMounted) return;

      try {
        // 1. Default to Router params if Expo caught the link first
        let accessToken = params.access_token || globalParams.access_token;
        let refreshToken = params.refresh_token || globalParams.refresh_token;
        let type = params.type || globalParams.type;

        // 2. If no Router params, safely parse the raw URL
        if (url && (!accessToken || !refreshToken)) {
          try {
            const urlObj = new URL(url);
            const hashParams = new URLSearchParams(urlObj.hash.substring(1));
            const queryParams = new URLSearchParams(urlObj.search);

            type = type || hashParams.get('type') || queryParams.get('type');
            accessToken = accessToken || hashParams.get('access_token');
            refreshToken = refreshToken || hashParams.get('refresh_token');
          } catch (parseError) {
            logger.warn('Failed to parse raw deep link URL', parseError);
          }
        }

        // 3. Password recovery flow
        if (type === 'recovery' && accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken as string,
            refresh_token: refreshToken as string,
          });

          if (sessionError) {
            Alert.alert('Link Expired', 'This password reset link has expired. Please request a new one.', [
              { text: 'OK', onPress: () => router.replace('/(auth)/sign-in') },
            ]);
            return;
          }

          if (isMounted) setMode('recovery');
          return;
        }

        // 4. OAuth login flow
        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken as string,
            refresh_token: refreshToken as string,
          });

          if (sessionError) {
            router.replace('/(auth)/sign-in');
            return;
          }

          router.replace('/');
          return;
        }

        // If no valid tokens found, bounce to login
        router.replace('/(auth)/sign-in');
      } catch (err) {
        logger.error('Auth callback error', err);
        router.replace('/(auth)/sign-in');
      }
    };

    // Check Cold Boot URL
    Linking.getInitialURL().then(handleUrl);

    // Listen for Warm Boot URLs
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [params, globalParams]); // Re-run if router catches params late

  const handleResetPassword = async () => {
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      // Show alert first, THEN sign out on confirm to prevent UI unmount crashes
      Alert.alert(
        'Password Updated',
        'Your password has been reset. Please sign in with your new password.',
        [
          { 
            text: 'Sign In', 
            onPress: async () => {
              await supabase.auth.signOut();
              router.replace('/(auth)/sign-in');
            }
          }
        ],
      );
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      if (isSubmitting) setIsSubmitting(false);
    }
  };

  // Loading state
  if (mode === 'loading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.gold.base} />
      </View>
    );
  }

  // Password recovery form
  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Set New Password</Text>
          <Text style={styles.subtitle}>Enter your new password below.</Text>

          <View style={styles.formCard}>
            <BlurView intensity={40} tint="light" style={styles.cardBlur} />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.7)', 'rgba(255, 255, 255, 0.4)']}
              style={styles.cardGradient}
            />
            <View style={styles.cardBorder} />

            <View style={styles.formContent}>
              <View style={styles.inputContainer}>
                <BlurView intensity={20} tint="light" style={styles.inputBlur} />
                <View style={styles.inputBorder} />
                <TextInput
                  style={styles.input}
                  placeholder="New password"
                  placeholderTextColor={COLORS.text.tertiary}
                  secureTextEntry
                  autoComplete="new-password"
                  value={newPassword}
                  onChangeText={(text) => { setNewPassword(text); setError(''); }}
                />
              </View>

              <View style={styles.inputContainer}>
                <BlurView intensity={20} tint="light" style={styles.inputBlur} />
                <View style={styles.inputBorder} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm password"
                  placeholderTextColor={COLORS.text.tertiary}
                  secureTextEntry
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChangeText={(text) => { setConfirmPassword(text); setError(''); }}
                  onSubmitEditing={handleResetPassword}
                />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                  isSubmitting && styles.buttonDisabled,
                ]}
                onPress={handleResetPassword}
                disabled={isSubmitting}
              >
                <LinearGradient
                  colors={[COLORS.gold.base, COLORS.gold.dark]}
                  style={styles.primaryButtonGradient}
                />
                <View style={styles.primaryButtonBorder} />
                {isSubmitting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Update Password</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.platinum.lightest,
  },
  keyboardView: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: SPACING.lg,
  },
  title: {
    fontFamily: 'Georgia',
    fontSize: 28,
    fontWeight: '500',
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  formCard: {
    borderRadius: BORDER_RADIUS.xxl,
    overflow: 'hidden',
    ...SHADOWS.glassElevated,
  },
  cardBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  cardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    borderColor: COLORS.frost.border,
  },
  formContent: {
    padding: SPACING.xl,
  },
  inputContainer: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  inputBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  inputBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.frost.border,
  },
  input: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md + 2,
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
  },
  errorText: {
    fontSize: FONT_SIZES.sm,
    color: '#E53E3E',
    marginBottom: SPACING.sm,
  },
  primaryButton: {
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md + 4,
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: SPACING.sm,
    ...SHADOWS.goldGlow,
  },
  primaryButtonGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  primaryButtonBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 220, 180, 0.5)',
  },
  primaryButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});