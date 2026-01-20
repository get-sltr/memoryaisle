import { useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Aurora color palettes
export const AURORA_PALETTES = {
  northern: {
    colors: ['#00D4AA', '#00B4D8', '#7B2CBF', '#E040FB', '#00D4AA'],
    glow: 'rgba(0, 212, 170, 0.4)',
  },
  sunset: {
    colors: ['#FF6B6B', '#FFA07A', '#FFD93D', '#FF8E53', '#FF6B6B'],
    glow: 'rgba(255, 107, 107, 0.4)',
  },
  cosmic: {
    colors: ['#667EEA', '#764BA2', '#F093FB', '#F5576C', '#667EEA'],
    glow: 'rgba(102, 126, 234, 0.4)',
  },
  ocean: {
    colors: ['#00C9FF', '#92FE9D', '#00B4DB', '#0083B0', '#00C9FF'],
    glow: 'rgba(0, 201, 255, 0.4)',
  },
  forest: {
    colors: ['#134E5E', '#71B280', '#38EF7D', '#11998E', '#134E5E'],
    glow: 'rgba(113, 178, 128, 0.4)',
  },
};

type AuroraPalette = keyof typeof AURORA_PALETTES;

interface AuroraBackgroundProps {
  palette?: AuroraPalette;
  intensity?: 'subtle' | 'medium' | 'vivid';
  animated?: boolean;
  children?: React.ReactNode;
}

export function AuroraBackground({
  palette = 'northern',
  intensity = 'medium',
  animated = true,
  children,
}: AuroraBackgroundProps) {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity1 = useSharedValue(0.6);
  const opacity2 = useSharedValue(0.4);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const intensityMap = {
    subtle: { blur: 80, opacity: 0.3 },
    medium: { blur: 60, opacity: 0.5 },
    vivid: { blur: 40, opacity: 0.7 },
  };

  const { colors, glow } = AURORA_PALETTES[palette];
  const { blur, opacity } = intensityMap[intensity];

  useEffect(() => {
    if (animated) {
      // Slow rotation
      rotation.value = withRepeat(
        withTiming(360, { duration: 30000, easing: Easing.linear }),
        -1,
        false
      );

      // Breathing scale
      scale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );

      // Opacity wave
      opacity1.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 4000 }),
          withTiming(0.5, { duration: 4000 })
        ),
        -1,
        true
      );

      opacity2.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 5000 }),
          withTiming(0.3, { duration: 5000 })
        ),
        -1,
        true
      );

      // Gentle drift
      translateX.value = withRepeat(
        withSequence(
          withTiming(30, { duration: 10000, easing: Easing.inOut(Easing.ease) }),
          withTiming(-30, { duration: 10000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );

      translateY.value = withRepeat(
        withSequence(
          withTiming(-20, { duration: 12000, easing: Easing.inOut(Easing.ease) }),
          withTiming(20, { duration: 12000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }
  }, [animated]);

  const animatedStyle1 = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
      { translateX: translateX.value },
    ],
    opacity: opacity1.value * opacity,
  }));

  const animatedStyle2 = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${-rotation.value * 0.7}deg` },
      { scale: scale.value * 0.9 },
      { translateY: translateY.value },
    ],
    opacity: opacity2.value * opacity,
  }));

  return (
    <View style={styles.container}>
      {/* Base dark background */}
      <View style={[styles.base, { backgroundColor: '#0a0a0f' }]} />

      {/* Aurora layer 1 */}
      <Animated.View style={[styles.auroraLayer, animatedStyle1]}>
        <LinearGradient
          colors={colors as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        />
      </Animated.View>

      {/* Aurora layer 2 (offset) */}
      <Animated.View style={[styles.auroraLayer, styles.auroraOffset, animatedStyle2]}>
        <LinearGradient
          colors={[...colors].reverse() as any}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.gradient}
        />
      </Animated.View>

      {/* Blur overlay for smooth aurora effect */}
      <BlurView intensity={blur} tint="dark" style={StyleSheet.absoluteFill} />

      {/* Glow spots */}
      <View style={[styles.glowSpot, styles.glowSpot1, { backgroundColor: glow }]} />
      <View style={[styles.glowSpot, styles.glowSpot2, { backgroundColor: colors[2] + '40' }]} />

      {/* Content */}
      {children}
    </View>
  );
}

// Smaller aurora card background
interface AuroraCardProps {
  palette?: AuroraPalette;
  style?: any;
  children?: React.ReactNode;
}

export function AuroraCard({ palette = 'northern', style, children }: AuroraCardProps) {
  const shimmer = useSharedValue(0);
  const { colors } = AURORA_PALETTES[palette];

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + shimmer.value * 0.4,
  }));

  return (
    <View style={[styles.card, style]}>
      {/* Card aurora gradient */}
      <LinearGradient
        colors={[colors[0] + '30', colors[2] + '20', colors[4] + '30']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Shimmer overlay */}
      <Animated.View style={[styles.shimmer, shimmerStyle]}>
        <LinearGradient
          colors={['transparent', colors[1] + '40', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Glass border */}
      <View style={styles.cardBorder} />

      {/* Content */}
      {children}
    </View>
  );
}

// Glow button component
interface GlowButtonProps {
  palette?: AuroraPalette;
  onPress?: () => void;
  children?: React.ReactNode;
  style?: any;
}

export function GlowButton({ palette = 'northern', onPress, children, style }: GlowButtonProps) {
  const glow = useSharedValue(0);
  const { colors } = AURORA_PALETTES[palette];

  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.4 + glow.value * 0.4,
    shadowRadius: 12 + glow.value * 8,
  }));

  return (
    <Animated.View
      style={[
        styles.glowButton,
        { shadowColor: colors[0] },
        glowStyle,
        style,
      ]}
    >
      <LinearGradient
        colors={[colors[0], colors[2]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.glowButtonGradient}
      >
        {children}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  base: {
    ...StyleSheet.absoluteFillObject,
  },
  auroraLayer: {
    position: 'absolute',
    width: SCREEN_WIDTH * 2,
    height: SCREEN_HEIGHT * 2,
    top: -SCREEN_HEIGHT * 0.5,
    left: -SCREEN_WIDTH * 0.5,
  },
  auroraOffset: {
    top: -SCREEN_HEIGHT * 0.3,
    left: -SCREEN_WIDTH * 0.3,
  },
  gradient: {
    flex: 1,
    borderRadius: SCREEN_WIDTH,
  },
  glowSpot: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.6,
  },
  glowSpot1: {
    width: 200,
    height: 200,
    top: '20%',
    right: -50,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 100,
  },
  glowSpot2: {
    width: 150,
    height: 150,
    bottom: '30%',
    left: -30,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 80,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
  },
  glowButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  glowButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
