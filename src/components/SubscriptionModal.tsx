// SubscriptionModal - Premium upgrade UI
// Beautiful glass morphism design for subscription selection

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS, HIG } from '../constants/theme';
import {
  SUBSCRIPTION_TIERS,
  FeatureKey,
} from '../services/iap';
import { useSubscription } from '../hooks/useSubscription';

interface SubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  highlightFeature?: FeatureKey;
}

const PREMIUM_FEATURES = [
  { icon: '✨', title: 'Unlimited Mira AI', description: 'Ask Mira anything, anytime' },
  { icon: '📋', title: 'Meal Planning', description: 'Generate weekly meal plans with macros' },
  { icon: '🧾', title: 'Receipt Scanning', description: 'Scan receipts to track purchases' },
  { icon: '👨‍👩‍👧‍👦', title: '7 Family Members', description: 'Share lists with the whole family' },
  { icon: '📝', title: 'Unlimited Lists', description: 'Create as many lists as you need' },
  { icon: '✈️', title: 'Trip Planning', description: 'Plan trips with smart checklists' },
  { icon: '📅', title: 'Smart Calendar', description: 'Traditions & holiday planning' },
  { icon: '⭐', title: 'Priority Support', description: 'Get help when you need it' },
];

export function SubscriptionModal({
  visible,
  onClose,
  highlightFeature,
}: SubscriptionModalProps) {
  const insets = useSafeAreaInsets();
  const { isPremium, purchaseMonthly, restorePurchases, product, refresh } = useSubscription();
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Use live price from Apple, fall back to tier constant
  const displayPrice = product?.localizedPrice || `$${SUBSCRIPTION_TIERS.premium.price.monthly.toFixed(2)}`;

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      const result = await purchaseMonthly();

      switch (result.status) {
        case 'success':
          await refresh();
          Alert.alert(
            'Welcome to Premium!',
            'Thank you for subscribing. All premium features are now unlocked!',
            [{ text: 'OK', onPress: onClose }]
          );
          break;
        case 'cancelled':
          // User dismissed — do nothing
          break;
        case 'pending':
          Alert.alert(
            'Purchase Pending',
            'Your purchase is awaiting approval. Premium features will unlock once approved.'
          );
          break;
        case 'error':
          Alert.alert('Purchase Failed', result.message);
          break;
      }
    } catch (error) {
      Alert.alert('Purchase Failed', 'There was an error processing your purchase. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const success = await restorePurchases();
      if (success) {
        Alert.alert('Restored!', 'Your premium subscription has been restored.', [
          { text: 'OK', onPress: onClose },
        ]);
      } else {
        Alert.alert('No Purchases Found', 'No previous purchases were found to restore.');
      }
    } catch (error) {
      Alert.alert('Restore Failed', 'There was an error restoring your purchases. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  };

  if (isPremium) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={[styles.container, { paddingBottom: insets.bottom + SPACING.lg }]}>
            <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.95)', 'rgba(250, 248, 245, 0.9)']}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.header}>
              <Text style={styles.premiumBadge}>Premium</Text>
              <Pressable style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeText}>Done</Text>
              </Pressable>
            </View>

            <View style={styles.premiumActiveContent}>
              <Text style={styles.checkmark}>✓</Text>
              <Text style={styles.premiumTitle}>You're Premium!</Text>
              <Text style={styles.premiumSubtitle}>
                Enjoy unlimited access to all features
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { paddingBottom: insets.bottom + SPACING.lg }]}>
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.95)', 'rgba(250, 248, 245, 0.9)']}
            style={StyleSheet.absoluteFill}
          />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Upgrade to Premium</Text>
              <Text style={styles.subtitle}>Unlock all features</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Subscription Info */}
            <View style={styles.subscriptionInfoCard}>
              <Text style={styles.subscriptionName}>MemoryAisle Premium</Text>
              <View style={styles.priceRow}>
                <Text style={styles.planPrice}>{displayPrice}</Text>
                <Text style={styles.planPeriod}>/mo</Text>
              </View>
              <Text style={styles.trialText}>Includes 7-day free trial</Text>
              <Text style={styles.subscriptionType}>Monthly auto-renewable subscription</Text>
            </View>

            {/* Features */}
            <View style={styles.featuresSection}>
              <Text style={styles.featuresTitle}>What you get:</Text>
              {PREMIUM_FEATURES.map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  <Text style={styles.featureIcon}>{feature.icon}</Text>
                  <View style={styles.featureText}>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <Text style={styles.featureDescription}>{feature.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* CTA Button */}
          <View style={styles.ctaContainer}>
            <Pressable
              style={[styles.ctaButton, isLoading && styles.ctaButtonDisabled]}
              onPress={handleSubscribe}
              disabled={isLoading || isRestoring}
              accessibilityRole="button"
              accessibilityLabel={`Subscribe for ${displayPrice} per month with 7-day free trial`}
            >
              <LinearGradient
                colors={[COLORS.gold.light, COLORS.gold.base]}
                style={StyleSheet.absoluteFill}
              />
              {isLoading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.ctaText}>
                  Start Free Trial - {displayPrice}/mo
                </Text>
              )}
            </Pressable>

            {/* Restore Purchases */}
            <Pressable
              style={styles.restoreButton}
              onPress={handleRestore}
              disabled={isLoading || isRestoring}
              accessibilityRole="button"
              accessibilityLabel="Restore previous purchases"
            >
              {isRestoring ? (
                <ActivityIndicator color={COLORS.text.secondary} size="small" />
              ) : (
                <Text style={styles.restoreText}>Restore Purchases</Text>
              )}
            </Pressable>

            <Text style={styles.termsText}>
              After your 7-day free trial, you'll be charged {displayPrice}/month. Cancel anytime in Settings. Subscription auto-renews unless canceled at least 24 hours before the end of the current period.{'\n\n'}
              <Text style={styles.termsLink} onPress={() => Linking.openURL('https://memoryaisle.app/terms')}>Terms of Use</Text>
              {'  •  '}
              <Text style={styles.termsLink} onPress={() => Linking.openURL('https://memoryaisle.app/privacy')}>Privacy Policy</Text>
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: 'transparent',
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.title,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  closeButton: {
    width: HIG.minTouchTarget,
    height: HIG.minTouchTarget,
    borderRadius: HIG.minTouchTarget / 2,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.text.secondary,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
  },

  // Subscription Info
  subscriptionInfoCard: {
    backgroundColor: 'rgba(212, 165, 71, 0.1)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
    borderWidth: 2,
    borderColor: COLORS.gold.base,
    alignItems: 'center',
  },
  subscriptionName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.gold.dark,
    marginBottom: SPACING.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.text.primary,
  },
  planPeriod: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.text.secondary,
    marginLeft: 4,
  },
  trialText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.success,
    marginTop: SPACING.sm,
  },
  subscriptionType: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },

  // Features
  featuresSection: {
    marginBottom: SPACING.xl,
  },
  featuresTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  featureIcon: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  featureDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginTop: 2,
  },

  // CTA
  ctaContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  ctaButton: {
    height: 54,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...SHADOWS.goldGlow,
  },
  ctaButtonDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.white,
  },
  termsText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 16,
  },
  termsLink: {
    color: COLORS.gold.dark,
    textDecorationLine: 'underline',
  },
  restoreButton: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  restoreText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },

  // Premium active state
  premiumBadge: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.gold.dark,
  },
  premiumActiveContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  checkmark: {
    fontSize: 64,
    color: COLORS.success,
    marginBottom: SPACING.md,
  },
  premiumTitle: {
    fontSize: FONT_SIZES.title,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  premiumSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },
});
