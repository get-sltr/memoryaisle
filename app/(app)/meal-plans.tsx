import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  FadeIn,
  SlideInRight,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { AuroraBackground, AuroraCard, AURORA_PALETTES } from '../../src/components/AuroraBackground';
import { MealPlanCard } from '../../src/components/MealPlanCard';
import { PaywallPrompt } from '../../src/components/PaywallPrompt';
import { useFeatureAccess } from '../../src/hooks/useSubscription';
import { useAuthStore } from '../../src/stores/authStore';
import { getActiveList, addItem } from '../../src/services/lists';
import { getCurrentMealPlan, getMealPlans, type MealPlanWithMeals } from '../../src/services/mealPlans';
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
} from '../../src/constants/theme';
import type { MiraMealPlan, MiraDayPlan, MiraMeal } from '../../src/services/mira';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TabType = 'active' | 'saved' | 'history';

// Convert database MealPlanWithMeals to UI MiraMealPlan format
function dbPlanToMiraPlan(dbPlan: MealPlanWithMeals): MiraMealPlan {
  const meals = dbPlan.planned_meals || [];
  const startDate = new Date(dbPlan.start_date);
  const endDate = new Date(dbPlan.end_date);
  const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Group meals by date
  const mealsByDate = new Map<string, typeof meals>();
  for (const meal of meals) {
    const date = meal.date;
    if (!mealsByDate.has(date)) mealsByDate.set(date, []);
    mealsByDate.get(date)!.push(meal);
  }

  const days: MiraDayPlan[] = [];
  for (let i = 0; i < duration; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const dayMeals = mealsByDate.get(dateStr) || [];

    const findMeal = (type: string): MiraMeal => {
      const m = dayMeals.find(dm => dm.meal_type === type);
      return {
        name: m?.name || '',
        description: m?.description || '',
        calories: m?.calories || 0,
        prepTime: m?.prep_time || '',
        ingredients: m?.ingredients || [],
      };
    };

    const b = findMeal('breakfast');
    const l = findMeal('lunch');
    const d = findMeal('dinner');
    const s = findMeal('snack');

    days.push({
      day: i + 1,
      meals: {
        breakfast: b,
        lunch: l,
        dinner: d,
        snacks: s,
      },
      totalCalories: (b.calories || 0) + (l.calories || 0) + (d.calories || 0) + (s.calories || 0),
    });
  }

  // Collect all ingredients as shopping list
  const shoppingList = [...new Set(meals.flatMap(m => m.ingredients || []))];

  return {
    name: dbPlan.name,
    description: `${duration}-day meal plan`,
    duration,
    dailyTargets: { calories: 2000, protein: '120g', carbs: '200g', fat: '70g' },
    dietType: 'balanced',
    days,
    shoppingList,
    tips: [],
  };
}

export default function MealPlansScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [selectedPlan, setSelectedPlan] = useState<MiraMealPlan | null>(null);
  const [savedPlans, setSavedPlans] = useState<MiraMealPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);

  // Check if user has access to meal plans (premium only)
  const { hasAccess, isLoading: subscriptionLoading, isPremium } = useFeatureAccess('mealPlans');
  const { household } = useAuthStore();

  // Load meal plans from database
  useEffect(() => {
    if (!household?.id || !hasAccess) return;

    const loadMealPlans = async () => {
      setIsLoading(true);
      try {
        // Get current active plan
        const currentPlan = await getCurrentMealPlan(household.id);
        if (currentPlan && currentPlan.planned_meals.length > 0) {
          setSelectedPlan(dbPlanToMiraPlan(currentPlan));
        }

        // Get all plans for saved/history tabs
        const allPlans = await getMealPlans(household.id);
        const today = new Date().toISOString().split('T')[0];
        const pastPlans = allPlans.filter(p => p.end_date < today && p.planned_meals.length > 0);
        setSavedPlans(pastPlans.map(dbPlanToMiraPlan));
      } catch {
        // On error, show empty state
      } finally {
        setIsLoading(false);
      }
    };

    loadMealPlans();
  }, [household?.id, hasAccess]);

  // Animation values
  const tabIndicator = useSharedValue(0);

  const handleTabChange = useCallback((tab: TabType) => {
    Haptics.selectionAsync();
    setActiveTab(tab);
    tabIndicator.value = withSpring(
      tab === 'active' ? 0 : tab === 'saved' ? 1 : 2,
      { damping: 20, stiffness: 200 }
    );
  }, []);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(tabIndicator.value, [0, 1, 2], [0, (SCREEN_WIDTH - 48) / 3, ((SCREEN_WIDTH - 48) / 3) * 2]) }],
  }));

  // Show paywall for free users
  useEffect(() => {
    if (!subscriptionLoading && !hasAccess) {
      setShowPaywall(true);
    }
  }, [subscriptionLoading, hasAccess]);

  const handleAddToShoppingList = useCallback(async (items: string[]) => {
    if (!household?.id) return;
    try {
      const list = await getActiveList(household.id);
      if (!list) {
        Alert.alert('Error', 'Could not get shopping list');
        return;
      }
      let added = 0;
      for (const item of items) {
        const result = await addItem(list.id, item, undefined, 1, 'ai_suggested');
        if (result) added++;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Added!', `${added} ingredients added to your shopping list.`);
    } catch {
      Alert.alert('Error', 'Failed to add items to list');
    }
  }, [household?.id]);

  return (
    <AuroraBackground palette="northern" intensity="subtle">
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <Text style={styles.backButtonText}>{'←'}</Text>
        </Pressable>

        <View style={styles.titleContainer}>
          <Text style={styles.title}>Meal Plans</Text>
          <Text style={styles.subtitle}>Powered by Mira</Text>
        </View>

        <View style={{ width: 44 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <View style={styles.tabsBackground}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        </View>

        <Animated.View style={[styles.tabIndicator, indicatorStyle]}>
          <LinearGradient
            colors={[AURORA_PALETTES.northern.colors[0] + '80', AURORA_PALETTES.northern.colors[2] + '60']}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {(['active', 'saved', 'history'] as TabType[]).map((tab) => (
          <Pressable
            key={tab}
            style={styles.tab}
            onPress={() => handleTabChange(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={COLORS.gold.base} />
          </View>
        ) : activeTab === 'active' && selectedPlan ? (
          <Animated.View entering={FadeIn.duration(400)}>
            {/* Plan Overview Card */}
            <AuroraCard palette="northern" style={styles.overviewCard}>
              <View style={styles.overviewContent}>
                <View style={styles.overviewHeader}>
                  <Text style={styles.planName}>{selectedPlan.name}</Text>
                  <View style={styles.dietBadge}>
                    <Text style={styles.dietBadgeText}>{selectedPlan.dietType}</Text>
                  </View>
                </View>

                <Text style={styles.planDescription}>{selectedPlan.description}</Text>

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{selectedPlan.duration}</Text>
                    <Text style={styles.statLabel}>Days</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{selectedPlan.dailyTargets.calories}</Text>
                    <Text style={styles.statLabel}>Cal/Day</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{selectedPlan.dailyTargets.protein}</Text>
                    <Text style={styles.statLabel}>Protein</Text>
                  </View>
                </View>
              </View>
            </AuroraCard>

            {/* Meal Plan Card with swipe navigation */}
            <MealPlanCard
              mealPlan={selectedPlan}
              onAddToList={handleAddToShoppingList}
            />

            {/* Shopping List Preview */}
            <Animated.View entering={SlideInRight.delay(200).duration(400)}>
              <AuroraCard palette="ocean" style={styles.shoppingCard}>
                <View style={styles.shoppingContent}>
                  <View style={styles.shoppingHeader}>
                    <Text style={styles.shoppingTitle}>Shopping List</Text>
                    <Text style={styles.shoppingCount}>{selectedPlan.shoppingList.length} items</Text>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.shoppingItems}>
                      {selectedPlan.shoppingList.slice(0, 8).map((item, index) => (
                        <View key={index} style={styles.shoppingItem}>
                          <Text style={styles.shoppingItemText}>{item}</Text>
                        </View>
                      ))}
                      {selectedPlan.shoppingList.length > 8 && (
                        <View style={styles.shoppingMore}>
                          <Text style={styles.shoppingMoreText}>+{selectedPlan.shoppingList.length - 8}</Text>
                        </View>
                      )}
                    </View>
                  </ScrollView>

                  <Pressable
                    style={styles.addAllButton}
                    onPress={() => handleAddToShoppingList(selectedPlan.shoppingList)}
                  >
                    <Text style={styles.addAllButtonText}>Add All to List</Text>
                  </Pressable>
                </View>
              </AuroraCard>
            </Animated.View>

            {/* Tips Section */}
            {selectedPlan.tips && selectedPlan.tips.length > 0 && (
              <Animated.View entering={SlideInRight.delay(300).duration(400)}>
                <AuroraCard palette="forest" style={styles.tipsCard}>
                  <View style={styles.tipsContent}>
                    <Text style={styles.tipsTitle}>Pro Tips</Text>
                    {selectedPlan.tips.map((tip, index) => (
                      <View key={index} style={styles.tipItem}>
                        <Text style={styles.tipBullet}>✦</Text>
                        <Text style={styles.tipText}>{tip}</Text>
                      </View>
                    ))}
                  </View>
                </AuroraCard>
              </Animated.View>
            )}
          </Animated.View>
        ) : activeTab === 'active' && !selectedPlan ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🍽️</Text>
            <Text style={styles.emptyTitle}>No Active Plan</Text>
            <Text style={styles.emptyText}>Ask Mira to create a personalized meal plan for you</Text>
            <Pressable style={styles.askMiraButton} onPress={() => router.push('/(app)')}>
              <LinearGradient
                colors={[COLORS.gold.base, COLORS.gold.dark]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Text style={styles.askMiraButtonText}>Ask Mira</Text>
            </Pressable>
          </View>
        ) : activeTab === 'saved' ? (
          savedPlans.length > 0 ? (
            <Animated.View entering={FadeIn.duration(400)}>
              {savedPlans.map((plan, idx) => (
                <Pressable key={idx} onPress={() => { setSelectedPlan(plan); handleTabChange('active'); }}>
                  <AuroraCard palette="ocean" style={styles.overviewCard}>
                    <View style={styles.overviewContent}>
                      <Text style={styles.planName}>{plan.name}</Text>
                      <Text style={styles.planDescription}>{plan.description}</Text>
                      <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                          <Text style={styles.statValue}>{plan.duration}</Text>
                          <Text style={styles.statLabel}>Days</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                          <Text style={styles.statValue}>{plan.dailyTargets.calories}</Text>
                          <Text style={styles.statLabel}>Cal/Day</Text>
                        </View>
                      </View>
                    </View>
                  </AuroraCard>
                </Pressable>
              ))}
            </Animated.View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No Saved Plans</Text>
              <Text style={styles.emptyText}>Ask Mira to create a meal plan and save it for later</Text>
            </View>
          )
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📜</Text>
            <Text style={styles.emptyTitle}>No History Yet</Text>
            <Text style={styles.emptyText}>Your completed meal plans will appear here</Text>
          </View>
        )}
      </ScrollView>

      {/* Paywall for free users */}
      <PaywallPrompt
        visible={showPaywall}
        onClose={() => {
          setShowPaywall(false);
          // Go back if user dismisses the paywall
          if (!hasAccess) {
            router.back();
          }
        }}
        feature="mealPlans"
      />
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: 60,
    paddingBottom: SPACING.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  backButtonText: {
    fontSize: 20,
    color: COLORS.white,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.xxl,
    fontWeight: '600',
    color: COLORS.white,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    height: 44,
  },
  tabsBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabIndicator: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    width: (SCREEN_WIDTH - 48 - 4) / 3,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  tabTextActive: {
    color: COLORS.white,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 120,
  },
  overviewCard: {
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
  },
  overviewContent: {
    gap: SPACING.md,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.white,
    flex: 1,
  },
  dietBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  dietBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.white,
    textTransform: 'uppercase',
  },
  planDescription: {
    fontSize: FONT_SIZES.md,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.white,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  shoppingCard: {
    marginTop: SPACING.lg,
    padding: SPACING.lg,
  },
  shoppingContent: {
    gap: SPACING.md,
  },
  shoppingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shoppingTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.white,
  },
  shoppingCount: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  shoppingItems: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  shoppingItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
  },
  shoppingItemText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.white,
  },
  shoppingMore: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
  },
  shoppingMoreText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.white,
  },
  addAllButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  addAllButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.white,
  },
  tipsCard: {
    marginTop: SPACING.lg,
    padding: SPACING.lg,
  },
  tipsContent: {
    gap: SPACING.sm,
  },
  tipsTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  tipItem: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  tipBullet: {
    fontSize: FONT_SIZES.sm,
    color: AURORA_PALETTES.forest.colors[2],
  },
  tipText: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    flex: 1,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    maxWidth: 250,
  },
  askMiraButton: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  askMiraButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
  },
});
