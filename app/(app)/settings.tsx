import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Linking,
  ActivityIndicator,
  AppState,
  Switch,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { SubscriptionModal } from '../../src/components/SubscriptionModal';
import { useSubscription } from '../../src/hooks/useSubscription';
import { useAuthStore } from '../../src/stores/authStore';
import { signOut } from '../../src/services/auth';
import { adminService } from '../../src/services/admin';
import { useThemeStore } from '../../src/stores/themeStore';
import { supabase } from '../../src/services/supabase';
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
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [saveMiraHistory, setSaveMiraHistory] = useState(true);
  const [isClearingHistory, setIsClearingHistory] = useState(false);

  // Load Mira history preference from Supabase
  useEffect(() => {
    if (!user?.id) return;

    const loadMiraPreference = async () => {
      const { data } = await supabase
        .from('users')
        .select('profile')
        .eq('id', user.id)
        .single();

      if (data?.profile?.save_mira_history !== undefined) {
        setSaveMiraHistory(data.profile.save_mira_history);
      }
    };

    loadMiraPreference();
  }, [user?.id]);

  // Handle Mira history toggle - save to Supabase
  const handleMiraHistoryToggle = async (value: boolean) => {
    if (!user?.id) return;

    setSaveMiraHistory(value);

    // Get current profile and merge with new setting
    const { data: userData } = await supabase
      .from('users')
      .select('profile')
      .eq('id', user.id)
      .single();

    const currentProfile = userData?.profile || {};

    await supabase
      .from('users')
      .update({
        profile: {
          ...currentProfile,
          save_mira_history: value,
        },
      })
      .eq('id', user.id);
  };

  // Clear Mira conversation history
  const handleClearMiraHistory = () => {
    Alert.alert(
      'Clear Mira History',
      'This will permanently delete all your conversations with Mira. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear History',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;
            setIsClearingHistory(true);
            try {
              const { error } = await supabase
                .from('mira_conversations')
                .delete()
                .eq('user_id', user.id);

              if (error) throw error;

              Alert.alert('Success', 'Mira conversation history cleared');
            } catch (error: any) {
              console.error('Error clearing Mira history:', error);
              Alert.alert('Error', 'Failed to clear conversation history');
            } finally {
              setIsClearingHistory(false);
            }
          },
        },
      ]
    );
  };

  // Check notification permission status
  const checkNotificationStatus = useCallback(async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setNotificationStatus(status);
  }, []);

  useEffect(() => {
    adminService.isAdmin().then(setIsAdmin);
    checkNotificationStatus();

    // Re-check notification status when app returns from background (user might have changed settings)
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkNotificationStatus();
      }
    });

    return () => subscription.remove();
  }, [checkNotificationStatus]);

  // Delete account handler
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data including your family profiles, grocery lists, meal plans, and Mira conversation history. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.prompt(
              'Confirm Deletion',
              'Type DELETE to confirm account deletion:',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Forever',
                  style: 'destructive',
                  onPress: async (text: string | undefined) => {
                    if (text?.toUpperCase() !== 'DELETE') {
                      Alert.alert('Cancelled', 'Account deletion cancelled. You typed: ' + (text || 'nothing'));
                      return;
                    }

                    setIsDeletingAccount(true);
                    try {
                      // Delete all user data from Supabase
                      const userId = user?.id;
                      if (!userId) throw new Error('No user ID');

                      // Delete in order of dependencies
                      await supabase.from('list_items').delete().eq('list_id',
                        supabase.from('grocery_lists').select('id').eq('user_id', userId)
                      );
                      await supabase.from('grocery_lists').delete().eq('user_id', userId);
                      await supabase.from('mira_conversations').delete().eq('user_id', userId);
                      await supabase.from('meal_plans').delete().eq('user_id', userId);
                      await supabase.from('recipes').delete().eq('user_id', userId);
                      await supabase.from('household_members').delete().eq('household_id',
                        supabase.from('households').select('id').eq('owner_id', userId)
                      );
                      await supabase.from('households').delete().eq('owner_id', userId);
                      await supabase.from('receipts').delete().eq('user_id', userId);
                      await supabase.from('purchase_history').delete().eq('user_id', userId);
                      await supabase.from('favorites').delete().eq('user_id', userId);
                      await supabase.from('store_locations').delete().eq('user_id', userId);
                      await supabase.from('usage_tracking').delete().eq('user_id', userId);
                      await supabase.from('subscriptions').delete().eq('user_id', userId);
                      await supabase.from('user_preferences').delete().eq('user_id', userId);
                      await supabase.from('users').delete().eq('id', userId);

                      // Sign out and clear local state
                      await signOut();
                      clearAuthStore();

                      Alert.alert(
                        'Account Deleted',
                        'Your account and all associated data have been permanently deleted.',
                        [{ text: 'OK', onPress: () => router.replace('/(auth)/landing') }]
                      );
                    } catch (error) {
                      console.error('Account deletion error:', error);
                      Alert.alert('Error', 'Failed to delete account. Please contact support@memoryaisle.app');
                    } finally {
                      setIsDeletingAccount(false);
                    }
                  },
                },
              ],
              'plain-text'
            );
          },
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

  const handleNotifications = async () => {
    if (notificationStatus === 'granted') {
      Alert.alert(
        'Notifications Enabled',
        'Push notifications are enabled. You can manage notification preferences in your device settings.',
        [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => Linking.openURL('app-settings:'),
          },
        ]
      );
    } else if (notificationStatus === 'denied') {
      Alert.alert(
        'Notifications Disabled',
        'Push notifications are currently disabled. Enable them in Settings to receive updates about shared lists, family activity, and store reminders.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => Linking.openURL('app-settings:'),
          },
        ]
      );
    } else {
      // undetermined - request permission
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationStatus(status);
      if (status === 'granted') {
        Alert.alert('Success', 'Push notifications have been enabled!');
      } else {
        Alert.alert(
          'Notifications Denied',
          'You can enable notifications later in your device settings.',
          [
            { text: 'OK', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openURL('app-settings:'),
            },
          ]
        );
      }
    }
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
              router.replace('/(auth)/sign-in');
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
                    <Text style={styles.upgradePrice}>$47.88/year</Text>
                    <Text style={styles.upgradeSavings}>Just $3.99/month</Text>
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
            title="My Store Cards"
            subtitle="Loyalty and rewards cards"
            onPress={() => router.push('/(app)/store-cards')}
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
          <SettingRow
            icon="🗑️"
            title="Delete Account"
            subtitle="Permanently delete your account and data"
            onPress={handleDeleteAccount}
            danger
          />
        </SectionCard>

        {/* Mira AI Section */}
        <SectionCard title="Mira AI" icon="✨">
          <View style={styles.settingRow}>
            <Text style={styles.settingIcon}>💬</Text>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Save Conversation History</Text>
              <Text style={styles.settingSubtitle}>
                When enabled, Mira remembers your past conversations to give better recommendations
              </Text>
            </View>
            <Switch
              value={saveMiraHistory}
              onValueChange={handleMiraHistoryToggle}
              trackColor={{ false: COLORS.platinum.base, true: COLORS.gold.light }}
              thumbColor={saveMiraHistory ? COLORS.gold.base : COLORS.platinum.dark}
            />
          </View>
          <SettingRow
            icon="🗑️"
            title="Clear Conversation History"
            subtitle={isClearingHistory ? 'Clearing...' : 'Delete all Mira conversations'}
            onPress={isClearingHistory ? undefined : handleClearMiraHistory}
            danger
          />
        </SectionCard>

        {/* App Section */}
        <SectionCard title="App" icon="📱">
          <SettingRow
            icon="🔔"
            title="Notifications"
            subtitle={
              notificationStatus === 'granted'
                ? 'Enabled'
                : notificationStatus === 'denied'
                ? 'Disabled - tap to enable'
                : 'Tap to enable'
            }
            onPress={handleNotifications}
          />
          <SettingRow
            icon="🎨"
            title="Appearance"
            subtitle={isDark ? 'Dark mode' : 'Light mode'}
            onPress={handleAppearance}
          />
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
            title="Terms of Use"
            onPress={() => router.push('/(app)/terms')}
          />
          <SettingRow
            icon="🔒"
            title="Privacy Policy"
            onPress={() => router.push('/(app)/privacy')}
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
        <Text style={styles.versionText}>MemoryAisle v1.1.0</Text>
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
