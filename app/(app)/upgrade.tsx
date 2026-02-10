// Upgrade to Premium - Dedicated page

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../src/constants/theme';
import { useSubscription } from '../../src/hooks/useSubscription';
import { SUBSCRIPTION_TIERS } from '../../src/services/iap';
import { useThemeStore } from '../../src/stores/themeStore';

const PREMIUM_FEATURES = [
  { icon: '✨', title: 'Unlimited Mira AI', desc: 'Ask Mira anything, anytime - no daily limits' },
  { icon: '📋', title: 'Meal Planning', desc: 'Generate weekly meal plans with macros & nutrition' },
  { icon: '🧾', title: 'Receipt Scanning', desc: 'Scan receipts to auto-track purchases & prices' },
  { icon: '👨‍👩‍👧‍👦', title: '7 Family Members', desc: 'Share lists with your entire household' },
  { icon: '📝', title: 'Unlimited Lists', desc: 'Create unlimited shopping lists' },
  { icon: '📦', title: 'Unlimited Items', desc: 'No limit on items per list' },
  { icon: '✈️', title: 'Trip Planning', desc: 'Smart packing & travel checklists' },
  { icon: '📅', title: 'Smart Calendar', desc: 'Traditions, holidays & event planning' },
  { icon: '💳', title: 'Store Cards', desc: 'Store all your loyalty & rewards cards' },
  { icon: '🏷️', title: 'Deal Alerts', desc: 'Get notified of sales at your stores' },
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
  const { isPremium, purchaseYearly, restorePurchases, product } = useSubscription();
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Use live price from Apple, fall back to tier constant
  const displayPrice = product?.localizedPrice || `$${SUBSCRIPTION_TIERS.premium.price.yearly.toFixed(2)}`;

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      const result = await purchaseYearly();

      switch (result.status) {
        case 'success':
          Alert.alert(
            'Welcome to Premium!',
            'Your subscription is now active. Enjoy unlimited access to all features!',
            [{ text: 'Get Started', onPress: () => router.replace('/(app)') }]
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
      Alert.alert('Purchase Failed', 'Please try again or contact support.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const success = await restorePurchases();
      if (success) {
        Alert.alert('Restored!', 'Your subscription has been restored.');
      } else {
        Alert.alert('No Purchases Found', 'No previous purchases were found to restore.');
      }
    } catch (error) {
      Alert.alert('Restore Failed', 'Please try again.');
    } finally {
      setIsRestoring(false);
    }
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
            onPress={() => {
              Linking.openURL('https://apps.apple.com/account/subscriptions');
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

        {/* Subscription Plan Card */}
        <View style={styles.subscriptionInfo}>
          <Text style={styles.subscriptionName}>MemoryAisle Premium</Text>
          <View style={styles.priceRow}>
            <Text style={styles.planPrice}>{displayPrice}</Text>
            <Text style={styles.planPeriod}>/year</Text>
          </View>
          <Text style={styles.trialText}>Includes 2-week free trial</Text>
          <Text style={styles.subscriptionDetails}>Yearly auto-renewable subscription</Text>

          {/* Subscribe Button */}
          <Pressable
            style={[styles.planCtaButton, (isLoading || isRestoring) && styles.ctaButtonDisabled]}
            onPress={handleSubscribe}
            disabled={isLoading || isRestoring}
            accessibilityRole="button"
            accessibilityLabel={`Subscribe for ${displayPrice} per year with 2-week free trial`}
          >
            <LinearGradient
              colors={isLoading ? ['#CCCCCC', '#AAAAAA'] : [COLORS.gold.light, COLORS.gold.base]}
              style={StyleSheet.absoluteFill}
            />
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.ctaText}>Start Free Trial</Text>
            )}
          </Pressable>

          {/* Restore */}
          <Pressable
            onPress={handleRestore}
            style={styles.restoreButton}
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
        </View>

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
              Terms of Use
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
          <Text style={styles.cancelText}>
            Payment will be charged to your Apple ID after the free trial ends. Subscription automatically renews at {displayPrice}/year unless canceled at least 24 hours before the end of the current period. Manage subscriptions in your Apple ID account settings.
          </Text>
        </View>
      </ScrollView>

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

  // Subscription Info
  subscriptionInfo: {
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
  subscriptionDetails: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    fontSize: 40,
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

  // CTA inside plan card
  planCtaButton: {
    width: '100%',
    height: 52,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: SPACING.lg,
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
  ctaButtonDisabled: {
    opacity: 0.7,
  },
  restoreButton: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  restoreText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    textDecorationLine: 'underline',
  },
});
