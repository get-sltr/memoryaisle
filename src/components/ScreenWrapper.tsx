import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NAV_HEIGHT } from '../constants/theme';
import { useThemeStore } from '../stores/themeStore';

interface ScreenWrapperProps {
  children: React.ReactNode;
  withBottomPadding?: boolean;
}

export function ScreenWrapper({ children, withBottomPadding = true }: ScreenWrapperProps) {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useThemeStore();

  const gradientColors = [
    colors.background.start,
    colors.background.mid1,
    colors.background.mid2,
    colors.background.end,
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Background gradient */}
      <LinearGradient
        colors={gradientColors as any}
        locations={[0, 0.4, 0.7, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.3, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient light effect - warm golden tones (hidden in dark mode) */}
      {!isDark && (
        <View style={styles.ambientLight} pointerEvents="none">
          <LinearGradient
            colors={['rgba(255,250,240,0.6)', 'transparent']}
            style={styles.ambientTopLeft}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <LinearGradient
            colors={['rgba(235, 210, 175, 0.4)', 'transparent']}
            style={styles.ambientBottomRight}
            start={{ x: 1, y: 1 }}
            end={{ x: 0, y: 0 }}
          />
          {/* Warm gold ambient */}
          <LinearGradient
            colors={['rgba(212, 165, 71, 0.08)', 'transparent']}
            style={styles.ambientGold}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 1, y: 1 }}
          />
        </View>
      )}

      {/* Content */}
      <View
        style={[
          styles.content,
          { paddingTop: insets.top },
          withBottomPadding && { paddingBottom: insets.bottom + 20 },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  ambientLight: {
    ...StyleSheet.absoluteFillObject,
  },
  ambientTopLeft: {
    position: 'absolute',
    top: '-30%',
    left: '-20%',
    width: '80%',
    height: '80%',
    borderRadius: 1000,
  },
  ambientBottomRight: {
    position: 'absolute',
    bottom: '-20%',
    right: '-20%',
    width: '70%',
    height: '70%',
    borderRadius: 1000,
  },
  ambientGold: {
    position: 'absolute',
    top: '20%',
    left: '20%',
    width: '60%',
    height: '60%',
    borderRadius: 1000,
  },
  content: {
    flex: 1,
  },
});
