import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp, Text, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { BORDER_RADIUS, SPACING, FONTS, FONT_SIZES } from '../constants/theme';

// ============================================
// LIQUID GLASS CARD - Frosted glass container
// ============================================
interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  noPadding?: boolean;
  dark?: boolean;
}

export function GlassCard({
  children,
  style,
  intensity = 25,
  noPadding = false,
  dark = false,
}: GlassCardProps) {
  return (
    <View style={[styles.cardContainer, dark && styles.cardDark, style]}>
      <BlurView
        intensity={intensity}
        tint={dark ? 'dark' : 'light'}
        style={styles.blur}
      />

      {/* Subtle gradient overlay */}
      <LinearGradient
        colors={
          dark
            ? ['rgba(40, 40, 45, 0.7)', 'rgba(30, 30, 35, 0.8)']
            : ['rgba(255, 255, 255, 0.7)', 'rgba(245, 245, 250, 0.6)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.cardGradient}
      />

      {/* Inner border glow */}
      <View style={[styles.cardBorder, dark && styles.cardBorderDark]} />

      <View style={[styles.cardContent, noPadding && styles.noPadding]}>
        {children}
      </View>
    </View>
  );
}

// ============================================
// GLASS BUTTON - Primary action (amber glow)
// ============================================
interface GlassButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
}

export function GlassButton({
  children,
  onPress,
  style,
  variant = 'primary',
  disabled = false,
}: GlassButtonProps) {
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.buttonContainer,
        isPrimary && styles.buttonPrimary,
        isGhost && styles.buttonGhost,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
        style,
      ]}
    >
      {isPrimary ? (
        <>
          {/* Amber gradient for primary */}
          <LinearGradient
            colors={['#D4915A', '#C47F4A', '#B56E3A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.buttonGradient}
          />
          {/* Top shine */}
          <LinearGradient
            colors={['rgba(255, 200, 150, 0.4)', 'rgba(255, 180, 120, 0)']}
            style={styles.buttonShine}
          />
          {/* Glow border */}
          <View style={styles.primaryBorder} />
        </>
      ) : isGhost ? (
        <>
          <View style={styles.ghostBackground} />
          <View style={styles.ghostBorder} />
        </>
      ) : (
        <>
          {/* Frosted glass for secondary */}
          <BlurView intensity={20} tint="dark" style={styles.blur} />
          <LinearGradient
            colors={['rgba(60, 60, 65, 0.8)', 'rgba(45, 45, 50, 0.9)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.buttonGradient}
          />
          <View style={styles.secondaryBorder} />
        </>
      )}

      <View style={styles.buttonContent}>
        {typeof children === 'string' ? (
          <Text style={[
            styles.buttonText,
            isPrimary && styles.buttonTextPrimary,
            isGhost && styles.buttonTextGhost,
          ]}>
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </Pressable>
  );
}

// ============================================
// GLASS FAB - Floating action button
// ============================================
interface GlassFabProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  size?: number;
  variant?: 'primary' | 'secondary';
}

export function GlassFab({
  children,
  onPress,
  style,
  size = 64,
  variant = 'primary',
}: GlassFabProps) {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.fabContainer,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && styles.buttonPressed,
        style,
      ]}
    >
      {isPrimary ? (
        <>
          <LinearGradient
            colors={['#D4915A', '#C47F4A', '#A86A3A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.fabGradient, { borderRadius: size / 2 }]}
          />
          {/* Circular shine */}
          <LinearGradient
            colors={['rgba(255, 220, 180, 0.5)', 'rgba(255, 180, 120, 0)']}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 0.7, y: 0.6 }}
            style={[styles.fabShine, { borderRadius: size / 2 }]}
          />
          <View style={[styles.fabBorderPrimary, { borderRadius: size / 2 }]} />
        </>
      ) : (
        <>
          <BlurView intensity={30} tint="light" style={[styles.blur, { borderRadius: size / 2 }]} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.8)', 'rgba(240, 240, 245, 0.7)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[styles.fabGradient, { borderRadius: size / 2 }]}
          />
          <View style={[styles.fabBorderSecondary, { borderRadius: size / 2 }]} />
        </>
      )}

      <View style={styles.fabContent}>
        {children}
      </View>
    </Pressable>
  );
}

// ============================================
// GLASS PILL - Small pill button
// ============================================
interface GlassPillProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  active?: boolean;
}

export function GlassPill({ children, onPress, style, active = false }: GlassPillProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pillContainer,
        active && styles.pillActive,
        pressed && styles.buttonPressed,
        style,
      ]}
    >
      <BlurView intensity={20} tint="light" style={styles.blur} />
      <LinearGradient
        colors={
          active
            ? ['rgba(212, 145, 90, 0.9)', 'rgba(180, 110, 60, 0.9)']
            : ['rgba(255, 255, 255, 0.75)', 'rgba(245, 245, 250, 0.65)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.pillGradient}
      />
      <View style={[styles.pillBorder, active && styles.pillBorderActive]} />

      <View style={styles.pillContent}>
        {typeof children === 'string' ? (
          <Text style={[styles.pillText, active && styles.pillTextActive]}>{children}</Text>
        ) : (
          children
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Card styles
  cardContainer: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardDark: {
    backgroundColor: 'rgba(30, 30, 35, 0.3)',
  },
  blur: {
    ...StyleSheet.absoluteFillObject,
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  cardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cardBorderDark: {
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardContent: {
    padding: SPACING.md,
  },
  noPadding: {
    padding: 0,
  },

  // Button styles
  buttonContainer: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    minHeight: 48,
  },
  buttonPrimary: {
    shadowColor: '#D4915A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  buttonShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  primaryBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 180, 120, 0.5)',
  },
  secondaryBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  ghostBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  ghostBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  buttonContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm + 4,
    paddingHorizontal: SPACING.lg,
  },
  buttonText: {
    fontFamily: FONTS.sans.medium,
    fontSize: FONT_SIZES.md,
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  buttonTextPrimary: {
    color: '#FFFFFF',
    fontFamily: FONTS.sans.bold,
  },
  buttonTextGhost: {
    color: 'rgba(255, 255, 255, 0.7)',
  },

  // FAB styles
  fabContainer: {
    overflow: 'hidden',
    shadowColor: '#D4915A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  fabGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  fabShine: {
    ...StyleSheet.absoluteFillObject,
  },
  fabBorderPrimary: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 200, 150, 0.4)',
  },
  fabBorderSecondary: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  fabContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Pill styles
  pillContainer: {
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  pillActive: {
    shadowColor: '#D4915A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  pillGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  pillBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  pillBorderActive: {
    borderColor: 'rgba(255, 180, 120, 0.5)',
  },
  pillContent: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontFamily: FONTS.sans.medium,
    fontSize: FONT_SIZES.sm,
    color: 'rgba(50, 50, 55, 0.9)',
    letterSpacing: 0.5,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
});
