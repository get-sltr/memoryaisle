// Receipt Scanning Screen - Premium feature for scanning receipts
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';
import { receiptService, ReceiptScanResult } from '../../src/services/receipt';
import { useFeatureAccess } from '../../src/hooks/useSubscription';
import { useAuthStore } from '../../src/stores/authStore';
import { PaywallPrompt } from '../../src/components/PaywallPrompt';
import { useListStore } from '../../src/stores/listStore';
import { useThemeStore } from '../../src/stores/themeStore';

export default function ReceiptsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const { user, household } = useAuthStore();
  const { hasAccess, isLoading: subscriptionLoading } = useFeatureAccess('receiptScanning');
  const [showPaywall, setShowPaywall] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [lastResult, setLastResult] = useState<ReceiptScanResult | null>(null);
  const { items, currentList, completeItem } = useListStore();

  useEffect(() => {
    if (!subscriptionLoading && !hasAccess) {
      setShowPaywall(true);
    }
  }, [subscriptionLoading, hasAccess]);

  const handleScanReceipt = async () => {
    if (!hasAccess) {
      setShowPaywall(true);
      return;
    }

    setIsScanning(true);
    try {
      const base64 = await receiptService.captureReceipt();
      if (!base64) {
        setIsScanning(false);
        return;
      }

      // Get current list items for comparison
      const listItemNames = items
        .filter(item => !item.is_completed)
        .map(item => item.name);

      const result = await receiptService.scanAndCompare(base64, listItemNames, household?.id);
      setLastResult(result);

      if (result.success && result.purchasedItems.length > 0) {
        // Offer to check off purchased items
        Alert.alert(
          'Items Found!',
          `Found ${result.purchasedItems.length} items from your list on the receipt. Mark them as purchased?`,
          [
            { text: 'No', style: 'cancel' },
            {
              text: 'Yes, Check Off',
              onPress: () => {
                result.purchasedItems.forEach(purchased => {
                  const matchingItem = items.find(
                    item => item.name.toLowerCase().includes(purchased.name.toLowerCase())
                  );
                  if (matchingItem && !matchingItem.is_completed) {
                    completeItem(matchingItem.id);
                  }
                });
              },
            },
          ]
        );
      } else if (result.success) {
        Alert.alert('Scan Complete', result.message || 'No matching items found on receipt.');
      }
    } catch (error) {
      console.error('Scan error:', error);
      Alert.alert('Error', 'Failed to scan receipt. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  if (subscriptionLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={COLORS.gold.base} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Background */}
      <LinearGradient
        colors={[colors.background.start, colors.background.mid1, colors.background.end]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Receipt Scanner</Text>
        <Text style={styles.subtitle}>Scan receipts to check off items</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Scan Card */}
        <View style={styles.scanCard}>
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.9)', 'rgba(250, 250, 255, 0.8)']}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.scanIconContainer}>
            <LinearGradient
              colors={[COLORS.gold.light, COLORS.gold.base]}
              style={styles.scanIconGradient}
            >
              <Text style={styles.scanIcon}>🧾</Text>
            </LinearGradient>
          </View>

          <Text style={styles.scanTitle}>Scan Your Receipt</Text>
          <Text style={styles.scanDescription}>
            Take a photo of your receipt and we'll automatically check off items from your shopping list.
          </Text>

          <Pressable
            style={[styles.scanButton, isScanning && styles.scanButtonDisabled]}
            onPress={handleScanReceipt}
            disabled={isScanning}
          >
            <LinearGradient
              colors={[COLORS.gold.light, COLORS.gold.base]}
              style={StyleSheet.absoluteFill}
            />
            {isScanning ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.scanButtonText}>Scan Receipt</Text>
            )}
          </Pressable>
        </View>

        {/* Last Scan Result */}
        {lastResult && (
          <View style={styles.resultCard}>
            <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.85)', 'rgba(250, 250, 255, 0.75)']}
              style={StyleSheet.absoluteFill}
            />

            <Text style={styles.resultTitle}>Last Scan Results</Text>

            {lastResult.purchasedItems.length > 0 && (
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionTitle}>Items Found</Text>
                {lastResult.purchasedItems.map((item, index) => (
                  <View key={index} style={styles.resultItem}>
                    <Text style={styles.checkmark}>✓</Text>
                    <Text style={styles.resultItemText}>{item.name}</Text>
                  </View>
                ))}
              </View>
            )}

            {lastResult.missingItems.length > 0 && (
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionTitle}>Still Need</Text>
                {lastResult.missingItems.map((item, index) => (
                  <View key={index} style={styles.resultItem}>
                    <Text style={styles.missingMark}>○</Text>
                    <Text style={styles.resultItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Tips */}
        <View style={styles.tipsCard}>
          <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.85)', 'rgba(250, 250, 255, 0.75)']}
            style={StyleSheet.absoluteFill}
          />

          <Text style={styles.tipsTitle}>Tips for Best Results</Text>
          <View style={styles.tipRow}>
            <Text style={styles.tipIcon}>💡</Text>
            <Text style={styles.tipText}>Hold the camera steady and ensure good lighting</Text>
          </View>
          <View style={styles.tipRow}>
            <Text style={styles.tipIcon}>📋</Text>
            <Text style={styles.tipText}>Make sure your shopping list is current before scanning</Text>
          </View>
          <View style={styles.tipRow}>
            <Text style={styles.tipIcon}>🎯</Text>
            <Text style={styles.tipText}>Center the receipt in the camera frame</Text>
          </View>
        </View>
      </ScrollView>

      {/* Paywall */}
      <PaywallPrompt
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="receiptScanning"
        title="Unlock Receipt Scanning"
        description="Scan your receipts and automatically check off purchased items from your list."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 120,
  },
  scanCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    padding: SPACING.xl,
    alignItems: 'center',
    ...SHADOWS.glassElevated,
    marginBottom: SPACING.lg,
  },
  scanIconContainer: {
    marginBottom: SPACING.lg,
  },
  scanIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.goldGlow,
  },
  scanIcon: {
    fontSize: 40,
  },
  scanTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  scanDescription: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 22,
  },
  scanButton: {
    width: '100%',
    height: 54,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...SHADOWS.goldGlow,
  },
  scanButtonDisabled: {
    opacity: 0.7,
  },
  scanButtonText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.white,
  },
  resultCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    padding: SPACING.lg,
    ...SHADOWS.glass,
    marginBottom: SPACING.lg,
  },
  resultTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  resultSection: {
    marginTop: SPACING.sm,
  },
  resultSectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
  },
  checkmark: {
    fontSize: 16,
    color: COLORS.success,
    fontWeight: '700',
  },
  missingMark: {
    fontSize: 16,
    color: COLORS.text.secondary,
  },
  resultItemText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
  },
  tipsCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    padding: SPACING.lg,
    ...SHADOWS.glass,
  },
  tipsTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  tipIcon: {
    fontSize: 18,
    width: 24,
  },
  tipText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    lineHeight: 20,
  },
});
