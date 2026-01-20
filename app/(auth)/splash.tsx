import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import {
  COLORS,
  FONT_SIZES,
  SPACING,
} from '../../src/constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SplashScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate in
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 15,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Navigate to main app after delay
    const timer = setTimeout(() => {
      router.replace('/');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      {/* Video Background */}
      <Video
        source={require('../../assets/splashpage.mp4')}
        style={styles.backgroundVideo}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
      />

      {/* Overlay gradient */}
      <LinearGradient
        colors={['rgba(248, 249, 251, 0.85)', 'rgba(232, 236, 242, 0.95)']}
        style={StyleSheet.absoluteFill}
      />

      {/* Content */}
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Image
            source={require('../../assets/theapp.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View style={{ opacity: textFadeAnim }}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Preparing your list...</Text>
        </Animated.View>

        {/* Loading dots */}
        <Animated.View style={[styles.loadingDots, { opacity: textFadeAnim }]}>
          <LoadingDots />
        </Animated.View>
      </View>
    </View>
  );
}

function LoadingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animateDots = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot1, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot1, {
            toValue: 0.3,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot2, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot2, {
            toValue: 0.3,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot3, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot3, {
            toValue: 0.3,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };
    animateDots();
  }, []);

  return (
    <View style={styles.dotsContainer}>
      <Animated.View style={[styles.dot, { opacity: dot1 }]} />
      <Animated.View style={[styles.dot, { opacity: dot2 }]} />
      <Animated.View style={[styles.dot, { opacity: dot3 }]} />
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  logoContainer: {
    marginBottom: SPACING.xl,
  },
  logo: {
    width: 120,
    height: 120,
  },
  title: {
    fontFamily: 'Georgia',
    fontSize: 28,
    fontWeight: '500',
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.md,
    color: COLORS.gold.dark,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  loadingDots: {
    marginTop: SPACING.xxl,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.gold.base,
  },
});
