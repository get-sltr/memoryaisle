import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Linking,
  Share,
  ActivityIndicator,
  AppState,
  Switch,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { logger } from '../../src/utils/logger';
import { SubscriptionModal } from '../../src/components/SubscriptionModal';
import { useSubscription } from '../../src/hooks/useSubscription';
import { useAuthStore } from '../../src/stores/authStore';
import { signOut } from '../../src/services/auth';
import { adminService } from '../../src/services/admin';
import { useThemeStore } from '../../src/stores/themeStore';
import { supabase } from '../../src/services/supabase';
import { SUBSCRIPTION_TIERS } from '../../src/services/iap';
import { useGLP1Store } from '../../src/stores/glp1Store';
import { MEDICATIONS } from '../../src/services/glp1Engine';
import { deactivateGLP1Profile } from '../../src/services/glp1';
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
  const { user, household, signOut: clearAuthStore } = useAuthStore();
  const { subscription, isPremium, isLoading, product, restorePurchases, refresh } = useSubscription();
  const _theme = useThemeStore(); // keep import active for ScreenWrapper
  const { isActive: glp1Active, profile: glp1Profile, cycleInfo, cleanup: glp1Cleanup } = useGLP1Store();
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [saveMiraHistory, setSaveMiraHistory] = useState(true);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(true);

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
      if (data?.profile?.weekly_digest !== undefined) {
        setWeeklyDigestEnabled(data.profile.weekly_digest);
      }
    };

    loadMiraPreference();
  }, [user?.id]);

  // Handle Mira history toggle - save to Supabase with rollback on failure
  const handleMiraHistoryToggle = async (value: boolean) => {
    if (!user?.id) return;

    const previousValue = saveMiraHistory;
    setSaveMiraHistory(value);

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('profile')
        .eq('id', user.id)
        .single();

      const currentProfile = userData?.profile || {};

      const { error } = await supabase
        .from('users')
        .update({
          profile: {
            ...currentProfile,
            save_mira_history: value,
          },
        })
        .eq('id', user.id);

      if (error) throw error;
    } catch {
      // Revert the toggle on failure
      setSaveMiraHistory(previousValue);
    }
  };

  // Handle weekly digest toggle
  const handleWeeklyDigestToggle = async (value: boolean) => {
    if (!user?.id) return;

    const previousValue = weeklyDigestEnabled;
    setWeeklyDigestEnabled(value);

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('profile')
        .eq('id', user.id)
        .single();

      const currentProfile = userData?.profile || {};

      const { error } = await supabase
        .from('users')
        .update({
          profile: {
            ...currentProfile,
            weekly_digest: value,
          },
        })
        .eq('id', user.id);

      if (error) throw error;
    } catch {
      setWeeklyDigestEnabled(previousValue);
    }
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
              logger.error('Error clearing Mira history:', error);
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

    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkNotificationStatus();
      }
    });

    return () => appStateSub.remove();
  }, [checkNotificationStatus]);

  // Delete account handler
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and data. If you are the household owner, this will also delete all family grocery lists and meal plans. This cannot be undone.',
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
                      Alert.alert('Cancelled', 'Account deletion cancelled.');
                      return;
                    }

                    setIsDeletingAccount(true);
                    try {
                      // Single server-side RPC handles everything atomically:
                      // archives subscription to blacklist, handles household,
                      // deletes auth.users (cascades all child data)
                      const { error: rpcError } = await supabase.rpc('delete_user_account');

                      if (rpcError) {
                        throw rpcError;
                      }

                      // Sign out and clear local state
                      await signOut();
                      clearAuthStore();

                      Alert.alert(
                        'Account Deleted',
                        'Your account and all associated data have been permanently deleted.',
                        [{ text: 'OK', onPress: () => router.replace('/(auth)/landing') }]
                      );
                    } catch (error) {
                      logger.error('Account deletion error:', error);
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

    Alert.alert(
      'Manage Subscription',
      'You can manage or cancel your Premium subscription through Apple.',
      [
        { text: 'Close', style: 'cancel' },
        {
          text: 'Manage Subscription',
          onPress: () => Linking.openURL('https://apps.apple.com/account/subscriptions'),
        },
      ]
    );
  };

  const handleRestorePurchases = async () => {
    setIsRestoring(true);
    try {
      const success = await restorePurchases();
      if (success) {
        await refresh();
        Alert.alert('Restored!', 'Your subscription has been restored.');
      } else {
        Alert.alert('Not Found', 'No previous purchases were found to restore.');
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to restore purchases. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleSignOut = () => {
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
              const result = await signOut();
              clearAuthStore();
              router.replace('/(auth)/landing');
            } catch (error) {
              logger.error('Sign out error:', error);
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

  // Display price from live product (StoreKit) or fall back to SUBSCRIPTION_TIERS
  const displayPrice = product?.localizedPrice
    ? `${product.localizedPrice}/mo`
    : `$${SUBSCRIPTION_TIERS.premium.price.monthly.toFixed(2)}/mo`;

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
                    <Text style={styles.upgradePrice}>{displayPrice}</Text>
                    <Text style={styles.upgradeSavings}>7-day free trial</Text>
                  </View>
                </View>
                <View style={styles.upgradeArrow}>
                  <Text style={styles.upgradeArrowText}>→</Text>
                </View>
              </Pressable>
            </>
          )}

          {/* Restore Purchases -- Apple Guideline 3.1.2 requires this to be visible */}
          <SettingRow
            icon="🔄"
            title="Restore Purchases"
            subtitle={isRestoring ? 'Restoring...' : 'Restore a previous subscription'}
            onPress={isRestoring ? undefined : handleRestorePurchases}
          />
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
          {household?.invite_code && (
            <SettingRow
              icon="👥"
              title="Invite Family"
              subtitle={`Code: ${household.invite_code}`}
              onPress={async () => {
                try {
                  await Share.share({
                    message: `Join my household on MemoryAisle! Use invite code: ${household.invite_code}`,
                  });
                } catch (error) {
                  Alert.alert('Invite Code', `Your household invite code is: ${household.invite_code}`);
                }
              }}
            />
          )}
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
            icon="📈"
            title="Purchase Reports"
            subtitle="Spending analytics & export"
            onPress={() => router.push('/(app)/reports')}
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

        {/* GLP-1 Section — only shows for active profiles or premium users */}
        {(glp1Active || isPremium) && (
          <SectionCard title="GLP-1 Tracking" icon="💊">
            {glp1Active && glp1Profile ? (
              <>
                <SettingRow
                  icon="💉"
                  title={MEDICATIONS[glp1Profile.medication]?.brand || 'Medication'}
                  subtitle={`${glp1Profile.dose || 'Dose not set'} • ${glp1Profile.duration.replace(/_/g, ' ')}`}
                />
                {cycleInfo && (
                  <SettingRow
                    icon={cycleInfo.emoji}
                    title={`Current Phase: ${cycleInfo.label}`}
                    subtitle={`Day ${cycleInfo.dayInCycle + 1} of ${cycleInfo.totalCycleDays} • ${Math.round(cycleInfo.portionScale * 100)}% portions`}
                  />
                )}
                <SettingRow
                  icon="⚙️"
                  title="Update GLP-1 Profile"
                  subtitle="Change medication, dose, or triggers"
                  onPress={() => router.push('/(app)/glp1-setup')}
                />
                <SettingRow
                  icon="🛑"
                  title="Disable GLP-1 Tracking"
                  subtitle="Turn off cycle-aware features"
                  onPress={() => {
                    Alert.alert(
                      'Disable GLP-1 Tracking',
                      'This will turn off all GLP-1 adaptive meal features. Your data will be saved and you can re-enable anytime.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Disable',
                          style: 'destructive',
                          onPress: async () => {
                            if (!user?.id) return;
                            const result = await deactivateGLP1Profile(user.id);
                            if (result.success) {
                              glp1Cleanup();
                              Alert.alert('Disabled', 'GLP-1 tracking has been turned off.');
                            }
                          },
                        },
                      ]
                    );
                  }}
                  danger
                />
              </>
            ) : (
              <SettingRow
                icon="➕"
                title="Set Up GLP-1 Tracking"
                subtitle="Adaptive meal planning for your medication cycle"
                onPress={() => router.push('/(app)/glp1-setup')}
              />
            )}
          </SectionCard>
        )}

        {/* Content Section */}
        <SectionCard title="Content" icon="📸">
          <SettingRow
            icon="🖼️"
            title="Meal Memories"
            subtitle="Your family food photo journal"
            onPress={() => router.push('/(app)/meal-memories')}
          />
          <SettingRow
            icon="📖"
            title="Blog"
            subtitle="Recipes, tips & stories"
            onPress={() => router.push('/(app)/blog')}
          />
        </SectionCard>

        {/* Household Tools Section */}
        <SectionCard title="Household Tools" icon="🏠">
          <SettingRow
            icon="🏪"
            title="Pantry Inventory"
            subtitle="Track items, expiry dates & auto-restock"
            onPress={() => router.push('/(app)/pantry')}
          />
          <SettingRow
            icon="💰"
            title="Smart Budget"
            subtitle="Grocery spending tracker & analytics"
            onPress={() => router.push('/(app)/budget')}
          />
          <SettingRow
            icon="📖"
            title="Family Cookbook"
            subtitle="Your family recipe collection"
            onPress={() => router.push('/(app)/cookbook')}
          />
          <SettingRow
            icon="🎄"
            title="Holiday Planner"
            subtitle="Plan holiday feasts & prep timelines"
            onPress={() => router.push('/(app)/holiday-planner')}
          />
          <SettingRow
            icon="📷"
            title="Barcode Scanner"
            subtitle="Scan products into your pantry"
            onPress={() => router.push('/(app)/barcode-scanner')}
          />
          <SettingRow
            icon="🌍"
            title="Community Recipes"
            subtitle="Discover & share recipes"
            onPress={() => router.push('/(app)/community')}
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
          <View style={styles.settingRow}>
            <Text style={styles.settingIcon}>📊</Text>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Weekly Digest</Text>
              <Text style={styles.settingSubtitle}>
                Receive a weekly summary with spending, meals, and Mira suggestions
              </Text>
            </View>
            <Switch
              value={weeklyDigestEnabled}
              onValueChange={handleWeeklyDigestToggle}
              trackColor={{ false: COLORS.platinum.base, true: COLORS.gold.light }}
              thumbColor={weeklyDigestEnabled ? COLORS.gold.base : COLORS.platinum.dark}
            />
          </View>
          {/* Dark mode disabled for now — light mode only */}
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
              Linking.openURL('https://apps.apple.com/app/memoryaisle/id6757601958?action=write-review');
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
        <Text style={styles.versionText}>MemoryAisle v{Constants.expoConfig?.version ?? '1.1.0'}</Text>
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
    paddingBottom: 230,
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