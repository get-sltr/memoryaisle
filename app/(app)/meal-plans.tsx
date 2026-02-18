import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
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
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
} from '../../src/constants/theme';
import type { MiraMealPlan } from '../../src/services/mira';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Sample meal plan data (would come from Mira in production)
const SAMPLE_MEAL_PLANS: MiraMealPlan[] = [
  {
    name: '7-Day Balanced Nutrition',
    description: 'A well-rounded week of healthy meals with optimal macros',
    duration: 7,
    dailyTargets: {
      calories: 2000,
      protein: '120g',
      carbs: '200g',
      fat: '70g',
    },
    dietType: 'balanced',
    days: [
      {
        day: 1,
        meals: {
          breakfast: {
            name: 'Greek Yogurt Parfait',
            description: 'Creamy yogurt with granola, berries, and honey',
            calories: 380,
            macros: { protein: '18g', carbs: '52g', fat: '12g' },
            ingredients: ['Greek yogurt', 'Granola', 'Mixed berries', 'Honey'],
            prepTime: '5 min',
          },
          lunch: {
            name: 'Mediterranean Quinoa Bowl',
            description: 'Protein-packed quinoa with fresh vegetables',
            calories: 520,
            macros: { protein: '28g', carbs: '58g', fat: '18g' },
            ingredients: ['Quinoa', 'Chickpeas', 'Cucumber', 'Tomatoes', 'Feta', 'Olive oil'],
            prepTime: '20 min',
          },
          dinner: {
            name: 'Grilled Salmon with Asparagus',
            description: 'Omega-3 rich salmon with roasted vegetables',
            calories: 580,
            macros: { protein: '45g', carbs: '25g', fat: '32g' },
            ingredients: ['Salmon fillet', 'Asparagus', 'Lemon', 'Garlic', 'Olive oil'],
            prepTime: '25 min',
          },
          snacks: {
            name: 'Apple with Almond Butter',
            description: 'Simple and satisfying afternoon snack',
            calories: 280,
            macros: { protein: '8g', carbs: '30g', fat: '16g' },
            ingredients: ['Apple', 'Almond butter'],
            prepTime: '2 min',
          },
        },
        totalCalories: 1760,
        totalMacros: { protein: '99g', carbs: '165g', fat: '78g' },
      },
      {
        day: 2,
        meals: {
          breakfast: {
            name: 'Avocado Toast with Eggs',
            description: 'Whole grain toast topped with creamy avocado and poached eggs',
            calories: 420,
            macros: { protein: '20g', carbs: '35g', fat: '24g' },
            ingredients: ['Whole grain bread', 'Avocado', 'Eggs', 'Cherry tomatoes'],
            prepTime: '10 min',
          },
          lunch: {
            name: 'Asian Chicken Salad',
            description: 'Crispy greens with grilled chicken and sesame dressing',
            calories: 480,
            macros: { protein: '38g', carbs: '28g', fat: '22g' },
            ingredients: ['Mixed greens', 'Chicken breast', 'Edamame', 'Mandarin oranges', 'Sesame dressing'],
            prepTime: '15 min',
          },
          dinner: {
            name: 'Turkey Stuffed Peppers',
            description: 'Colorful bell peppers filled with seasoned turkey and rice',
            calories: 520,
            macros: { protein: '42g', carbs: '45g', fat: '16g' },
            ingredients: ['Bell peppers', 'Ground turkey', 'Brown rice', 'Tomato sauce', 'Cheese'],
            prepTime: '35 min',
          },
          snacks: {
            name: 'Hummus with Veggies',
            description: 'Creamy hummus with crunchy vegetable sticks',
            calories: 220,
            macros: { protein: '8g', carbs: '22g', fat: '12g' },
            ingredients: ['Hummus', 'Carrots', 'Celery', 'Cucumber'],
            prepTime: '5 min',
          },
        },
        totalCalories: 1640,
        totalMacros: { protein: '108g', carbs: '130g', fat: '74g' },
      },
    ],
    shoppingList: [
      'Greek yogurt', 'Granola', 'Mixed berries', 'Honey', 'Quinoa',
      'Chickpeas', 'Cucumber', 'Tomatoes', 'Feta cheese', 'Olive oil',
      'Salmon fillets', 'Asparagus', 'Lemons', 'Garlic', 'Apples',
      'Almond butter', 'Whole grain bread', 'Avocados', 'Eggs',
    ],
    tips: [
      'Prep ingredients on Sunday for faster weekday cooking',
      'Keep healthy snacks pre-portioned for grab-and-go convenience',
      'Stay hydrated - aim for 8 glasses of water daily',
    ],
  },
];

type TabType = 'active' | 'saved' | 'history';

export default function MealPlansScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [selectedPlan, setSelectedPlan] = useState<MiraMealPlan | null>(SAMPLE_MEAL_PLANS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  // Check if user has access to meal plans (premium only)
  const { hasAccess, isLoading: subscriptionLoading, isPremium } = useFeatureAccess('mealPlans');

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

  const handleAddToShoppingList = useCallback((items: string[]) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // TODO: Add items to shopping list
    console.log('Adding to shopping list:', items);
  }, []);

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
        {activeTab === 'active' && selectedPlan ? (
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
        ) : activeTab === 'saved' ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No Saved Plans</Text>
            <Text style={styles.emptyText}>Ask Mira to create a meal plan and save it for later</Text>
          </View>
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
});
