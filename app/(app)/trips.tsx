import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  Alert,
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
  calculateGasCost,
} from '../../src/services/tripPlanning';
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
  const { household } = useAuthStore();
  const [selectedType, setSelectedType] = useState<TripType | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<TripRecipe | null>(null);
  const [currentPlan, setCurrentPlan] = useState<TripPlan | null>(null);
  const [miraMessage, setMiraMessage] = useState<string | null>(null);

  // Planning form state
  const [tripName, setTripName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [travelers, setTravelers] = useState('4');

  // Filter state
  const [recipeComplexity, setRecipeComplexity] = useState<MealComplexity | null>(null);

  // Memoized trip types - prevents recalculation on every render
  const tripTypes = useMemo(() => Object.values(TRIP_TEMPLATES), []);

  useEffect(() => {
    // Show Mira's greeting
    setMiraMessage(getMiraTripResponse(''));
  }, []);

  const handleSelectTrip = useCallback((type: TripType) => {
    setSelectedType(type);
    setMiraMessage(getMiraTripResponse(type));
  }, []);

  const handleStartPlanning = useCallback(() => {
    if (!selectedType) return;
    const template = TRIP_TEMPLATES[selectedType];
    setTripName(`${template.name}`);
    setShowPlanModal(true);
  }, [selectedType]);

  const handleCreatePlan = useCallback(() => {
    if (!selectedType || !tripName.trim()) {
      Alert.alert('Missing Info', 'Please enter a trip name');
      return;
    }

    const start = startDate || new Date().toISOString().split('T')[0];
    const end = endDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const plan = createTripPlan(
      selectedType,
      tripName,
      start,
      end,
      parseInt(travelers) || 4
    );

    setCurrentPlan(plan);
    setShowPlanModal(false);
    setMiraMessage(`🎉 Your ${plan.name} is planned! I've created a checklist with ${plan.checklists.reduce((acc, cat) => acc + cat.items.length, 0)} items and ${plan.meals.length} meal suggestions.`);
  }, [selectedType, tripName, startDate, endDate, travelers]);

  const toggleChecklistItem = useCallback((categoryId: string, itemId: string) => {
    if (!currentPlan) return;

    setCurrentPlan(prev => {
      if (!prev) return prev;
      return {
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
    });
  }, [currentPlan]);

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
  }, [selectedRecipe, household?.id]);

  // Generate shopping list from trip plan checklist
  const handleGenerateShoppingList = useCallback(async () => {
    if (!currentPlan || !household?.id) {
      Alert.alert('Error', 'Could not generate list');
      return;
    }

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

        {/* Current Plan */}
        {currentPlan && (
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
                  </View>
                  <View style={styles.planBudget}>
                    <Text style={styles.planBudgetLabel}>Est. Budget</Text>
                    <Text style={styles.planBudgetValue}>
                      ${currentPlan.estimatedBudget?.total || 0}
                    </Text>
                  </View>
                </View>

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
              </View>
            </View>
          </View>
        )}

        {/* Trip Types */}
        {!currentPlan && (
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
                      placeholder={selectedType ? `${TRIP_TEMPLATES[selectedType].suggestedDuration.min}-${TRIP_TEMPLATES[selectedType].suggestedDuration.max}` : '3'}
                      placeholderTextColor={COLORS.text.secondary}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>

                <Pressable style={styles.createButton} onPress={handleCreatePlan}>
                  <LinearGradient
                    colors={[COLORS.gold.light, COLORS.gold.base]}
                    style={styles.createButtonGradient}
                  />
                  <Text style={styles.createButtonText}>Create Trip Plan</Text>
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

      {/* Recipe Detail Modal */}
      <Modal
        visible={showRecipeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRecipeModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowRecipeModal(false)}>
          <BlurView intensity={80} tint="dark" style={styles.modalBlur}>
            <Pressable style={[styles.modalCard, styles.recipeModalCard]} onPress={e => e.stopPropagation()}>
              <BlurView intensity={60} tint="light" style={styles.modalCardBlur} />
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.3)']}
                style={styles.modalCardGradient}
              />
              <View style={styles.modalCardBorder} />

              {/* X close button */}
              <Pressable
                style={styles.recipeCloseX}
                onPress={() => setShowRecipeModal(false)}
              >
                <Text style={styles.recipeCloseXText}>✕</Text>
              </Pressable>

              {selectedRecipe && (
                <>
                  <ScrollView
                    style={styles.recipeModalContent}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    showsVerticalScrollIndicator={true}
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

                  {/* Add Ingredients button - fixed at bottom, outside ScrollView */}
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
                </>
              )}
            </Pressable>
          </BlurView>
        </Pressable>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
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
  planBudget: {
    alignItems: 'flex-end',
  },
  planBudgetLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
  },
  planBudgetValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.gold.dark,
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

  // Recipe Modal
  recipeCloseX: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeCloseXText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  recipeModalContent: {
    padding: SPACING.lg,
    flex: 1,
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