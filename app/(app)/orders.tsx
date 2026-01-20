// Order History - Track shopping history
// Shows past purchases and spending analytics

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../src/constants/theme';
import { supabase } from '../../src/services/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { useThemeStore } from '../../src/stores/themeStore';

interface Order {
  id: string;
  store_name: string;
  total: number;
  items_count: number;
  created_at: string;
  receipt_url?: string;
}

interface SpendingSummary {
  thisMonth: number;
  lastMonth: number;
  thisYear: number;
}

export default function OrdersPage() {
  const { colors, isDark } = useThemeStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();

  // Theme-aware colors
  const cardBg = isDark ? colors.frost.bgHeavy : '#fff';
  const [orders, setOrders] = useState<Order[]>([]);
  const [spending, setSpending] = useState<SpendingSummary>({
    thisMonth: 0,
    lastMonth: 0,
    thisYear: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadOrders();
    }
  }, [user?.id]);

  const loadOrders = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (data) {
        setOrders(data);
        calculateSpending(data);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateSpending = (ordersList: Order[]) => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

    let thisMonthTotal = 0;
    let lastMonthTotal = 0;
    let thisYearTotal = 0;

    ordersList.forEach((order) => {
      const orderDate = new Date(order.created_at);
      const orderMonth = orderDate.getMonth();
      const orderYear = orderDate.getFullYear();

      if (orderMonth === thisMonth && orderYear === thisYear) {
        thisMonthTotal += order.total;
      }
      if (orderMonth === lastMonth && orderYear === lastMonthYear) {
        lastMonthTotal += order.total;
      }
      if (orderYear === thisYear) {
        thisYearTotal += order.total;
      }
    });

    setSpending({
      thisMonth: thisMonthTotal,
      lastMonth: lastMonthTotal,
      thisYear: thisYearTotal,
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderOrder = ({ item }: { item: Order }) => (
    <Pressable style={[styles.orderCard, { backgroundColor: cardBg }]}>
      <View style={styles.orderIcon}>
        <Text style={styles.orderIconText}>🧾</Text>
      </View>
      <View style={styles.orderContent}>
        <Text style={styles.orderStore}>{item.store_name}</Text>
        <Text style={styles.orderDate}>{formatDate(item.created_at)}</Text>
        <Text style={styles.orderItems}>{item.items_count} items</Text>
      </View>
      <View style={styles.orderRight}>
        <Text style={styles.orderTotal}>${item.total.toFixed(2)}</Text>
        <Text style={styles.orderArrow}>→</Text>
      </View>
    </Pressable>
  );

  const percentChange = spending.lastMonth > 0
    ? ((spending.thisMonth - spending.lastMonth) / spending.lastMonth * 100).toFixed(0)
    : '0';

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
        <Text style={styles.headerTitle}>Order History</Text>
        <View style={styles.backButton} />
      </View>

      {/* Spending Summary */}
      <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
        <View style={styles.summaryMain}>
          <Text style={styles.summaryLabel}>This Month</Text>
          <Text style={styles.summaryAmount}>${spending.thisMonth.toFixed(2)}</Text>
          {spending.lastMonth > 0 && (
            <Text style={[
              styles.summaryChange,
              Number(percentChange) >= 0 ? styles.changeUp : styles.changeDown
            ]}>
              {Number(percentChange) >= 0 ? '↑' : '↓'} {Math.abs(Number(percentChange))}% vs last month
            </Text>
          )}
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryItemLabel}>Last Month</Text>
            <Text style={styles.summaryItemValue}>${spending.lastMonth.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryItemLabel}>This Year</Text>
            <Text style={styles.summaryItemValue}>${spending.thisYear.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Orders List */}
      <Text style={styles.sectionTitle}>Recent Orders</Text>

      {orders.length > 0 ? (
        <FlatList
          data={orders}
          renderItem={renderOrder}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + SPACING.xl }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📜</Text>
          <Text style={styles.emptyTitle}>No Orders Yet</Text>
          <Text style={styles.emptyDescription}>
            Your shopping history will appear here after you complete purchases
          </Text>
        </View>
      )}
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

  // Summary Card
  summaryCard: {
    backgroundColor: '#fff',
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
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
    fontSize: 40,
    fontWeight: '800',
    color: COLORS.text.primary,
    marginVertical: SPACING.xs,
  },
  summaryChange: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  changeUp: {
    color: '#e53935',
  },
  changeDown: {
    color: COLORS.success,
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

  // Section
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },

  // List
  listContent: {
    paddingHorizontal: SPACING.lg,
  },

  // Order Card
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
  },
  orderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.gold.light + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderIconText: {
    fontSize: 24,
  },
  orderContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  orderStore: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  orderDate: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
  },
  orderItems: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.inkFaded,
  },
  orderRight: {
    alignItems: 'flex-end',
  },
  orderTotal: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  orderArrow: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    marginTop: 4,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
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
  },
});
