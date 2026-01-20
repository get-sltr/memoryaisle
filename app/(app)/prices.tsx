// Price Tracking - Monitor price trends and get deal alerts
// Shows purchase history and price comparisons

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../src/constants/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { useThemeStore } from '../../src/stores/themeStore';
import {
  priceTrackingService,
  PriceTrend,
  PriceAlert,
} from '../../src/services/priceTracking';

type TabType = 'trends' | 'alerts' | 'history';

export default function PricesPage() {
  const { colors, isDark } = useThemeStore();
  const insets = useSafeAreaInsets();

  // Theme-aware colors
  const cardBg = isDark ? colors.frost.bgHeavy : '#fff';
  const tabBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
  const router = useRouter();
  const { household } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('trends');
  const [trends, setTrends] = useState<PriceTrend[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [spending, setSpending] = useState({ thisMonth: 0, lastMonth: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (household?.id) {
      loadData();
    }
  }, [household?.id]);

  const loadData = async () => {
    if (!household?.id) return;

    try {
      const [trendsData, alertsData, spendingData] = await Promise.all([
        priceTrackingService.getPriceTrends(household.id),
        priceTrackingService.getPriceAlerts(household.id),
        priceTrackingService.getSpendingSummary(household.id),
      ]);

      setTrends(trendsData);
      setAlerts(alertsData);
      setSpending(spendingData);
    } catch (error) {
      console.error('Error loading price data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatPrice = (price: number) => `$${price.toFixed(2)}`;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getChangeColor = (change: number | null) => {
    if (change === null) return COLORS.text.secondary;
    if (change < 0) return COLORS.success;
    if (change > 0) return '#e53935';
    return COLORS.text.secondary;
  };

  const renderTrendItem = ({ item }: { item: PriceTrend }) => (
    <View style={[styles.trendCard, { backgroundColor: cardBg }]}>
      <View style={styles.trendHeader}>
        <Text style={styles.trendName} numberOfLines={1}>
          {item.item_name}
        </Text>
        <Text style={styles.trendPrice}>{formatPrice(item.currentPrice)}</Text>
      </View>

      <View style={styles.trendDetails}>
        {item.percentChange !== null && (
          <View
            style={[
              styles.changeBadge,
              { backgroundColor: getChangeColor(item.percentChange) + '15' },
            ]}
          >
            <Text style={[styles.changeText, { color: getChangeColor(item.percentChange) }]}>
              {item.percentChange > 0 ? '+' : ''}
              {item.percentChange.toFixed(1)}%
            </Text>
          </View>
        )}
        <Text style={styles.trendMeta}>
          Avg: {formatPrice(item.averagePrice)} | Low: {formatPrice(item.lowestPrice)}
        </Text>
      </View>

      <View style={styles.trendFooter}>
        <Text style={styles.trendStore}>{item.store_name || 'Unknown Store'}</Text>
        <Text style={styles.trendDate}>
          {item.purchaseCount}x tracked | Last: {formatDate(item.lastPurchased)}
        </Text>
      </View>
    </View>
  );

  const renderAlertItem = ({ item }: { item: PriceAlert }) => (
    <View
      style={[
        styles.alertCard,
        { backgroundColor: cardBg },
        item.type === 'price_drop' && styles.alertDrop,
        item.type === 'good_deal' && styles.alertDeal,
        item.type === 'price_increase' && styles.alertIncrease,
      ]}
    >
      <View style={styles.alertIcon}>
        <Text style={styles.alertIconText}>
          {item.type === 'price_drop' ? '!' : item.type === 'good_deal' ? '!' : '!'}
        </Text>
      </View>
      <View style={styles.alertContent}>
        <Text style={styles.alertMessage}>{item.message}</Text>
        {item.savings !== null && item.savings > 0 && (
          <Text style={styles.alertSavings}>Save {formatPrice(item.savings)}</Text>
        )}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>
        {activeTab === 'trends' ? '!' : activeTab === 'alerts' ? '!' : '!'}
      </Text>
      <Text style={styles.emptyTitle}>
        {activeTab === 'trends'
          ? 'No Price Data Yet'
          : activeTab === 'alerts'
            ? 'No Alerts'
            : 'No History'}
      </Text>
      <Text style={styles.emptyDescription}>
        {activeTab === 'trends'
          ? 'Scan receipts after shopping to start tracking prices'
          : activeTab === 'alerts'
            ? 'Price alerts will appear when we detect deals or changes'
            : 'Your purchase history will appear here'}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={[colors.background.start, colors.background.end]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.base} />
          <Text style={styles.loadingText}>Loading price data...</Text>
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
          <Text style={styles.backText}>-</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Price Tracking</Text>
        <View style={styles.backButton} />
      </View>

      {/* Spending Summary */}
      <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
        <View style={styles.summaryMain}>
          <Text style={styles.summaryLabel}>Tracked Spending</Text>
          <Text style={styles.summaryAmount}>{formatPrice(spending.total)}</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryItemLabel}>This Month</Text>
            <Text style={styles.summaryItemValue}>{formatPrice(spending.thisMonth)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryItemLabel}>Last Month</Text>
            <Text style={styles.summaryItemValue}>{formatPrice(spending.lastMonth)}</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabContainer, { backgroundColor: tabBg }]}>
        <Pressable
          style={[styles.tab, activeTab === 'trends' && [styles.tabActive, { backgroundColor: cardBg }]]}

          onPress={() => setActiveTab('trends')}
        >
          <Text style={[styles.tabText, activeTab === 'trends' && styles.tabTextActive]}>
            Trends ({trends.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'alerts' && [styles.tabActive, { backgroundColor: cardBg }]]}

          onPress={() => setActiveTab('alerts')}
        >
          <Text style={[styles.tabText, activeTab === 'alerts' && styles.tabTextActive]}>
            Alerts ({alerts.length})
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      {activeTab === 'trends' && (
        <FlatList
          data={trends}
          renderItem={renderTrendItem}
          keyExtractor={(item) => item.item_name}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + SPACING.xl },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {activeTab === 'alerts' && (
        <FlatList
          data={alerts}
          renderItem={renderAlertItem}
          keyExtractor={(item, index) => `${item.item_name}-${index}`}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + SPACING.xl },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={renderEmptyState}
        />
      )}
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

  // Summary Card
  summaryCard: {
    backgroundColor: '#fff',
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  summaryMain: {
    alignItems: 'center',
    paddingBottom: SPACING.md,
  },
  summaryLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
  },
  summaryAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.text.primary,
    marginVertical: SPACING.xs,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: COLORS.platinum.light,
    marginVertical: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryItemLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
  },
  summaryItemValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginTop: 2,
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: BORDER_RADIUS.lg,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
  },
  tabActive: {
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  tabTextActive: {
    color: COLORS.text.primary,
  },

  // List
  listContent: {
    paddingHorizontal: SPACING.lg,
  },

  // Trend Card
  trendCard: {
    backgroundColor: '#fff',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  trendName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
    flex: 1,
    marginRight: SPACING.sm,
  },
  trendPrice: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  trendDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  changeBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    marginRight: SPACING.sm,
  },
  changeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  trendMeta: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
  },
  trendFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trendStore: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.inkFaded,
    fontWeight: '500',
  },
  trendDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.inkFaded,
  },

  // Alert Card
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold.base,
  },
  alertDrop: {
    borderLeftColor: COLORS.success,
  },
  alertDeal: {
    borderLeftColor: COLORS.gold.base,
  },
  alertIncrease: {
    borderLeftColor: '#e53935',
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.gold.light + '30',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  alertIconText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.gold.dark,
  },
  alertContent: {
    flex: 1,
  },
  alertMessage: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  alertSavings: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.success,
    fontWeight: '600',
    marginTop: 2,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    paddingTop: SPACING.xxl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  emptyDescription: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    maxWidth: 280,
  },
});
