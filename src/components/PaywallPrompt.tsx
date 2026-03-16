// PaywallPrompt - Contextual upgrade prompts
// Shows when user tries to access a premium feature

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../constants/theme';
import { SubscriptionModal } from './SubscriptionModal';
import { useSubscription } from '../hooks/useSubscription';
import { FeatureKey } from '../services/iap';

interface PaywallPromptProps {
  visible: boolean;
  onClose: () => void;
  feature: FeatureKey;
  title?: string;
  description?: string;
}

// Feature-specific messaging
const FEATURE_MESSAGES: Record<FeatureKey, { title: string; description: string; icon: string }> = {
  maxLists: {
    title: 'Need More Lists?',
    description: 'Upgrade to Premium for unlimited shopping lists',
    icon: '📝',
  },
  maxItemsPerList: {
    title: 'List Full',
    description: 'Upgrade to Premium for unlimited items per list',
    icon: '📋',
  },
  miraQueriesPerDay: {
    title: 'Out of Mira Queries',
    description: "You've used all 10 free queries today. Upgrade for unlimited access!",
    icon: '✨',
  },
  recipesPerDay: {
    title: 'Recipe Limit Reached',
    description: "You've generated 3 recipes today. Upgrade for unlimited recipes!",
    icon: '👨‍🍳',
  },
  mealPlans: {
    title: 'Meal Plans are Premium',
    description: 'Generate weekly meal plans with macros and shopping lists',
    icon: '📅',
  },
  familyMembers: {
    title: 'More Family Members',
    description: 'Upgrade to add up to 7 family members to your household',
    icon: '👨‍👩‍👧‍👦',
  },
  voiceCommands: {
    title: 'Voice Commands',
    description: 'Talk to Mira hands-free while cooking',
    icon: '🎤',
  },
  receiptScanning: {
    title: 'Receipt Scanning',
    description: 'Scan receipts to automatically track your purchases',
    icon: '🧾',
  },
  tripPlanning: {
    title: 'Trip Planning',
    description: 'Plan trips with smart packing lists and meal suggestions',
    icon: '✈️',
  },
  traditions: {
    title: 'More Traditions',
    description: 'Create unlimited family traditions and weekly meals',
    icon: '🎉',
  },
  favorites: {
    title: 'More Favorites',
    description: 'Save unlimited favorite items for quick access',
    icon: '⭐',
  },
  storeGeofencing: {
    title: 'More Store Locations',
    description: 'Save unlimited stores for automatic list reminders',
    icon: '📍',
  },
  smartCalendar: {
    title: 'Smart Calendar',
    description: 'Full access to holiday planning and traditions calendar',
    icon: '📆',
  },
  prioritySupport: {
    title: 'Priority Support',
    description: 'Get fast responses from our support team',
    icon: '💬',
  },
};

export function PaywallPrompt({
  visible,
  onClose,
  feature,
  title,
  description,
}: PaywallPromptProps) {
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [isRestoring, setIsRestoring] = useState(false);
  const { restorePurchases } = useSubscription();

  const featureInfo = FEATURE_MESSAGES[feature] || {
    title: 'Premium Feature',
    description: 'Upgrade to unlock this feature',
    icon: '✨',
  };

  React.useEffect(() => {
    if (visible) {
      Animated.spring(fadeAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
            transform: [
              {
                scale: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1],
                }),
              },
            ],
          },
        ]}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.container}>
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.95)', 'rgba(250, 248, 245, 0.9)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.cardBorder} />

          <Text style={styles.icon}>{featureInfo.icon}</Text>
          <Text style={styles.title}>{title || featureInfo.title}</Text>
          <Text style={styles.description}>{description || featureInfo.description}</Text>

          <View style={styles.buttons}>
            <Pressable
              style={styles.upgradeButton}
              onPress={() => setShowSubscriptionModal(true)}
            >
              <LinearGradient
                colors={[COLORS.gold.light, COLORS.gold.base]}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.upgradeText}>Upgrade to Premium</Text>
            </Pressable>

            <Pressable style={styles.dismissButton} onPress={onClose}>
              <Text style={styles.dismissText}>Maybe Later</Text>
            </Pressable>

            <Pressable
              style={styles.restoreButton}
              onPress={async () => {
                setIsRestoring(true);
                try {
                  const success = await restorePurchases();
                  if (success) onClose();
                } finally {
                  setIsRestoring(false);
                }
              }}
              disabled={isRestoring}
              accessibilityRole="button"
              accessibilityLabel="Restore previous purchases"
            >
              {isRestoring ? (
                <ActivityIndicator color={COLORS.text.secondary} size="small" />
              ) : (
                <Text style={styles.restoreText}>Restore Purchases</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Animated.View>

      <SubscriptionModal
        visible={showSubscriptionModal}
        onClose={() => {
          setShowSubscriptionModal(false);
          onClose();
        }}
        highlightFeature={feature}
      />
    </>
  );
}

// Inline paywall banner (non-modal)
interface PaywallBannerProps {
  feature: FeatureKey;
  compact?: boolean;
  onUpgrade?: () => void;
}

export function PaywallBanner({ feature, compact = false, onUpgrade }: PaywallBannerProps) {
  const [showModal, setShowModal] = useState(false);
  const featureInfo = FEATURE_MESSAGES[feature];

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <View style={[styles.banner, compact && styles.bannerCompact]}>
        <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(212, 165, 71, 0.15)', 'rgba(212, 165, 71, 0.08)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.bannerBorder} />

        <View style={styles.bannerContent}>
          <Text style={styles.bannerIcon}>{featureInfo?.icon || '✨'}</Text>
          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTitle}>{featureInfo?.title || 'Premium Feature'}</Text>
            {!compact && (
              <Text style={styles.bannerDescription}>
                {featureInfo?.description || 'Upgrade to unlock'}
              </Text>
            )}
          </View>
          <Pressable style={styles.bannerButton} onPress={handleUpgrade}>
            <LinearGradient
              colors={[COLORS.gold.light, COLORS.gold.base]}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.bannerButtonText}>Upgrade</Text>
          </Pressable>
        </View>
      </View>

      <SubscriptionModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        highlightFeature={feature}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // Modal overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  container: {
    width: '100%',
    maxWidth: 340,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    overflow: 'hidden',
    ...SHADOWS.glassElevated,
  },
  cardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  icon: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  description: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  buttons: {
    width: '100%',
    gap: SPACING.sm,
  },
  upgradeButton: {
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...SHADOWS.goldGlow,
  },
  upgradeText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.white,
  },
  dismissButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  restoreButton: {
    paddingVertical: SPACING.xs,
    alignItems: 'center',
  },
  restoreText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    textDecorationLine: 'underline',
  },

  // Banner styles
  banner: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginVertical: SPACING.md,
  },
  bannerCompact: {
    marginVertical: SPACING.sm,
  },
  bannerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.gold.light,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  bannerIcon: {
    fontSize: 24,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gold.dark,
  },
  bannerDescription: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  bannerButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  bannerButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.white,
  },
});
