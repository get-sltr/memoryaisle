import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
  Extrapolation,
  runOnJS,
  FadeIn,
  FadeInDown,
  SlideInRight,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { AuroraCard, AURORA_PALETTES } from './AuroraBackground';
import type { MiraMealPlan, MiraDayPlan, MiraMeal } from '../services/mira';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;
const SWIPE_THRESHOLD = CARD_WIDTH * 0.3;

// Meal type icons and colors
const MEAL_CONFIG = {
  breakfast: {
    icon: '🌅',
    gradient: ['#FFB347', '#FF8C42', '#FF6B35'],
    glow: '#FFB347',
  },
  lunch: {
    icon: '☀️',
    gradient: ['#56CCF2', '#2F80ED', '#5E60CE'],
    glow: '#56CCF2',
  },
  dinner: {
    icon: '🌙',
    gradient: ['#A855F7', '#7C3AED', '#5B21B6'],
    glow: '#A855F7',
  },
  snacks: {
    icon: '🍎',
    gradient: ['#10B981', '#059669', '#047857'],
    glow: '#10B981',
  },
};

interface MealPlanCardProps {
  mealPlan: MiraMealPlan;
  onAddToList?: (ingredients: string[]) => void;
  onSave?: () => void;
  onDismiss?: () => void;
}

export function MealPlanCard({
  mealPlan,
  onAddToList,
  onSave,
  onDismiss,
}: MealPlanCardProps) {
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);

  const translateX = useSharedValue(0);
  const cardScale = useSharedValue(1);
  const glowIntensity = useSharedValue(0.5);

  const currentDay = mealPlan.days[currentDayIndex];

  // Glow animation
  useEffect(() => {
    glowIntensity.value = withSequence(
      withTiming(0.8, { duration: 1500 }),
      withTiming(0.5, { duration: 1500 })
    );

    const interval = setInterval(() => {
      glowIntensity.value = withSequence(
        withTiming(0.8, { duration: 1500 }),
        withTiming(0.5, { duration: 1500 })
      );
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleDayChange = (direction: 'next' | 'prev') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (direction === 'next' && currentDayIndex < mealPlan.days.length - 1) {
      setCurrentDayIndex(currentDayIndex + 1);
    } else if (direction === 'prev' && currentDayIndex > 0) {
      setCurrentDayIndex(currentDayIndex - 1);
    }
  };

  // Swipe gesture for day navigation
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX * 0.5;
      cardScale.value = interpolate(
        Math.abs(event.translationX),
        [0, SWIPE_THRESHOLD],
        [1, 0.95],
        Extrapolation.CLAMP
      );
    })
    .onEnd((event) => {
      if (event.translationX > SWIPE_THRESHOLD && currentDayIndex > 0) {
        runOnJS(handleDayChange)('prev');
      } else if (event.translationX < -SWIPE_THRESHOLD && currentDayIndex < mealPlan.days.length - 1) {
        runOnJS(handleDayChange)('next');
      }

      translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      cardScale.value = withSpring(1, { damping: 20, stiffness: 200 });
    });

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: cardScale.value },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowIntensity.value,
  }));

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.container, animatedCardStyle]}>
          {/* Outer glow */}
          <Animated.View style={[styles.outerGlow, glowStyle]}>
            <LinearGradient
              colors={['transparent', AURORA_PALETTES.northern.glow, 'transparent']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
            />
          </Animated.View>

          <AuroraCard palette="northern" style={styles.card}>
            {/* Header */}
            <Animated.View
              entering={FadeInDown.delay(100).duration(500)}
              style={styles.header}
            >
              <View style={styles.headerLeft}>
                <Text style={styles.planName}>{mealPlan.name}</Text>
                <Text style={styles.planMeta}>
                  {mealPlan.duration} days • {mealPlan.dietType}
                </Text>
              </View>
              <View style={styles.caloriesBadge}>
                <LinearGradient
                  colors={['rgba(0, 212, 170, 0.3)', 'rgba(0, 180, 216, 0.3)']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Text style={styles.caloriesText}>
                  {mealPlan.dailyTargets.calories}
                </Text>
                <Text style={styles.caloriesLabel}>cal/day</Text>
              </View>
            </Animated.View>

            {/* Day selector */}
            <View style={styles.daySelector}>
              <Pressable
                onPress={() => handleDayChange('prev')}
                disabled={currentDayIndex === 0}
                style={[styles.dayArrow, currentDayIndex === 0 && styles.dayArrowDisabled]}
              >
                <Text style={styles.dayArrowText}>‹</Text>
              </Pressable>

              <View style={styles.dayInfo}>
                <Text style={styles.dayNumber}>Day {currentDay?.day || 1}</Text>
                <Text style={styles.dayName}>{currentDay?.dayName || 'Monday'}</Text>
              </View>

              <Pressable
                onPress={() => handleDayChange('next')}
                disabled={currentDayIndex === mealPlan.days.length - 1}
                style={[styles.dayArrow, currentDayIndex === mealPlan.days.length - 1 && styles.dayArrowDisabled]}
              >
                <Text style={styles.dayArrowText}>›</Text>
              </Pressable>
            </View>

            {/* Day progress dots */}
            <View style={styles.progressDots}>
              {mealPlan.days.slice(0, 7).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.progressDot,
                    index === currentDayIndex && styles.progressDotActive,
                    index < currentDayIndex && styles.progressDotCompleted,
                  ]}
                />
              ))}
              {mealPlan.days.length > 7 && (
                <Text style={styles.moreDays}>+{mealPlan.days.length - 7}</Text>
              )}
            </View>

            {/* Meals */}
            {currentDay && (
              <View style={styles.mealsContainer}>
                {(['breakfast', 'lunch', 'dinner', 'snacks'] as const).map((mealType, index) => {
                  const meal = currentDay.meals[mealType];
                  if (!meal) return null;

                  return (
                    <MealItem
                      key={mealType}
                      mealType={mealType}
                      meal={meal}
                      index={index}
                      expanded={expandedMeal === mealType}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setExpandedMeal(expandedMeal === mealType ? null : mealType);
                      }}
                    />
                  );
                })}
              </View>
            )}

            {/* Macros summary */}
            <Animated.View
              entering={FadeIn.delay(400).duration(500)}
              style={styles.macrosBar}
            >
              <MacroChip label="Protein" value={mealPlan.dailyTargets.protein} color="#10B981" />
              <MacroChip label="Carbs" value={mealPlan.dailyTargets.carbs} color="#F59E0B" />
              <MacroChip label="Fat" value={mealPlan.dailyTargets.fat} color="#EF4444" />
            </Animated.View>

            {/* Action buttons */}
            <View style={styles.actions}>
              <Pressable
                style={styles.actionButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onAddToList?.(mealPlan.shoppingList);
                }}
              >
                <LinearGradient
                  colors={['#00D4AA', '#00B4D8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionButtonGradient}
                >
                  <Text style={styles.actionButtonText}>Add to Shopping List</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </AuroraCard>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

// Individual meal item component
interface MealItemProps {
  mealType: keyof typeof MEAL_CONFIG;
  meal: MiraMeal;
  index: number;
  expanded: boolean;
  onPress: () => void;
}

function MealItem({ mealType, meal, index, expanded, onPress }: MealItemProps) {
  const config = MEAL_CONFIG[mealType];
  const height = useSharedValue(72);
  const rotation = useSharedValue(0);

  useEffect(() => {
    height.value = withSpring(expanded ? 180 : 72, { damping: 15, stiffness: 150 });
    rotation.value = withSpring(expanded ? 180 : 0, { damping: 15, stiffness: 150 });
  }, [expanded]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View
      entering={SlideInRight.delay(index * 100).duration(400)}
      style={[styles.mealItem, animatedStyle]}
    >
      <Pressable onPress={onPress} style={styles.mealItemContent}>
        {/* Glow background */}
        <View style={[styles.mealGlow, { shadowColor: config.glow }]} />

        {/* Gradient accent */}
        <LinearGradient
          colors={config.gradient as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.mealAccent}
        />

        {/* Content */}
        <View style={styles.mealMain}>
          <View style={styles.mealHeader}>
            <Text style={styles.mealIcon}>{config.icon}</Text>
            <View style={styles.mealInfo}>
              <Text style={styles.mealType}>{mealType}</Text>
              <Text style={styles.mealName} numberOfLines={1}>{meal.name}</Text>
            </View>
            <View style={styles.mealStats}>
              <Text style={styles.mealCalories}>{meal.calories}</Text>
              <Text style={styles.mealCaloriesLabel}>cal</Text>
            </View>
            <Animated.View style={chevronStyle}>
              <Text style={styles.chevron}>▼</Text>
            </Animated.View>
          </View>

          {/* Expanded content */}
          {expanded && (
            <Animated.View
              entering={FadeIn.duration(200)}
              style={styles.mealExpanded}
            >
              <Text style={styles.mealDescription}>{meal.description}</Text>
              <View style={styles.ingredientsList}>
                {meal.ingredients.slice(0, 4).map((ingredient, i) => (
                  <View key={i} style={styles.ingredientItem}>
                    <View style={[styles.ingredientDot, { backgroundColor: config.gradient[0] }]} />
                    <Text style={styles.ingredientText}>{ingredient}</Text>
                  </View>
                ))}
                {meal.ingredients.length > 4 && (
                  <Text style={styles.moreIngredients}>
                    +{meal.ingredients.length - 4} more
                  </Text>
                )}
              </View>
            </Animated.View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// Macro nutrient chip
function MacroChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.macroChip}>
      <View style={[styles.macroDot, { backgroundColor: color }]} />
      <Text style={styles.macroValue}>{value}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    padding: SPACING.md,
  },
  outerGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    borderRadius: 40,
  },
  card: {
    borderRadius: 24,
    padding: SPACING.lg,
    backgroundColor: 'rgba(10, 10, 20, 0.9)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  headerLeft: {
    flex: 1,
  },
  planName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  planMeta: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'capitalize',
  },
  caloriesBadge: {
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    overflow: 'hidden',
  },
  caloriesText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#00D4AA',
  },
  caloriesLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  daySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  dayArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayArrowDisabled: {
    opacity: 0.3,
  },
  dayArrowText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '300',
  },
  dayInfo: {
    flex: 1,
    alignItems: 'center',
  },
  dayNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dayName: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.lg,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressDotActive: {
    backgroundColor: '#00D4AA',
    width: 24,
  },
  progressDotCompleted: {
    backgroundColor: 'rgba(0, 212, 170, 0.5)',
  },
  moreDays: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    marginLeft: 4,
  },
  mealsContainer: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  mealItem: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  mealItemContent: {
    flex: 1,
    flexDirection: 'row',
  },
  mealGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  mealAccent: {
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  mealMain: {
    flex: 1,
    padding: SPACING.md,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealIcon: {
    fontSize: 24,
    marginRight: SPACING.sm,
  },
  mealInfo: {
    flex: 1,
  },
  mealType: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  mealStats: {
    alignItems: 'flex-end',
    marginRight: SPACING.sm,
  },
  mealCalories: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  mealCaloriesLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  chevron: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  mealExpanded: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  mealDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: SPACING.sm,
    lineHeight: 18,
  },
  ingredientsList: {
    gap: 4,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ingredientDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  ingredientText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  moreIngredients: {
    fontSize: 12,
    color: 'rgba(0, 212, 170, 0.8)',
    marginTop: 4,
  },
  macrosBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: SPACING.md,
  },
  macroChip: {
    alignItems: 'center',
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  macroValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  macroLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actions: {
    gap: SPACING.sm,
  },
  actionButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
