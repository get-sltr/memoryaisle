import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Link, router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signUp, signInWithOAuth } from '../../src/services/auth';
import Svg, { Path } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../../src/constants/theme';

// Apple Logo SVG Component
function AppleLogo({ size = 18, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </Svg>
  );
}

// Google Logo SVG Component
function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

// Facebook Logo SVG Component
function FacebookLogo({ size = 18, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </Svg>
  );
}

export default function SignUp() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'facebook' | 'apple' | null>(null);

  const handleSignUp = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const { success, error } = await signUp(email, password, name);
    setLoading(false);

    if (!success) {
      Alert.alert('Error', error || 'Failed to create account');
      return;
    }

    Alert.alert(
      'Check your email',
      'We sent you a confirmation link. Please check your email to verify your account.',
      [{ text: 'OK', onPress: () => router.replace('/(auth)/sign-in') }]
    );
  };

  const handleOAuthSignIn = async (provider: 'google' | 'facebook' | 'apple') => {
    setOauthLoading(provider);
    const { success, error } = await signInWithOAuth(provider);
    setOauthLoading(null);

    if (!success) {
      if (error !== 'Sign in was cancelled') {
        Alert.alert('Error', error || `Failed to sign up with ${provider}`);
      }
      return;
    }

    router.replace('/');
  };

  return (
    <View style={styles.container}>
      {/* Video Background */}
      <Video
        source={require('../../assets/landpagelogo.mp4')}
        style={styles.backgroundVideo}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
      />

      {/* Overlay gradient for readability */}
      <LinearGradient
        colors={['rgba(248, 249, 251, 0.85)', 'rgba(232, 236, 242, 0.95)']}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Image
              source={require('../../assets/theapp.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.title}>Memoryaisle</Text>
            <Text style={styles.tagline}>Never Forget. Never Overbuy.</Text>
          </View>

          {/* Glass Card Form */}
          <View style={styles.formCard}>
            <BlurView intensity={25} tint="light" style={styles.cardBlur} />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.75)', 'rgba(248, 249, 251, 0.65)']}
              style={styles.cardGradient}
            />
            {/* Top shine */}
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.15)', 'transparent']}
              style={styles.cardShine}
            />
            <View style={styles.cardBorder} />

            <View style={styles.formContent}>
              <Text style={styles.formTitle}>Create Account</Text>
              <Text style={styles.formSubtitle}>Join to start organizing</Text>

              {/* Name Input */}
              <View style={styles.inputContainer}>
                <BlurView intensity={15} tint="light" style={styles.inputBlur} />
                <View style={styles.inputBorder} />
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor={COLORS.text.secondary}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>

              {/* Email Input */}
              <View style={styles.inputContainer}>
                <BlurView intensity={15} tint="light" style={styles.inputBlur} />
                <View style={styles.inputBorder} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={COLORS.text.secondary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <BlurView intensity={15} tint="light" style={styles.inputBlur} />
                <View style={styles.inputBorder} />
                <TextInput
                  style={styles.input}
                  placeholder="Password (min 6 characters)"
                  placeholderTextColor={COLORS.text.secondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              {/* Create Account Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleSignUp}
                disabled={loading || oauthLoading !== null}
              >
                <LinearGradient
                  colors={[COLORS.gold.light, COLORS.gold.base]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryButtonGradient}
                />
                <View style={styles.primaryButtonBorder} />
                <Text style={styles.primaryButtonText}>
                  {loading ? 'Creating account...' : 'Create Account'}
                </Text>
              </Pressable>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or sign up with</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Sign up with Apple - HIG compliant */}
              <Pressable
                style={({ pressed }) => [
                  styles.appleButton,
                  pressed && styles.buttonPressed,
                  oauthLoading === 'apple' && styles.buttonDisabled,
                ]}
                onPress={() => handleOAuthSignIn('apple')}
                disabled={loading || oauthLoading !== null}
              >
                <View style={styles.appleButtonContent}>
                  {oauthLoading === 'apple' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <AppleLogo size={18} color="#FFFFFF" />
                      <Text style={styles.appleButtonText}>Sign up with Apple</Text>
                    </>
                  )}
                </View>
              </Pressable>

              {/* Sign up with Google */}
              <Pressable
                style={({ pressed }) => [
                  styles.googleButton,
                  pressed && styles.buttonPressed,
                  oauthLoading === 'google' && styles.buttonDisabled,
                ]}
                onPress={() => handleOAuthSignIn('google')}
                disabled={loading || oauthLoading !== null}
              >
                <View style={styles.googleButtonContent}>
                  {oauthLoading === 'google' ? (
                    <ActivityIndicator size="small" color={COLORS.text.primary} />
                  ) : (
                    <>
                      <GoogleLogo size={18} />
                      <Text style={styles.googleButtonText}>Sign up with Google</Text>
                    </>
                  )}
                </View>
              </Pressable>

              {/* Sign up with Facebook */}
              <Pressable
                style={({ pressed }) => [
                  styles.facebookButton,
                  pressed && styles.buttonPressed,
                  oauthLoading === 'facebook' && styles.buttonDisabled,
                ]}
                onPress={() => handleOAuthSignIn('facebook')}
                disabled={loading || oauthLoading !== null}
              >
                <View style={styles.facebookButtonContent}>
                  {oauthLoading === 'facebook' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <FacebookLogo size={18} color="#FFFFFF" />
                      <Text style={styles.facebookButtonText}>Sign up with Facebook</Text>
                    </>
                  )}
                </View>
              </Pressable>

              {/* Terms */}
              <Text style={styles.termsText}>
                By creating an account, you agree to our{' '}
                <Text style={styles.termsLink}>Terms of Service</Text>
                {' '}and{' '}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/sign-in" asChild>
              <Pressable>
                <Text style={styles.footerLink}>Sign In</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.platinum.lightest,
  },
  backgroundVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logoImage: {
    width: 70,
    height: 70,
    marginBottom: SPACING.md,
  },
  title: {
    fontFamily: 'Georgia',
    fontSize: 32,
    fontWeight: '500',
    color: COLORS.text.primary,
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.sm,
    color: COLORS.gold.dark,
    fontStyle: 'italic',
    marginTop: SPACING.xs,
  },

  // Form Card
  formCard: {
    borderRadius: BORDER_RADIUS.xxl,
    overflow: 'hidden',
    marginBottom: SPACING.xl,
    ...SHADOWS.glassElevated,
  },
  cardBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  cardShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '35%',
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
  formTitle: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.xxl,
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    marginBottom: SPACING.lg,
  },

  // Inputs
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
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
  },

  // Primary Button
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

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.platinum.base,
  },
  dividerText: {
    marginHorizontal: SPACING.md,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
  },

  // Apple Sign-In - HIG compliant (black, full-width, prominent)
  appleButton: {
    backgroundColor: '#000000',
    borderRadius: BORDER_RADIUS.lg,
    height: 50,
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  appleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  appleButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Google Sign-In - white with border
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    height: 50,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    marginBottom: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  googleButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  // Facebook Sign-In - brand blue
  facebookButton: {
    backgroundColor: '#1877F2',
    borderRadius: BORDER_RADIUS.lg,
    height: 50,
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  facebookButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  facebookButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Terms
  termsText: {
    fontSize: FONT_SIZES.xs + 1,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: COLORS.gold.dark,
    fontWeight: '500',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
  },
  footerText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
  },
  footerLink: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gold.dark,
    fontWeight: '600',
  },
});
