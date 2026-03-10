import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS } from '../constants/theme';

export function ErrorFallback() {
  const handleReload = () => {
    // Force a re-render by navigating to the same route
    try {
      const { router } = require('expo-router');
      router.replace('/(app)');
    } catch {
      // Fallback: no-op, user can manually restart
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>!</Text>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>
        An unexpected error occurred. Please try again.
      </Text>
      <Pressable style={styles.button} onPress={handleReload}>
        <Text style={styles.buttonText}>Reload</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xxl,
    backgroundColor: COLORS.background?.start || '#FAF8F5',
  },
  icon: {
    fontSize: 48,
    fontWeight: '700',
    color: COLORS.gold?.base || '#D4A547',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.title || 22,
    fontWeight: '700',
    color: COLORS.text?.primary || '#1A1A1A',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: FONT_SIZES.md || 16,
    color: COLORS.text?.secondary || '#666',
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  button: {
    backgroundColor: COLORS.gold?.base || '#D4A547',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg || 12,
  },
  buttonText: {
    fontSize: FONT_SIZES.md || 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
