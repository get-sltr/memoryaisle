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
} from 'react-native';
import { Link, router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signIn, signInWithOAuth } from '../../src/services/auth';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../../src/constants/theme';

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'facebook' | null>(null);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    const { success, error } = await signIn(email, password);
    setLoading(false);

    if (!success) {
      Alert.alert('Error', error || 'Failed to sign in');
      return;
    }

    router.replace('/(auth)/splash');
  };

  const handleOAuthSignIn = async (provider: 'google' | 'facebook') => {
    setOauthLoading(provider);
    const { success, error } = await signInWithOAuth(provider);
    setOauthLoading(null);

    if (!success) {
      if (error !== 'Sign in was cancelled') {
        Alert.alert('Error', error || `Failed to sign in with ${provider}`);
      }
      return;
    }

    router.replace('/(auth)/splash');
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
            { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 },
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
              <Text style={styles.formTitle}>Welcome Back</Text>
              <Text style={styles.formSubtitle}>Sign in to continue</Text>

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
                  placeholder="Password"
                  placeholderTextColor={COLORS.text.secondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              {/* Sign In Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleSignIn}
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
                  {loading ? 'Signing in...' : 'Sign In'}
                </Text>
              </Pressable>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Social Login Buttons */}
              <View style={styles.socialButtons}>
                {/* Google Button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.socialButton,
                    pressed && styles.buttonPressed,
                    oauthLoading === 'google' && styles.buttonDisabled,
                  ]}
                  onPress={() => handleOAuthSignIn('google')}
                  disabled={loading || oauthLoading !== null}
                >
                  <BlurView intensity={20} tint="light" style={styles.socialButtonBlur} />
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.8)', 'rgba(248, 249, 251, 0.7)']}
                    style={styles.socialButtonGradient}
                  />
                  <View style={styles.socialButtonBorder} />
                  <View style={styles.socialButtonContent}>
                    <View style={[styles.socialIcon, styles.googleIcon]}>
                      <Text style={styles.googleIconText}>G</Text>
                    </View>
                    <Text style={styles.socialButtonText}>
                      {oauthLoading === 'google' ? 'Connecting...' : 'Google'}
                    </Text>
                  </View>
                </Pressable>

                {/* Facebook Button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.socialButton,
                    pressed && styles.buttonPressed,
                    oauthLoading === 'facebook' && styles.buttonDisabled,
                  ]}
                  onPress={() => handleOAuthSignIn('facebook')}
                  disabled={loading || oauthLoading !== null}
                >
                  <BlurView intensity={20} tint="light" style={styles.socialButtonBlur} />
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.8)', 'rgba(248, 249, 251, 0.7)']}
                    style={styles.socialButtonGradient}
                  />
                  <View style={styles.socialButtonBorder} />
                  <View style={styles.socialButtonContent}>
                    <View style={[styles.socialIcon, styles.facebookIcon]}>
                      <Text style={styles.facebookIconText}>f</Text>
                    </View>
                    <Text style={styles.socialButtonText}>
                      {oauthLoading === 'facebook' ? 'Connecting...' : 'Facebook'}
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/sign-up" asChild>
              <Pressable>
                <Text style={styles.footerLink}>Sign Up</Text>
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
    marginBottom: SPACING.xxl,
  },
  logoImage: {
    width: 80,
    height: 80,
    marginBottom: SPACING.md,
  },
  title: {
    fontFamily: 'Georgia',
    fontSize: 36,
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
    height: '40%',
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
    marginBottom: SPACING.xl,
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
    paddingVertical: SPACING.md + 2,
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
    marginVertical: SPACING.xl,
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

  // Social Buttons
  socialButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  socialButton: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    overflow: 'hidden',
  },
  socialButtonBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  socialButtonGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  socialButtonBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.frost.border,
  },
  socialButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  socialIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.platinum.base,
  },
  googleIconText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4285F4',
  },
  facebookIcon: {
    backgroundColor: '#1877F2',
  },
  facebookIconText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  socialButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
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
