import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View, Pressable, Animated, Easing } from 'react-native';
import { COLORS, FONTS, FONT_SIZES, SPACING, ANIMATION, ThemeColors } from '../constants/theme';

interface FadingListItemProps {
  id: string;
  name: string;
  quantity: number;
  addedBy?: string;
  source?: 'manual' | 'ai_suggested' | 'voice';
  onComplete: (id: string) => void;
  colors?: ThemeColors;
}

// Sand dust particle
interface Particle {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  rotation: Animated.Value;
}

const NUM_PARTICLES = 24;

export function FadingListItem({
  id,
  name,
  quantity,
  addedBy,
  source,
  onComplete,
  colors = COLORS,
}: FadingListItemProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const height = useRef(new Animated.Value(60)).current;
  const [showParticles, setShowParticles] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Create particles with random properties
  const particles = useRef<Particle[]>(
    Array.from({ length: NUM_PARTICLES }, (_, i) => ({
      id: i,
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(1),
      rotation: new Animated.Value(0),
    }))
  ).current;

  const handlePress = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setShowParticles(true);

    // Start particle animations
    const particleAnimations = particles.map((particle, index) => {
      // Random direction and distance
      const angle = (Math.random() * 360) * (Math.PI / 180);
      const distance = 40 + Math.random() * 80;
      const targetX = Math.cos(angle) * distance;
      const targetY = Math.sin(angle) * distance - 20; // Slight upward bias
      const duration = 400 + Math.random() * 300;
      const delay = index * 15; // Stagger particles

      return Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          // Move outward
          Animated.timing(particle.x, {
            toValue: targetX,
            duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(particle.y, {
            toValue: targetY,
            duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          // Fade in then out
          Animated.sequence([
            Animated.timing(particle.opacity, {
              toValue: 0.9,
              duration: 50,
              useNativeDriver: true,
            }),
            Animated.timing(particle.opacity, {
              toValue: 0,
              duration: duration - 50,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          // Scale down
          Animated.timing(particle.scale, {
            toValue: 0.2,
            duration,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          // Rotate
          Animated.timing(particle.rotation, {
            toValue: Math.random() * 4 - 2,
            duration,
            useNativeDriver: true,
          }),
        ]),
      ]);
    });

    // Main content fade
    const contentFade = Animated.sequence([
      Animated.delay(100),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ]);

    // Height collapse
    const heightCollapse = Animated.sequence([
      Animated.delay(350),
      Animated.timing(height, {
        toValue: 0,
        duration: 200,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
    ]);

    // Run all animations
    Animated.parallel([
      ...particleAnimations,
      contentFade,
      heightCollapse,
    ]).start(() => {
      onComplete(id);
    });
  };

  // Show source indicator for AI suggestions
  const showAiBadge = source === 'ai_suggested';

  // Particle color based on theme
  const particleColor = colors.inkLight;

  return (
    <Animated.View style={[styles.container, { height }]}>
      {/* Sand dust particles */}
      {showParticles && (
        <View style={styles.particlesContainer} pointerEvents="none">
          {particles.map((particle) => (
            <Animated.View
              key={particle.id}
              style={[
                styles.particle,
                {
                  backgroundColor: particleColor,
                  opacity: particle.opacity,
                  transform: [
                    { translateX: particle.x },
                    { translateY: particle.y },
                    { scale: particle.scale },
                    {
                      rotate: particle.rotation.interpolate({
                        inputRange: [-2, 2],
                        outputRange: ['-180deg', '180deg'],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
      )}

      <Pressable onPress={handlePress} style={styles.pressable} disabled={isAnimating}>
        <Animated.View style={[styles.content, { opacity }]}>
          <View style={styles.leftSection}>
            {/* Quantity bubble */}
            {quantity > 1 && (
              <View style={[styles.quantityBubble, { backgroundColor: colors.paperDark }]}>
                <Text style={[styles.quantityText, { color: colors.ink }]}>{quantity}</Text>
              </View>
            )}

            {/* Item name */}
            <Text style={[styles.itemName, { color: colors.ink }]}>{name}</Text>

            {/* AI badge */}
            {showAiBadge && (
              <View style={[styles.aiBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.aiBadgeText}>AI</Text>
              </View>
            )}
          </View>

          {/* Added by attribution */}
          {addedBy && (
            <Text style={[styles.addedBy, { color: colors.inkLight }]}>{addedBy}</Text>
          )}
        </Animated.View>

        {/* Subtle bottom border */}
        <Animated.View style={[styles.border, { backgroundColor: colors.paperDark, opacity }]} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'visible', // Allow particles to escape
  },
  pressable: {
    flex: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  quantityBubble: {
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  quantityText: {
    fontFamily: FONTS.sans.medium,
    fontSize: FONT_SIZES.xs,
  },
  itemName: {
    fontFamily: FONTS.handwriting.regular,
    fontSize: FONT_SIZES.xl, // Slightly larger for handwriting
    flex: 1,
    letterSpacing: 0.5,
  },
  aiBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: SPACING.sm,
  },
  aiBadgeText: {
    fontFamily: FONTS.sans.medium,
    fontSize: FONT_SIZES.xs,
    color: COLORS.white,
  },
  addedBy: {
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.sm,
    fontStyle: 'italic',
  },
  border: {
    height: 1,
    marginLeft: SPACING.xs,
  },
  // Particles
  particlesContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
