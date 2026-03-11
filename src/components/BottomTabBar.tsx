import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, Text, StyleSheet, Animated, Image, ImageSourcePropType, Easing, Dimensions } from 'react-native';
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

const SCREEN_WIDTH = Dimensions.get('window').width;
const COLLAPSED_WIDTH = 44;
const COLLAPSED_RIGHT = 8;

// Custom tab icons
const TAB_ICONS = {
  list: require('../../assets/icons/list_tab.png'),
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

// Tab icons
const ListIcon = ({ active }: { active: boolean }) => (
  <GlassTabIcon source={TAB_ICONS.list} active={active} />
);

const CalendarIcon = ({ active }: { active: boolean }) => (
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
    <Text style={[styles.icon, active && styles.iconActive]}>📅</Text>
  </View>
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
  { name: 'calendar', label: 'Calendar', icon: CalendarIcon },
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
  const [expanded, setExpanded] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current; // 0 = collapsed, 1 = expanded

  const toggle = () => {
    const toValue = expanded ? 0 : 1;
    Animated.spring(slideAnim, {
      toValue,
      damping: 18,
      stiffness: 200,
      useNativeDriver: true,
    }).start();
    setExpanded(!expanded);
  };

  const handleTabPress = (routeName: string, routeKey: string, isFocused: boolean) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: routeKey,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }

    // Auto-collapse after navigation
    Animated.spring(slideAnim, {
      toValue: 0,
      damping: 18,
      stiffness: 200,
      useNativeDriver: true,
    }).start();
    setExpanded(false);
  };

  // The full bar slides in from right. translateX goes from SCREEN_WIDTH to 0.
  const barTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_WIDTH, 0],
  });

  // The collapsed pill fades out as bar expands
  const pillOpacity = slideAnim.interpolate({
    inputRange: [0, 0.3],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const pillScale = slideAnim.interpolate({
    inputRange: [0, 0.3],
    outputRange: [1, 0.8],
    extrapolate: 'clamp',
  });

  const bottomPadding = Math.max(insets.bottom, 12);

  return (
    <>
      {/* Collapsed pill - sits on right edge */}
      <Animated.View
        style={[
          styles.collapsedPill,
          {
            bottom: bottomPadding + 8,
            opacity: pillOpacity,
            transform: [{ scale: pillScale }],
          },
        ]}
        pointerEvents={expanded ? 'none' : 'auto'}
      >
        <Pressable
          onPress={toggle}
          style={styles.collapsedPillTouchable}
          accessibilityLabel="Open navigation"
          accessibilityRole="button"
        >
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.9)', 'rgba(250, 248, 245, 0.85)']}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.collapsedPillText}>{'\u00BB'}</Text>
        </Pressable>
      </Animated.View>

      {/* Expanded full bar */}
      <Animated.View
        style={[
          styles.container,
          {
            paddingBottom: bottomPadding,
            transform: [{ translateX: barTranslateX }],
          },
        ]}
        pointerEvents={expanded ? 'auto' : 'none'}
      >
        <LinearGradient
          colors={['transparent', 'rgba(200, 212, 228, 0.95)']}
          style={styles.fadeGradient}
          pointerEvents="none"
        />

        <View style={styles.navBarWrapper}>
          <View style={styles.navBar}>
            <BlurView intensity={30} tint="light" style={styles.blur} />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.85)', 'rgba(250, 250, 255, 0.75)']}
              style={styles.gradient}
            />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0)']}
              style={styles.shine}
            />
            <View style={styles.border} />

            <View style={styles.tabsContainer}>
              {/* Collapse button */}
              <Pressable
                onPress={toggle}
                style={styles.collapseButton}
                accessibilityLabel="Close navigation"
                accessibilityRole="button"
              >
                <Text style={styles.collapseButtonText}>{'\u00AB'}</Text>
              </Pressable>

              {/* Tab items */}
              {state.routes.map((route: any, index: number) => {
                const tabConfig = TABS.find((t) => t.name === route.name);
                if (!tabConfig) return null;

                const isFocused = state.index === index;

                return (
                  <TabItem
                    key={route.key}
                    label={tabConfig.label}
                    icon={tabConfig.icon}
                    active={isFocused}
                    onPress={() => handleTabPress(route.name, route.key, isFocused)}
                  />
                );
              })}
            </View>
          </View>
        </View>
      </Animated.View>
    </>
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
    <Pressable
      onPress={onPress}
      style={styles.tabItem}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
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
  // Collapsed pill on right edge
  collapsedPill: {
    position: 'absolute',
    right: COLLAPSED_RIGHT,
    width: COLLAPSED_WIDTH,
    height: COLLAPSED_WIDTH,
    borderRadius: COLLAPSED_WIDTH / 2,
    overflow: 'hidden',
    ...SHADOWS.glassElevated,
    zIndex: 100,
  },
  collapsedPillTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: COLLAPSED_WIDTH / 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  collapsedPillText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.gold.base,
    marginLeft: 2,
  },
  // Expanded bar
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    zIndex: 100,
  },
  fadeGradient: {
    ...StyleSheet.absoluteFillObject,
    top: -40,
  },
  navBarWrapper: {
    overflow: 'visible',
    padding: 4,
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
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  collapseButton: {
    width: 32,
    height: HIG.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapseButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.secondary,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    minHeight: HIG.minTouchTarget,
    justifyContent: 'center',
  },
  tabItemInner: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    minHeight: HIG.minTouchTarget,
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
    width: HIG.minTouchTarget,
    height: HIG.minTouchTarget,
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
    width: 26,
    height: 26,
    resizeMode: 'contain',
    opacity: 0.8,
  },
  tabIconImageActive: {
    opacity: 1,
  },
  icon: {
    fontSize: 22,
    opacity: 0.8,
  },
  iconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.text.secondary,
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: COLORS.white,
  },
});
