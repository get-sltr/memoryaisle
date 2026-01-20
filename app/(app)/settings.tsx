import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Linking,
  ActivityIndicator,
  TextInput,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { SubscriptionModal } from '../../src/components/SubscriptionModal';
import { useSubscription } from '../../src/hooks/useSubscription';
import { useAuthStore } from '../../src/stores/authStore';
import { signOut } from '../../src/services/auth';
import { adminService } from '../../src/services/admin';
import { founderFamilyService } from '../../src/services/founderFamily';
import { useThemeStore } from '../../src/stores/themeStore';
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../../src/constants/theme';

// Section Card Component
function SectionCard({ title, icon, children }: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.75)', 'rgba(250, 248, 245, 0.6)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.sectionCardBorder} />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionIcon}>{icon}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// Setting Row Component
function SettingRow({
  icon,
  title,
  subtitle,
  rightElement,
  onPress,
  danger = false,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      style={styles.settingRow}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={styles.settingIcon}>{icon}</Text>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, danger && styles.dangerText]}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement || (onPress && <Text style={styles.chevron}>›</Text>)}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { user, signOut: clearAuthStore } = useAuthStore();
  const { subscription, isPremium, isLoading, restorePurchases, refresh } = useSubscription();
  const { isDark, toggleTheme } = useThemeStore();
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFounder, setIsFounder] = useState(false);

  useEffect(() => {
    adminService.isAdmin().then(setIsAdmin);
    adminService.isFounder().then(setIsFounder);
  }, []);

  // Redeem gift code
  const handleRedeemCode = () => {
    Alert.prompt(
      'Redeem Gift Code',
      'Enter your gift code to unlock Premium features:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem',
          onPress: async (code) => {
            if (!code?.trim()) return;
            const result = await founderFamilyService.redeemCode(code);
            if (result.success) {
              Alert.alert('Success!', 'Welcome to the MemoryAisle family! You now have Premium access forever.');
              refresh(); // Refresh subscription status
            } else {
              Alert.alert('Invalid Code', result.error || 'This code is invalid or has already been used.');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  // Generate family code (founder only)
  const handleGenerateFamilyCode = () => {
    Alert.prompt(
      'Generate Family Code',
      'Enter a label for this code (e.g., "Mom", "Sister"):\n\nThis code will give someone free Premium forever.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async (label) => {
            const code = await founderFamilyService.generateCode(label || undefined);
            if (code) {
              Alert.alert(
                'Code Generated!',
                `Share this code with your family:\n\n${code}\n\nThey can redeem it in Settings > Redeem Gift Code`,
                [
                  { text: 'Copy Code', onPress: () => Clipboard.setStringAsync(code) },
                  {
                    text: 'Share',
                    onPress: () => Share.share({
                      message: `Download MemoryAisle and use this gift code for free Premium:\n\n${code}\n\nApp Store: https://apps.apple.com/app/memoryaisle`,
                    }),
                  },
                ]
              );
            } else {
              Alert.alert('Error', 'Failed to generate code. Please try again.');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  // View all family codes (founder only)
  const handleViewFamilyCodes = async () => {
    const codes = await founderFamilyService.getCodes();

    if (codes.length === 0) {
      Alert.alert('No Codes Yet', 'You haven\'t generated any family codes yet.\n\nTap "Generate Family Code" to create one!');
      return;
    }

    const codeList = codes.map(c => {
      const status = c.redeemed_by
        ? `✅ Used by ${c.redeemed_by_email || 'someone'}`
        : '⏳ Available';
      const label = c.label ? ` (${c.label})` : '';
      return `${c.code}${label}\n   ${status}`;
    }).join('\n\n');

    Alert.alert(
      `Your Family Codes (${codes.length})`,
      codeList,
      [
        { text: 'OK' },
        {
          text: 'Copy All Available',
          onPress: () => {
            const available = codes
              .filter(c => !c.redeemed_by)
              .map(c => c.code)
              .join('\n');
            if (available) {
              Clipboard.setStringAsync(available);
              Alert.alert('Copied!', 'Available codes copied to clipboard.');
            } else {
              Alert.alert('No Available Codes', 'All your codes have been redeemed.');
            }
          }
        },
      ]
    );
  };

  const handleAppearance = () => {
    Alert.alert(
      'Appearance',
      `Current theme: ${isDark ? 'Dark' : 'Light'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isDark ? 'Switch to Light' : 'Switch to Dark',
          onPress: toggleTheme,
        },
      ]
    );
  };

  const handleNotifications = () => {
    Alert.alert(
      'Notifications',
      'Manage notification settings in your device settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => Linking.openURL('app-settings:'),
        },
      ]
    );
  };

  const handleManageSubscription = async () => {
    if (!isPremium) {
      setShowSubscriptionModal(true);
      return;
    }

    // For Apple IAP, users manage subscriptions through iOS Settings
    Alert.alert(
      'Manage Subscription',
      'To manage your Premium subscription, please go to:\n\nSettings > Apple ID > Subscriptions',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => Linking.openURL('app-settings:'),
        },
      ]
    );
  };

  const handleRestorePurchases = async () => {
    setIsManaging(true);
    try {
      const success = await restorePurchases();
      if (success) {
        Alert.alert('Restored!', 'Your subscription has been restored.');
      } else {
        Alert.alert('Not Found', 'No previous purchases were found to restore.');
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to open subscription management');
    } finally {
      setIsManaging(false);
    }
  };

  const handleSignOut = () => {
    console.log('Sign out button pressed');
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Signing out...');
              const result = await signOut();
              console.log('Sign out result:', result);
              clearAuthStore();
              console.log('Auth store cleared, navigating...');
              router.replace('/(auth)/landing');
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <ScreenWrapper>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Settings</Text>
        </View>

        {/* Subscription Section */}
        <SectionCard title="Subscription" icon="⭐">
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={COLORS.gold.base} />
            </View>
          ) : isPremium ? (
            <>
              <View style={styles.subscriptionStatus}>
                <LinearGradient
                  colors={[COLORS.gold.lightest, 'rgba(212, 165, 71, 0.15)']}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.subscriptionStatusBorder} />
                <View style={styles.premiumBadge}>
                  <LinearGradient
                    colors={[COLORS.gold.light, COLORS.gold.base]}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={styles.premiumBadgeText}>PREMIUM</Text>
                </View>
                <Text style={styles.subscriptionPlan}>
                  {subscription?.billingInterval === 'year' ? 'Yearly' : 'Monthly'} Plan
                </Text>
                {subscription?.currentPeriodEnd && (
                  <Text style={styles.subscriptionRenewal}>
                    {subscription.cancelAtPeriodEnd
                      ? `Expires ${formatDate(subscription.currentPeriodEnd)}`
                      : `Renews ${formatDate(subscription.currentPeriodEnd)}`}
                  </Text>
                )}
              </View>

              <Pressable
                style={styles.manageButton}
                onPress={handleManageSubscription}
                disabled={isManaging}
              >
                {isManaging ? (
                  <ActivityIndicator color={COLORS.gold.dark} size="small" />
                ) : (
                  <Text style={styles.manageButtonText}>Manage Subscription</Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.freeStatus}>
                <Text style={styles.freeTitle}>Free Plan</Text>
                <Text style={styles.freeSubtitle}>Limited features</Text>
              </View>

              <Pressable
                style={styles.upgradeCard}
                onPress={() => router.push('/(app)/upgrade')}
              >
                <LinearGradient
                  colors={['rgba(212, 165, 71, 0.12)', 'rgba(212, 165, 71, 0.06)']}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.upgradeCardBorder} />
                <View style={styles.upgradeContent}>
                  <Text style={styles.upgradeTitle}>Upgrade to Premium</Text>
                  <Text style={styles.upgradeSubtitle}>
                    Unlimited Mira AI, meal plans, receipt scanning & more
                  </Text>
                  <View style={styles.upgradePricing}>
                    <Text style={styles.upgradePrice}>3-day free trial</Text>
                    <Text style={styles.upgradeSavings}>then $47.88/yr or $9.99/mo</Text>
                  </View>
                </View>
                <View style={styles.upgradeArrow}>
                  <Text style={styles.upgradeArrowText}>→</Text>
                </View>
              </Pressable>
            </>
          )}
        </SectionCard>

        {/* Account Section */}
        <SectionCard title="Account" icon="👤">
          <SettingRow
            icon="✉️"
            title="Email"
            subtitle={user?.email || 'Not set'}
          />
          <SettingRow
            icon="🏠"
            title="Household"
            subtitle="Manage household members"
            onPress={() => router.push('/(app)/family')}
          />
          <SettingRow
            icon="💳"
            title="Wallet"
            subtitle="Loyalty cards, credits & gift cards"
            onPress={() => router.push('/(app)/wallet')}
          />
          <SettingRow
            icon="📜"
            title="Order History"
            subtitle="View past purchases"
            onPress={() => router.push('/(app)/orders')}
          />
          <SettingRow
            icon="📊"
            title="Price Tracking"
            subtitle="Monitor prices & get deal alerts"
            onPress={() => router.push('/(app)/prices')}
          />
        </SectionCard>

        {/* App Section */}
        <SectionCard title="App" icon="📱">
          <SettingRow
            icon="🔔"
            title="Notifications"
            subtitle="Manage push notifications"
            onPress={handleNotifications}
          />
          <SettingRow
            icon="🎨"
            title="Appearance"
            subtitle={isDark ? 'Dark mode' : 'Light mode'}
            onPress={handleAppearance}
          />
        </SectionCard>

        {/* Gift Codes Section */}
        <SectionCard title="Gift Codes" icon="🎁">
          <SettingRow
            icon="🎟️"
            title="Redeem Gift Code"
            subtitle="Have a code? Get free Premium!"
            onPress={handleRedeemCode}
          />
          {isFounder && (
            <>
              <SettingRow
                icon="💝"
                title="Generate Family Code"
                subtitle="Give free Premium to family"
                onPress={handleGenerateFamilyCode}
              />
              <SettingRow
                icon="📋"
                title="View My Codes"
                subtitle="See all codes & who used them"
                onPress={handleViewFamilyCodes}
              />
            </>
          )}
        </SectionCard>

        {/* Support Section */}
        <SectionCard title="Support" icon="💬">
          <SettingRow
            icon="❓"
            title="Help Center"
            subtitle="FAQs & guides"
            onPress={() => Linking.openURL('https://memoryaisle.app/help')}
          />
          <SettingRow
            icon="📧"
            title="Contact Us"
            subtitle="support@memoryaisle.app"
            onPress={() => Linking.openURL('mailto:support@memoryaisle.app')}
          />
          <SettingRow
            icon="💼"
            title="Business Inquiries"
            subtitle="Ads, partnerships & press"
            onPress={() => Linking.openURL('mailto:press@memoryaisle.app')}
          />
          <SettingRow
            icon="⭐"
            title="Rate MemoryAisle"
            subtitle="Love the app? Leave a review!"
            onPress={() => {
              // iOS App Store URL - update with actual app ID when published
              Linking.openURL('https://apps.apple.com/app/memoryaisle/id123456789?action=write-review');
            }}
          />
        </SectionCard>

        {/* Legal Section */}
        <SectionCard title="Legal" icon="📄">
          <SettingRow
            icon="📜"
            title="Terms of Service"
            onPress={() => Linking.openURL('https://memoryaisle.app/terms')}
          />
          <SettingRow
            icon="🔒"
            title="Privacy Policy"
            onPress={() => Linking.openURL('https://memoryaisle.app/privacy')}
          />
          <SettingRow
            icon="📧"
            title="Legal Contact"
            subtitle="legal@memoryaisle.app"
            onPress={() => Linking.openURL('mailto:legal@memoryaisle.app')}
          />
        </SectionCard>

        {/* Admin Section - Only shown to admins */}
        {isAdmin && (
          <SectionCard title="Admin" icon="👑">
            <SettingRow
              icon="📊"
              title="Admin Dashboard"
              subtitle="Users, subscriptions & errors"
              onPress={() => router.push('/(app)/admin')}
            />
          </SectionCard>
        )}

        {/* Sign Out */}
        <Pressable style={styles.signOutButton} onPress={handleSignOut}>
          <BlurView intensity={15} tint="light" style={StyleSheet.absoluteFill} pointerEvents="none" />
          <LinearGradient
            colors={['rgba(212, 97, 76, 0.1)', 'rgba(212, 97, 76, 0.05)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.signOutBorder} pointerEvents="none" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

        {/* Version */}
        <Text style={styles.versionText}>MemoryAisle v1.0.0</Text>
      </ScrollView>

      <SubscriptionModal
        visible={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: 120,
  },
  header: {
    marginBottom: SPACING.lg,
  },
  pageTitle: {
    fontSize: FONT_SIZES.title,
    fontWeight: '700',
    color: COLORS.text.primary,
  },

  // Section card
  sectionCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    ...SHADOWS.glass,
  },
  sectionCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  sectionIcon: {
    fontSize: 20,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
  },

  // Setting row
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.04)',
  },
  settingIcon: {
    fontSize: 18,
    width: 28,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text.primary,
  },
  settingSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: FONT_SIZES.xl,
    color: COLORS.text.secondary,
  },
  dangerText: {
    color: COLORS.error,
  },

  // Loading
  loadingContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },

  // Subscription status (Premium)
  subscriptionStatus: {
    margin: SPACING.md,
    marginTop: 0,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    alignItems: 'center',
  },
  subscriptionStatusBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.gold.light,
  },
  premiumBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  premiumBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 1,
  },
  subscriptionPlan: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  subscriptionRenewal: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },

  // Manage button
  manageButton: {
    margin: SPACING.md,
    marginTop: 0,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    alignItems: 'center',
  },
  manageButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gold.dark,
  },

  // Free status
  freeStatus: {
    padding: SPACING.md,
    paddingTop: 0,
  },
  freeTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  freeSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
  },

  // Upgrade card
  upgradeCard: {
    margin: SPACING.md,
    marginTop: 0,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  upgradeCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.gold.light,
  },
  upgradeContent: {
    flex: 1,
  },
  upgradeTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.gold.dark,
  },
  upgradeSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  upgradePricing: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  upgradePrice: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  upgradeSavings: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.success,
    fontWeight: '600',
  },
  upgradeArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.gold.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeArrowText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.white,
    fontWeight: '700',
  },

  // Sign out
  signOutButton: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  signOutBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(212, 97, 76, 0.2)',
  },
  signOutText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.error,
  },

  // Version
  versionText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
});
