// Custom Checkout Screen for Stripe Subscriptions
// Premium in-app payment experience

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  useStripe,
  CardField,
  CardFieldInput,
} from '@stripe/stripe-react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../src/constants/theme';
import { supabase } from '../../src/services/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { SUBSCRIPTION_TIERS, BillingInterval } from '../../src/services/stripe';
import { useThemeStore } from '../../src/stores/themeStore';

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const router = useRouter();
  const params = useLocalSearchParams<{ interval?: string }>();
  const { user } = useAuthStore();
  const { confirmSetupIntent, createPaymentMethod } = useStripe();

  const [interval, setInterval] = useState<BillingInterval>(
    (params.interval as BillingInterval) || 'year'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [cardComplete, setCardComplete] = useState(false);
  const [setupIntentSecret, setSetupIntentSecret] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);

  const priceId = interval === 'month'
    ? SUBSCRIPTION_TIERS.premium.priceIds.monthly
    : SUBSCRIPTION_TIERS.premium.priceIds.yearly;

  const price = interval === 'month'
    ? SUBSCRIPTION_TIERS.premium.price.monthly
    : SUBSCRIPTION_TIERS.premium.price.yearly;

  const monthlyEquivalent = interval === 'year'
    ? (SUBSCRIPTION_TIERS.premium.price.yearly / 12).toFixed(2)
    : SUBSCRIPTION_TIERS.premium.price.monthly.toFixed(2);

  const savings = interval === 'year'
    ? Math.round(((SUBSCRIPTION_TIERS.premium.price.monthly * 12 - SUBSCRIPTION_TIERS.premium.price.yearly) / (SUBSCRIPTION_TIERS.premium.price.monthly * 12)) * 100)
    : 0;

  useEffect(() => {
    initializePayment();
  }, []);

  const initializePayment = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase.functions.invoke('stripe-payment-sheet', {
        body: {
          userId: user.id,
          priceId,
          interval,
        },
      });

      if (error) throw error;

      setSetupIntentSecret(data.setupIntent);
      setCustomerId(data.customerId);
    } catch (error: any) {
      console.error('Init payment error:', error);
      Alert.alert('Error', 'Failed to initialize payment. Please try again.');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSubscribe = async () => {
    if (!cardComplete || !setupIntentSecret || !user?.id) {
      Alert.alert('Error', 'Please enter your card details');
      return;
    }

    setIsLoading(true);

    try {
      // Create payment method and confirm setup intent
      const { setupIntent, error: confirmError } = await confirmSetupIntent(setupIntentSecret, {
        paymentMethodType: 'Card',
      });

      if (confirmError) {
        throw new Error(confirmError.message);
      }

      if (setupIntent?.status !== 'Succeeded') {
        throw new Error('Payment setup failed. Please try again.');
      }

      // Now create the subscription
      const { data: subData, error: subError } = await supabase.functions.invoke('stripe-create-subscription', {
        body: {
          userId: user.id,
          priceId,
          interval,
        },
      });

      if (subError) throw subError;
      if (subData?.error) throw new Error(subData.error);

      // Success!
      Alert.alert(
        'Welcome to Premium!',
        'Your subscription is now active. Enjoy unlimited access to all features!',
        [
          {
            text: 'Get Started',
            onPress: () => router.replace('/(app)'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Subscribe error:', error);
      Alert.alert('Payment Failed', error.message || 'Please try again or contact support.');
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: '∞', label: 'Unlimited Lists & Items' },
    { icon: '🤖', label: 'Unlimited Mira AI' },
    { icon: '📸', label: 'Receipt Scanning' },
    { icon: '🍽️', label: 'Meal Planning' },
    { icon: '👨‍👩‍👧‍👦', label: 'Up to 12 Family Members' },
    { icon: '✈️', label: 'Trip Planning' },
  ];

  if (isInitializing) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={[COLORS.background.start, COLORS.background.end]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.base} />
          <Text style={styles.loadingText}>Preparing checkout...</Text>
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
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Plan Selection */}
        <View style={styles.planCard}>
          <LinearGradient
            colors={[COLORS.gold.light, COLORS.gold.base]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.planGradient}
          >
            <Text style={styles.planBadge}>PREMIUM</Text>
          </LinearGradient>

          <View style={styles.planContent}>
            <Text style={styles.planTitle}>MemoryAisle Premium</Text>

            {/* Billing Toggle */}
            <View style={styles.billingToggle}>
              <Pressable
                style={[styles.billingOption, interval === 'month' && styles.billingOptionActive]}
                onPress={() => setInterval('month')}
              >
                <Text style={[styles.billingText, interval === 'month' && styles.billingTextActive]}>
                  Monthly
                </Text>
                <Text style={[styles.billingPrice, interval === 'month' && styles.billingPriceActive]}>
                  $9.99/mo
                </Text>
              </Pressable>

              <Pressable
                style={[styles.billingOption, interval === 'year' && styles.billingOptionActive]}
                onPress={() => setInterval('year')}
              >
                {savings > 0 && (
                  <View style={styles.savingsBadge}>
                    <Text style={styles.savingsText}>SAVE {savings}%</Text>
                  </View>
                )}
                <Text style={[styles.billingText, interval === 'year' && styles.billingTextActive]}>
                  Yearly
                </Text>
                <Text style={[styles.billingPrice, interval === 'year' && styles.billingPriceActive]}>
                  $47.88/yr
                </Text>
                <Text style={[styles.billingSubtext, interval === 'year' && styles.billingSubtextActive]}>
                  ${monthlyEquivalent}/mo
                </Text>
              </Pressable>
            </View>

            {/* Features List */}
            <View style={styles.featuresList}>
              {features.map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <Text style={styles.featureIcon}>{feature.icon}</Text>
                  <Text style={styles.featureLabel}>{feature.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Payment Card */}
        <View style={styles.paymentCard}>
          <Text style={styles.paymentTitle}>Payment Details</Text>
          <Text style={styles.paymentSubtitle}>Enter your card information</Text>

          <View style={styles.cardFieldContainer}>
            <CardField
              postalCodeEnabled={true}
              placeholders={{
                number: '4242 4242 4242 4242',
              }}
              cardStyle={{
                backgroundColor: '#FFFFFF',
                textColor: '#1A1A1A',
                borderColor: COLORS.platinum.light,
                borderWidth: 1,
                borderRadius: 12,
                fontSize: 16,
                placeholderColor: '#A0A0A0',
              }}
              style={styles.cardField}
              onCardChange={(cardDetails) => {
                setCardComplete(cardDetails.complete);
              }}
            />
          </View>

          <View style={styles.securityNote}>
            <Text style={styles.securityIcon}>🔒</Text>
            <Text style={styles.securityText}>
              Secured by Stripe. Your card details are encrypted.
            </Text>
          </View>
        </View>

        {/* Order Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order Summary</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Premium ({interval === 'month' ? 'Monthly' : 'Yearly'})
            </Text>
            <Text style={styles.summaryValue}>${price.toFixed(2)}</Text>
          </View>

          {interval === 'year' && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelGreen}>You save</Text>
              <Text style={styles.summaryValueGreen}>
                ${(SUBSCRIPTION_TIERS.premium.price.monthly * 12 - SUBSCRIPTION_TIERS.premium.price.yearly).toFixed(2)}
              </Text>
            </View>
          )}

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${price.toFixed(2)}</Text>
          </View>

          <Text style={styles.billingNote}>
            {interval === 'month'
              ? 'Billed monthly. Cancel anytime.'
              : 'Billed annually. Cancel anytime.'}
          </Text>
        </View>
      </ScrollView>

      {/* Subscribe Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
        <Pressable
          style={[
            styles.subscribeButton,
            (!cardComplete || isLoading) && styles.subscribeButtonDisabled,
          ]}
          onPress={handleSubscribe}
          disabled={!cardComplete || isLoading}
        >
          <LinearGradient
            colors={cardComplete && !isLoading
              ? [COLORS.gold.light, COLORS.gold.base]
              : ['#D0D0D0', '#B0B0B0']
            }
            style={styles.subscribeGradient}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.subscribeText}>Subscribe Now</Text>
                <Text style={styles.subscribePrice}>${price.toFixed(2)}</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

        <Text style={styles.termsText}>
          By subscribing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.end,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
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
  content: {
    paddingHorizontal: SPACING.lg,
  },

  // Plan Card
  planCard: {
    backgroundColor: '#FFF',
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  planGradient: {
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  planBadge: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 2,
  },
  planContent: {
    padding: SPACING.lg,
  },
  planTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },

  // Billing Toggle
  billingToggle: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  billingOption: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.platinum.light,
    alignItems: 'center',
  },
  billingOptionActive: {
    borderColor: COLORS.gold.base,
    backgroundColor: COLORS.gold.light + '20',
  },
  billingText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  billingTextActive: {
    color: COLORS.gold.dark,
  },
  billingPrice: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '800',
    color: COLORS.text.primary,
    marginTop: 4,
  },
  billingPriceActive: {
    color: COLORS.gold.dark,
  },
  billingSubtext: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  billingSubtextActive: {
    color: COLORS.gold.base,
  },
  savingsBadge: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  savingsText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },

  // Features
  featuresList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  featureItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  featureIcon: {
    fontSize: 16,
    marginRight: SPACING.xs,
  },
  featureLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.primary,
  },

  // Payment Card
  paymentCard: {
    backgroundColor: '#FFF',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  paymentTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  paymentSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginTop: 2,
    marginBottom: SPACING.md,
  },
  cardFieldContainer: {
    marginBottom: SPACING.md,
  },
  cardField: {
    width: '100%',
    height: 50,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  securityIcon: {
    fontSize: 14,
    marginRight: SPACING.xs,
  },
  securityText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: '#FFF',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
  },
  summaryTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  summaryLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
  },
  summaryValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  summaryLabelGreen: {
    fontSize: FONT_SIZES.md,
    color: COLORS.success,
  },
  summaryValueGreen: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.success,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: COLORS.platinum.light,
    marginVertical: SPACING.md,
  },
  totalLabel: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  totalValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '800',
    color: COLORS.text.primary,
  },
  billingNote: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.lg,
    paddingTop: SPACING.md,
  },
  subscribeButton: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  subscribeButtonDisabled: {
    opacity: 0.7,
  },
  subscribeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  subscribeText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: '#FFF',
  },
  subscribePrice: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '800',
    color: '#FFF',
  },
  termsText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
});
