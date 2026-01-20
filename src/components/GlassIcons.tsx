// Custom Liquid Glass Icons - Seamlessly integrated into the glass aesthetic
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Ellipse, Rect, G, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { COLORS } from '../constants/theme';

interface IconProps {
  size?: number;
  color?: string;
  glassStyle?: boolean;
}

// Glass wrapper for icons
export function GlassIconWrapper({
  children,
  size = 44,
  variant = 'default'
}: {
  children: React.ReactNode;
  size?: number;
  variant?: 'default' | 'gold' | 'subtle';
}) {
  const gradientColors = {
    default: ['rgba(255, 255, 255, 0.5)', 'rgba(245, 248, 255, 0.3)'] as const,
    gold: ['rgba(247, 229, 179, 0.4)', 'rgba(212, 165, 71, 0.2)'] as const,
    subtle: ['rgba(255, 255, 255, 0.3)', 'rgba(250, 250, 255, 0.15)'] as const,
  };

  return (
    <View style={[styles.glassWrapper, { width: size, height: size, borderRadius: size * 0.35 }]}>
      <LinearGradient
        colors={gradientColors[variant]}
        style={styles.glassGradient}
      />
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.4)', 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={styles.glassShine}
      />
      <View style={[styles.glassBorder, { borderRadius: size * 0.35 }]} />
      {children}
    </View>
  );
}

// Family/People Icon
export function FamilyGlassIcon({ size = 24, color = COLORS.gold.dark }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="7" r="3" fill={color} opacity={0.9} />
      <Circle cx="15" cy="7" r="3" fill={color} opacity={0.7} />
      <Path
        d="M3 18c0-3 3-5 6-5s6 2 6 5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M15 13c2 0 4 1.5 4 4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
        opacity={0.7}
      />
    </Svg>
  );
}

// Location Pin Icon
export function LocationGlassIcon({ size = 24, color = COLORS.gold.dark }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        fill={color}
        opacity={0.85}
      />
      <Circle cx="12" cy="9" r="2.5" fill="white" opacity={0.9} />
    </Svg>
  );
}

// Logout/Door Icon
export function LogoutGlassIcon({ size = 24, color = COLORS.error }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16 17l5-5-5-5M21 12H9"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Star Icon
export function StarGlassIcon({ size = 24, color = COLORS.gold.base }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill={color}
        opacity={0.9}
      />
    </Svg>
  );
}

// Share Icon
export function ShareGlassIcon({ size = 24, color = COLORS.text.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="18" cy="5" r="3" fill={color} opacity={0.8} />
      <Circle cx="6" cy="12" r="3" fill={color} opacity={0.8} />
      <Circle cx="18" cy="19" r="3" fill={color} opacity={0.8} />
      <Path
        d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.6}
      />
    </Svg>
  );
}

// QR Code Icon
export function QRCodeGlassIcon({ size = 24, color = COLORS.text.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="7" height="7" rx="1" fill={color} opacity={0.8} />
      <Rect x="14" y="3" width="7" height="7" rx="1" fill={color} opacity={0.8} />
      <Rect x="3" y="14" width="7" height="7" rx="1" fill={color} opacity={0.8} />
      <Rect x="14" y="14" width="3" height="3" rx="0.5" fill={color} opacity={0.6} />
      <Rect x="18" y="14" width="3" height="3" rx="0.5" fill={color} opacity={0.6} />
      <Rect x="14" y="18" width="3" height="3" rx="0.5" fill={color} opacity={0.6} />
      <Rect x="18" y="18" width="3" height="3" rx="0.5" fill={color} opacity={0.6} />
    </Svg>
  );
}

// Grocery/Cart Icon
export function CartGlassIcon({ size = 24, color = COLORS.gold.dark }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6z"
        fill={color}
        opacity={0.2}
        stroke={color}
        strokeWidth={1.5}
      />
      <Path
        d="M3 6h18"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M16 10a4 4 0 01-8 0"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

// Milk Icon
export function MilkGlassIcon({ size = 32, color = COLORS.platinum.mid }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 2h8l2 4v14a2 2 0 01-2 2H8a2 2 0 01-2-2V6l2-4z"
        fill="white"
        stroke={color}
        strokeWidth={1.5}
      />
      <Path
        d="M6 6h12"
        stroke={color}
        strokeWidth={1.5}
      />
      <Path
        d="M8 12h8v6a1 1 0 01-1 1H9a1 1 0 01-1-1v-6z"
        fill={COLORS.platinum.light}
        opacity={0.5}
      />
    </Svg>
  );
}

// Egg Icon
export function EggGlassIcon({ size = 32, color = COLORS.gold.light }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3c-3.5 0-7 4.5-7 10 0 4 3 8 7 8s7-4 7-8c0-5.5-3.5-10-7-10z"
        fill={color}
        stroke={COLORS.gold.base}
        strokeWidth={1}
      />
      <Path
        d="M9 10c1-2 2-3 3-3"
        stroke="white"
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.6}
      />
    </Svg>
  );
}

// Bread Icon
export function BreadGlassIcon({ size = 32, color = COLORS.gold.base }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 8c0-2.5 3-4 7-4s7 1.5 7 4c0 1-0.5 2-1 2.5v9.5a2 2 0 01-2 2H8a2 2 0 01-2-2v-9.5C5.5 10 5 9 5 8z"
        fill={color}
        opacity={0.8}
      />
      <Path
        d="M8 10v8M12 10v8M16 10v8"
        stroke={COLORS.gold.dark}
        strokeWidth={1}
        opacity={0.3}
      />
    </Svg>
  );
}

// Chicken Icon
export function ChickenGlassIcon({ size = 32, color = COLORS.gold.base }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 5c2 0 4 2 4 4 0 1.5-1 3-2 4l1 8H6l1-8c-1-1-2-2.5-2-4 0-2 2-4 4-4"
        fill={color}
        opacity={0.8}
      />
      <Circle cx="12" cy="8" r="4" fill={COLORS.gold.light} />
      <Path
        d="M10 7.5a0.5 0.5 0 100-1 0.5 0.5 0 000 1zM14 7.5a0.5 0.5 0 100-1 0.5 0.5 0 000 1z"
        fill={COLORS.text.primary}
      />
    </Svg>
  );
}

// Avocado Icon
export function AvocadoGlassIcon({ size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2c-4 0-7 6-7 12 0 4 3 8 7 8s7-4 7-8c0-6-3-12-7-12z"
        fill="#7EB88A"
        opacity={0.9}
      />
      <Path
        d="M12 10c-2 0-4 2-4 5 0 2 2 4 4 4s4-2 4-4c0-3-2-5-4-5z"
        fill="#F7E5B3"
      />
      <Circle cx="12" cy="14" r="2.5" fill="#8B4513" opacity={0.8} />
    </Svg>
  );
}

// Cheese Icon
export function CheeseGlassIcon({ size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 18l10-14 10 14H2z"
        fill={COLORS.gold.base}
        opacity={0.9}
      />
      <Circle cx="8" cy="15" r="1.5" fill={COLORS.gold.dark} opacity={0.4} />
      <Circle cx="14" cy="13" r="2" fill={COLORS.gold.dark} opacity={0.4} />
      <Circle cx="17" cy="16" r="1" fill={COLORS.gold.dark} opacity={0.4} />
    </Svg>
  );
}

// Banana Icon
export function BananaGlassIcon({ size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 16c2-6 6-10 12-12 1 4-1 10-6 14-3 2-6 2-6-2z"
        fill="#F7E5B3"
        stroke={COLORS.gold.base}
        strokeWidth={1}
      />
      <Path
        d="M16 4c0.5 0.5 1 1.5 0.5 2.5"
        stroke="#8B4513"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// Yogurt Icon
export function YogurtGlassIcon({ size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 6h12l-1 14a2 2 0 01-2 2h-6a2 2 0 01-2-2L6 6z"
        fill="white"
        stroke={COLORS.platinum.mid}
        strokeWidth={1.5}
      />
      <Path
        d="M5 6h14v-2a1 1 0 00-1-1H6a1 1 0 00-1 1v2z"
        fill={COLORS.gold.light}
      />
      <Path
        d="M9 10c0.5 1 1.5 1.5 3 1.5s2.5-0.5 3-1.5"
        stroke={COLORS.platinum.base}
        strokeWidth={1}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

// Clock/Time Icon
export function ClockGlassIcon({ size = 16, color = COLORS.text.secondary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={2} fill="none" opacity={0.8} />
      <Path
        d="M12 6v6l4 2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.8}
      />
    </Svg>
  );
}

// Servings/People Icon
export function ServingsGlassIcon({ size = 16, color = COLORS.text.secondary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="7" r="3" fill={color} opacity={0.6} />
      <Circle cx="15" cy="7" r="3" fill={color} opacity={0.4} />
      <Path
        d="M4 18c0-2.5 2.5-4.5 5-4.5s5 2 5 4.5"
        stroke={color}
        strokeWidth={2}
        fill="none"
        opacity={0.6}
      />
      <Path
        d="M15 13.5c1.5 0 3 1.5 3 3.5"
        stroke={color}
        strokeWidth={2}
        fill="none"
        opacity={0.4}
      />
    </Svg>
  );
}

// Sparkle/AI Icon
export function SparkleGlassIcon({ size = 16, color = COLORS.gold.base }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2z"
        fill={color}
        opacity={0.9}
      />
      <Path
        d="M19 15l0.75 2.25L22 18l-2.25 0.75L19 21l-0.75-2.25L16 18l2.25-0.75L19 15z"
        fill={color}
        opacity={0.6}
      />
    </Svg>
  );
}

// Check Icon
export function CheckGlassIcon({ size = 20, color = COLORS.success }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6L9 17l-5-5"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Plus Icon
export function PlusGlassIcon({ size = 24, color = COLORS.text.primary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// Recipe/Book Icon
export function RecipeGlassIcon({ size = 24, color = COLORS.gold.dark }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 4h12a2 2 0 012 2v14a2 2 0 01-2 2H4V4z"
        fill={color}
        opacity={0.2}
        stroke={color}
        strokeWidth={1.5}
      />
      <Path
        d="M8 8h6M8 12h4"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M18 4h2v16a2 2 0 01-2 2"
        stroke={color}
        strokeWidth={1.5}
        opacity={0.6}
      />
    </Svg>
  );
}

// ==================== MENU & PROFILE ICONS ====================

// List Icon
export function ListGlassIcon({ size = 24, color = COLORS.gold.dark }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 6h13M8 12h13M8 18h13"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx="4" cy="6" r="2" fill={color} opacity={0.8} />
      <Circle cx="4" cy="12" r="2" fill={color} opacity={0.8} />
      <Circle cx="4" cy="18" r="2" fill={color} opacity={0.8} />
    </Svg>
  );
}

// Calendar/Plan Icon
export function PlanGlassIcon({ size = 24, color = COLORS.gold.dark }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="4" width="18" height="18" rx="2" fill={color} opacity={0.15} stroke={color} strokeWidth={1.5} />
      <Path
        d="M3 10h18"
        stroke={color}
        strokeWidth={1.5}
      />
      <Path
        d="M8 2v4M16 2v4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx="8" cy="15" r="1.5" fill={color} opacity={0.6} />
      <Circle cx="12" cy="15" r="1.5" fill={color} opacity={0.6} />
      <Circle cx="16" cy="15" r="1.5" fill={color} opacity={0.6} />
    </Svg>
  );
}

// Heart/Favorites Icon
export function FavoritesGlassIcon({ size = 24, color = '#E85A4F' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill={color}
        opacity={0.85}
      />
    </Svg>
  );
}

// User Profile Icon
export function ProfileGlassIcon({ size = 24, color = COLORS.gold.dark }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" fill={color} opacity={0.8} />
      <Path
        d="M4 20c0-4 4-6 8-6s8 2 8 6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        fill={color}
        fillOpacity={0.2}
      />
    </Svg>
  );
}

// Family/Heart Home Icon
export function FamilyHomeGlassIcon({ size = 24, color = COLORS.gold.dark }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 12l9-9 9 9"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10"
        fill={color}
        opacity={0.15}
        stroke={color}
        strokeWidth={1.5}
      />
      <Path
        d="M12 15.5l-0.7-0.6c-2.5-2.3-4.3-4-4.3-5.9 0-1.5 1.2-2.7 2.7-2.7.9 0 1.7.4 2.3 1 .6-.6 1.4-1 2.3-1 1.5 0 2.7 1.2 2.7 2.7 0 1.9-1.8 3.6-4.3 5.9l-.7.6z"
        fill="#E85A4F"
        opacity={0.9}
      />
    </Svg>
  );
}

// Sparkle/Magic Moment Icon
export function MomentGlassIcon({ size = 24, color = COLORS.gold.base }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z"
        fill={color}
        opacity={0.9}
      />
      <Path
        d="M5 5l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"
        fill={color}
        opacity={0.5}
      />
      <Path
        d="M18 16l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z"
        fill={color}
        opacity={0.5}
      />
    </Svg>
  );
}

// Settings Gear Icon
export function SettingsGlassIcon({ size = 24, color = COLORS.text.secondary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={2} />
      <Path
        d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ==================== CATEGORY ICONS ====================

// Produce/Leaf Icon
export function ProduceGlassIcon({ size = 24, color = '#4CAF50' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2c-4 2-8 6-8 12 0 4 2 6 4 6 1 0 2-0.5 2-2 0-3 2-5 2-8 0 3 2 5 2 8 0 1.5 1 2 2 2 2 0 4-2 4-6 0-6-4-10-8-12z"
        fill={color}
        opacity={0.85}
      />
      <Path
        d="M12 6v10"
        stroke={color}
        strokeWidth={1.5}
        opacity={0.5}
      />
    </Svg>
  );
}

// Dairy/Milk Bottle Icon
export function DairyGlassIcon({ size = 24, color = '#42A5F5' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 2h8v3l2 3v12a2 2 0 01-2 2H8a2 2 0 01-2-2V8l2-3V2z"
        fill="white"
        stroke={color}
        strokeWidth={1.5}
      />
      <Path
        d="M6 8h12"
        stroke={color}
        strokeWidth={1.5}
      />
      <Path
        d="M8 12h8v7a1 1 0 01-1 1H9a1 1 0 01-1-1v-7z"
        fill={color}
        opacity={0.3}
      />
    </Svg>
  );
}

// Meat/Steak Icon
export function MeatGlassIcon({ size = 24, color = '#EF5350' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12c0-4 3-8 8-8s8 4 8 8-3 8-8 8-8-4-8-8z"
        fill={color}
        opacity={0.8}
      />
      <Path
        d="M8 10c0-1.5 2-3 4-3s4 1.5 4 3-2 3-4 3-4-1.5-4-3z"
        fill="#FFCDD2"
      />
      <Circle cx="9" cy="14" r="1.5" fill="#FFCDD2" opacity={0.8} />
    </Svg>
  );
}

// Poultry/Chicken Drumstick Icon
export function PoultryGlassIcon({ size = 24, color = '#FF7043' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 4c3 0 6 2 7 5 1 3 0 6-2 8l-2 5h-2l1-5c-3 0-5-2-5-5s1-8 3-8z"
        fill={color}
        opacity={0.85}
      />
      <Path
        d="M11 17l1-4"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Circle cx="12" cy="8" r="3" fill="#FFE0B2" />
    </Svg>
  );
}

// Seafood/Fish Icon
export function SeafoodGlassIcon({ size = 24, color = '#26C6DA' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 12c4-6 10-6 14-2l4-3v10l-4-3c-4 4-10 4-14-2z"
        fill={color}
        opacity={0.85}
      />
      <Circle cx="7" cy="11" r="1.5" fill="white" />
      <Path
        d="M12 9c1 1 1 3 0 4"
        stroke="white"
        strokeWidth={1}
        opacity={0.5}
      />
    </Svg>
  );
}

// Bakery/Bread Loaf Icon
export function BakeryGlassIcon({ size = 24, color = '#D4A574' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 10c0-3 4-5 8-5s8 2 8 5v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8z"
        fill={color}
        opacity={0.85}
      />
      <Path
        d="M8 10v8M12 10v8M16 10v8"
        stroke={color}
        strokeWidth={1}
        opacity={0.4}
      />
      <Path
        d="M4 10c0-1.5 4-3 8-3s8 1.5 8 3"
        stroke="#8B4513"
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.4}
      />
    </Svg>
  );
}

// Frozen/Snowflake Icon
export function FrozenGlassIcon({ size = 24, color = '#81D4FA' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2v20M2 12h20"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M5 5l14 14M19 5L5 19"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M12 5l-2 2 2 2 2-2-2-2zM12 15l-2 2 2 2 2-2-2-2zM5 12l2-2 2 2-2 2-2-2zM15 12l2-2 2 2-2 2-2-2z"
        fill={color}
        opacity={0.5}
      />
    </Svg>
  );
}

// Pantry/Jar Icon
export function PantryGlassIcon({ size = 24, color = '#8D6E63' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="6" y="6" width="12" height="14" rx="2" fill={color} opacity={0.25} stroke={color} strokeWidth={1.5} />
      <Path
        d="M8 3h8v3H8V3z"
        fill={color}
        opacity={0.6}
      />
      <Path
        d="M9 10h6M9 13h4"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.5}
      />
    </Svg>
  );
}

// Beverages/Bottle Icon
export function BeveragesGlassIcon({ size = 24, color = '#7E57C2' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 2h6v4l2 2v12a2 2 0 01-2 2H9a2 2 0 01-2-2V8l2-2V2z"
        fill={color}
        opacity={0.25}
        stroke={color}
        strokeWidth={1.5}
      />
      <Path
        d="M7 8h10"
        stroke={color}
        strokeWidth={1.5}
      />
      <Path
        d="M10 2v4M14 2v4"
        stroke={color}
        strokeWidth={1}
        opacity={0.5}
      />
    </Svg>
  );
}

// Snacks/Cookie Icon
export function SnacksGlassIcon({ size = 24, color = '#FFB74D' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" fill={color} opacity={0.85} />
      <Circle cx="9" cy="9" r="1.5" fill="#8D6E63" />
      <Circle cx="14" cy="8" r="1" fill="#8D6E63" />
      <Circle cx="10" cy="14" r="1.5" fill="#8D6E63" />
      <Circle cx="15" cy="13" r="1" fill="#8D6E63" />
      <Circle cx="12" cy="11" r="1" fill="#8D6E63" opacity={0.7} />
    </Svg>
  );
}

// Household/Home Icon
export function HouseholdGlassIcon({ size = 24, color = '#78909C' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 12l9-9 9 9"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10"
        fill={color}
        opacity={0.2}
        stroke={color}
        strokeWidth={1.5}
      />
      <Rect x="9" y="14" width="6" height="7" fill={color} opacity={0.4} />
    </Svg>
  );
}

// Deli/Sandwich Icon
export function DeliGlassIcon({ size = 24, color = '#A1887F' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Bread top */}
      <Path
        d="M4 10c0-2 2-4 8-4s8 2 8 4H4z"
        fill={color}
        opacity={0.25}
        stroke={color}
        strokeWidth={1.5}
      />
      {/* Fillings */}
      <Path
        d="M5 10h14v4H5z"
        fill={color}
        opacity={0.4}
      />
      {/* Lettuce wave */}
      <Path
        d="M4 11c1 1 2-1 4 0s2 1 4 0 2-1 4 0 2 1 4 0"
        stroke="#66BB6A"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* Bread bottom */}
      <Path
        d="M4 14c0 2 2 4 8 4s8-2 8-4H4z"
        fill={color}
        opacity={0.25}
        stroke={color}
        strokeWidth={1.5}
      />
    </Svg>
  );
}

// Breakfast/Coffee Icon
export function BreakfastGlassIcon({ size = 24, color = '#8D6E63' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Coffee cup */}
      <Path
        d="M6 8h10v10a2 2 0 01-2 2H8a2 2 0 01-2-2V8z"
        fill={color}
        opacity={0.25}
        stroke={color}
        strokeWidth={1.5}
      />
      {/* Handle */}
      <Path
        d="M16 10h1a2 2 0 012 2v1a2 2 0 01-2 2h-1"
        stroke={color}
        strokeWidth={1.5}
        fill="none"
      />
      {/* Steam */}
      <Path
        d="M8 5c0-1 1-2 1-2s1 1 1 2M11 4c0-1 1-2 1-2s1 1 1 2M14 5c0-1 1-2 1-2s1 1 1 2"
        stroke={color}
        strokeWidth={1}
        strokeLinecap="round"
        opacity={0.5}
      />
    </Svg>
  );
}

// International/Globe Icon
export function InternationalGlassIcon({ size = 24, color = '#7E57C2' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Globe */}
      <Circle
        cx="12"
        cy="12"
        r="9"
        fill={color}
        opacity={0.2}
        stroke={color}
        strokeWidth={1.5}
      />
      {/* Longitude line */}
      <Ellipse
        cx="12"
        cy="12"
        rx="4"
        ry="9"
        stroke={color}
        strokeWidth={1}
        opacity={0.5}
      />
      {/* Latitude lines */}
      <Path
        d="M3 12h18M5 8h14M5 16h14"
        stroke={color}
        strokeWidth={1}
        opacity={0.5}
      />
    </Svg>
  );
}

// Baby/Bottle Icon
export function BabyGlassIcon({ size = 24, color = '#F48FB1' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Bottle body */}
      <Path
        d="M8 8h8v12a2 2 0 01-2 2h-4a2 2 0 01-2-2V8z"
        fill={color}
        opacity={0.25}
        stroke={color}
        strokeWidth={1.5}
      />
      {/* Nipple */}
      <Path
        d="M10 8V6a2 2 0 014 0v2"
        fill={color}
        opacity={0.3}
        stroke={color}
        strokeWidth={1.5}
      />
      {/* Cap */}
      <Path
        d="M9 4h6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      {/* Measurement lines */}
      <Path
        d="M8 12h2M8 15h3M8 18h2"
        stroke={color}
        strokeWidth={1}
        opacity={0.5}
      />
    </Svg>
  );
}

// Other/Basket Icon
export function OtherGlassIcon({ size = 24, color = '#9E9E9E' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 8h14l-2 12H7L5 8z"
        fill={color}
        opacity={0.25}
        stroke={color}
        strokeWidth={1.5}
      />
      <Path
        d="M3 8h18"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M8 8V6a4 4 0 018 0v2"
        stroke={color}
        strokeWidth={1.5}
        fill="none"
      />
    </Svg>
  );
}

// ==================== TRIP/ADVENTURE ICON ====================

export function TripGlassIcon({ size = 24, color = COLORS.gold.dark }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Tent/Mountain */}
      <Path
        d="M2 20L12 4L22 20H2Z"
        fill={color}
        opacity={0.15}
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* Tent opening */}
      <Path
        d="M9 20L12 14L15 20"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* Sun */}
      <Circle cx="18" cy="6" r="2" fill={color} opacity={0.5} />
      {/* Sun rays */}
      <Path
        d="M18 2.5v1M18 8.5v1M21 6h1M14 6h1"
        stroke={color}
        strokeWidth={1}
        strokeLinecap="round"
        opacity={0.5}
      />
    </Svg>
  );
}

// ==================== CALENDAR ICON ====================

export function CalendarGlassIcon({ size = 24, color = COLORS.gold.dark }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Calendar body */}
      <Rect
        x="3"
        y="4"
        width="18"
        height="18"
        rx="3"
        fill={color}
        opacity={0.15}
        stroke={color}
        strokeWidth={1.5}
      />
      {/* Top bar */}
      <Path
        d="M3 9h18"
        stroke={color}
        strokeWidth={1.5}
      />
      {/* Calendar rings */}
      <Path
        d="M8 2v4M16 2v4"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* Date dots */}
      <Circle cx="8" cy="14" r="1.5" fill={color} />
      <Circle cx="12" cy="14" r="1.5" fill={color} />
      <Circle cx="16" cy="14" r="1.5" fill={color} />
      <Circle cx="8" cy="18" r="1.5" fill={color} opacity={0.5} />
      <Circle cx="12" cy="18" r="1.5" fill={color} opacity={0.5} />
    </Svg>
  );
}

// ==================== ALLERGY ICONS ====================

// Allergy Warning Icon (small badge for list items)
export function AllergyBadgeIcon({ size = 16, color = '#EF5350' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" fill={color} opacity={0.9} />
      <Path
        d="M12 7v6"
        stroke="white"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Circle cx="12" cy="16.5" r="1.5" fill="white" />
    </Svg>
  );
}

// Allergy Shield Icon (for settings/profile)
export function AllergyShieldIcon({ size = 24, color = '#EF5350' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L4 6v6c0 5.25 3.4 10.15 8 12 4.6-1.85 8-6.75 8-12V6l-8-4z"
        fill={color}
        opacity={0.2}
        stroke={color}
        strokeWidth={1.5}
      />
      <Path
        d="M12 8v4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx="12" cy="15" r="1" fill={color} />
    </Svg>
  );
}

// Map category IDs to icon components
export const CategoryIcons: Record<string, React.FC<IconProps>> = {
  produce: ProduceGlassIcon,
  dairy: DairyGlassIcon,
  meat: MeatGlassIcon,
  poultry: PoultryGlassIcon,
  seafood: SeafoodGlassIcon,
  deli: DeliGlassIcon,
  bakery: BakeryGlassIcon,
  frozen: FrozenGlassIcon,
  pantry: PantryGlassIcon,
  beverages: BeveragesGlassIcon,
  breakfast: BreakfastGlassIcon,
  snacks: SnacksGlassIcon,
  international: InternationalGlassIcon,
  baby: BabyGlassIcon,
  household: HouseholdGlassIcon,
  other: OtherGlassIcon,
};

const styles = StyleSheet.create({
  glassWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glassGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  glassShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  glassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
});
