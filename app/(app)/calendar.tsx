import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import {
  GlassIconWrapper,
  PlanGlassIcon,
  MomentGlassIcon,
} from '../../src/components/GlassIcons';
import { PaywallBanner } from '../../src/components/PaywallPrompt';
import { useAuthStore } from '../../src/stores/authStore';
import { addItem, getActiveList } from '../../src/services/lists';
import { useSubscription } from '../../src/hooks/useSubscription';
import {
  getUpcomingHolidays,
  getHolidaysForMonth,
  formatDaysUntil,
  formatHolidayDate,
  type HolidayOccurrence,
  type HolidayCategory,
} from '../../src/utils/holidays';
import {
  getMealPlansForDateRange,
  getMealsForDate,
  type PlannedMeal,
} from '../../src/services/mealPlans';
import type { CulturalPreference, WeeklyTradition } from '../../src/types';
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../../src/constants/theme';

// Map cultural preferences to holiday categories
const CULTURE_TO_CATEGORY: Record<CulturalPreference, HolidayCategory[]> = {
  secular: ['secular', 'american', 'cultural'],
  christian: ['christian'],
  jewish: ['jewish'],
  muslim: ['muslim'],
  hindu: ['hindu'],
  buddhist: ['hindu'], // Simplified - would expand
  chinese: ['chinese'],
};

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function CalendarScreen() {
  const { household, user } = useAuthStore();
  const { canAccess, isPremium } = useSubscription();
  const familyProfile = household?.familyProfile || {};
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'upcoming'>('upcoming');
  const [monthMeals, setMonthMeals] = useState<PlannedMeal[]>([]);
  const [todayMeals, setTodayMeals] = useState<PlannedMeal[]>([]);

  // Check if user has full calendar access
  const hasFullAccess = canAccess('smartCalendar');

  // Get family's cultural preferences
  const culturalPrefs = familyProfile.culturalPreferences || ['secular'];
  const weeklyTraditions = familyProfile.weeklyTraditions || [];

  // Fetch meals for the selected month
  useEffect(() => {
    if (!household?.id) return;
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    getMealPlansForDateRange(household.id, start, end)
      .then(setMonthMeals)
      .catch(() => setMonthMeals([]));
  }, [household?.id, selectedDate.getFullYear(), selectedDate.getMonth()]);

  // Fetch today's meals for the upcoming view
  useEffect(() => {
    if (!household?.id) return;
    getMealsForDate(household.id, new Date())
      .then(setTodayMeals)
      .catch(() => setTodayMeals([]));
  }, [household?.id]);

  // Map cultural preferences to holiday categories
  const relevantCategories = useMemo(() => {
    const categories: HolidayCategory[] = [];
    culturalPrefs.forEach(pref => {
      categories.push(...CULTURE_TO_CATEGORY[pref]);
    });
    return [...new Set(categories)];
  }, [culturalPrefs]);

  // Get upcoming holidays
  const upcomingHolidays = useMemo(() => {
    return getUpcomingHolidays(60, relevantCategories);
  }, [relevantCategories]);

  // Get holidays for selected month
  const monthHolidays = useMemo(() => {
    return getHolidaysForMonth(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      relevantCategories
    );
  }, [selectedDate, relevantCategories]);

  // Get traditions for this week
  const thisWeekTraditions = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    return weeklyTraditions.filter(t => {
      const daysUntil = (t.dayOfWeek - dayOfWeek + 7) % 7;
      return daysUntil <= 7 && t.isActive;
    }).sort((a, b) => {
      const daysUntilA = (a.dayOfWeek - dayOfWeek + 7) % 7;
      const daysUntilB = (b.dayOfWeek - dayOfWeek + 7) % 7;
      return daysUntilA - daysUntilB;
    });
  }, [weeklyTraditions]);

  // Handle "Holiday Mode" - generate shopping list for event
  const handleHolidayMode = async (holiday: HolidayOccurrence) => {
    // Check premium access
    if (!hasFullAccess) {
      Alert.alert(
        'Premium Feature',
        'Upgrade to Premium to create holiday shopping lists and use Holiday Mode!',
        [
          { text: 'Maybe Later', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/(app)/upgrade') },
        ]
      );
      return;
    }

    const items = holiday.suggestedItems || [];
    if (items.length === 0) {
      Alert.alert(
        holiday.name,
        'No suggested items for this holiday yet. Would you like to add your own?',
        [
          { text: 'Maybe Later', style: 'cancel' },
          { text: 'Add Items', onPress: () => router.push('/(app)') },
        ]
      );
      return;
    }

    // Show allergy-aware suggestions
    const userAllergies = user?.allergies || [];
    const hasAllergyConflicts = userAllergies.length > 0;

    // Build preview list
    const itemsPreview = items.map(item => `• ${item}`).join('\n');

    Alert.alert(
      `${holiday.icon} ${holiday.name} Shopping List`,
      `${hasAllergyConflicts ? 'Allergy-safe list:\n\n' : ''}${itemsPreview}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: hasAllergyConflicts ? 'Create Safe List' : 'Add to List',
          onPress: async () => {
            try {
              // Get the active list for the household
              if (!household?.id) {
                Alert.alert('Error', 'No household found');
                return;
              }

              const list = await getActiveList(household.id);
              if (!list) {
                Alert.alert('Error', 'Could not get or create shopping list');
                return;
              }

              // Add each item to the list
              let addedCount = 0;
              for (const itemName of items) {
                const result = await addItem(list.id, itemName, undefined, 1, 'ai_suggested');
                if (result) addedCount++;
              }

              Alert.alert(
                'List Created!',
                `Added ${addedCount} items for ${holiday.name}. Mira made it allergy-safe for your family!`,
                [{ text: 'View List', onPress: () => router.push('/(app)') }]
              );
            } catch (error) {
              console.error('Failed to add holiday items:', error);
              Alert.alert('Error', 'Failed to add items to list');
            }
          },
        },
      ]
    );
  };

  // Handle tradition shopping
  const handleTraditionMode = async (tradition: WeeklyTradition) => {
    // Check premium access
    if (!hasFullAccess) {
      Alert.alert(
        'Premium Feature',
        'Upgrade to Premium to create tradition shopping lists!',
        [
          { text: 'Maybe Later', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/(app)/upgrade') },
        ]
      );
      return;
    }

    const items = tradition.usualItems || [];
    if (items.length === 0) {
      Alert.alert(
        tradition.name,
        'No items saved for this tradition yet.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Build preview list
    const itemsPreview = items.map(item => `• ${item}`).join('\n');

    Alert.alert(
      `${tradition.icon} ${tradition.name}`,
      itemsPreview,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Items',
          onPress: async () => {
            try {
              if (!household?.id) {
                Alert.alert('Error', 'No household found');
                return;
              }

              const list = await getActiveList(household.id);
              if (!list) {
                Alert.alert('Error', 'Could not get or create shopping list');
                return;
              }

              // Add each item to the list
              let addedCount = 0;
              for (const itemName of items) {
                const result = await addItem(list.id, itemName, undefined, 1, 'ai_suggested');
                if (result) addedCount++;
              }

              Alert.alert(
                'Items Added!',
                `Added ${addedCount} ${tradition.name} items. Mira checked for allergies.`,
                [{ text: 'View List', onPress: () => router.push('/(app)') }]
              );
            } catch (error) {
              console.error('Failed to add tradition items:', error);
              Alert.alert('Error', 'Failed to add items to list');
            }
          },
        },
      ]
    );
  };

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: (number | null)[] = [];
    for (let i = 0; i < startPadding; i++) days.push(null);
    for (let i = 1; i <= totalDays; i++) days.push(i);
    return days;
  }, [selectedDate]);

  // Check if a day has events
  const getDayEvents = (day: number) => {
    const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
    const dateStr = date.toISOString().split('T')[0];
    const holidays = monthHolidays.filter(h => h.date.getDate() === day);
    const traditions = weeklyTraditions.filter(t => t.dayOfWeek === date.getDay() && t.isActive);
    const meals = monthMeals.filter(m => m.date === dateStr);
    return { holidays, traditions, meals };
  };

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0.3)']}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.backText}>{'\u2039'} Back</Text>
        </Pressable>
        <View style={styles.titleContainer}>
          <GlassIconWrapper size={44} variant="gold">
            <PlanGlassIcon size={24} />
          </GlassIconWrapper>
          <View>
            <Text style={styles.title}>Smart Calendar</Text>
            <Text style={styles.subtitle}>Holidays & Family Traditions</Text>
          </View>
        </View>
      </View>

      {/* View Mode Toggle */}
      <View style={styles.toggleContainer}>
        <Pressable
          style={[styles.toggleButton, viewMode === 'upcoming' && styles.toggleActive]}
          onPress={() => setViewMode('upcoming')}
        >
          <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={viewMode === 'upcoming'
              ? [COLORS.gold.light, COLORS.gold.base]
              : ['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.3)']
            }
            style={StyleSheet.absoluteFill}
          />
          <Text style={[styles.toggleText, viewMode === 'upcoming' && styles.toggleTextActive]}>
            Upcoming
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleButton, viewMode === 'month' && styles.toggleActive]}
          onPress={() => setViewMode('month')}
        >
          <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={viewMode === 'month'
              ? [COLORS.gold.light, COLORS.gold.base]
              : ['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.3)']
            }
            style={StyleSheet.absoluteFill}
          />
          <Text style={[styles.toggleText, viewMode === 'month' && styles.toggleTextActive]}>
            Calendar
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Show paywall banner for free users */}
        {!hasFullAccess && (
          <PaywallBanner feature="smartCalendar" />
        )}

        {viewMode === 'upcoming' ? (
          <>
            {/* Today's Planned Meals */}
            {todayMeals.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{'\u{1F372}'} Today's Meals</Text>
                {todayMeals.map((meal) => (
                  <View key={meal.id} style={styles.eventCard}>
                    <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.3)']}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.eventCardBorder} />
                    <View style={styles.eventCardContent}>
                      <View style={[styles.mealTypeBadge, { backgroundColor: 'rgba(0, 150, 136, 0.15)' }]}>
                        <Text style={styles.mealTypeText}>
                          {meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1)}
                        </Text>
                      </View>
                      <View style={styles.eventInfo}>
                        <Text style={styles.eventName}>{meal.name}</Text>
                        {meal.prep_time && (
                          <Text style={styles.eventDate}>Prep: {meal.prep_time}</Text>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* This Week's Traditions */}
            {thisWeekTraditions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{'\u{1F389}'} This Week</Text>
                {thisWeekTraditions.map((tradition) => {
                  const today = new Date().getDay();
                  const daysUntil = (tradition.dayOfWeek - today + 7) % 7;
                  return (
                    <TraditionCard
                      key={tradition.id}
                      tradition={tradition}
                      daysUntil={daysUntil}
                      onPress={() => handleTraditionMode(tradition)}
                    />
                  );
                })}
              </View>
            )}

            {/* Upcoming Holidays */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{'\u{1F4C5}'} Upcoming Holidays</Text>
              {upcomingHolidays.length > 0 ? (
                upcomingHolidays.slice(0, 10).map((holiday) => (
                  <HolidayCard
                    key={`${holiday.id}-${holiday.date.toISOString()}`}
                    holiday={holiday}
                    onPress={() => handleHolidayMode(holiday)}
                  />
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>
                    No upcoming holidays in your preferences.
                  </Text>
                  <Pressable
                    style={styles.emptyButton}
                    onPress={() => router.push('/family')}
                  >
                    <Text style={styles.emptyButtonText}>
                      Update Family Preferences
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Mira's Suggestion Card */}
            {upcomingHolidays.length > 0 && upcomingHolidays[0].daysUntil <= 14 && (
              <MiraSuggestionCard
                holiday={upcomingHolidays[0]}
                familyName={familyProfile.familyName}
                onAccept={() => handleHolidayMode(upcomingHolidays[0])}
              />
            )}
          </>
        ) : (
          <>
            {/* Calendar Month View */}
            <View style={styles.calendarCard}>
              <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.55)', 'rgba(250, 252, 255, 0.4)']}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.calendarBorder} />

              {/* Month Navigation */}
              <View style={styles.monthNav}>
                <Pressable
                  onPress={() => setSelectedDate(new Date(
                    selectedDate.getFullYear(),
                    selectedDate.getMonth() - 1,
                    1
                  ))}
                >
                  <Text style={styles.monthNavButton}>{'\u2039'}</Text>
                </Pressable>
                <Text style={styles.monthTitle}>
                  {MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                </Text>
                <Pressable
                  onPress={() => setSelectedDate(new Date(
                    selectedDate.getFullYear(),
                    selectedDate.getMonth() + 1,
                    1
                  ))}
                >
                  <Text style={styles.monthNavButton}>{'\u203A'}</Text>
                </Pressable>
              </View>

              {/* Day Headers */}
              <View style={styles.dayHeaders}>
                {DAYS_OF_WEEK.map(day => (
                  <Text key={day} style={styles.dayHeader}>{day}</Text>
                ))}
              </View>

              {/* Calendar Grid */}
              <View style={styles.calendarGrid}>
                {calendarDays.map((day, index) => {
                  if (day === null) {
                    return <View key={`empty-${index}`} style={styles.calendarDay} />;
                  }
                  const events = getDayEvents(day);
                  const hasEvents = events.holidays.length > 0 || events.traditions.length > 0 || events.meals.length > 0;
                  const isToday = new Date().getDate() === day &&
                    new Date().getMonth() === selectedDate.getMonth() &&
                    new Date().getFullYear() === selectedDate.getFullYear();

                  return (
                    <Pressable
                      key={day}
                      style={[
                        styles.calendarDay,
                        isToday && styles.calendarDayToday,
                        hasEvents && styles.calendarDayHasEvents,
                      ]}
                      onPress={() => {
                        if (hasEvents) {
                          const eventNames = [
                            ...events.holidays.map(h => h.name),
                            ...events.traditions.map(t => t.name),
                            ...events.meals.map(m => `${m.meal_type}: ${m.name}`),
                          ];
                          Alert.alert(
                            `${MONTHS[selectedDate.getMonth()]} ${day}`,
                            eventNames.join('\n')
                          );
                        }
                      }}
                    >
                      <Text style={[
                        styles.calendarDayText,
                        isToday && styles.calendarDayTextToday,
                      ]}>
                        {day}
                      </Text>
                      {hasEvents && (
                        <View style={styles.eventDots}>
                          {events.holidays.length > 0 && (
                            <View style={[styles.eventDot, styles.eventDotHoliday]} />
                          )}
                          {events.traditions.length > 0 && (
                            <View style={[styles.eventDot, styles.eventDotTradition]} />
                          )}
                          {events.meals.length > 0 && (
                            <View style={[styles.eventDot, styles.eventDotMeal]} />
                          )}
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Legend */}
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, styles.eventDotHoliday]} />
                  <Text style={styles.legendText}>Holiday</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, styles.eventDotTradition]} />
                  <Text style={styles.legendText}>Tradition</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, styles.eventDotMeal]} />
                  <Text style={styles.legendText}>Meal</Text>
                </View>
              </View>
            </View>

            {/* Month's Holidays */}
            {monthHolidays.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {'\u{1F389}'} {MONTHS[selectedDate.getMonth()]} Events
                </Text>
                {monthHolidays.map((holiday) => (
                  <HolidayCard
                    key={`${holiday.id}-${holiday.date.toISOString()}`}
                    holiday={holiday}
                    onPress={() => handleHolidayMode(holiday)}
                    showDate
                  />
                ))}
              </View>
            )}
          </>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </ScreenWrapper>
  );
}

// Helper to check if icon is ImageSourcePropType
const isImageSource = (icon: ImageSourcePropType | string | undefined): icon is ImageSourcePropType => {
  return icon !== undefined && typeof icon !== 'string';
};

// Holiday Icon component - handles both emoji strings and Image sources
function HolidayIcon({ icon, size = 32 }: { icon: ImageSourcePropType | string | undefined; size?: number }) {
  if (!icon) return null;

  if (isImageSource(icon)) {
    return (
      <View style={[styles.iconContainer, { width: size + 8, height: size + 8 }]}>
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0.3)']}
          style={StyleSheet.absoluteFill}
        />
        <Image source={icon} style={{ width: size, height: size, resizeMode: 'contain' }} />
      </View>
    );
  }

  return <Text style={[styles.eventIcon, { fontSize: size }]}>{icon}</Text>;
}

// Holiday Card Component
interface HolidayCardProps {
  holiday: HolidayOccurrence;
  onPress: () => void;
  showDate?: boolean;
}

function HolidayCard({ holiday, onPress, showDate }: HolidayCardProps) {
  return (
    <Pressable style={styles.eventCard} onPress={onPress}>
      <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.3)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.eventCardBorder} />

      <View style={styles.eventCardContent}>
        <HolidayIcon icon={holiday.icon} size={32} />
        <View style={styles.eventInfo}>
          <Text style={styles.eventName}>{holiday.name}</Text>
          <Text style={styles.eventDate}>
            {showDate ? formatHolidayDate(holiday.date) : formatDaysUntil(holiday.daysUntil)}
          </Text>
        </View>
        {holiday.suggestedItems && holiday.suggestedItems.length > 0 && (
          <View style={styles.holidayModeButton}>
            <Text style={styles.holidayModeText}>Holiday Mode</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// Tradition Card Component
interface TraditionCardProps {
  tradition: WeeklyTradition;
  daysUntil: number;
  onPress: () => void;
}

function TraditionCard({ tradition, daysUntil, onPress }: TraditionCardProps) {
  const dayLabel = daysUntil === 0 ? 'Today!' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`;

  return (
    <Pressable style={styles.eventCard} onPress={onPress}>
      <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={daysUntil === 0
          ? [`${COLORS.gold.light}40`, `${COLORS.gold.base}20`]
          : ['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.3)']
        }
        style={StyleSheet.absoluteFill}
      />
      <View style={[
        styles.eventCardBorder,
        daysUntil === 0 && styles.eventCardBorderToday
      ]} />

      <View style={styles.eventCardContent}>
        <Text style={styles.eventIcon}>{tradition.icon}</Text>
        <View style={styles.eventInfo}>
          <Text style={styles.eventName}>{tradition.name}</Text>
          <Text style={[styles.eventDate, daysUntil === 0 && styles.eventDateToday]}>
            {dayLabel}
          </Text>
        </View>
        <View style={[styles.holidayModeButton, styles.traditionModeButton]}>
          <Text style={styles.holidayModeText}>Add Items</Text>
        </View>
      </View>
    </Pressable>
  );
}

// Mira Suggestion Card
interface MiraSuggestionCardProps {
  holiday: HolidayOccurrence;
  familyName?: string;
  onAccept: () => void;
}

function MiraSuggestionCard({ holiday, familyName, onAccept }: MiraSuggestionCardProps) {
  return (
    <View style={styles.miraCard}>
      <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={[`${COLORS.gold.light}35`, `${COLORS.gold.base}15`]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.miraBorder} />

      <View style={styles.miraContent}>
        <GlassIconWrapper size={50} variant="gold">
          <MomentGlassIcon size={28} />
        </GlassIconWrapper>
        <Text style={styles.miraTitle}>Mira's Suggestion</Text>
        <View style={styles.miraTextRow}>
          <HolidayIcon icon={holiday.icon} size={24} />
          <Text style={styles.miraText}>
            {holiday.name} is {formatDaysUntil(holiday.daysUntil).toLowerCase()}!
            {familyName ? ` Ready to help ${familyName} celebrate?` : ' Want me to help you prepare?'}
          </Text>
        </View>
        <Pressable style={styles.miraButton} onPress={onAccept}>
          <LinearGradient
            colors={[COLORS.gold.light, COLORS.gold.base]}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.miraButtonText}>
            Create Allergy-Safe List {'\u2192'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  backText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 4,
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
  toggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  toggleButton: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  toggleActive: {},
  toggleText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  toggleTextActive: {
    color: '#FFF',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  eventCard: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
    ...SHADOWS.glass,
  },
  eventCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  eventCardBorderToday: {
    borderColor: COLORS.gold.base,
    borderWidth: 1,
  },
  eventCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  eventIcon: {
    fontSize: 32,
  },
  iconContainer: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  eventDate: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  eventDateToday: {
    color: COLORS.gold.dark,
    fontWeight: '600',
  },
  holidayModeButton: {
    backgroundColor: `${COLORS.gold.base}25`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  traditionModeButton: {
    backgroundColor: `${COLORS.gold.light}35`,
  },
  holidayModeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.gold.dark,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: `${COLORS.gold.base}20`,
    borderRadius: BORDER_RADIUS.lg,
  },
  emptyButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gold.dark,
  },
  // Mira Card
  miraCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    ...SHADOWS.glass,
  },
  miraBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.gold.base,
  },
  miraContent: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  miraTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.gold.dark,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  miraTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  miraText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    lineHeight: 20,
  },
  miraButton: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm + 2,
  },
  miraButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: '#FFF',
  },
  // Calendar View
  calendarCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    ...SHADOWS.glass,
  },
  calendarBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  monthNavButton: {
    fontSize: 24,
    color: COLORS.gold.dark,
    paddingHorizontal: SPACING.md,
  },
  monthTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  dayHeaders: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  calendarDayToday: {
    backgroundColor: `${COLORS.gold.base}20`,
    borderRadius: BORDER_RADIUS.md,
  },
  calendarDayHasEvents: {},
  calendarDayText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.primary,
  },
  calendarDayTextToday: {
    fontWeight: '700',
    color: COLORS.gold.dark,
  },
  eventDots: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  eventDotHoliday: {
    backgroundColor: COLORS.gold.base,
  },
  eventDotTradition: {
    backgroundColor: '#4CAF50',
  },
  eventDotMeal: {
    backgroundColor: '#009688',
  },
  mealTypeBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  mealTypeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: '#00796B',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.lg,
    paddingTop: SPACING.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
  },
  bottomPadding: {
    height: 100,
  },
});
