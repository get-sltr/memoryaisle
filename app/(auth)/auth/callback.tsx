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
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../../../src/constants/theme';

/**
 * Auth Callback Handler
 * Handles two flows:
 * 1. OAuth redirect (Google, Facebook, Apple web) — sets session from tokens
 * 2. Password recovery — detects type=recovery, shows new password form
 */
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();
  const globalParams = useGlobalSearchParams();

  const [mode, setMode] = useState<'loading' | 'recovery' | 'oauth'>('loading');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const url = await Linking.getInitialURL();

        if (url) {
          const urlObj = new URL(url);
          const hashParams = new URLSearchParams(urlObj.hash.substring(1));
          const queryParams = new URLSearchParams(urlObj.search);

          // Check for password recovery flow
          const type = hashParams.get('type') || queryParams.get('type');
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (type === 'recovery' && accessToken && refreshToken) {
            // Set session from recovery link tokens so updateUser works
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              Alert.alert('Link Expired', 'This password reset link has expired. Please request a new one.', [
                { text: 'OK', onPress: () => router.replace('/(auth)/sign-in') },
              ]);
              return;
            }

            setMode('recovery');
            return;
          }

          // OAuth flow — set session from tokens
          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              router.replace('/(auth)/sign-in');
              return;
            }

            router.replace('/');
            return;
          }
        }

        // Check URL params (some providers pass tokens this way)
        const accessTokenParam = params.access_token || globalParams.access_token;
        const refreshTokenParam = params.refresh_token || globalParams.refresh_token;

        if (accessTokenParam && refreshTokenParam) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessTokenParam as string,
            refresh_token: refreshTokenParam as string,
          });

          if (sessionError) {
            router.replace('/(auth)/sign-in');
            return;
          }

          router.replace('/');
          return;
        }

        // No valid tokens found
        router.replace('/(auth)/sign-in');
      } catch {
        router.replace('/(auth)/sign-in');
      }
    };

    handleCallback();
  }, []);

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

      // Sign out so user logs in fresh with new password
      await supabase.auth.signOut();

      Alert.alert(
        'Password Updated',
        'Your password has been reset. Please sign in with your new password.',
        [{ text: 'Sign In', onPress: () => router.replace('/(auth)/sign-in') }],
      );
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
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
