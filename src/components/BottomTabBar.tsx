import React, { useEffect, useRef } from 'react';
import { View, Pressable, Text, StyleSheet, Animated, Image, ImageSourcePropType, Easing } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  FONT_SIZES,
  SHADOWS,
  HIG,
} from '../constants/theme';
// MiraIcon removed - Mira now uses floating button only

// Animated Rose Gold Border Component
function AnimatedRoseGoldBorder() {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Continuous rotation animation for gradient border
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Pulsing glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <>
      {/* Pulsing glow underneath */}
      <Animated.View
        style={[
          styles.pulsingGlow,
          { opacity: pulseAnim }
        ]}
      />
      {/* Animated gradient border */}
      <View style={styles.animatedBorderContainer}>
        <Animated.View
          style={[
            styles.rotatingGradient,
            { transform: [{ rotate }] }
          ]}
        >
          <LinearGradient
            colors={['#E8B8D4', '#D4A547', '#FFB6C1', '#D4A547', '#E8B8D4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </>
  );
}

// Custom tab icons
const TAB_ICONS = {
  list: require('../../assets/icons/list_tab.png'),
  plan: require('../../assets/icons/plan_tab.png'),
  recipes: require('../../assets/icons/Recipes_tab.png'),
};

// Glass icon wrapper component
const GlassTabIcon = ({ source, active }: { source: ImageSourcePropType; active: boolean }) => (
  <View style={[styles.iconGlassWrapper, active && styles.iconGlassWrapperActive]}>
    <LinearGradient
      colors={active
        ? ['rgba(212, 175, 55, 0.25)', 'rgba(212, 175, 55, 0.1)']
        : ['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.2)']}
      style={StyleSheet.absoluteFill}
    />
    <LinearGradient
      colors={['rgba(255, 255, 255, 0.7)', 'transparent']}
      start={{ x: 0.3, y: 0 }}
      end={{ x: 0.7, y: 0.6 }}
      style={styles.iconShine}
    />
    <Image source={source} style={[styles.tabIconImage, active && styles.tabIconImageActive]} />
  </View>
);

// Tab icons as simple components
const ListIcon = ({ active }: { active: boolean }) => (
  <GlassTabIcon source={TAB_ICONS.list} active={active} />
);

const PlanIcon = ({ active }: { active: boolean }) => (
  <GlassTabIcon source={TAB_ICONS.plan} active={active} />
);

const FavsIcon = ({ active }: { active: boolean }) => (
  <View style={[styles.iconGlassWrapper, active && styles.iconGlassWrapperActive]}>
    <LinearGradient
      colors={active
        ? ['rgba(212, 175, 55, 0.25)', 'rgba(212, 175, 55, 0.1)']
        : ['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.2)']}
      style={StyleSheet.absoluteFill}
    />
    <LinearGradient
      colors={['rgba(255, 255, 255, 0.7)', 'transparent']}
      start={{ x: 0.3, y: 0 }}
      end={{ x: 0.7, y: 0.6 }}
      style={styles.iconShine}
    />
    <Text style={[styles.icon, active && styles.iconActive]}>⭐</Text>
  </View>
);

const SettingsIcon = ({ active }: { active: boolean }) => (
  <View style={[styles.iconGlassWrapper, active && styles.iconGlassWrapperActive]}>
    <LinearGradient
      colors={active
        ? ['rgba(212, 175, 55, 0.25)', 'rgba(212, 175, 55, 0.1)']
        : ['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.2)']}
      style={StyleSheet.absoluteFill}
    />
    <LinearGradient
      colors={['rgba(255, 255, 255, 0.7)', 'transparent']}
      start={{ x: 0.3, y: 0 }}
      end={{ x: 0.7, y: 0.6 }}
      style={styles.iconShine}
    />
    <Text style={[styles.icon, active && styles.iconActive]}>⚙️</Text>
  </View>
);

// Receipt Scan Icon with special gold styling (similar ring effect)
const ReceiptScanIcon = ({ active }: { active: boolean }) => (
  <View style={[styles.iconGlassWrapper, styles.receiptIconWrapper, active && styles.iconGlassWrapperActive]}>
    <LinearGradient
      colors={active
        ? ['rgba(212, 175, 55, 0.35)', 'rgba(180, 200, 220, 0.2)']
        : ['rgba(180, 200, 220, 0.3)', 'rgba(212, 175, 55, 0.15)']}
      style={StyleSheet.absoluteFill}
    />
    <LinearGradient
      colors={['rgba(255, 255, 255, 0.7)', 'transparent']}
      start={{ x: 0.3, y: 0 }}
      end={{ x: 0.7, y: 0.6 }}
      style={styles.iconShine}
    />
    <Text style={[styles.icon, active && styles.iconActive]}>🧾</Text>
  </View>
);

interface TabConfig {
  name: string;
  label: string;
  icon: (props: { active: boolean }) => React.ReactNode;
}

const TABS: TabConfig[] = [
  { name: 'index', label: 'List', icon: ListIcon },
  { name: 'mealplan', label: 'Plan', icon: PlanIcon },
  { name: 'receipts', label: 'Scan', icon: ReceiptScanIcon },
  { name: 'favorites', label: 'Favs', icon: FavsIcon },
  { name: 'settings', label: 'Menu', icon: SettingsIcon },
];

interface BottomTabBarProps {
  readonly state: any;
  readonly navigation: any;
}

export function BottomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {/* Background gradient fade */}
      <LinearGradient
        colors={['transparent', 'rgba(200, 212, 228, 0.95)']}
        style={styles.fadeGradient}
        pointerEvents="none"
      />

      {/* Glass nav bar wrapper - allows animated border to extend outside */}
      <View style={styles.navBarWrapper}>
        {/* Animated rose gold border effect */}
        <AnimatedRoseGoldBorder />

        {/* Glass nav bar content */}
        <View style={styles.navBar}>
          <BlurView intensity={30} tint="light" style={styles.blur} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.85)', 'rgba(250, 250, 255, 0.75)']}
            style={styles.gradient}
          />
          {/* Top shine */}
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0)']}
            style={styles.shine}
          />
          {/* Border */}
          <View style={styles.border} />

          {/* Tab items */}
          <View style={styles.tabsContainer}>
            {state.routes.map((route: any, index: number) => {
              const tabConfig = TABS.find((t) => t.name === route.name);
              if (!tabConfig) return null;

              const isFocused = state.index === index;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              return (
                <TabItem
                  key={route.key}
                  label={tabConfig.label}
                  icon={tabConfig.icon}
                  active={isFocused}
                  onPress={onPress}
                />
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

interface TabItemProps {
  label: string;
  icon: (props: { active: boolean }) => React.ReactNode;
  active: boolean;
  onPress: () => void;
}

function TabItem({ label, icon: Icon, active, onPress }: TabItemProps) {
  const scaleAnim = useRef(new Animated.Value(active ? 1 : 0.95)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: active ? 1 : 0.95,
      damping: 15,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  }, [active]);

  return (
    <Pressable onPress={onPress} style={styles.tabItem}>
      <Animated.View
        style={[
          styles.tabItemInner,
          active && styles.tabItemActive,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        {active && (
          <>
            <LinearGradient
              colors={[COLORS.gold.light, COLORS.gold.base]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.activeGradient}
            />
            <View style={styles.activeBorder} />
          </>
        )}
        <View style={styles.tabContent}>
          <Icon active={active} />
          <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
            {label}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  fadeGradient: {
    ...StyleSheet.absoluteFillObject,
    top: -40,
  },
  navBarWrapper: {
    // Allow animated border to extend outside
    overflow: 'visible',
    padding: 4, // Space for the animated border
  },
  navBar: {
    borderRadius: BORDER_RADIUS.xxl,
    overflow: 'hidden',
    ...SHADOWS.glassElevated,
  },
  blur: {
    ...StyleSheet.absoluteFillObject,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  shine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    borderColor: COLORS.frost.border,
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: SPACING.sm,        // Was xs+2 (6pt) - now 8pt
    paddingHorizontal: SPACING.sm,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    minHeight: HIG.minTouchTarget,      // Ensure 44pt minimum touch target
    justifyContent: 'center',
  },
  tabItemInner: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    minHeight: HIG.minTouchTarget,      // Ensure 44pt minimum
  },
  tabItemActive: {
    ...SHADOWS.goldGlow,
  },
  activeGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
  },
  activeBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 220, 180, 0.5)',
  },
  tabContent: {
    alignItems: 'center',
    gap: 4,
  },
  iconGlassWrapper: {
    width: HIG.minTouchTarget,    // Was 32 - now 44pt for HIG compliance
    height: HIG.minTouchTarget,   // Was 32 - now 44pt for HIG compliance
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  iconGlassWrapperActive: {
    borderColor: 'rgba(212, 175, 55, 0.4)',
    shadowColor: COLORS.gold.base,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  receiptIconWrapper: {
    borderColor: 'rgba(180, 200, 220, 0.4)',
  },
  iconShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  tabIconImage: {
    width: 26,            // Was 22 - slightly larger for visibility
    height: 26,           // Was 22
    resizeMode: 'contain',
    opacity: 0.8,
  },
  tabIconImageActive: {
    opacity: 1,
  },
  icon: {
    fontSize: 22,         // Was 18 - larger for visibility
    opacity: 0.8,
  },
  iconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: FONT_SIZES.xs,    // Now 11pt (was 10pt) - HIG minimum
    fontWeight: '600',
    color: COLORS.text.secondary,
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: COLORS.white,
  },
  // Animated border styles
  pulsingGlow: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: BORDER_RADIUS.xxl + 8,
    backgroundColor: 'transparent',
    shadowColor: '#E8B8D4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  animatedBorderContainer: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: BORDER_RADIUS.xxl + 2,
    overflow: 'hidden',
  },
  rotatingGradient: {
    width: '200%',
    height: '200%',
    position: 'absolute',
    top: '-50%',
    left: '-50%',
  },
});
