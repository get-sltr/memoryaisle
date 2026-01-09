import { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { FONTS, FONT_SIZES, SPACING } from '../constants/theme';
import type { SavedStore } from '../services/geofence';

interface StoreArrivalBannerProps {
  store: SavedStore;
  onDismiss: () => void;
  colors: {
    primary: string;
    paper: string;
    ink: string;
    inkLight: string;
  };
}

export function StoreArrivalBanner({ store, onDismiss, colors }: StoreArrivalBannerProps) {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide in from top
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.primary,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>📍</Text>
        <View style={styles.textContainer}>
          <Text style={styles.title}>You're at {store.name}</Text>
          {store.address && (
            <Text style={styles.subtitle}>{store.address}</Text>
          )}
        </View>
        <Pressable onPress={handleDismiss} style={styles.dismissButton}>
          <Text style={styles.dismissText}>✕</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: 12,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  icon: {
    fontSize: 24,
    marginRight: SPACING.sm,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontFamily: FONTS.sans.medium,
    fontSize: FONT_SIZES.md,
    color: '#FFFFFF',
  },
  subtitle: {
    fontFamily: FONTS.sans.regular,
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  dismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
