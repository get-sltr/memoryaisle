import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Image,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { logger } from '../../src/utils/logger';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { useAuthStore } from '../../src/stores/authStore';
import {
  getMealPlansForDateRange,
  getCurrentMealPlan,
  createEmptyMealPlan,
  addMealToPlan,
  updateMeal,
  deleteMeal,
  type PlannedMeal,
  type MealPlanWithMeals,
} from '../../src/services/mealPlans';
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../../src/constants/theme';

// Helper to generate week data dynamically
function generateWeekData(weekOffset: number = 0) {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek + (weekOffset * 7));

  const days = [];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);

    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === new Date(today.getTime() + 86400000).toDateString();

    let dayName = dayNames[date.getDay()];
    if (isToday) dayName = 'Today';
    else if (isTomorrow) dayName = 'Tomorrow';

    days.push({
      id: `day-${i}`,
      dayName,
      date: `${dayNames[date.getDay()]} ${date.getDate()}`,
      fullDate: date,
      isToday,
      meals: [] as Array<{ type: string; name: string; id: string }>,
    });
  }

  return days;
}

function getWeekRange(weekOffset: number = 0) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek + (weekOffset * 7));

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
    return `${monthNames[startOfWeek.getMonth()]} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}`;
  }
  return `${monthNames[startOfWeek.getMonth()]} ${startOfWeek.getDate()} - ${monthNames[endOfWeek.getMonth()]} ${endOfWeek.getDate()}`;
}

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert' | 'other';

interface Meal {
  id: string;
  type: MealType;
  name: string;
  calories?: number;
  notes?: string;
}

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'other', label: 'Other' },
];

const MEAL_COLORS: Record<MealType, [string, string]> = {
  breakfast: ['#F0B86E', '#E09145'],
  lunch: ['#7EB88A', '#5A9E68'],
  dinner: ['#8E7CC3', '#6A5ACD'],
  snack: ['#E8A87C', '#D67D4A'],
  dessert: ['#F6B8D4', '#E88DB5'],
  other: ['#9BA4B4', '#7A8599'],
};

export default function MealPlanScreen() {
  const { household, user } = useAuthStore();
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekMeals, setWeekMeals] = useState<Record<string, Meal[]>>({});
  const [currentPlan, setCurrentPlan] = useState<MealPlanWithMeals | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modal state for adding/editing meals
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [editingDbMealId, setEditingDbMealId] = useState<string | null>(null);
  const [mealName, setMealName] = useState('');
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [mealCalories, setMealCalories] = useState('');
  const [mealNotes, setMealNotes] = useState('');

  // Load meals from database
  const loadMeals = useCallback(async () => {
    if (!household) return;

    try {
      setIsLoading(true);

      // Calculate week date range
      const today = new Date();
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek + (weekOffset * 7));
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      // Get current meal plan
      const plan = await getCurrentMealPlan(household.id);
      setCurrentPlan(plan);

      // Get meals for the week
      const meals = await getMealPlansForDateRange(household.id, startOfWeek, endOfWeek);

      // Convert to our local format grouped by day
      const mealsByDay: Record<string, Meal[]> = {};

      meals.forEach((dbMeal: PlannedMeal) => {
        const mealDate = new Date(dbMeal.date);
        const dayIndex = Math.floor((mealDate.getTime() - startOfWeek.getTime()) / (1000 * 60 * 60 * 24));
        const dayId = `day-${dayIndex}`;

        if (!mealsByDay[dayId]) {
          mealsByDay[dayId] = [];
        }

        mealsByDay[dayId].push({
          id: dbMeal.id,
          type: dbMeal.meal_type as MealType,
          name: dbMeal.name,
          calories: dbMeal.calories || undefined,
          notes: dbMeal.description || undefined,
        });
      });

      setWeekMeals(mealsByDay);
    } catch (error) {
      logger.error('Failed to load meals:', error);
    } finally {
      setIsLoading(false);
    }
  }, [household, weekOffset]);

  // Load meals on mount and when week changes
  useEffect(() => {
    loadMeals();
  }, [loadMeals]);

  const weekData = useMemo(() => {
    const days = generateWeekData(weekOffset);
    // Merge saved meals into the week data
    return days.map(day => ({
      ...day,
      meals: weekMeals[day.id] || [],
    }));
  }, [weekOffset, weekMeals]);

  const selectedWeek = useMemo(() => getWeekRange(weekOffset), [weekOffset]);

  const handlePreviousWeek = useCallback(() => {
    setWeekOffset(prev => prev - 1);
  }, []);

  const handleNextWeek = useCallback(() => {
    setWeekOffset(prev => prev + 1);
  }, []);

  const openAddMealModal = useCallback((dayId: string) => {
    setEditingDayId(dayId);
    setEditingMeal(null);
    setEditingDbMealId(null);
    setMealName('');
    setMealType('breakfast');
    setMealCalories('');
    setMealNotes('');
    setModalVisible(true);
  }, []);

  const openEditMealModal = useCallback((dayId: string, meal: Meal) => {
    setEditingDayId(dayId);
    setEditingMeal(meal);
    setEditingDbMealId(meal.id); // This is now the database UUID
    setMealName(meal.name);
    setMealType(meal.type);
    setMealCalories(meal.calories ? String(meal.calories) : '');
    setMealNotes(meal.notes || '');
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setEditingDayId(null);
    setEditingMeal(null);
    setEditingDbMealId(null);
    setMealName('');
    setMealCalories('');
    setMealNotes('');
  }, []);

  // Helper to get date string from dayId
  const getDateFromDayId = useCallback((dayId: string) => {
    const dayIndex = parseInt(dayId.replace('day-', ''), 10);
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek + (weekOffset * 7));
    const targetDate = new Date(startOfWeek);
    targetDate.setDate(startOfWeek.getDate() + dayIndex);
    return targetDate.toISOString().split('T')[0];
  }, [weekOffset]);

  const saveMeal = useCallback(async () => {
    if (!editingDayId || !mealName.trim() || !household) {
      Alert.alert('Missing Info', 'Please enter a meal name');
      return;
    }

    const calories = mealCalories ? parseInt(mealCalories, 10) : undefined;

    try {
      if (editingDbMealId) {
        // Update existing meal in database
        await updateMeal(editingDbMealId, {
          name: mealName.trim(),
          description: mealNotes.trim() || undefined,
          calories,
        });

        // Update local state
        setWeekMeals(prev => ({
          ...prev,
          [editingDayId]: (prev[editingDayId] || []).map(m =>
            m.id === editingDbMealId
              ? { ...m, name: mealName.trim(), type: mealType, calories, notes: mealNotes.trim() || undefined }
              : m
          ),
        }));
      } else {
        // Create new meal - first ensure we have a meal plan
        let planId = currentPlan?.id;

        if (!planId) {
          // Create a meal plan for this week
          const today = new Date();
          const dayOfWeek = today.getDay();
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - dayOfWeek + (weekOffset * 7));
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);

          const newPlan = await createEmptyMealPlan(
            household.id,
            'Weekly Meal Plan',
            startOfWeek,
            endOfWeek,
            user?.id
          );
          planId = newPlan.id;
          setCurrentPlan({ ...newPlan, planned_meals: [] });
        }

        // Get the date for this day
        const mealDate = getDateFromDayId(editingDayId);

        // Add meal to database
        const newDbMeal = await addMealToPlan(planId, mealDate, {
          meal_type: mealType,
          name: mealName.trim(),
          description: mealNotes.trim() || undefined,
          calories,
        });

        // Update local state with the database meal
        const newMeal: Meal = {
          id: newDbMeal.id,
          type: mealType,
          name: mealName.trim(),
          calories,
          notes: mealNotes.trim() || undefined,
        };
        setWeekMeals(prev => ({
          ...prev,
          [editingDayId]: [...(prev[editingDayId] || []), newMeal],
        }));
      }
      closeModal();
    } catch (error) {
      logger.error('Failed to save meal:', error);
      Alert.alert('Error', 'Failed to save meal. Please try again.');
    }
  }, [editingDayId, editingDbMealId, mealName, mealType, mealCalories, mealNotes, closeModal, household, user, currentPlan, weekOffset, getDateFromDayId]);

  const handleRemoveMeal = useCallback((dayId: string, mealId: string) => {
    Alert.alert(
      'Delete Meal',
      'Are you sure you want to remove this meal?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from database
              await deleteMeal(mealId);

              // Update local state
              setWeekMeals(prev => ({
                ...prev,
                [dayId]: (prev[dayId] || []).filter(m => m.id !== mealId),
              }));
            } catch (error) {
              logger.error('Failed to delete meal:', error);
              Alert.alert('Error', 'Failed to delete meal. Please try again.');
            }
          },
        },
      ]
    );
  }, []);

  // Calculate daily totals
  const getDayCalories = useCallback((dayId: string) => {
    const meals = weekMeals[dayId] || [];
    return meals.reduce((sum, meal) => sum + (meal.calories || 0), 0);
  }, [weekMeals]);

  const handleAddButtonPress = useCallback(() => {
    Alert.alert(
      'Quick Actions',
      'What would you like to do?',
      [
        { text: 'View Trip Recipes', onPress: () => router.push('/trips') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, []);

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Image
            source={require('../../assets/theapp.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.title}>Meal Plan</Text>
            <Text style={styles.subtitle}>This Week</Text>
          </View>
        </View>
        <Pressable style={styles.addButton} onPress={handleAddButtonPress}>
          <BlurView intensity={20} tint="light" style={styles.addButtonBlur} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.7)', 'rgba(245, 245, 250, 0.5)']}
            style={styles.addButtonGradient}
          />
          <View style={styles.addButtonBorder} />
          <Text style={styles.addButtonText}>+</Text>
        </Pressable>
      </View>

      {/* Calendar Navigation */}
      <View style={styles.calendarHeader}>
        <Text style={styles.calendarTitle}>{selectedWeek}</Text>
        <View style={styles.calendarNav}>
          <Pressable style={styles.navButton} onPress={handlePreviousWeek}>
            <BlurView intensity={15} tint="light" style={styles.navButtonBlur} />
            <View style={styles.navButtonBorder} />
            <Text style={styles.navButtonText}>{'<'}</Text>
          </Pressable>
          <Pressable style={styles.navButton} onPress={handleNextWeek}>
            <BlurView intensity={15} tint="light" style={styles.navButtonBlur} />
            <View style={styles.navButtonBorder} />
            <Text style={styles.navButtonText}>{'>'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Week View */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.base} />
          <Text style={styles.loadingText}>Loading meals...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.weekView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.weekViewContent}
        >
          {weekData.map((day) => (
            <DayCard
              key={day.id}
              day={day}
              dayCalories={getDayCalories(day.id)}
              onAddMeal={() => openAddMealModal(day.id)}
              onEditMeal={(meal) => openEditMealModal(day.id, meal)}
              onRemoveMeal={(mealId) => handleRemoveMeal(day.id, mealId)}
            />
          ))}
        </ScrollView>
      )}

      {/* Add/Edit Meal Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeModal} />
          <View style={styles.modalContainer}>
            <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.95)', 'rgba(250, 252, 255, 0.9)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.modalBorder} />

            <View style={styles.modalContent}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingMeal ? 'Edit Meal' : 'Add Meal'}
                </Text>
                <Pressable onPress={closeModal} style={styles.modalCloseBtn}>
                  <Text style={styles.modalCloseText}>×</Text>
                </Pressable>
              </View>

              {/* Meal Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>What did you eat?</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., Grilled salmon with rice"
                  placeholderTextColor={COLORS.text.tertiary}
                  value={mealName}
                  onChangeText={setMealName}
                  autoFocus={true}
                />
              </View>

              {/* Meal Type Selection */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Meal Type</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.mealTypeRow}
                >
                  {MEAL_TYPES.map((type) => (
                    <Pressable
                      key={type.value}
                      style={[
                        styles.mealTypeOption,
                        mealType === type.value && styles.mealTypeOptionActive,
                      ]}
                      onPress={() => setMealType(type.value)}
                    >
                      <LinearGradient
                        colors={
                          mealType === type.value
                            ? MEAL_COLORS[type.value]
                            : ['rgba(255,255,255,0.5)', 'rgba(245,245,250,0.3)']
                        }
                        style={StyleSheet.absoluteFill}
                      />
                      <Text
                        style={[
                          styles.mealTypeOptionText,
                          mealType === type.value && styles.mealTypeOptionTextActive,
                        ]}
                      >
                        {type.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Calories Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Calories (optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., 450"
                  placeholderTextColor={COLORS.text.tertiary}
                  value={mealCalories}
                  onChangeText={(text) => setMealCalories(text.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                />
              </View>

              {/* Notes Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Notes (optional)</Text>
                <TextInput
                  style={[styles.textInput, styles.textInputMultiline]}
                  placeholder="Any notes about this meal..."
                  placeholderTextColor={COLORS.text.tertiary}
                  value={mealNotes}
                  onChangeText={setMealNotes}
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* Save Button */}
              <Pressable style={styles.saveButton} onPress={saveMeal}>
                <LinearGradient
                  colors={[COLORS.gold.light, COLORS.gold.base]}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.saveButtonText}>
                  {editingMeal ? 'Update Meal' : 'Add Meal'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenWrapper>
  );
}

interface DayData {
  id: string;
  dayName: string;
  date: string;
  fullDate?: Date;
  isToday: boolean;
  meals: Meal[];
}

interface DayCardProps {
  day: DayData;
  dayCalories: number;
  onAddMeal: () => void;
  onEditMeal: (meal: Meal) => void;
  onRemoveMeal: (mealId: string) => void;
}

function DayCard({ day, dayCalories, onAddMeal, onEditMeal, onRemoveMeal }: DayCardProps) {
  return (
    <View style={[styles.dayCard, day.isToday && styles.dayCardToday]}>
      <BlurView intensity={20} tint="light" style={styles.cardBlur} />
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.7)', 'rgba(245, 245, 250, 0.6)']}
        style={styles.cardGradient}
      />
      {/* Top shine */}
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.12)', 'transparent']}
        style={styles.cardShine}
      />
      <View style={[styles.cardBorder, day.isToday && styles.cardBorderToday]} />

      <View style={styles.cardContent}>
        {/* Day Header */}
        <View style={styles.dayHeader}>
          <View>
            <Text style={styles.dayName}>{day.dayName}</Text>
            <Text style={[styles.dayDate, day.isToday && styles.dayDateToday]}>
              {day.date}
            </Text>
          </View>
          {dayCalories > 0 && (
            <View style={styles.caloriesBadge}>
              <Text style={styles.caloriesText}>{dayCalories} cal</Text>
            </View>
          )}
        </View>

        {/* Meals */}
        <View style={styles.mealsList}>
          {day.meals.map((meal) => (
            <Pressable
              key={meal.id}
              style={styles.mealPill}
              onPress={() => onEditMeal(meal)}
              onLongPress={() => onRemoveMeal(meal.id)}
            >
              <LinearGradient
                colors={MEAL_COLORS[meal.type] || ['#888', '#666']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.mealTypeBadge}
              >
                <Text style={styles.mealTypeText}>
                  {meal.type.charAt(0).toUpperCase() + meal.type.slice(1)}
                </Text>
              </LinearGradient>
              <View style={styles.mealInfo}>
                <Text style={styles.mealName}>{meal.name}</Text>
                {meal.calories && (
                  <Text style={styles.mealCalories}>{meal.calories} cal</Text>
                )}
              </View>
            </Pressable>
          ))}

          {/* Add Meal Button */}
          <Pressable style={styles.addMealBtn} onPress={onAddMeal}>
            <Text style={styles.addMealText}>
              + {day.meals.length === 0 ? 'Log a meal' : 'Add another meal'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 2,
  },
  logoImage: {
    width: 40,
    height: 40,
  },
  title: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.title,
    fontWeight: '500',
    color: COLORS.text.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gold.dark,
    fontStyle: 'italic',
    marginTop: 2,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  addButtonBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  addButtonGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  addButtonBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.frost.border,
  },
  addButtonText: {
    fontSize: 24,
    color: COLORS.text.primary,
    fontWeight: '300',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  calendarTitle: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.xxl,
    color: COLORS.text.primary,
  },
  calendarNav: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  navButtonBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  navButtonBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.frost.border,
  },
  navButtonText: {
    fontSize: 16,
    color: COLORS.text.secondary,
  },
  weekView: {
    flex: 1,
  },
  weekViewContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 120, // Extra padding for scroll
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontFamily: FONTS?.serif?.regular || 'Georgia',
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    fontStyle: 'italic',
  },
  dayCard: {
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  dayCardToday: {
    ...SHADOWS.goldGlow,
  },
  cardBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  cardShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  cardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.frost.border,
  },
  cardBorderToday: {
    borderColor: 'rgba(212, 165, 71, 0.4)',
  },
  cardContent: {
    padding: SPACING.md,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  dayName: {
    fontSize: FONT_SIZES.xs + 1,
    fontWeight: '700',
    color: COLORS.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dayDate: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  dayDateToday: {
    color: COLORS.gold.dark,
  },
  mealsList: {
    gap: SPACING.sm,
  },
  mealPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 2,
    padding: SPACING.md - 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.frost.border,
  },
  mealTypeBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: BORDER_RADIUS.sm,
  },
  mealTypeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mealInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text.primary,
    flex: 1,
  },
  mealCalories: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginLeft: SPACING.sm,
  },
  caloriesBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  caloriesText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gold.dark,
  },
  addMealBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md - 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.platinum.mid,
  },
  addMealText: {
    fontSize: FONT_SIZES.sm + 1,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  modalContainer: {
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    overflow: 'hidden',
    maxHeight: '85%',
  },
  modalBorder: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: COLORS.frost.border,
  },
  modalContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl + 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 28,
    color: COLORS.text.secondary,
    lineHeight: 28,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: COLORS.frost.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
  },
  textInputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  mealTypeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  mealTypeOption: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.frost.border,
  },
  mealTypeOptionActive: {
    borderColor: 'transparent',
  },
  mealTypeOptionText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  mealTypeOptionTextActive: {
    color: COLORS.white,
  },
  saveButton: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  saveButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.white,
  },
});
