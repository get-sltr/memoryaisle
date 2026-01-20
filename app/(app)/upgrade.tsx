// Upgrade to Premium - Dedicated page
// Shows both monthly and yearly options clearly

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../src/constants/theme';
import { useSubscription } from '../../src/hooks/useSubscription';
import { BillingInterval, stripeService } from '../../src/services/stripe';
import { useThemeStore } from '../../src/stores/themeStore';

const PREMIUM_FEATURES = [
  { icon: '✨', title: 'Unlimited Mira AI', desc: 'Ask Mira anything, anytime - no daily limits' },
  { icon: '📋', title: 'Meal Planning', desc: 'Generate weekly meal plans with macros & nutrition' },
  { icon: '🧾', title: 'Receipt Scanning', desc: 'Scan receipts to auto-track purchases & prices' },
  { icon: '👨‍👩‍👧‍👦', title: '12 Family Members', desc: 'Share lists with your entire household' },
  { icon: '📝', title: 'Unlimited Lists', desc: 'Create unlimited shopping lists' },
  { icon: '📦', title: 'Unlimited Items', desc: 'No limit on items per list' },
  { icon: '✈️', title: 'Trip Planning', desc: 'Smart packing & travel checklists' },
  { icon: '📅', title: 'Smart Calendar', desc: 'Traditions, holidays & event planning' },
  { icon: '💳', title: 'Loyalty Cards', desc: 'Store all your rewards & membership cards' },
  { icon: '🎁', title: 'Gift Card Wallet', desc: 'Track gift card balances' },
  { icon: '🏷️', title: 'Promo Codes', desc: 'Save & organize promo codes' },
  { icon: '📊', title: 'Price Tracking', desc: 'Get notified when prices drop' },
  { icon: '📜', title: 'Order History', desc: 'Track all your shopping history' },
  { icon: '🍽️', title: 'Recipe Generation', desc: 'Unlimited AI recipe creation' },
  { icon: '⭐', title: 'Unlimited Favorites', desc: 'Save unlimited favorite items' },
  { icon: '🏪', title: 'Unlimited Stores', desc: 'Geofencing for all your stores' },
  { icon: '🚨', title: 'Advanced Allergy Alerts', desc: 'Smart dietary restriction warnings' },
  { icon: '🎉', title: 'All Traditions', desc: 'Access to 8+ cultural traditions' },
  { icon: '💬', title: 'Priority Support', desc: 'Get help when you need it' },
];

export default function UpgradePage() {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const router = useRouter();
  const { isPremium } = useSubscription();
  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>('year');

  const savings = stripeService.getYearlySavings();

  const handleSubscribe = () => {
    // Navigate to custom checkout screen
    router.push({
      pathname: '/(app)/checkout',
      params: { interval: selectedInterval },
    });
  };

  if (isPremium) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={[COLORS.background.start, COLORS.background.end]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Premium</Text>
          <View style={styles.backButton} />
        </View>

        <View style={styles.premiumActive}>
          <Text style={styles.premiumIcon}>👑</Text>
          <Text style={styles.premiumTitle}>You're Premium!</Text>
          <Text style={styles.premiumSubtitle}>
            Enjoy unlimited access to all features
          </Text>
          <Pressable
            style={styles.manageButton}
            onPress={async () => {
              const url = await stripeService.createPortalSession('');
              if (url) Linking.openURL(url);
            }}
          >
            <Text style={styles.manageButtonText}>Manage Subscription</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={[colors.background.start, colors.background.end]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Upgrade to Premium</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>✨</Text>
          <Text style={styles.heroTitle}>Unlock Everything</Text>
          <Text style={styles.heroSubtitle}>
            Get unlimited access to all premium features
          </Text>
        </View>

        {/* Pricing Cards */}
        <Text style={styles.sectionTitle}>Choose your plan</Text>

        {/* Yearly Card - Recommended with Trial */}
        <Pressable
          style={[
            styles.pricingCard,
            selectedInterval === 'year' && styles.pricingCardActive,
          ]}
          onPress={() => setSelectedInterval('year')}
        >
          <View style={styles.recommendedBadge}>
            <Text style={styles.recommendedText}>3-DAY FREE TRIAL</Text>
          </View>
          <View style={styles.cardRow}>
            <View style={styles.radioOuter}>
              {selectedInterval === 'year' && <View style={styles.radioInner} />}
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.planName}>Yearly</Text>
              <View style={styles.priceRow}>
                <Text style={styles.planPrice}>$47.88</Text>
                <Text style={styles.planPeriod}>/year</Text>
              </View>
              <Text style={styles.monthlyBreakdown}>Just $3.99/month</Text>
              <Text style={styles.savingsText}>Save {savings.percentage}% (${savings.amount.toFixed(2)})</Text>
              <Text style={styles.trialText}>Start with 3 days free</Text>
            </View>
          </View>
        </Pressable>

        {/* Monthly Card */}
        <Pressable
          style={[
            styles.pricingCard,
            selectedInterval === 'month' && styles.pricingCardActive,
          ]}
          onPress={() => setSelectedInterval('month')}
        >
          <View style={styles.cardRow}>
            <View style={styles.radioOuter}>
              {selectedInterval === 'month' && <View style={styles.radioInner} />}
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.planName}>Monthly</Text>
              <View style={styles.priceRow}>
                <Text style={styles.planPrice}>$9.99</Text>
                <Text style={styles.planPeriod}>/month</Text>
              </View>
              <Text style={styles.monthlyBreakdown}>Billed monthly</Text>
            </View>
          </View>
        </Pressable>

        {/* Features */}
        <Text style={[styles.sectionTitle, { marginTop: SPACING.xl }]}>
          What's included
        </Text>
        <View style={styles.featuresGrid}>
          {PREMIUM_FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Text style={styles.featureIcon}>{feature.icon}</Text>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDesc}>{feature.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Terms */}
        <View style={styles.termsSection}>
          <Text style={styles.termsText}>
            By subscribing, you agree to our{' '}
            <Text
              style={styles.termsLink}
              onPress={() => Linking.openURL('https://memoryaisle.app/terms')}
            >
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text
              style={styles.termsLink}
              onPress={() => Linking.openURL('https://memoryaisle.app/privacy')}
            >
              Privacy Policy
            </Text>
            .
          </Text>
          <Text style={styles.termsText}>
            For questions, contact{' '}
            <Text
              style={styles.termsLink}
              onPress={() => Linking.openURL('mailto:legal@memoryaisle.app')}
            >
              legal@memoryaisle.app
            </Text>
          </Text>
          <Text style={styles.cancelText}>
            {selectedInterval === 'year'
              ? '3-day free trial. Cancel anytime during trial. After trial, $47.88/year billed annually.'
              : 'Cancel anytime. $9.99/month billed monthly.'}
          </Text>
        </View>
      </ScrollView>

      {/* Fixed CTA Button */}
      <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + SPACING.md }]}>
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
        <Pressable
          style={styles.ctaButton}
          onPress={handleSubscribe}
        >
          <LinearGradient
            colors={[COLORS.gold.light, COLORS.gold.base]}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.ctaText}>
            {selectedInterval === 'year'
              ? 'Continue to Checkout'
              : 'Continue to Checkout'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.end,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 24,
    color: COLORS.text.primary,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  heroIcon: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text.primary,
  },
  heroSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },

  // Section
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },

  // Pricing Cards
  pricingCard: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pricingCardActive: {
    borderColor: COLORS.gold.base,
    backgroundColor: 'rgba(212, 165, 71, 0.08)',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -12,
    right: SPACING.md,
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  recommendedText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.white,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  cardContent: {
    flex: 1,
  },
  planName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.text.primary,
  },
  planPeriod: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    marginLeft: 4,
  },
  monthlyBreakdown: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  savingsText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.success,
    marginTop: 4,
  },
  trialText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.gold.dark,
    marginTop: 4,
  },

  // Features
  featuresGrid: {
    gap: SPACING.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: SPACING.md,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  featureDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginTop: 2,
  },

  // Terms
  termsSection: {
    marginTop: SPACING.xl,
    alignItems: 'center',
    paddingBottom: SPACING.xl,
  },
  termsText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  termsLink: {
    color: COLORS.gold.dark,
    textDecorationLine: 'underline',
  },
  cancelText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.inkFaded,
    marginTop: SPACING.sm,
  },

  // CTA
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  ctaButton: {
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ctaText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Premium Active
  premiumActive: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  premiumIcon: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  premiumTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text.primary,
  },
  premiumSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  manageButton: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.gold.base,
    borderRadius: BORDER_RADIUS.lg,
  },
  manageButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
  },
});
