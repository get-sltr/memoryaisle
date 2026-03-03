import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { useAuthStore } from '../../src/stores/authStore';
import { useSubscriptionStore } from '../../src/stores/subscriptionStore';
import { useBudgetStore } from '../../src/stores/budgetStore';
import { type CategoryBreakdown } from '../../src/services/budget';
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../../src/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_WIDTH = SCREEN_WIDTH - SPACING.lg * 2 - SPACING.md * 2;

const CATEGORY_COLORS: Record<string, string> = {
  produce: '#7EB88A',
  dairy: '#8DB4E2',
  meat: '#D4614C',
  bakery: '#D4A547',
  pantry: '#8E7CC3',
  other: '#A8AEB8',
};

const CATEGORY_EMOJI: Record<string, string> = {
  produce: '🥬',
  dairy: '🧀',
  meat: '🥩',
  bakery: '🍞',
  pantry: '🥫',
  other: '📦',
};

export default function BudgetScreen() {
  const { user } = useAuthStore();
  const { subscription } = useSubscriptionStore();
  const isPremium = subscription.tier === 'premium';
  const {
    budget,
    summary,
    categoryBreakdown,
    monthlyTrends,
    isLoading,
    initialize,
    setBudget: storeBudget,
    loadTrends,
  } = useBudgetStore();

  const [showSetup, setShowSetup] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [periodInput, setPeriodInput] = useState<'weekly' | 'monthly'>('monthly');
  const [isSaving, setIsSaving] = useState(false);

  const householdId = user?.household_id;

  useEffect(() => {
    if (householdId) {
      initialize(householdId);
    }
  }, [householdId]);

  useEffect(() => {
    if (householdId && isPremium && budget) {
      loadTrends(householdId);
    }
  }, [householdId, isPremium, budget]);

  const handleSetBudget = async () => {
    const amount = parseFloat(budgetInput);
    if (!amount || amount <= 0 || !householdId) {
      Alert.alert('Invalid Amount', 'Please enter a valid budget amount.');
      return;
    }

    setIsSaving(true);
    const success = await storeBudget(householdId, amount, periodInput);
    setIsSaving(false);

    if (success) {
      setShowSetup(false);
      setBudgetInput('');
    } else {
      Alert.alert('Error', 'Could not save budget.');
    }
  };

  const statusColor = summary?.status === 'red' ? COLORS.error
    : summary?.status === 'yellow' ? COLORS.warning
    : COLORS.success;

  // No budget set yet
  if (!budget && !isLoading) {
    return (
      <ScreenWrapper>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0.3)']} style={StyleSheet.absoluteFill} />
            <Text style={styles.backText}>{'\u2039'} Back</Text>
          </Pressable>
          <Text style={styles.title}>Budget</Text>
        </View>

        <View style={styles.setupState}>
          <Text style={styles.setupEmoji}>💰</Text>
          <Text style={styles.setupTitle}>Set Your Grocery Budget</Text>
          <Text style={styles.setupText}>
            Track your spending and let Mira suggest meals that fit your budget.
          </Text>

          <View style={styles.setupForm}>
            <Text style={styles.fieldLabel}>Budget Amount</Text>
            <View style={styles.amountRow}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="400"
                placeholderTextColor={COLORS.text.tertiary}
                value={budgetInput}
                onChangeText={setBudgetInput}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>

            <Text style={styles.fieldLabel}>Period</Text>
            <View style={styles.periodRow}>
              {(['weekly', 'monthly'] as const).map((p) => (
                <Pressable
                  key={p}
                  style={[styles.periodChip, periodInput === p && styles.periodChipActive]}
                  onPress={() => setPeriodInput(p)}
                >
                  <Text style={[styles.periodLabel, periodInput === p && styles.periodLabelActive]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
              onPress={handleSetBudget}
              disabled={isSaving}
            >
              <LinearGradient colors={[COLORS.gold.light, COLORS.gold.base]} style={StyleSheet.absoluteFill} />
              {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Set Budget</Text>}
            </Pressable>
          </View>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0.3)']} style={StyleSheet.absoluteFill} />
          <Text style={styles.backText}>{'\u2039'} Back</Text>
        </Pressable>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>Budget</Text>
            <Text style={styles.subtitle}>{budget?.period === 'weekly' ? 'Weekly' : 'Monthly'} Grocery Budget</Text>
          </View>
          <Pressable style={styles.editBtn} onPress={() => { setBudgetInput(String(budget?.amount || '')); setPeriodInput(budget?.period || 'monthly'); setShowSetup(true); }}>
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={COLORS.gold.base} style={{ padding: SPACING.xxl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Main Budget Card */}
          {summary && (
            <View style={styles.budgetCard}>
              <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.6)', 'rgba(250, 252, 255, 0.4)']}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.budgetCardBorder} />

              <View style={styles.budgetCardContent}>
                <View style={styles.budgetHeader}>
                  <View>
                    <Text style={styles.spentLabel}>Spent</Text>
                    <Text style={[styles.spentAmount, { color: statusColor }]}>${summary.totalSpent.toFixed(2)}</Text>
                  </View>
                  <View style={styles.budgetRight}>
                    <Text style={styles.budgetLabel}>of ${summary.budgetAmount.toFixed(0)}</Text>
                    <Text style={[styles.remainingText, { color: statusColor }]}>${summary.remaining.toFixed(2)} left</Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, summary.percentUsed)}%`, backgroundColor: statusColor }]} />
                </View>
                <Text style={styles.percentText}>{summary.percentUsed}% used • {summary.daysLeft} days left</Text>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>${summary.dailyAverage.toFixed(2)}</Text>
                    <Text style={styles.statLabel}>Daily Avg</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, summary.projectedTotal > summary.budgetAmount ? { color: COLORS.error } : {}]}>
                      ${summary.projectedTotal.toFixed(0)}
                    </Text>
                    <Text style={styles.statLabel}>Projected</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{summary.daysLeft > 0 ? `$${(summary.remaining / summary.daysLeft).toFixed(2)}` : '-'}</Text>
                    <Text style={styles.statLabel}>Per Day Left</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Category Breakdown */}
          {categoryBreakdown.length > 0 && (
            <View style={styles.sectionCard}>
              <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
              <LinearGradient colors={['rgba(255, 255, 255, 0.55)', 'rgba(250, 252, 255, 0.4)']} style={StyleSheet.absoluteFill} />
              <View style={styles.sectionCardBorder} />

              <View style={styles.sectionCardContent}>
                <Text style={styles.sectionTitle}>Spending by Category</Text>
                {categoryBreakdown.map((cat) => (
                  <View key={cat.category} style={styles.catRow}>
                    <Text style={styles.catEmoji}>{CATEGORY_EMOJI[cat.category] || '📦'}</Text>
                    <View style={styles.catInfo}>
                      <View style={styles.catLabelRow}>
                        <Text style={styles.catName}>{cat.category.charAt(0).toUpperCase() + cat.category.slice(1)}</Text>
                        <Text style={styles.catAmount}>${cat.total.toFixed(2)}</Text>
                      </View>
                      <View style={styles.catBar}>
                        <View style={[styles.catBarFill, { width: `${cat.percentage}%`, backgroundColor: CATEGORY_COLORS[cat.category] || COLORS.platinum.mid }]} />
                      </View>
                    </View>
                    <Text style={styles.catPercent}>{cat.percentage}%</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Monthly Trends (Premium) */}
          {isPremium && monthlyTrends.length > 0 && (
            <View style={styles.sectionCard}>
              <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
              <LinearGradient colors={['rgba(255, 255, 255, 0.55)', 'rgba(250, 252, 255, 0.4)']} style={StyleSheet.absoluteFill} />
              <View style={styles.sectionCardBorder} />

              <View style={styles.sectionCardContent}>
                <Text style={styles.sectionTitle}>Monthly Trends</Text>
                <View style={styles.trendChart}>
                  {monthlyTrends.map((trend) => {
                    const maxSpent = Math.max(...monthlyTrends.map(t => t.spent), 1);
                    const height = (trend.spent / maxSpent) * 100;
                    const overBudget = trend.budget > 0 && trend.spent > trend.budget;

                    return (
                      <View key={trend.month} style={styles.trendBar}>
                        <View style={styles.trendBarContainer}>
                          <View style={[styles.trendBarFill, { height: `${height}%`, backgroundColor: overBudget ? COLORS.error : COLORS.success }]} />
                        </View>
                        <Text style={styles.trendAmount}>${trend.spent.toFixed(0)}</Text>
                        <Text style={styles.trendMonth}>{trend.month.split(' ')[0]}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          {!isPremium && (
            <Pressable style={styles.premiumBanner} onPress={() => router.push('/(app)/upgrade')}>
              <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
              <LinearGradient colors={[`${COLORS.gold.light}40`, `${COLORS.gold.base}20`]} style={StyleSheet.absoluteFill} />
              <Text style={styles.premiumBannerText}>⭐ Upgrade for monthly trends & Mira budget-aware meal planning</Text>
            </Pressable>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {/* Edit Budget Modal (inline) */}
      {showSetup && (
        <View style={styles.editOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowSetup(false)} />
          <View style={styles.editSheet}>
            <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255, 255, 255, 0.95)', 'rgba(250, 246, 240, 0.98)']} style={StyleSheet.absoluteFill} />
            <View style={styles.editSheetContent}>
              <Text style={styles.modalTitle}>Update Budget</Text>
              <View style={styles.amountRow}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={budgetInput}
                  onChangeText={setBudgetInput}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              </View>
              <View style={styles.periodRow}>
                {(['weekly', 'monthly'] as const).map((p) => (
                  <Pressable key={p} style={[styles.periodChip, periodInput === p && styles.periodChipActive]} onPress={() => setPeriodInput(p)}>
                    <Text style={[styles.periodLabel, periodInput === p && styles.periodLabelActive]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable style={styles.saveBtn} onPress={handleSetBudget} disabled={isSaving}>
                <LinearGradient colors={[COLORS.gold.light, COLORS.gold.base]} style={StyleSheet.absoluteFill} />
                {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.md },
  backButton: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.lg, overflow: 'hidden', marginBottom: SPACING.md,
  },
  backText: { fontSize: FONT_SIZES.md, color: COLORS.text.primary, fontWeight: '500' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: 'Georgia', fontSize: FONT_SIZES.title, fontWeight: '500', color: COLORS.text.primary, letterSpacing: -0.5 },
  subtitle: { fontSize: FONT_SIZES.sm, color: COLORS.gold.dark, fontStyle: 'italic', marginTop: 2 },
  editBtn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.full, backgroundColor: 'rgba(255, 255, 255, 0.5)', borderWidth: 0.5, borderColor: 'rgba(200, 200, 210, 0.3)' },
  editBtnText: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.gold.dark },
  scrollContent: { paddingHorizontal: SPACING.lg, gap: SPACING.md },
  // Budget Card
  budgetCard: { borderRadius: BORDER_RADIUS.xl, overflow: 'hidden', ...SHADOWS.glass },
  budgetCardBorder: { ...StyleSheet.absoluteFillObject, borderRadius: BORDER_RADIUS.xl, borderWidth: 0.5, borderColor: 'rgba(255, 255, 255, 0.5)' },
  budgetCardContent: { padding: SPACING.lg },
  budgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: SPACING.md },
  spentLabel: { fontSize: FONT_SIZES.sm, color: COLORS.text.secondary, fontWeight: '500' },
  spentAmount: { fontSize: 32, fontFamily: 'Georgia', fontWeight: '700', letterSpacing: -1 },
  budgetRight: { alignItems: 'flex-end' },
  budgetLabel: { fontSize: FONT_SIZES.sm, color: COLORS.text.secondary },
  remainingText: { fontSize: FONT_SIZES.lg, fontWeight: '700' },
  progressBar: { height: 10, backgroundColor: 'rgba(0, 0, 0, 0.06)', borderRadius: 5, overflow: 'hidden', marginBottom: SPACING.xs },
  progressFill: { height: '100%', borderRadius: 5 },
  percentText: { fontSize: FONT_SIZES.xs, color: COLORS.text.tertiary, textAlign: 'center', marginBottom: SPACING.md },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.text.primary },
  statLabel: { fontSize: FONT_SIZES.xs, color: COLORS.text.tertiary, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(0, 0, 0, 0.06)' },
  // Section Card
  sectionCard: { borderRadius: BORDER_RADIUS.xl, overflow: 'hidden', ...SHADOWS.glass },
  sectionCardBorder: { ...StyleSheet.absoluteFillObject, borderRadius: BORDER_RADIUS.xl, borderWidth: 0.5, borderColor: 'rgba(255, 255, 255, 0.5)' },
  sectionCardContent: { padding: SPACING.lg },
  sectionTitle: { fontFamily: 'Georgia', fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.text.primary, marginBottom: SPACING.md },
  // Category Breakdown
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, gap: SPACING.sm },
  catEmoji: { fontSize: 20, width: 28, textAlign: 'center' },
  catInfo: { flex: 1 },
  catLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  catName: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.text.primary },
  catAmount: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.text.secondary },
  catBar: { height: 6, backgroundColor: 'rgba(0, 0, 0, 0.04)', borderRadius: 3, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 3 },
  catPercent: { fontSize: FONT_SIZES.xs, fontWeight: '600', color: COLORS.text.tertiary, width: 35, textAlign: 'right' },
  // Trends
  trendChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 140 },
  trendBar: { alignItems: 'center', flex: 1 },
  trendBarContainer: { width: 20, height: 100, justifyContent: 'flex-end', borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(0, 0, 0, 0.04)' },
  trendBarFill: { width: '100%', borderRadius: 4 },
  trendAmount: { fontSize: 9, color: COLORS.text.tertiary, marginTop: 4, fontWeight: '600' },
  trendMonth: { fontSize: 10, color: COLORS.text.secondary, fontWeight: '500' },
  // Premium Banner
  premiumBanner: { borderRadius: BORDER_RADIUS.lg, overflow: 'hidden', padding: SPACING.md, borderWidth: 1, borderColor: `${COLORS.gold.base}30` },
  premiumBannerText: { fontSize: FONT_SIZES.sm, color: COLORS.gold.dark, fontWeight: '500', textAlign: 'center' },
  // Setup State
  setupState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl },
  setupEmoji: { fontSize: 56, marginBottom: SPACING.md },
  setupTitle: { fontFamily: 'Georgia', fontSize: FONT_SIZES.xxl, fontWeight: '600', color: COLORS.text.primary, marginBottom: SPACING.sm, textAlign: 'center' },
  setupText: { fontSize: FONT_SIZES.md, color: COLORS.text.secondary, textAlign: 'center', lineHeight: 22, marginBottom: SPACING.xl },
  setupForm: { width: '100%' },
  fieldLabel: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.text.secondary, marginBottom: SPACING.xs, marginTop: SPACING.sm },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  dollarSign: { fontSize: 28, fontWeight: '700', color: COLORS.text.primary, marginRight: SPACING.xs },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '700', color: COLORS.text.primary, borderBottomWidth: 2, borderBottomColor: COLORS.gold.base, paddingVertical: SPACING.xs },
  periodRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  periodChip: {
    flex: 1, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg, alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)', borderWidth: 0.5, borderColor: 'rgba(200, 200, 210, 0.3)',
  },
  periodChipActive: { backgroundColor: `${COLORS.gold.base}20`, borderColor: COLORS.gold.base },
  periodLabel: { fontSize: FONT_SIZES.md, fontWeight: '500', color: COLORS.text.secondary },
  periodLabelActive: { color: COLORS.gold.dark, fontWeight: '600' },
  saveBtn: { marginTop: SPACING.lg, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.xl, alignItems: 'center', overflow: 'hidden', ...SHADOWS.goldGlow },
  saveBtnText: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: '#FFF' },
  modalTitle: { fontFamily: 'Georgia', fontSize: FONT_SIZES.xl, fontWeight: '600', color: COLORS.text.primary, textAlign: 'center', marginBottom: SPACING.md },
  // Edit overlay
  editOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.3)' },
  editSheet: { borderTopLeftRadius: BORDER_RADIUS.xxl, borderTopRightRadius: BORDER_RADIUS.xxl, overflow: 'hidden' },
  editSheetContent: { padding: SPACING.lg, paddingBottom: 50 },
});
