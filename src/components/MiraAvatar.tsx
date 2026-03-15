import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { MiraIcon, MiraListeningIcon } from './icons';
import { COLORS } from '../constants/theme';

type MiraState = 'idle' | 'listening' | 'thinking';
type MiraSize = 'small' | 'medium' | 'large';

interface MiraAvatarProps {
  state?: MiraState;
  size?: MiraSize;
  colors?: {
    primary?: string;
    paperDark?: string;
    ink?: string;
  };
}

const SIZE_MAP: Record<MiraSize, number> = {
  small: 40,
  medium: 56,
  large: 80,
};

export function MiraAvatar({ state = 'idle', size = 'medium', colors }: MiraAvatarProps) {
  const iconSize = SIZE_MAP[size];
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Thinking state: gentle spin
  useEffect(() => {
    if (state === 'thinking') {
      const loop = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loop.start();
      return () => loop.stop();
    } else {
      spinAnim.setValue(0);
    }
  }, [state]);

  // Listening state: pulse
  useEffect(() => {
    if (state === 'listening') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const primaryColor = colors?.primary || COLORS.gold.base;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: iconSize,
          height: iconSize,
          transform: [
            { scale: pulseAnim },
            { rotate: state === 'thinking' ? spin : '0deg' },
          ],
        },
      ]}
    >
      {state === 'listening' ? (
        <MiraListeningIcon
          size={iconSize}
          color={primaryColor}
          secondaryColor={colors?.paperDark || '#E88B7A'}
          animated
        />
      ) : (
        <MiraIcon
          size={iconSize}
          color={primaryColor}
          secondaryColor={colors?.paperDark || '#D4AF37'}
          animated={state === 'idle'}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
});
