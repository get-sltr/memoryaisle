import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, {
  Path,
  Circle,
  G,
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Ellipse,
} from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

interface IconProps {
  size?: number;
  color?: string;
  secondaryColor?: string;
  animated?: boolean;
}

/**
 * Mira Icon - The AI Assistant
 * A gentle, glowing orb with flowing curves representing wisdom and helpfulness
 * Inspired by a pearl with soft internal light
 */
export function MiraIcon({ size = 24, color = '#6B7F59', secondaryColor = '#8FA878', animated = false }: IconProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (animated) {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.1,
              duration: 1500,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1500,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 0.9,
              duration: 1500,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.6,
              duration: 1500,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    }
  }, [animated]);

  return (
    <Animated.View style={{ transform: [{ scale: animated ? pulseAnim : 1 }] }}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Defs>
          <LinearGradient id="miraGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={secondaryColor} stopOpacity="0.9" />
            <Stop offset="50%" stopColor={color} stopOpacity="1" />
            <Stop offset="100%" stopColor={secondaryColor} stopOpacity="0.8" />
          </LinearGradient>
          <LinearGradient id="miraInner" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.1" />
          </LinearGradient>
        </Defs>

        {/* Outer glow ring */}
        <Circle cx="24" cy="24" r="20" fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.3" />

        {/* Main orb */}
        <Circle cx="24" cy="24" r="16" fill="url(#miraGradient)" />

        {/* Inner highlight - top left */}
        <Ellipse cx="19" cy="19" rx="6" ry="5" fill="url(#miraInner)" />

        {/* Flowing curves inside - representing AI thoughts */}
        <Path
          d="M18 28 Q24 22 30 28"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />
        <Path
          d="M20 24 Q24 20 28 24"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.4"
        />

        {/* Sparkle accents */}
        <Circle cx="35" cy="13" r="2" fill={color} opacity="0.6" />
        <Circle cx="38" cy="18" r="1.2" fill={color} opacity="0.4" />
        <Circle cx="10" cy="32" r="1.5" fill={color} opacity="0.5" />
      </Svg>
    </Animated.View>
  );
}

/**
 * Mira Listening Icon
 * Sound waves emanating from the orb - active listening state
 */
export function MiraListeningIcon({ size = 24, color = '#D4614C', secondaryColor = '#E88B7A', animated = true }: IconProps) {
  const wave1 = useRef(new Animated.Value(0)).current;
  const wave2 = useRef(new Animated.Value(0)).current;
  const wave3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      const animateWave = (anim: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 1,
              duration: 600,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 600,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        );
      };

      Animated.parallel([
        animateWave(wave1, 0),
        animateWave(wave2, 200),
        animateWave(wave3, 400),
      ]).start();
    }
  }, [animated]);

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="listeningGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={secondaryColor} />
          <Stop offset="100%" stopColor={color} />
        </LinearGradient>
      </Defs>

      {/* Central orb - warm coral when listening */}
      <Circle cx="24" cy="24" r="12" fill="url(#listeningGradient)" />

      {/* Inner highlight */}
      <Ellipse cx="21" cy="21" rx="4" ry="3" fill="#FFFFFF" opacity="0.3" />

      {/* Sound wave rings */}
      <Circle cx="24" cy="24" r="16" fill="none" stroke={color} strokeWidth="2" opacity="0.6" />
      <Circle cx="24" cy="24" r="20" fill="none" stroke={color} strokeWidth="1.5" opacity="0.4" />
      <Circle cx="24" cy="24" r="23" fill="none" stroke={color} strokeWidth="1" opacity="0.2" />
    </Svg>
  );
}

/**
 * Voice/Microphone Icon
 * Elegant vintage-style microphone with sound waves
 */
export function VoiceIcon({ size = 24, color = '#6B7F59', secondaryColor = '#8FA878' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="voiceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={secondaryColor} />
          <Stop offset="100%" stopColor={color} />
        </LinearGradient>
      </Defs>

      {/* Microphone body - rounded rectangle */}
      <Rect x="18" y="8" width="12" height="20" rx="6" fill="url(#voiceGradient)" />

      {/* Inner detail lines */}
      <Path d="M22 13 L26 13" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <Path d="M22 17 L26 17" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <Path d="M22 21 L26 21" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />

      {/* Microphone arc/holder */}
      <Path
        d="M12 22 Q12 34 24 34 Q36 34 36 22"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Stand */}
      <Path d="M24 34 L24 40" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M18 40 L30 40" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Receipt/Scan Icon
 * Stylized receipt with scan lines
 */
export function ScanIcon({ size = 24, color = '#6B7F59', secondaryColor = '#8FA878' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="scanGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={secondaryColor} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.1" />
        </LinearGradient>
      </Defs>

      {/* Receipt paper with wavy bottom */}
      <Path
        d="M12 6 L36 6 L36 38 Q33 35 30 38 Q27 41 24 38 Q21 35 18 38 Q15 41 12 38 Z"
        fill="url(#scanGradient)"
        stroke={color}
        strokeWidth="2"
      />

      {/* Receipt lines */}
      <Path d="M16 12 L32 12" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <Path d="M16 18 L28 18" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <Path d="M16 23 L26 23" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <Path d="M16 28 L30 28" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />

      {/* Scan line effect */}
      <Path
        d="M8 24 L40 24"
        stroke={secondaryColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="2 4"
        opacity="0.8"
      />

      {/* Corner brackets for scanning */}
      <Path d="M8 10 L8 6 L12 6" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <Path d="M40 10 L40 6 L36 6" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <Path d="M8 38 L8 42 L12 42" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <Path d="M40 38 L40 42 L36 42" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/**
 * Family/Household Icon
 * Warm, connected figures representing family sharing
 */
export function FamilyIcon({ size = 24, color = '#6B7F59', secondaryColor = '#8FA878' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="familyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={secondaryColor} />
          <Stop offset="100%" stopColor={color} />
        </LinearGradient>
      </Defs>

      {/* Center figure (main user) */}
      <Circle cx="24" cy="14" r="6" fill="url(#familyGradient)" />
      <Path
        d="M16 36 Q16 24 24 24 Q32 24 32 36"
        fill="url(#familyGradient)"
      />

      {/* Left figure (family member) */}
      <Circle cx="10" cy="18" r="4.5" fill={color} opacity="0.7" />
      <Path
        d="M4 38 Q4 28 10 28 Q16 28 16 38"
        fill={color}
        opacity="0.7"
      />

      {/* Right figure (family member) */}
      <Circle cx="38" cy="18" r="4.5" fill={color} opacity="0.7" />
      <Path
        d="M32 38 Q32 28 38 28 Q44 28 44 38"
        fill={color}
        opacity="0.7"
      />

      {/* Connection arc - representing togetherness */}
      <Path
        d="M12 22 Q24 16 36 22"
        stroke={secondaryColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        strokeDasharray="3 3"
        opacity="0.6"
      />
    </Svg>
  );
}

/**
 * Sun Icon - Light Mode
 * Warm, radiating sun with gentle rays
 */
export function SunIcon({ size = 24, color = '#E9B44C', secondaryColor = '#F2D184' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="sunGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={secondaryColor} />
          <Stop offset="100%" stopColor={color} />
        </LinearGradient>
      </Defs>

      {/* Sun core */}
      <Circle cx="24" cy="24" r="10" fill="url(#sunGradient)" />

      {/* Inner highlight */}
      <Ellipse cx="21" cy="21" rx="4" ry="3" fill="#FFFFFF" opacity="0.4" />

      {/* Sun rays - organic, flowing */}
      <G stroke={color} strokeWidth="2.5" strokeLinecap="round">
        <Path d="M24 6 L24 10" />
        <Path d="M24 38 L24 42" />
        <Path d="M6 24 L10 24" />
        <Path d="M38 24 L42 24" />
        <Path d="M11.5 11.5 L14.5 14.5" />
        <Path d="M33.5 33.5 L36.5 36.5" />
        <Path d="M11.5 36.5 L14.5 33.5" />
        <Path d="M33.5 14.5 L36.5 11.5" />
      </G>
    </Svg>
  );
}

/**
 * Moon Icon - Dark Mode
 * Gentle crescent moon with stars
 */
export function MoonIcon({ size = 24, color = '#7B8CDE', secondaryColor = '#A8B4E8' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="moonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={secondaryColor} />
          <Stop offset="100%" stopColor={color} />
        </LinearGradient>
      </Defs>

      {/* Moon crescent */}
      <Path
        d="M28 8 Q14 12 14 24 Q14 36 28 40 Q18 36 18 24 Q18 12 28 8"
        fill="url(#moonGradient)"
      />

      {/* Moon surface detail */}
      <Circle cx="20" cy="20" r="2" fill={color} opacity="0.3" />
      <Circle cx="17" cy="28" r="1.5" fill={color} opacity="0.2" />

      {/* Stars */}
      <G fill={secondaryColor}>
        <Circle cx="36" cy="12" r="1.5" />
        <Circle cx="40" cy="20" r="1" />
        <Circle cx="34" cy="32" r="1.2" />
        <Circle cx="42" cy="28" r="0.8" />
      </G>

      {/* Sparkle star */}
      <Path
        d="M38 16 L39 18 L41 17 L39.5 19 L41 21 L39 20 L38 22 L37.5 20 L35 21 L37 19 L35 17 L37.5 18 Z"
        fill={secondaryColor}
        opacity="0.8"
      />
    </Svg>
  );
}

/**
 * Add Icon - Plus in a circle
 * Clean, inviting add button
 */
export function AddIcon({ size = 24, color = '#6B7F59' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Circle cx="24" cy="24" r="18" fill="none" stroke={color} strokeWidth="2" />
      <Path d="M24 14 L24 34" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M14 24 L34 24" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Check Icon - Completion checkmark
 * Elegant, flowing checkmark
 */
export function CheckIcon({ size = 24, color = '#6B7F59' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        d="M10 26 L18 34 L38 14"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * Shopping Cart Icon
 * Stylized, elegant cart
 */
export function CartIcon({ size = 24, color = '#6B7F59', secondaryColor = '#8FA878' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="cartGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={secondaryColor} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.2" />
        </LinearGradient>
      </Defs>

      {/* Cart basket */}
      <Path
        d="M10 16 L14 16 L18 32 L38 32 L42 16 L16 16"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="url(#cartGradient)"
      />

      {/* Cart handle */}
      <Path
        d="M6 12 L10 16"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Wheels */}
      <Circle cx="20" cy="38" r="3" fill={color} />
      <Circle cx="34" cy="38" r="3" fill={color} />

      {/* Items in cart - abstract shapes */}
      <Circle cx="24" cy="24" r="3" fill={secondaryColor} opacity="0.6" />
      <Circle cx="32" cy="22" r="2.5" fill={secondaryColor} opacity="0.5" />
    </Svg>
  );
}

/**
 * Olive Branch Icon - Brand element
 * Elegant olive branch representing Mediterranean warmth
 */
export function OliveBranchIcon({ size = 24, color = '#6B7F59', secondaryColor = '#8FA878' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {/* Main stem - flowing curve */}
      <Path
        d="M8 40 Q20 30 24 24 Q28 18 40 8"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Leaves - pairs along the stem */}
      <G fill={secondaryColor}>
        {/* Bottom leaves */}
        <Ellipse cx="14" cy="34" rx="4" ry="2" transform="rotate(-30 14 34)" />
        <Ellipse cx="18" cy="36" rx="4" ry="2" transform="rotate(30 18 36)" />

        {/* Middle leaves */}
        <Ellipse cx="20" cy="28" rx="4" ry="2" transform="rotate(-40 20 28)" />
        <Ellipse cx="26" cy="30" rx="4" ry="2" transform="rotate(40 26 30)" />

        {/* Upper leaves */}
        <Ellipse cx="28" cy="20" rx="3.5" ry="1.8" transform="rotate(-45 28 20)" />
        <Ellipse cx="32" cy="22" rx="3.5" ry="1.8" transform="rotate(45 32 22)" />

        {/* Top leaves */}
        <Ellipse cx="34" cy="14" rx="3" ry="1.5" transform="rotate(-50 34 14)" />
        <Ellipse cx="38" cy="14" rx="3" ry="1.5" transform="rotate(50 38 14)" />
      </G>

      {/* Small olives */}
      <Circle cx="16" cy="32" r="2" fill={color} opacity="0.7" />
      <Circle cx="30" cy="18" r="1.8" fill={color} opacity="0.7" />
    </Svg>
  );
}

/**
 * Sparkle Icon - For highlights and accents
 */
export function SparkleIcon({ size = 24, color = '#E9B44C' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        d="M24 4 L26 18 L40 16 L28 24 L40 32 L26 30 L24 44 L22 30 L8 32 L20 24 L8 16 L22 18 Z"
        fill={color}
      />
    </Svg>
  );
}

export default {
  MiraIcon,
  MiraListeningIcon,
  VoiceIcon,
  ScanIcon,
  FamilyIcon,
  SunIcon,
  MoonIcon,
  AddIcon,
  CheckIcon,
  CartIcon,
  OliveBranchIcon,
  SparkleIcon,
};
