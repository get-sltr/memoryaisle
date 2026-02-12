import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { type ProductOrSubscription } from 'react-native-iap';
import { getProduct, purchaseSubscription, restorePurchases } from '../../src/services/subscription';
import { useSubscriptionStore } from '../../src/stores/subscriptionStore';
import { useThemeStore } from '../../src/stores/themeStore';
import {
  SUBSCRIPTION_TITLE,
  SUBSCRIPTION_PRICE,
  SUBSCRIPTION_DURATION,
  APPLE_SUBSCRIPTION_DISCLOSURE,
  PRIVACY_URL,
  TERMS_URL,
} from '../../src/constants/subscription';
import { COLORS, FONTS, FONT_SIZES, SPACING } from '../../src/constants/theme';

const FEATURES = [
  { icon: '✨', title: 'Mira AI Voice Assistant', description: 'Add items by voice, get smart responses' },
  { icon: '📷', title: 'Smart Receipt Scanning', description: 'Scan receipts to check for missed items' },
  { icon: '📍', title: 'Store Arrival Notifications', description: 'Your list appears when you arrive at the store' },
  { icon: '📊', title: 'Purchase Pattern Predictions', description: 'Know what you need before you run out' },
];

export default function Paywall() {
  const { colors } = useThemeStore();
  const { checkSubscription } = useSubscriptionStore();
  const [product, setProduct] = useState<ProductOrSubscription | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    loadProduct();
  }, []);

  const loadProduct = async () => {
    const p = await getProduct();
    setProduct(p);
  };

  const displayPrice = product?.displayPrice || SUBSCRIPTION_PRICE;
  const displayTitle = product?.title || SUBSCRIPTION_TITLE;

  const handlePurchase = async () => {
    setPurchasing(true);
    const result = await purchaseSubscription();
    setPurchasing(false);

    if (result.success) {
      await checkSubscription();
      Alert.alert('Welcome to Premium!', 'You now have access to all MemoryAisle features.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else if (result.error && result.error !== 'Purchase cancelled') {
      Alert.alert('Purchase Failed', result.error);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    const result = await restorePurchases();
    setRestoring(false);

    if (result.restored) {
      await checkSubscription();
      Alert.alert('Restored!', 'Your premium subscription has been restored.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else if (result.success) {
      Alert.alert('No Subscription Found', 'No previous subscription was found for this account.');
    } else {
      Alert.alert('Restore Failed', result.error || 'Could not restore purchases.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Close Button */}
        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <Text style={[styles.closeText, { color: colors.inkLight }]}>Close</Text>
        </Pressable>

        {/* Title */}
        <Text style={[styles.title, { color: colors.ink }]}>{displayTitle}</Text>
        <Text style={[styles.subtitle, { color: colors.inkLight }]}>
          Unlock the full power of your grocery assistant
        </Text>

        {/* Feature List */}
        <View style={styles.features}>
          {FEATURES.map((feature) => (
            <View key={feature.title} style={[styles.featureRow, { backgroundColor: colors.paperDark }]}>
              <Text style={styles.featureIcon}>{feature.icon}</Text>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: colors.ink }]}>{feature.title}</Text>
                <Text style={[styles.featureDesc, { color: colors.inkLight }]}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Price & Duration */}
        <View style={styles.priceSection}>
          <Text style={[styles.price, { color: colors.ink }]}>{displayPrice}</Text>
          <Text style={[styles.duration, { color: colors.inkLight }]}>{SUBSCRIPTION_DURATION}</Text>
        </View>

        {/* Subscribe Button */}
        <Pressable
          style={[styles.subscribeButton, (purchasing || restoring) && styles.buttonDisabled]}
          onPress={handlePurchase}
          disabled={purchasing || restoring}
        >
          {purchasing ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.subscribeText}>Subscribe</Text>
          )}
        </Pressable>

        {/* Restore */}
        <Pressable
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={purchasing || restoring}
        >
          {restoring ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={[styles.restoreText, { color: colors.primary }]}>Restore Purchases</Text>
          )}
        </Pressable>

        {/* Apple Disclosure */}
        <Text style={[styles.disclosure, { color: colors.inkFaded }]}>
          {APPLE_SUBSCRIPTION_DISCLOSURE}
        </Text>

        {/* Legal Links */}
        <View style={styles.legalLinks}>
          <Pressable onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={[styles.legalLink, { color: colors.primary }]}>Privacy Policy</Text>
          </Pressable>
          <Text style={[styles.legalSep, { color: colors.inkFaded }]}>|</Text>
          <Pressable onPress={() => Linking.openURL(TERMS_URL)}>
            <Text style={[styles.legalLink, { color: colors.primary }]}>Terms of Use</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paper,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  closeButton: {
    alignSelf: 'flex-end',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  closeText: {
    fontFamily: FONTS.sans.medium,
    fontSize: FONT_SIZES.md,
  },
  title: {
    fontFamily: FONTS.serif.bold,
    fontSize: FONT_SIZES.xxl,
    color: COLORS.ink,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  subtitle: {
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.md,
    color: COLORS.inkLight,
    textAlign: 'center',
    marginTop: SPACING.sm,
    fontStyle: 'italic',
  },
  features: {
    marginTop: SPACING.xl,
    gap: SPACING.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: 12,
  },
  featureIcon: {
    fontSize: 28,
    marginRight: SPACING.md,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontFamily: FONTS.sans.bold,
    fontSize: FONT_SIZES.md,
    color: COLORS.ink,
  },
  featureDesc: {
    fontFamily: FONTS.sans.regular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.inkLight,
    marginTop: 2,
  },
  priceSection: {
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  price: {
    fontFamily: FONTS.serif.bold,
    fontSize: FONT_SIZES.xxl,
    color: COLORS.ink,
  },
  duration: {
    fontFamily: FONTS.sans.regular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.inkLight,
    marginTop: SPACING.xs,
  },
  subscribeButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  subscribeText: {
    fontFamily: FONTS.sans.bold,
    fontSize: FONT_SIZES.lg,
    color: COLORS.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  restoreText: {
    fontFamily: FONTS.sans.medium,
    fontSize: FONT_SIZES.md,
  },
  disclosure: {
    fontFamily: FONTS.sans.regular,
    fontSize: FONT_SIZES.xs,
    color: COLORS.inkFaded,
    textAlign: 'center',
    marginTop: SPACING.lg,
    lineHeight: 18,
    paddingHorizontal: SPACING.sm,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  legalLink: {
    fontFamily: FONTS.sans.medium,
    fontSize: FONT_SIZES.sm,
  },
  legalSep: {
    fontSize: FONT_SIZES.sm,
  },
});
