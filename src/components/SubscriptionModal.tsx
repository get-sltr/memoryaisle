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
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../constants/theme';
import {
  SUBSCRIPTION_TIERS,
  BillingInterval,
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
  { icon: '👨‍👩‍👧‍👦', title: '12 Family Members', description: 'Share lists with the whole family' },
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
  const { subscription, isPremium, purchaseMonthly, purchaseYearly, restorePurchases } = useSubscription();
  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>('year');
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      const success = selectedInterval === 'year'
        ? await purchaseYearly()
        : await purchaseMonthly();

      if (success) {
        Alert.alert(
          'Welcome to Premium!',
          'Thank you for subscribing. All premium features are now unlocked!',
          [{ text: 'OK', onPress: onClose }]
        );
      }
    } catch (error) {
      console.error('Subscription error:', error);
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
      console.error('Restore error:', error);
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
            {/* Pricing Options - Two Clear Cards */}
            <Text style={styles.choosePlanText}>Choose your plan:</Text>

            <View style={styles.pricingCards}>
              {/* Monthly Card */}
              <Pressable
                style={[
                  styles.pricingCard,
                  selectedInterval === 'month' && styles.pricingCardActive,
                ]}
                onPress={() => setSelectedInterval('month')}
              >
                <View style={styles.radioOuter}>
                  {selectedInterval === 'month' && <View style={styles.radioInner} />}
                </View>
                <View style={styles.pricingCardContent}>
                  <Text style={styles.planName}>Monthly</Text>
                  <Text style={styles.planPrice}>$9.99</Text>
                  <Text style={styles.planPeriod}>per month</Text>
                </View>
              </Pressable>

              {/* Yearly Card */}
              <Pressable
                style={[
                  styles.pricingCard,
                  selectedInterval === 'year' && styles.pricingCardActive,
                ]}
                onPress={() => setSelectedInterval('year')}
              >
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsText}>BEST VALUE</Text>
                </View>
                <View style={styles.radioOuter}>
                  {selectedInterval === 'year' && <View style={styles.radioInner} />}
                </View>
                <View style={styles.pricingCardContent}>
                  <Text style={styles.planName}>Yearly</Text>
                  <Text style={styles.planPrice}>$47.88</Text>
                  <Text style={styles.planPeriod}>per year</Text>
                  <Text style={styles.planSavings}>Save 60% ($3.99/mo)</Text>
                </View>
              </Pressable>
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
            >
              <LinearGradient
                colors={[COLORS.gold.light, COLORS.gold.base]}
                style={StyleSheet.absoluteFill}
              />
              {isLoading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.ctaText}>
                  {selectedInterval === 'year'
                    ? 'Start Premium - $47.88/year'
                    : 'Start Premium - $9.99/month'}
                </Text>
              )}
            </Pressable>

            {/* Restore Purchases */}
            <Pressable
              style={styles.restoreButton}
              onPress={handleRestore}
              disabled={isLoading || isRestoring}
            >
              {isRestoring ? (
                <ActivityIndicator color={COLORS.text.secondary} size="small" />
              ) : (
                <Text style={styles.restoreText}>Restore Purchases</Text>
              )}
            </Pressable>

            <Text style={styles.termsText}>
              Payment will be charged to your Apple ID account. Subscription automatically renews unless canceled at least 24 hours before the end of the current period.
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
    width: 36,
    height: 36,
    borderRadius: 18,
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

  // Plan selection
  choosePlanText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  pricingCards: {
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  pricingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pricingCardActive: {
    backgroundColor: 'rgba(212, 165, 71, 0.1)',
    borderColor: COLORS.gold.base,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.gold.base,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  radioInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.gold.base,
  },
  pricingCardContent: {
    flex: 1,
  },
  planName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text.primary,
    marginTop: 2,
  },
  planPeriod: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
  },
  planSavings: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.success,
    marginTop: 4,
  },
  savingsBadge: {
    position: 'absolute',
    top: -10,
    right: SPACING.md,
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  savingsText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.white,
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
