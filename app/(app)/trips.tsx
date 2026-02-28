import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../../src/constants/theme';
import {
  TRIP_TEMPLATES,
  TRIP_RECIPES,
  createTripPlan,
  getRecipesForTrip,
  getMiraTripResponse,
} from '../../src/services/tripPlanning';
import {
  saveTripPlan,
  getActiveTripPlan,
  updateTripPlan,
  deleteTripPlan,
} from '../../src/services/tripPlanStorage';
import { useAuthStore } from '../../src/stores/authStore';
import { getActiveList, addItem } from '../../src/services/lists';
import type {
  TripType,
  TripPlan,
  TripChecklistCategory,
  TripRecipe,
  MealComplexity,
} from '../../src/types';

export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const { user, household } = useAuthStore();
  const [selectedType, setSelectedType] = useState<TripType | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<TripRecipe | null>(null);
  const [currentPlan, setCurrentPlan] = useState<TripPlan | null>(null);
  const [miraMessage, setMiraMessage] = useState<string | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(true);

  // Planning form state
  const [tripName, setTripName] = useState('');
  const [travelers, setTravelers] = useState('4');
  const [days, setDays] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isEditing, setIsEditing] = useState(false);

  // Filter state
  const [recipeComplexity, setRecipeComplexity] = useState<MealComplexity | null>(null);

  // Ref for debouncing checklist persist
  const checklistSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formatDate = useCallback((dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, []);

  // Memoized trip types - prevents recalculation on every render
  const tripTypes = useMemo(() => Object.values(TRIP_TEMPLATES), []);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (checklistSaveTimer.current) clearTimeout(checklistSaveTimer.current);
    };
  }, []);

  // Load active trip plan from Supabase on mount
  useEffect(() => {
    setMiraMessage(getMiraTripResponse(''));

    if (!household?.id) {
      setIsLoadingPlan(false);
      return;
    }

    getActiveTripPlan(household.id)
      .then((plan) => {
        if (plan) {
          setCurrentPlan(plan);
          setSelectedType(plan.type);
          setMiraMessage(`Welcome back! Your "${plan.name}" trip plan is loaded.`);
        }
      })
      .catch(() => {
        // Silently fail — user can still create a new plan
      })
      .finally(() => setIsLoadingPlan(false));
  }, [household?.id]);

  const handleSelectTrip = useCallback((type: TripType) => {
    setSelectedType(type);
    setMiraMessage(getMiraTripResponse(type));
  }, []);

  const handleStartPlanning = useCallback(() => {
    if (!selectedType) return;
    const template = TRIP_TEMPLATES[selectedType];
    setTripName(`${template.name}`);
    setStartDate(new Date().toISOString().split('T')[0]);
    setShowPlanModal(true);
  }, [selectedType]);

  const handleCreatePlan = useCallback(async () => {
    if (!selectedType || !tripName.trim()) {
      Alert.alert('Missing Info', 'Please enter a trip name');
      return;
    }

    const rawDays = parseInt(days);
    const numDays = Math.min(Math.max(rawDays > 0 ? rawDays : TRIP_TEMPLATES[selectedType].suggestedDuration.min, 1), 365);
    const numTravelers = Math.min(Math.max(parseInt(travelers) || 4, 1), 50);
    const start = startDate;
    const startDateObj = new Date(startDate + 'T12:00:00');
    const endDate = new Date(startDateObj.getTime() + (numDays - 1) * 24 * 60 * 60 * 1000);
    const end = endDate.toISOString().split('T')[0];

    const plan = createTripPlan(
      selectedType,
      tripName,
      start,
      end,
      numTravelers
    );

    // Set local state immediately
    setCurrentPlan(plan);
    setShowPlanModal(false);
    setIsEditing(false);
    setMiraMessage(`🎉 Your ${plan.name} is planned! I've created a checklist with ${plan.checklists.reduce((acc, cat) => acc + cat.items.length, 0)} items and ${plan.meals.length} meal suggestions.`);

    // Persist to Supabase — update local ID from server but don't overwrite full plan
    // (user may toggle checklists between optimistic set and server response)
    if (household?.id) {
      try {
        if (isEditing && currentPlan?.id) {
          const saved = await updateTripPlan(currentPlan.id, plan);
          // Only take the server-assigned ID, don't overwrite local state
          setCurrentPlan(prev => prev ? { ...prev, id: saved.id, updatedAt: saved.updatedAt } : saved);
        } else {
          const saved = await saveTripPlan(household.id, plan, user?.id);
          setCurrentPlan(prev => prev ? { ...prev, id: saved.id, createdAt: saved.createdAt, updatedAt: saved.updatedAt } : saved);
        }
      } catch {
        // Keep local state so user doesn't lose work
        Alert.alert('Sync Error', 'Trip saved locally but could not sync to cloud. It will retry next time.');
      }
    }
  }, [selectedType, tripName, days, travelers, startDate, household?.id, user?.id, isEditing, currentPlan?.id]);

  const toggleChecklistItem = useCallback((categoryId: string, itemId: string) => {
    if (!currentPlan) return;

    setCurrentPlan(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        checklists: prev.checklists.map(cat => {
          if (cat.id !== categoryId) return cat;
          return {
            ...cat,
            items: cat.items.map(item => {
              if (item.id !== itemId) return item;
              return { ...item, isPacked: !item.isPacked };
            }),
          };
        }),
      };

      // Debounced persist to Supabase (fire-and-forget, don't block UI)
      if (checklistSaveTimer.current) clearTimeout(checklistSaveTimer.current);
      checklistSaveTimer.current = setTimeout(() => {
        if (prev.id) {
          updateTripPlan(prev.id, { checklists: updated.checklists }).catch(() => {});
        }
      }, 500);

      return updated;
    });
  }, [currentPlan]);

  const handleEditTrip = useCallback(() => {
    if (!currentPlan) return;
    setTripName(currentPlan.name);
    setTravelers(String(currentPlan.travelers));
    setDays(String(currentPlan.duration));
    setStartDate(currentPlan.startDate);
    setSelectedType(currentPlan.type);
    setIsEditing(true);
    setShowPlanModal(true);
  }, [currentPlan]);

  const handleCancelTrip = useCallback(() => {
    Alert.alert(
      'Cancel Trip',
      'Are you sure you want to cancel this trip? This cannot be undone.',
      [
        { text: 'Keep Trip', style: 'cancel' },
        {
          text: 'Cancel Trip',
          style: 'destructive',
          onPress: async () => {
            const planId = currentPlan?.id;
            setCurrentPlan(null);
            setSelectedType(null);
            setIsEditing(false);
            setMiraMessage(getMiraTripResponse(''));

            // Delete from Supabase
            if (planId) {
              deleteTripPlan(planId).catch(() => {});
            }
          },
        },
      ]
    );
  }, [currentPlan?.id]);

  // Memoized recipes - only recalculates when dependencies change
  const recipes = useMemo(() =>
    selectedType
      ? getRecipesForTrip(selectedType, recipeComplexity || undefined)
      : TRIP_RECIPES,
    [selectedType, recipeComplexity]
  );

  // Add recipe ingredients to shopping list
  const handleAddRecipeToList = useCallback(async () => {
    if (!selectedRecipe || !household?.id) {
      Alert.alert('Error', 'Could not add ingredients');
      return;
    }

    try {
      const list = await getActiveList(household.id);
      if (!list) {
        Alert.alert('Error', 'Could not find your shopping list');
        return;
      }

      // Fire all network requests simultaneously
      const promises = selectedRecipe.ingredients.map(ingredient => {
        const itemName = ingredient.amount
          ? `${ingredient.amount} ${ingredient.item}`
          : ingredient.item;
        return addItem(list.id, itemName);
      });

      const results = await Promise.allSettled(promises);
      const addedCount = results.filter(r => r.status === 'fulfilled' && r.value).length;

      Alert.alert(
        'Added to List!',
        `${addedCount} ingredients from "${selectedRecipe.name}" added to your shopping list.`
      );
      setShowRecipeModal(false);
    } catch {
      Alert.alert('Error', 'Could not add ingredients to your list. Please try again.');
    }
  }, [selectedRecipe, household?.id]);

  // Generate shopping list from trip plan checklist
  const handleGenerateShoppingList = useCallback(async () => {
    if (!currentPlan || !household?.id) {
      Alert.alert('Error', 'Could not generate list');
      return;
    }

    try {
      const list = await getActiveList(household.id);
      if (!list) {
        Alert.alert('Error', 'Could not find your shopping list');
        return;
      }

      // Flatten all unchecked items from all categories into a single array
      const uncheckedItems = currentPlan.checklists.flatMap(category =>
        category.items.filter(item => !item.isPacked)
      );

      if (uncheckedItems.length === 0) {
        Alert.alert(
          'Nothing to Add',
          'All items are already checked off.'
        );
        return;
      }

      // Fire all network requests simultaneously
      const promises = uncheckedItems.map(item => addItem(list.id, item.name));

      const results = await Promise.allSettled(promises);
      const addedCount = results.filter(r => r.status === 'fulfilled' && r.value).length;

      Alert.alert(
        'Added to Shopping List!',
        `${addedCount} trip items added to your shopping list.`
      );
    } catch {
      Alert.alert('Error', 'Could not add items to your list. Please try again.');
    }
  }, [currentPlan, household?.id]);

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Trip Planner</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Mira Message */}
        {miraMessage && (
          <View style={styles.miraCard}>
            <BlurView intensity={40} tint="light" style={styles.miraCardBlur} pointerEvents="none" />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.5)', 'rgba(250, 252, 255, 0.35)']}
              style={styles.miraCardGradient}
              pointerEvents="none"
            />
            <View style={styles.miraCardBorder} pointerEvents="none" />
            <View style={styles.miraCardContent}>
              <View style={styles.miraAvatar}>
                <LinearGradient
                  colors={[COLORS.gold.light, COLORS.gold.base]}
                  style={styles.miraAvatarGradient}
                />
                <Text style={styles.miraAvatarText}>M</Text>
              </View>
              <View style={styles.miraTextContainer}>
                <Text style={styles.miraLabel}>Mira</Text>
                <Text style={styles.miraText}>{miraMessage}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Loading State */}
        {isLoadingPlan && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.gold.base} />
            <Text style={styles.loadingText}>Loading your trip...</Text>
          </View>
        )}

        {/* Current Plan */}
        {!isLoadingPlan && currentPlan && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📋 Your Trip Plan</Text>
            <View style={styles.planCard}>
              <BlurView intensity={35} tint="light" style={styles.planCardBlur} pointerEvents="none" />
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.4)', 'rgba(250, 252, 255, 0.25)']}
                style={styles.planCardGradient}
                pointerEvents="none"
              />
              <View style={styles.planCardBorder} pointerEvents="none" />
              <View style={styles.planCardContent}>
                <View style={styles.planHeader}>
                  <Text style={styles.planIcon}>{TRIP_TEMPLATES[currentPlan.type].icon}</Text>
                  <View style={styles.planInfo}>
                    <Text style={styles.planName}>{currentPlan.name}</Text>
                    <Text style={styles.planMeta}>
                      {currentPlan.duration} days • {currentPlan.travelers} travelers
                    </Text>
                    <Text style={styles.planDates}>
                      {formatDate(currentPlan.startDate)} – {formatDate(currentPlan.endDate)}
                    </Text>
                  </View>
                </View>

                {/* Budget Breakdown */}
                {currentPlan.estimatedBudget && (
                  <View style={styles.budgetBreakdown}>
                    <View style={styles.budgetTotalRow}>
                      <Text style={styles.budgetTotalLabel}>Est. Budget</Text>
                      <Text style={styles.budgetTotalValue}>
                        ${currentPlan.estimatedBudget.total.toLocaleString()}
                      </Text>
                    </View>
                    {currentPlan.estimatedBudget.hotelPerNight > 0 && (
                      <Text style={styles.budgetLine}>
                        Hotel: ${currentPlan.estimatedBudget.hotelPerNight}/night × {currentPlan.duration > 1 ? currentPlan.duration - 1 : 0} nights = ${currentPlan.estimatedBudget.accommodation.toLocaleString()}
                      </Text>
                    )}
                    {currentPlan.estimatedBudget.flights > 0 && (
                      <Text style={styles.budgetLine}>
                        Flights: ${Math.round(currentPlan.estimatedBudget.flights / currentPlan.travelers)}/person × {currentPlan.travelers} = ${currentPlan.estimatedBudget.flights.toLocaleString()}
                      </Text>
                    )}
                    <Text style={styles.budgetLine}>
                      Food: ${currentPlan.estimatedBudget.food.toLocaleString()}  |  Activities: ${currentPlan.estimatedBudget.activities.toLocaleString()}
                    </Text>
                    {currentPlan.estimatedBudget.gas > 0 && (
                      <Text style={styles.budgetLine}>
                        Gas: ${currentPlan.estimatedBudget.gas.toLocaleString()}
                      </Text>
                    )}
                  </View>
                )}

                {/* Checklists */}
                {currentPlan.checklists.map(category => (
                  <View key={category.id} style={styles.checklistCategory}>
                    <View style={styles.checklistHeader}>
                      <Text style={styles.checklistIcon}>{category.icon}</Text>
                      <Text style={styles.checklistName}>{category.name}</Text>
                      <Text style={styles.checklistCount}>
                        {category.items.filter(i => i.isPacked).length}/{category.items.length}
                      </Text>
                    </View>
                    <View style={styles.checklistItems}>
                      {category.items.slice(0, 5).map(item => (
                        <Pressable
                          key={item.id}
                          style={styles.checklistItem}
                          onPress={() => toggleChecklistItem(category.id, item.id)}
                        >
                          <View style={[
                            styles.checkbox,
                            item.isPacked && styles.checkboxChecked,
                          ]}>
                            {item.isPacked && <Text style={styles.checkmark}>✓</Text>}
                          </View>
                          <Text style={[
                            styles.checklistItemText,
                            item.isPacked && styles.checklistItemTextChecked,
                          ]}>
                            {item.name}
                          </Text>
                          {item.isEssential && (
                            <Text style={styles.essentialBadge}>!</Text>
                          )}
                        </Pressable>
                      ))}
                      {category.items.length > 5 && (
                        <Text style={styles.moreItems}>
                          +{category.items.length - 5} more items
                        </Text>
                      )}
                    </View>
                  </View>
                ))}

                {/* Generate Shopping List Button */}
                <Pressable style={styles.generateButton} onPress={handleGenerateShoppingList}>
                  <LinearGradient
                    colors={[COLORS.gold.light, COLORS.gold.base]}
                    style={styles.generateButtonGradient}
                  />
                  <Text style={styles.generateButtonText}>
                    🛒 Add Trip Items to Shopping List
                  </Text>
                </Pressable>

                {/* Trip Management Buttons */}
                <View style={styles.managementRow}>
                  <Pressable style={styles.editTripButton} onPress={handleEditTrip}>
                    <Text style={styles.editTripButtonText}>Edit Trip</Text>
                  </Pressable>
                  <Pressable style={styles.cancelTripButton} onPress={handleCancelTrip}>
                    <Text style={styles.cancelTripButtonText}>Cancel Trip</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Trip Types */}
        {!isLoadingPlan && !currentPlan && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✨ Choose Your Adventure</Text>
            <View style={styles.tripTypesGrid}>
              {tripTypes.map(trip => (
                <Pressable
                  key={trip.type}
                  style={[
                    styles.tripTypeCard,
                    selectedType === trip.type && styles.tripTypeCardSelected,
                  ]}
                  onPress={() => handleSelectTrip(trip.type)}
                >
                  <BlurView intensity={30} tint="light" style={styles.tripTypeBlur} />
                  <LinearGradient
                    colors={selectedType === trip.type
                      ? ['rgba(212, 165, 71, 0.2)', 'rgba(212, 165, 71, 0.1)']
                      : ['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0.2)']
                    }
                    style={styles.tripTypeGradient}
                  />
                  <View style={[
                    styles.tripTypeBorder,
                    selectedType === trip.type && styles.tripTypeBorderSelected,
                  ]} />
                  <View style={styles.tripTypeContent}>
                    <Text style={styles.tripTypeIcon}>{trip.icon}</Text>
                    <Text style={styles.tripTypeName}>{trip.name}</Text>
                    <Text style={styles.tripTypeDuration}>
                      {trip.suggestedDuration.min}-{trip.suggestedDuration.max} days
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>

            {selectedType && (
              <Pressable style={styles.startButton} onPress={handleStartPlanning}>
                <LinearGradient
                  colors={[COLORS.gold.light, COLORS.gold.base, COLORS.gold.dark]}
                  style={styles.startButtonGradient}
                />
                <Text style={styles.startButtonText}>
                  Start Planning {TRIP_TEMPLATES[selectedType].icon}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Trip Recipes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🍳 Trip Recipes</Text>

          {/* Complexity Filter */}
          <View style={styles.filterRow}>
            {(['quick_easy', 'moderate', 'gourmet'] as MealComplexity[]).map(level => (
              <Pressable
                key={level}
                style={[
                  styles.filterChip,
                  recipeComplexity === level && styles.filterChipSelected,
                ]}
                onPress={() => setRecipeComplexity(recipeComplexity === level ? null : level)}
              >
                <Text style={[
                  styles.filterChipText,
                  recipeComplexity === level && styles.filterChipTextSelected,
                ]}>
                  {level === 'quick_easy' ? '⚡ Quick' : level === 'moderate' ? '👨‍🍳 Moderate' : '⭐ Gourmet'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Recipe Cards */}
          {recipes.length === 0 && (
            <View style={styles.noRecipes}>
              <Text style={styles.noRecipesText}>
                No recipes found for this combination.
              </Text>
              <Text style={styles.noRecipesHint}>
                Try a different trip type or complexity level.
              </Text>
            </View>
          )}
          {recipes.slice(0, 8).map(recipe => (
            <Pressable
              key={recipe.id}
              style={styles.recipeCard}
              onPress={() => {
                setSelectedRecipe(recipe);
                setShowRecipeModal(true);
              }}
            >
              <BlurView intensity={25} tint="light" style={styles.recipeCardBlur} pointerEvents="none" />
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0.2)']}
                style={styles.recipeCardGradient}
                pointerEvents="none"
              />
              <View style={styles.recipeCardBorder} pointerEvents="none" />
              <View style={styles.recipeCardContent}>
                <Text style={styles.recipeIcon}>{recipe.icon}</Text>
                <View style={styles.recipeInfo}>
                  <Text style={styles.recipeName}>{recipe.name}</Text>
                  <Text style={styles.recipeDescription} numberOfLines={1}>
                    {recipe.description}
                  </Text>
                  <View style={styles.recipeMeta}>
                    <Text style={styles.recipeTime}>⏱️ {recipe.totalTime}</Text>
                    <Text style={styles.recipeServings}>👥 {recipe.servings}</Text>
                    <View style={[
                      styles.complexityBadge,
                      recipe.complexity === 'quick_easy' && styles.complexityEasy,
                      recipe.complexity === 'moderate' && styles.complexityModerate,
                      recipe.complexity === 'gourmet' && styles.complexityGourmet,
                    ]}>
                      <Text style={styles.complexityText}>
                        {recipe.complexity === 'quick_easy' ? 'Easy' : recipe.complexity === 'moderate' ? 'Moderate' : 'Gourmet'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Plan Trip Modal */}
      <Modal
        visible={showPlanModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPlanModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowPlanModal(false)}>
          <BlurView intensity={80} tint="dark" style={styles.modalBlur}>
            <Pressable style={styles.modalCard} onPress={e => e.stopPropagation()}>
              <BlurView intensity={60} tint="light" style={styles.modalCardBlur} />
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.3)']}
                style={styles.modalCardGradient}
              />
              <View style={styles.modalCardBorder} />

              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>
                  {selectedType && TRIP_TEMPLATES[selectedType].icon} Plan Your Trip
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Trip Name</Text>
                  <TextInput
                    style={styles.input}
                    value={tripName}
                    onChangeText={setTripName}
                    placeholder="e.g., Summer Camping 2024"
                    placeholderTextColor={COLORS.text.secondary}
                  />
                </View>

                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Travelers</Text>
                    <TextInput
                      style={styles.input}
                      value={travelers}
                      onChangeText={setTravelers}
                      keyboardType="number-pad"
                      placeholder="4"
                      placeholderTextColor={COLORS.text.secondary}
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1, marginLeft: SPACING.sm }]}>
                    <Text style={styles.inputLabel}>Days</Text>
                    <TextInput
                      style={styles.input}
                      value={days}
                      onChangeText={setDays}
                      placeholder={selectedType ? `${TRIP_TEMPLATES[selectedType].suggestedDuration.min}-${TRIP_TEMPLATES[selectedType].suggestedDuration.max}` : '3'}
                      placeholderTextColor={COLORS.text.secondary}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>

                <View style={styles.startDateDisplay}>
                  <Text style={styles.startDateLabel}>Start Date</Text>
                  <View style={styles.datePickerRow}>
                    <Pressable
                      style={styles.dateArrow}
                      onPress={() => {
                        const d = new Date(startDate + 'T12:00:00');
                        d.setDate(d.getDate() - 1);
                        setStartDate(d.toISOString().split('T')[0]);
                      }}
                    >
                      <Text style={styles.dateArrowText}>←</Text>
                    </Pressable>
                    <Text style={styles.startDateValue}>
                      {formatDate(startDate)}
                    </Text>
                    <Pressable
                      style={styles.dateArrow}
                      onPress={() => {
                        const d = new Date(startDate + 'T12:00:00');
                        d.setDate(d.getDate() + 1);
                        setStartDate(d.toISOString().split('T')[0]);
                      }}
                    >
                      <Text style={styles.dateArrowText}>→</Text>
                    </Pressable>
                  </View>
                </View>

                <Pressable style={styles.createButton} onPress={handleCreatePlan}>
                  <LinearGradient
                    colors={[COLORS.gold.light, COLORS.gold.base]}
                    style={styles.createButtonGradient}
                  />
                  <Text style={styles.createButtonText}>
                    {isEditing ? 'Update Trip Plan' : 'Create Trip Plan'}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.cancelButton}
                  onPress={() => setShowPlanModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </Pressable>
          </BlurView>
        </Pressable>
      </Modal>

      {/* Recipe Detail Modal — Full Screen */}
      <Modal
        visible={showRecipeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRecipeModal(false)}
      >
        <View style={styles.recipeFullScreen}>
          <LinearGradient
            colors={['#FDF5E6', '#F8F0E0']}
            style={StyleSheet.absoluteFill}
          />

          {/* Header bar */}
          <View style={[styles.recipeFullHeader, { paddingTop: insets.top + SPACING.sm }]}>
            <Pressable onPress={() => setShowRecipeModal(false)} style={styles.recipeBackButton}>
              <Text style={styles.recipeBackText}>← Back</Text>
            </Pressable>
            <Text style={styles.recipeFullHeaderTitle}>Recipe</Text>
            <View style={{ width: 60 }} />
          </View>

          {selectedRecipe && (
            <>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.recipeFullContent}
                showsVerticalScrollIndicator={false}
                bounces={true}
              >
                <Text style={styles.recipeModalIcon}>{selectedRecipe.icon}</Text>
                <Text style={styles.recipeModalTitle}>{selectedRecipe.name}</Text>
                <Text style={styles.recipeModalDescription}>{selectedRecipe.description}</Text>

                <View style={styles.recipeModalMeta}>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaValue}>{selectedRecipe.prepTime}</Text>
                    <Text style={styles.metaLabel}>Prep</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaValue}>{selectedRecipe.cookTime}</Text>
                    <Text style={styles.metaLabel}>Cook</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaValue}>{selectedRecipe.servings}</Text>
                    <Text style={styles.metaLabel}>Servings</Text>
                  </View>
                </View>

                <Text style={styles.recipeModalSection}>🥘 Ingredients</Text>
                {selectedRecipe.ingredients.map((ing, i) => (
                  <View key={i} style={styles.ingredientRow}>
                    <Text style={styles.ingredientAmount}>{ing.amount}</Text>
                    <Text style={styles.ingredientItem}>{ing.item}</Text>
                  </View>
                ))}

                <Text style={styles.recipeModalSection}>📝 Instructions</Text>
                {selectedRecipe.instructions.map((step, i) => (
                  <View key={i} style={styles.instructionRow}>
                    <Text style={styles.instructionNumber}>{i + 1}</Text>
                    <Text style={styles.instructionText}>{step}</Text>
                  </View>
                ))}

                {selectedRecipe.equipment && selectedRecipe.equipment.length > 0 && (
                  <>
                    <Text style={styles.recipeModalSection}>🔧 Equipment Needed</Text>
                    <Text style={styles.equipmentText}>
                      {selectedRecipe.equipment.join(' • ')}
                    </Text>
                  </>
                )}

                {selectedRecipe.tips && selectedRecipe.tips.length > 0 && (
                  <>
                    <Text style={styles.recipeModalSection}>💡 Tips</Text>
                    {selectedRecipe.tips.map((tip, i) => (
                      <Text key={i} style={styles.tipText}>• {tip}</Text>
                    ))}
                  </>
                )}
              </ScrollView>

              {/* Add Ingredients button — fixed at bottom */}
              <View style={[styles.recipeFullFooter, { paddingBottom: insets.bottom + SPACING.md }]}>
                <Pressable style={styles.addToListButtonFixed} onPress={handleAddRecipeToList}>
                  <LinearGradient
                    colors={[COLORS.gold.light, COLORS.gold.base]}
                    style={styles.addToListButtonGradient}
                  >
                    <Text style={styles.addToListButtonText}>
                      📋 Add Ingredients to List
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  loadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  backButton: {
    padding: SPACING.sm,
  },
  backText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gold.base,
    fontWeight: '600',
  },
  title: {
    fontFamily: 'Georgia',
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  content: {
    paddingHorizontal: SPACING.lg,
  },

  // Mira Card
  miraCard: {
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
    ...SHADOWS.glass,
  },
  miraCardBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  miraCardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  miraCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(212, 165, 71, 0.3)',
  },
  miraCardContent: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  miraAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  miraAvatarGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  miraAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.white,
  },
  miraTextContainer: {
    flex: 1,
  },
  miraLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.gold.dark,
    marginBottom: 4,
  },
  miraText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.primary,
    lineHeight: 20,
  },

  // Section
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },

  // Trip Types Grid
  tripTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  tripTypeCard: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  tripTypeCardSelected: {
    transform: [{ scale: 1.02 }],
  },
  tripTypeBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  tripTypeGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  tripTypeBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  tripTypeBorderSelected: {
    borderWidth: 2,
    borderColor: COLORS.gold.base,
  },
  tripTypeContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.sm,
  },
  tripTypeIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  tripTypeName: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  tripTypeDuration: {
    fontSize: 10,
    color: COLORS.text.secondary,
    marginTop: 2,
  },

  // Start Button
  startButton: {
    marginTop: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.goldGlow,
  },
  startButtonGradient: {
    paddingVertical: SPACING.md + 4,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Plan Card
  planCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    ...SHADOWS.glass,
  },
  planCardBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  planCardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  planCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  planCardContent: {
    padding: SPACING.md,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(200, 205, 215, 0.3)',
  },
  planIcon: {
    fontSize: 40,
    marginRight: SPACING.md,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  planMeta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
  },
  planDates: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  budgetBreakdown: {
    backgroundColor: 'rgba(212, 165, 71, 0.08)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  budgetTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  budgetTotalLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  budgetTotalValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.gold.dark,
  },
  budgetLine: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    marginTop: 3,
  },
  managementRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  editTripButton: {
    flex: 1,
    paddingVertical: SPACING.sm + 4,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gold.base,
    alignItems: 'center',
  },
  editTripButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gold.dark,
  },
  cancelTripButton: {
    flex: 1,
    paddingVertical: SPACING.sm + 4,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(200, 205, 215, 0.5)',
    alignItems: 'center',
  },
  cancelTripButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
  startDateDisplay: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    marginBottom: SPACING.sm,
  },
  startDateLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212, 165, 71, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateArrowText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.gold.dark,
  },
  startDateValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },

  // Checklist
  checklistCategory: {
    marginBottom: SPACING.md,
  },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  checklistIcon: {
    fontSize: 18,
    marginRight: SPACING.sm,
  },
  checklistName: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  checklistCount: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  checklistItems: {
    paddingLeft: SPACING.lg + SPACING.sm,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(200, 205, 215, 0.5)',
    marginRight: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.gold.base,
    borderColor: COLORS.gold.base,
  },
  checkmark: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  checklistItemText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.primary,
  },
  checklistItemTextChecked: {
    textDecorationLine: 'line-through',
    color: COLORS.text.secondary,
  },
  essentialBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.error,
    marginLeft: 4,
  },
  moreItems: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    fontStyle: 'italic',
    marginTop: 4,
  },

  // Generate Button
  generateButton: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginTop: SPACING.md,
  },
  generateButtonGradient: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  generateButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
  },

  // Filter Row
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  filterChipSelected: {
    backgroundColor: 'rgba(212, 165, 71, 0.2)',
    borderColor: COLORS.gold.base,
  },
  filterChipText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
  },
  filterChipTextSelected: {
    color: COLORS.gold.dark,
    fontWeight: '600',
  },

  // Recipe Card
  recipeCard: {
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  recipeCardBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  recipeCardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  recipeCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  recipeCardContent: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  recipeIcon: {
    fontSize: 36,
  },
  recipeInfo: {
    flex: 1,
  },
  recipeName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  recipeDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  recipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  recipeTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
  },
  recipeServings: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
  },
  complexityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  complexityEasy: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  complexityModerate: {
    backgroundColor: 'rgba(255, 183, 77, 0.2)',
  },
  complexityGourmet: {
    backgroundColor: 'rgba(212, 165, 71, 0.2)',
  },
  complexityText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text.primary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBlur: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '90%',
    maxWidth: 400,
    borderRadius: BORDER_RADIUS.xxl,
    overflow: 'hidden',
    ...SHADOWS.glassElevated,
  },
  recipeModalCard: {
    maxHeight: '90%',
    flexDirection: 'column',
  },
  modalCardBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  modalContent: {
    padding: SPACING.xl,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputRow: {
    flexDirection: 'row',
  },
  inputLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  createButton: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginTop: SPACING.md,
  },
  createButtonGradient: {
    paddingVertical: SPACING.md + 2,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.white,
  },
  cancelButton: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
  },

  // Recipe Full Screen
  recipeFullScreen: {
    flex: 1,
  },
  recipeFullHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  recipeBackButton: {
    padding: SPACING.sm,
  },
  recipeBackText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gold.base,
    fontWeight: '600',
  },
  recipeFullHeaderTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  recipeFullContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  recipeFullFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
    paddingTop: SPACING.md,
    backgroundColor: 'rgba(253, 245, 230, 0.95)',
  },
  recipeModalIcon: {
    fontSize: 60,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  recipeModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  recipeModalDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: SPACING.md,
  },
  recipeModalMeta: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.lg,
  },
  metaItem: {
    alignItems: 'center',
  },
  metaValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  metaLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
  },
  recipeModalSection: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  ingredientRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  ingredientAmount: {
    width: 80,
    fontSize: FONT_SIZES.sm,
    color: COLORS.gold.dark,
    fontWeight: '600',
  },
  ingredientItem: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.primary,
  },
  instructionRow: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.gold.light,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.white,
    marginRight: SPACING.sm,
  },
  instructionText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.primary,
    lineHeight: 20,
  },
  equipmentText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
  },
  tipText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginBottom: 4,
  },
  addToListButton: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginTop: SPACING.lg,
  },
  addToListButtonFixed: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  addToListButtonGradient: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  addToListButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
  },
  noRecipes: {
    padding: SPACING.xl,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
  },
  noRecipesText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
    textAlign: 'center',
    fontWeight: '500',
  },
  noRecipesHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
});