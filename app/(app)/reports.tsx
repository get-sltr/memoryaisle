import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Svg, { Rect } from 'react-native-svg';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { useAuthStore } from '../../src/stores/authStore';
import { useThemeStore } from '../../src/stores/themeStore';
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../../src/constants/theme';
import {
  getMonthlySpending,
  getSpendingByCategory,
  getPurchaseItems,
  exportMonthToCSV,
  type CategorySpending,
  type PurchaseItem,
} from '../../src/services/purchaseReports';

const CATEGORY_COLORS: Record<string, string> = {
  dairy: '#5CC8E8',
  produce: '#7ED957',
  meat: '#E85C5C',
  bakery: '#FFCF5C',
  pantry: '#8B7355',
  other: '#C8A8E8',
};

const CATEGORY_LABELS: Record<string, string> = {
  dairy: 'Dairy',
  produce: 'Produce',
  meat: 'Meat',
  bakery: 'Bakery',
  pantry: 'Pantry',
  other: 'Other',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function ReportsScreen() {
  const router = useRouter();
  const { household } = useAuthStore();
  const { isDark, colors } = useThemeStore();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [spending, setSpending] = useState(0);
  const [prevSpending, setPrevSpending] = useState(0);
  const [categories, setCategories] = useState<CategorySpending[]>([]);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const cardBg = isDark ? colors.frost.bgHeavy : '#fff';

  const loadData = useCallback(async () => {
    if (!household?.id) return;
    try {
      const [total, prevTotal, cats, purchaseItems] = await Promise.all([
        getMonthlySpending(household.id, year, month),
        getMonthlySpending(
          household.id,
          month === 0 ? year - 1 : year,
          month === 0 ? 11 : month - 1
        ),
        getSpendingByCategory(household.id, year, month),
        getPurchaseItems(household.id, year, month),
      ]);
      setSpending(total);
      setPrevSpending(prevTotal);
      setCategories(cats);
      setItems(purchaseItems);
    } catch (e) {
      console.error('Failed to load reports:', e);
    } finally {
      setIsLoading(false);
    }
  }, [household?.id, year, month]);

  useEffect(() => {
    setIsLoading(true);
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const goToPrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(y => y - 1);
    } else {
      setMonth(m => m - 1);
    }
  };

  const goToNextMonth = () => {
    const isCurrentMonth = month === now.getMonth() && year === now.getFullYear();
    if (isCurrentMonth) return;
    if (month === 11) {
      setMonth(0);
      setYear(y => y + 1);
    } else {
      setMonth(m => m + 1);
    }
  };

  const handleExport = async () => {
    if (!household?.id) return;
    setExporting(true);
    try {
      await exportMonthToCSV(household.id, year, month);
    } catch (e) {
      console.error('Export failed:', e);
    } finally {
      setExporting(false);
    }
  };

  const percentChange =
    prevSpending > 0
      ? Math.round(((spending - prevSpending) / prevSpending) * 100)
      : 0;

  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear();
  const maxCategoryTotal = categories.length > 0 ? categories[0].total : 1;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderItem = ({ item }: { item: PurchaseItem }) => (
    <View style={[styles.itemRow, { backgroundColor: cardBg }]}>
      <View style={styles.itemContent}>
        <Text style={[styles.itemName, { color: colors.text.primary }]}>{item.item_name}</Text>
        <View style={styles.itemMeta}>
          <View style={[styles.categoryPill, { backgroundColor: (CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other) + '20' }]}>
            <Text style={[styles.categoryPillText, { color: CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other }]}>
              {CATEGORY_LABELS[item.category] || 'Other'}
            </Text>
          </View>
          <Text style={[styles.itemDate, { color: colors.text.secondary }]}>
            {formatDate(item.purchased_at)}
          </Text>
        </View>
      </View>
      <Text style={[styles.itemPrice, { color: colors.text.primary }]}>
        {item.price != null ? `$${item.price.toFixed(2)}` : '-'}
      </Text>
    </View>
  );

  const ListHeader = () => (
    <>
      {/* Month Selector */}
      <View style={styles.monthSelector}>
        <Pressable onPress={goToPrevMonth} style={styles.monthArrow}>
          <Text style={[styles.monthArrowText, { color: colors.text.primary }]}>←</Text>
        </Pressable>
        <Text style={[styles.monthTitle, { color: colors.text.primary }]}>
          {MONTH_NAMES[month]} {year}
        </Text>
        <Pressable
          onPress={goToNextMonth}
          style={[styles.monthArrow, isCurrentMonth && styles.monthArrowDisabled]}
          disabled={isCurrentMonth}
        >
          <Text style={[
            styles.monthArrowText,
            { color: isCurrentMonth ? colors.text.tertiary : colors.text.primary },
          ]}>→</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.gold.base} size="large" />
        </View>
      ) : (
        <>
          {/* Monthly Spending Card */}
          <View style={[styles.spendingCard, { backgroundColor: cardBg }]}>
            <BlurView intensity={15} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(255,255,255,0.75)', 'rgba(250,248,245,0.6)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.spendingCardBorder} />
            <Text style={styles.spendingLabel}>Total Spending</Text>
            <Text style={[styles.spendingAmount, { color: colors.text.primary }]}>
              ${spending.toFixed(2)}
            </Text>
            {prevSpending > 0 && (
              <Text style={[
                styles.spendingChange,
                percentChange >= 0 ? styles.changeUp : styles.changeDown,
              ]}>
                {percentChange >= 0 ? '↑' : '↓'} {Math.abs(percentChange)}% vs last month
              </Text>
            )}
          </View>

          {/* Category Breakdown */}
          {categories.length > 0 && (
            <View style={[styles.categoryCard, { backgroundColor: cardBg }]}>
              <BlurView intensity={15} tint="light" style={StyleSheet.absoluteFill} />
              <LinearGradient
                colors={['rgba(255,255,255,0.75)', 'rgba(250,248,245,0.6)']}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.spendingCardBorder} />
              <Text style={[styles.cardTitle, { color: colors.text.primary }]}>
                Spending by Category
              </Text>
              {categories.map((cat) => {
                const barWidth = Math.max((cat.total / maxCategoryTotal) * 100, 8);
                const color = CATEGORY_COLORS[cat.category] || CATEGORY_COLORS.other;
                return (
                  <View key={cat.category} style={styles.barRow}>
                    <Text style={[styles.barLabel, { color: colors.text.secondary }]}>
                      {CATEGORY_LABELS[cat.category] || 'Other'}
                    </Text>
                    <View style={styles.barContainer}>
                      <Svg height={20} width="100%">
                        <Rect
                          x={0}
                          y={2}
                          width={`${barWidth}%`}
                          height={16}
                          rx={8}
                          fill={color}
                        />
                      </Svg>
                    </View>
                    <Text style={[styles.barValue, { color: colors.text.primary }]}>
                      ${cat.total.toFixed(0)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Items Header */}
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Items Purchased ({items.length})
          </Text>
        </>
      )}
    </>
  );

  const ListFooter = () => (
    <View style={styles.footer}>
      {!isLoading && items.length > 0 && (
        <Pressable
          style={[styles.exportButton, exporting && styles.exportButtonDisabled]}
          onPress={handleExport}
          disabled={exporting}
        >
          <LinearGradient
            colors={[COLORS.gold.base, COLORS.gold.dark]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          {exporting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.exportButtonText}>Export CSV</Text>
          )}
        </Pressable>
      )}
    </View>
  );

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.text.primary }]}>←</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
          Purchase Reports
        </Text>
        <View style={styles.backButton} />
      </View>

      <FlatList
        data={isLoading ? [] : items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📊</Text>
              <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>No Purchases</Text>
              <Text style={[styles.emptyDescription, { color: colors.text.secondary }]}>
                No purchases recorded for {MONTH_NAMES[month]} {year}
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
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
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
  },

  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 120,
  },

  // Month selector
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  monthArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthArrowDisabled: {
    opacity: 0.3,
  },
  monthArrowText: {
    fontSize: 22,
    fontWeight: '600',
  },
  monthTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
  },

  // Loading
  loadingContainer: {
    padding: SPACING.xxl * 2,
    alignItems: 'center',
  },

  // Spending card
  spendingCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    ...SHADOWS.glass,
  },
  spendingCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  spendingLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
  },
  spendingAmount: {
    fontSize: 40,
    fontWeight: '800',
    marginVertical: SPACING.xs,
  },
  spendingChange: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  changeUp: {
    color: '#e53935',
  },
  changeDown: {
    color: COLORS.success,
  },

  // Category card
  categoryCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.glass,
  },
  cardTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  barLabel: {
    width: 60,
    fontSize: FONT_SIZES.xs,
    fontWeight: '500',
  },
  barContainer: {
    flex: 1,
    marginHorizontal: SPACING.sm,
  },
  barValue: {
    width: 45,
    textAlign: 'right',
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },

  // Section title
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },

  // Item row
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 4,
  },
  categoryPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  categoryPillText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  itemDate: {
    fontSize: FONT_SIZES.xs,
  },
  itemPrice: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
  },

  // Export button
  footer: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  exportButton: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    ...SHADOWS.goldGlow,
  },
  exportButtonDisabled: {
    opacity: 0.6,
  },
  exportButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: '#fff',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
  },
  emptyDescription: {
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
});
