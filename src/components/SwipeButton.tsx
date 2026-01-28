import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../constants/theme';

const SWIPE_THRESHOLD = 0.7; // 70% of width to trigger

interface SwipeButtonProps {
  onSwipeComplete: () => void;
  label: string;
  completedLabel?: string;
  icon?: string;
  disabled?: boolean;
}

export function SwipeButton({
  onSwipeComplete,
  label,
  completedLabel = 'Added!',
  icon = '➕',
  disabled = false,
}: SwipeButtonProps) {
  const [completed, setCompleted] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const thumbWidth = 50;

  const maxSlide = Math.max(1, containerWidth - thumbWidth - 8); // 8 for padding, min 1 to avoid animation errors

  const maxSlideRef = useRef(maxSlide);
  maxSlideRef.current = maxSlide;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !completed && !disabled,
      onMoveShouldSetPanResponder: () => !completed && !disabled,
      onPanResponderGrant: () => {
        translateX.setOffset(0);
        translateX.setValue(0);
      },
      onPanResponderMove: (_evt: any, gestureState: { dx: number }) => {
        const newValue = Math.max(0, Math.min(maxSlideRef.current, gestureState.dx));
        translateX.setValue(newValue);
      },
      onPanResponderRelease: (_evt: any, gestureState: { dx: number }) => {
        translateX.flattenOffset();

        const currentMaxSlide = maxSlideRef.current;
        const progress = gestureState.dx / currentMaxSlide;

        if (progress >= SWIPE_THRESHOLD) {
          // Complete the swipe
          Animated.spring(translateX, {
            toValue: currentMaxSlide,
            useNativeDriver: true,
            friction: 8,
          }).start(() => {
            setCompleted(true);
            onSwipeComplete();
          });
        } else {
          // Reset to start
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  // Progress for background color - ensure inputRange is always valid (positive)
  const safeMaxSlide = Math.max(1, maxSlide);
  const progress = translateX.interpolate({
    inputRange: [0, safeMaxSlide],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(212, 175, 55, 0.2)', 'rgba(76, 175, 80, 0.3)'],
  });

  if (completed) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#4CAF50', '#45a049']}
          style={styles.completedGradient}
        >
          <Text style={styles.completedText}>✓ {completedLabel}</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, disabled && styles.disabled]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <BlurView intensity={15} tint="light" style={StyleSheet.absoluteFill} />
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor }]} />
      <LinearGradient
        colors={['rgba(212, 175, 55, 0.1)', 'rgba(212, 175, 55, 0.05)']}
        style={StyleSheet.absoluteFill}
      />

      {/* Track hint text */}
      <View style={styles.trackContent}>
        <Text style={styles.hintText}>Swipe to {label.toLowerCase()}</Text>
        <Text style={styles.arrowHint}>→→→</Text>
      </View>

      {/* Sliding thumb */}
      <Animated.View
        style={[
          styles.thumb,
          {
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <LinearGradient
          colors={[COLORS.gold.light, COLORS.gold.base]}
          style={styles.thumbGradient}
        >
          <Text style={styles.thumbIcon}>{icon}</Text>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 50,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  disabled: {
    opacity: 0.5,
  },
  trackContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 60, // Account for thumb
  },
  hintText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gold.dark,
  },
  arrowHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gold.base,
    marginLeft: SPACING.xs,
    opacity: 0.6,
  },
  thumb: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    width: 50,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  thumbGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbIcon: {
    fontSize: 20,
  },
  completedGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.lg,
  },
  completedText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.white,
  },
});
