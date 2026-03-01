import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
  Easing,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Video, ResizeMode } from 'expo-av';
import Svg, { Path } from 'react-native-svg';
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  ANIMATION,
  HIG,
} from '../../src/constants/theme';
import { signInWithOAuth, getCurrentUser, getUserHousehold } from '../../src/services/auth';
import { useAuthStore } from '../../src/stores/authStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Shimmer effect component for glass buttons
function ShimmerEffect({ width = 200 }: { width?: number }) {
  const shimmerAnim = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    const runShimmer = () => {
      shimmerAnim.setValue(-1);
      Animated.timing(shimmerAnim, {
        toValue: 2,
        duration: 2500,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        setTimeout(runShimmer, 1500);
      });
    };

    const timeout = setTimeout(runShimmer, 500);
    return () => clearTimeout(timeout);
  }, []);

  const translateX = shimmerAnim.interpolate({
    inputRange: [-1, 2],
    outputRange: [-width, width * 2],
  });

  return (
    <Animated.View
      style={[
        styles.shimmer,
        {
          transform: [{ translateX }],
        },
      ]}
    >
      <LinearGradient
        colors={[
          'transparent',
          'rgba(255, 255, 255, 0.15)',
          'rgba(255, 255, 255, 0.4)',
          'rgba(255, 255, 255, 0.15)',
          'transparent',
        ]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.shimmerGradient}
      />
    </Animated.View>
  );
}

// Apple Logo SVG Component
function AppleLogo({ size = 20, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </Svg>
  );
}

// Google Logo SVG Component
function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

// Facebook Logo SVG Component
function FacebookLogo({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </Svg>
  );
}

export default function LandingScreen() {
  const [isLoading, setIsLoading] = useState<'google' | 'apple' | 'facebook' | null>(null);
  const { isAuthenticated, household } = useAuthStore();

  // Redirect if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated]);

  // Handle social sign in
  const handleSocialSignIn = async (provider: 'google' | 'apple' | 'facebook') => {
    setIsLoading(provider);
    try {
      const result = await signInWithOAuth(provider);
      if (result.success) {
        // Session is established. Load user+household directly rather than
        // waiting for onAuthStateChange (which can be missed if the listener
        // is recreated due to _layout.tsx effect dependency changes).
        const { setUser, setHousehold, setLoading } = useAuthStore.getState();
        setLoading(true);
        try {
          const user = await getCurrentUser();
          setUser(user);
          if (user) {
            const household = await getUserHousehold(user);
            setHousehold(household);
          }
        } finally {
          setLoading(false);
        }
        router.replace('/');
        return;
      }
      if (result.error) {
        Alert.alert('Sign In Failed', result.error);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong');
    }
    setIsLoading(null);
  };

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const videoScale = useRef(new Animated.Value(0.8)).current;
  const videoOpacity = useRef(new Animated.Value(0)).current;
  const titleFade = useRef(new Animated.Value(0)).current;
  const titleTranslate = useRef(new Animated.Value(20)).current;
  const subtitleFade = useRef(new Animated.Value(0)).current;
  const buttonsFade = useRef(new Animated.Value(0)).current;
  const buttonsTranslate = useRef(new Animated.Value(30)).current;

  // Ambient light animations
  const ambient1 = useRef(new Animated.Value(0)).current;
  const ambient2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered entrance animation
    Animated.sequence([
      // Fade in background
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      // Video entrance
      Animated.parallel([
        Animated.spring(videoScale, {
          toValue: 1,
          damping: ANIMATION.spring.gentle.damping,
          stiffness: ANIMATION.spring.gentle.stiffness,
          useNativeDriver: true,
        }),
        Animated.timing(videoOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
      // Title entrance
      Animated.parallel([
        Animated.timing(titleFade, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslate, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      // Subtitle
      Animated.timing(subtitleFade, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      // Buttons
      Animated.parallel([
        Animated.timing(buttonsFade, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(buttonsTranslate, {
          toValue: 0,
          damping: 20,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Ambient light floating animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(ambient1, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.timing(ambient1, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(ambient2, {
          toValue: 1,
          duration: 5000,
          useNativeDriver: true,
        }),
        Animated.timing(ambient2, {
          toValue: 0,
          duration: 5000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const ambient1Translate = ambient1.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });

  const ambient2Translate = ambient2.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 15],
  });

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={['#E8EAEF', '#DFE2E8', '#D8DCE4', '#D2D7E0']}
          locations={[0, 0.3, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Ambient Gold Light 1 */}
      <Animated.View
        style={[
          styles.ambientLight,
          styles.ambient1,
          {
            opacity: fadeAnim,
            transform: [{ translateY: ambient1Translate }],
          },
        ]}
      />

      {/* Ambient Gold Light 2 */}
      <Animated.View
        style={[
          styles.ambientLight,
          styles.ambient2,
          {
            opacity: fadeAnim,
            transform: [{ translateX: ambient2Translate }],
          },
        ]}
      />

      {/* Ambient Blue Light */}
      <Animated.View
        style={[
          styles.ambientLight,
          styles.ambient3,
          { opacity: fadeAnim },
        ]}
      />

      {/* Content */}
      <View style={styles.content}>
        {/* Video Container with Glass Frame */}
        <Animated.View
          style={[
            styles.videoWrapper,
            {
              opacity: videoOpacity,
              transform: [{ scale: videoScale }],
            },
          ]}
        >
          {/* Outer glow */}
          <View style={styles.videoGlow} />

          {/* Glass frame */}
          <View style={styles.videoFrame}>
            <BlurView intensity={40} tint="light" style={styles.videoBlur}>
              <LinearGradient
                colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.2)']}
                style={styles.videoGradient}
              />
            </BlurView>

            {/* Inner border shine */}
            <View style={styles.videoInnerBorder} />

            {/* Video */}
            <View style={styles.videoContainer}>
              <Video
                source={require('../../assets/landpagelogo.mp4')}
                style={styles.video}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                isLooping
                isMuted
              />
            </View>
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View
          style={{
            opacity: titleFade,
            transform: [{ translateY: titleTranslate }],
          }}
        >
          <Text style={styles.title}>MemoryAisle</Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View style={{ opacity: subtitleFade }}>
          <Text style={styles.subtitle}>Grocery shopping, elevated.</Text>
        </Animated.View>

        {/* Buttons */}
        <Animated.View
          style={[
            styles.buttonsContainer,
            {
              opacity: buttonsFade,
              transform: [{ translateY: buttonsTranslate }],
            },
          ]}
        >
          {/* Sign in with Apple - HIG-compliant, equal prominence */}
          <Pressable
            onPress={() => handleSocialSignIn('apple')}
            disabled={isLoading !== null}
            style={({ pressed }) => [
              styles.appleSignInButton,
              pressed && styles.buttonPressed,
              isLoading === 'apple' && styles.buttonLoading,
            ]}
          >
            <View style={styles.appleSignInInner}>
              {isLoading === 'apple' ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <AppleLogo size={18} color="#FFFFFF" />
                  <Text style={styles.appleSignInText}>Sign in with Apple</Text>
                </>
              )}
            </View>
          </Pressable>

          {/* Google Sign In */}
          <Pressable
            onPress={() => handleSocialSignIn('google')}
            disabled={isLoading !== null}
            style={({ pressed }) => [
              styles.googleSignInButton,
              pressed && styles.buttonPressed,
              isLoading === 'google' && styles.buttonLoading,
            ]}
          >
            <View style={styles.googleSignInInner}>
              {isLoading === 'google' ? (
                <ActivityIndicator size="small" color={COLORS.text.primary} />
              ) : (
                <>
                  <GoogleLogo size={18} />
                  <Text style={styles.googleSignInText}>Sign in with Google</Text>
                </>
              )}
            </View>
          </Pressable>

          {/* Facebook Sign In */}
          <Pressable
            onPress={() => handleSocialSignIn('facebook')}
            disabled={isLoading !== null}
            style={({ pressed }) => [
              styles.facebookSignInButton,
              pressed && styles.buttonPressed,
              isLoading === 'facebook' && styles.buttonLoading,
            ]}
          >
            <View style={styles.facebookSignInInner}>
              {isLoading === 'facebook' ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <FacebookLogo size={18} color="#FFFFFF" />
                  <Text style={styles.facebookSignInText}>Sign in with Facebook</Text>
                </>
              )}
            </View>
          </Pressable>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Get Started with Email */}
          <Pressable
            onPress={() => router.push('/(auth)/sign-up')}
            style={({ pressed }) => [
              styles.glassButtonPrimary,
              pressed && styles.buttonPressed,
            ]}
          >
            <LinearGradient
              colors={[
                'rgba(212, 175, 95, 0.9)',
                'rgba(212, 165, 71, 0.8)',
                'rgba(184, 144, 50, 0.85)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.glassButtonPrimaryGradient}
            >
              <View style={styles.glassButtonInner}>
                <Text style={styles.glassButtonPrimaryText}>Get Started with Email</Text>
              </View>
              <ShimmerEffect width={320} />
            </LinearGradient>
            <View style={styles.glassButtonShine} />
          </Pressable>

          {/* Sign In Button */}
          <Pressable
            onPress={() => router.push('/(auth)/sign-in')}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <BlurView intensity={30} tint="light" style={styles.secondaryBlur}>
              <View style={styles.secondaryInner}>
                <Text style={styles.secondaryButtonText}>
                  Already have an account? <Text style={styles.signInText}>Sign In</Text>
                </Text>
              </View>
            </BlurView>
          </Pressable>

          {/* Browse as Guest - prominent button */}
          <Pressable
            onPress={() => {
              useAuthStore.getState().enterGuestMode();
              router.replace('/');
            }}
            style={({ pressed }) => [
              styles.guestButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <View style={styles.guestButtonInner}>
              <Text style={styles.guestButtonText}>Browse without an account</Text>
            </View>
          </Pressable>
        </Animated.View>
      </View>

      {/* Bottom tagline */}
      <Animated.View style={[styles.footer, { opacity: buttonsFade }]}>
        <Text style={styles.footerText}>
          Smart lists • Voice assistant • Family sharing
        </Text>
        <View style={styles.legalLinks}>
          <Text
            style={styles.legalLinkText}
            onPress={() => Linking.openURL('https://memoryaisle.app/terms')}
          >
            Terms of Use
          </Text>
          <Text style={styles.legalSeparator}>•</Text>
          <Text
            style={styles.legalLinkText}
            onPress={() => Linking.openURL('https://memoryaisle.app/privacy')}
          >
            Privacy Policy
          </Text>
        </View>
        <Text style={styles.companyName}>SLTR DIGITAL LLC</Text>
        <Text style={styles.companyTagline}>INTELLIGENT | INNOVATIVE | INTUITIVE</Text>
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8EAEF',
  },
  ambientLight: {
    position: 'absolute',
    borderRadius: 999,
    pointerEvents: 'none',
  },
  ambient1: {
    top: -100,
    right: -50,
    width: 400,
    height: 400,
    backgroundColor: 'transparent',
    shadowColor: COLORS.gold.base,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 150,
    elevation: 0,
    ...Platform.select({
      ios: {},
      android: {
        backgroundColor: 'rgba(212, 165, 71, 0.15)',
      },
    }),
  },
  ambient2: {
    bottom: -100,
    left: -80,
    width: 500,
    height: 500,
    backgroundColor: 'transparent',
    shadowColor: COLORS.gold.dark,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 180,
    elevation: 0,
    ...Platform.select({
      ios: {},
      android: {
        backgroundColor: 'rgba(184, 134, 11, 0.12)',
      },
    }),
  },
  ambient3: {
    top: '40%',
    left: '50%',
    marginLeft: -150,
    width: 300,
    height: 300,
    backgroundColor: 'transparent',
    shadowColor: '#AAC0E0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 120,
    elevation: 0,
    ...Platform.select({
      ios: {},
      android: {
        backgroundColor: 'rgba(170, 192, 224, 0.1)',
      },
    }),
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.xl,
    paddingBottom: 30,
  },
  videoWrapper: {
    marginBottom: SPACING.xxl,
  },
  videoGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    borderRadius: 140,
    backgroundColor: 'transparent',
    shadowColor: COLORS.gold.base,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 0,
  },
  videoFrame: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    ...SHADOWS.glassElevated,
  },
  videoBlur: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 100,
  },
  videoGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  videoInnerBorder: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderRadius: 94,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  videoContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 88,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontFamily: 'Georgia',
    fontSize: 36,
    fontWeight: '400',
    color: COLORS.text.primary,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif-light' }),
    fontSize: FONT_SIZES.lg,
    fontWeight: '300',
    color: COLORS.gold.dark,
    textAlign: 'center',
    letterSpacing: 1,
    textTransform: 'lowercase',
    fontStyle: 'italic',
    marginBottom: SPACING.xxl + 10,
  },
  buttonsContainer: {
    width: '100%',
    maxWidth: 320,
    gap: SPACING.md,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginVertical: SPACING.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(138, 145, 157, 0.3)',
  },
  dividerText: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    letterSpacing: 0.3,
  },
  // Apple HIG-compliant Sign in with Apple button
  appleSignInButton: {
    backgroundColor: '#000000',
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    height: 50,
    justifyContent: 'center',
  },
  appleSignInInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  appleSignInText: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif-medium' }),
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Google sign-in button - matching size and prominence
  googleSignInButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    height: 50,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  googleSignInInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  googleSignInText: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif-medium' }),
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  // Facebook sign-in button - matching size and prominence
  facebookSignInButton: {
    backgroundColor: '#1877F2',
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    height: 50,
    justifyContent: 'center',
  },
  facebookSignInInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  facebookSignInText: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif-medium' }),
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Glass button styles with shimmer
  glassButtonPrimary: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: COLORS.gold.base,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  glassButtonPrimaryGradient: {
    paddingVertical: 18,
    paddingHorizontal: SPACING.xl,
    position: 'relative',
    overflow: 'hidden',
  },
  glassButtonPrimaryText: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif-medium' }),
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  glassButton: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: COLORS.gold.base,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  glassButtonWide: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: COLORS.gold.base,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  glassButtonGradient: {
    paddingVertical: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  glassButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  glassButtonText: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif-medium' }),
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  glassButtonShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 80,
    zIndex: 10,
  },
  shimmerGradient: {
    flex: 1,
    width: '100%',
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.subtle,
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  appleButtonText: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif-medium' }),
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  googleButtonText: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif-medium' }),
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  facebookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: '#1877F2',
    ...SHADOWS.subtle,
  },
  facebookButtonText: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif-medium' }),
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonLoading: {
    opacity: 0.7,
  },
  primaryButton: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    ...SHADOWS.goldGlow,
  },
  buttonGradient: {
    paddingVertical: 18,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif-medium' }),
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  secondaryButton: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  secondaryBlur: {
    overflow: 'hidden',
    borderRadius: BORDER_RADIUS.xl,
  },
  secondaryInner: {
    paddingVertical: 16,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  secondaryButtonText: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontSize: FONT_SIZES.md,
    fontWeight: '400',
    color: COLORS.text.primary,
  },
  signInText: {
    fontWeight: '600',
    color: COLORS.gold.dark,
  },
  guestButton: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(138, 145, 157, 0.3)',
  },
  guestButtonInner: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  guestButtonText: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif-medium' }),
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  footer: {
    paddingBottom: 50,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  footerText: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif-light' }),
    fontSize: FONT_SIZES.sm,
    fontWeight: '300',
    color: COLORS.text.secondary,
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  companyName: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif-medium' }),
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.gold.dark,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  companyTagline: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontSize: HIG.minFontSize,    // Was 9 - HIG minimum 11pt
    fontWeight: '400',
    color: COLORS.text.tertiary,  // Updated from removed 'muted'
    letterSpacing: 1.5,
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  legalLinkText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gold.dark,
    fontWeight: '500',
  },
  legalSeparator: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
  },
});
