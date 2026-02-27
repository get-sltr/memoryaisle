import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { logger } from '../../src/utils/logger';
import { useAuthStore } from '../../src/stores/authStore';
import { getRecipes, addRecipeToList } from '../../src/services/recipes';
import type { Recipe } from '../../src/types';
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../../src/constants/theme';

// Default sample recipes shown to all users
const DEFAULT_RECIPES: Recipe[] = [
  {
    id: 'default-1',
    household_id: '',
    name: 'Honey Garlic Chicken',
    emoji: '🍗',
    description: 'Sweet and savory chicken thighs glazed with a delicious honey garlic sauce.',
    total_time: '35 min',
    servings: 4,
    ingredients: [
      { item: 'chicken thighs', amount: '2 lbs' },
      { item: 'honey', amount: '1/4 cup' },
      { item: 'garlic', amount: '4 cloves, minced' },
      { item: 'soy sauce', amount: '3 tbsp' },
      { item: 'olive oil', amount: '2 tbsp' },
    ],
    instructions: [
      'Season chicken thighs with salt and pepper.',
      'Heat olive oil in a large skillet over medium-high heat.',
      'Sear chicken until golden brown, about 4-5 minutes per side.',
      'Mix honey, garlic, and soy sauce in a small bowl.',
      'Pour sauce over chicken and simmer for 15 minutes until cooked through.',
      'Serve with rice and garnish with green onions.',
    ],
    source: 'mira',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'default-2',
    household_id: '',
    name: 'Creamy Tuscan Pasta',
    emoji: '🍝',
    description: 'Rich and creamy Italian pasta with sun-dried tomatoes and spinach.',
    total_time: '25 min',
    servings: 4,
    ingredients: [
      { item: 'penne pasta', amount: '1 lb' },
      { item: 'heavy cream', amount: '1 cup' },
      { item: 'sun-dried tomatoes', amount: '1/2 cup, chopped' },
      { item: 'fresh spinach', amount: '2 cups' },
      { item: 'parmesan cheese', amount: '1/2 cup, grated' },
      { item: 'garlic', amount: '3 cloves, minced' },
    ],
    instructions: [
      'Cook pasta according to package directions. Reserve 1/2 cup pasta water.',
      'In a large pan, sauté garlic in olive oil until fragrant.',
      'Add heavy cream and sun-dried tomatoes, simmer for 3 minutes.',
      'Toss in spinach and stir until wilted.',
      'Add cooked pasta and parmesan, toss to coat.',
      'Add pasta water if needed for consistency. Season and serve.',
    ],
    source: 'mira',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'default-3',
    household_id: '',
    name: 'Avocado Toast',
    emoji: '🥑',
    description: 'Simple, healthy, and delicious breakfast or snack.',
    total_time: '10 min',
    servings: 2,
    ingredients: [
      { item: 'sourdough bread', amount: '2 slices' },
      { item: 'ripe avocado', amount: '1 large' },
      { item: 'lemon juice', amount: '1 tsp' },
      { item: 'red pepper flakes', amount: 'pinch', optional: true },
      { item: 'everything bagel seasoning', amount: '1 tsp', optional: true },
    ],
    instructions: [
      'Toast bread until golden and crispy.',
      'Cut avocado in half, remove pit, and scoop into a bowl.',
      'Mash avocado with lemon juice, salt, and pepper.',
      'Spread mashed avocado generously on toast.',
      'Top with red pepper flakes or everything bagel seasoning.',
    ],
    source: 'manual',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export default function RecipesScreen() {
  const { household } = useAuthStore();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [addingToList, setAddingToList] = useState<string | null>(null);

  const loadRecipes = useCallback(async () => {
    if (!household?.id) {
      setRecipes(DEFAULT_RECIPES);
      setLoading(false);
      return;
    }

    try {
      const data = await getRecipes(household.id);
      // Show default recipes if user has none
      setRecipes(data.length > 0 ? data : DEFAULT_RECIPES);
    } catch (error) {
      logger.error('Error loading recipes:', error);
      // Show defaults on error too
      setRecipes(DEFAULT_RECIPES);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [household?.id]);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadRecipes();
  }, [loadRecipes]);

  const handleOpenMira = () => {
    router.push('/(app)');
  };

  const handleAddToList = useCallback(async (recipe: Recipe) => {
    if (!household?.id) return;

    setAddingToList(recipe.id);
    try {
      const result = await addRecipeToList(household.id, recipe);
      if (result.success) {
        Alert.alert(
          'Added to List!',
          `${result.addedCount} ingredient${result.addedCount !== 1 ? 's' : ''} from "${recipe.name}" added to your shopping list.`
        );
      } else {
        Alert.alert('Error', 'Could not add ingredients to list. Please try again.');
      }
    } catch (error) {
      logger.error('Error adding to list:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setAddingToList(null);
    }
  }, [household?.id]);

  const handleViewRecipe = useCallback((recipe: Recipe) => {
    setSelectedRecipe(recipe);
  }, []);

  const handleCloseRecipe = useCallback(() => {
    setSelectedRecipe(null);
  }, []);

  // Loading state
  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Image
              source={require('../../assets/theapp.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.title}>Recipes</Text>
              <Text style={styles.subtitle}>Your Collection</Text>
            </View>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.base} />
          <Text style={styles.loadingText}>Loading recipes...</Text>
        </View>
      </ScreenWrapper>
    );
  }

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
            <Text style={styles.title}>Recipes</Text>
            <Text style={styles.subtitle}>Your Collection</Text>
          </View>
        </View>
        <Pressable style={styles.miraButton} onPress={handleOpenMira}>
          <BlurView intensity={20} tint="light" style={styles.miraButtonBlur} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.7)', 'rgba(245, 245, 250, 0.5)']}
            style={styles.miraButtonGradient}
          />
          <View style={styles.miraButtonBorder} />
          <Text style={styles.miraButtonText}>{'\u2726'}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.gold.base}
          />
        }
      >
        {/* Empty State */}
        {recipes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>{'\u{1F373}'}</Text>
            <Text style={styles.emptyTitle}>No Recipes Yet</Text>
            <Text style={styles.emptySubtitle}>
              Ask Mira to suggest recipes or add your own favorites!
            </Text>
            <Pressable style={styles.emptyButton} onPress={handleOpenMira}>
              <LinearGradient
                colors={[COLORS.gold.light, COLORS.gold.base]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyButtonGradient}
              />
              <Text style={styles.emptyButtonText}>{'\u2726'} Ask Mira for Ideas</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Section Label */}
            <Text style={styles.sectionLabel}>Your Recipes</Text>

            {/* Recipes List */}
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onAddToList={() => handleAddToList(recipe)}
                onViewRecipe={() => handleViewRecipe(recipe)}
                isAddingToList={addingToList === recipe.id}
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* Recipe Detail Modal */}
      <Modal
        visible={selectedRecipe !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseRecipe}
      >
        {selectedRecipe && (
          <RecipeDetailView
            recipe={selectedRecipe}
            onClose={handleCloseRecipe}
            onAddToList={() => {
              handleAddToList(selectedRecipe);
              handleCloseRecipe();
            }}
          />
        )}
      </Modal>
    </ScreenWrapper>
  );
}

interface RecipeCardProps {
  recipe: Recipe;
  onAddToList: () => void;
  onViewRecipe: () => void;
  isAddingToList: boolean;
}

function RecipeCard({ recipe, onAddToList, onViewRecipe, isAddingToList }: RecipeCardProps) {
  return (
    <View style={styles.card}>
      <BlurView intensity={20} tint="light" style={styles.cardBlur} />
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.7)', 'rgba(245, 245, 250, 0.6)']}
        style={styles.cardGradient}
      />
      <View style={styles.cardBorder} />

      {/* Recipe Image Header */}
      <LinearGradient
        colors={[COLORS.gold.light, COLORS.gold.base]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.imageHeader}
      >
        <Text style={styles.recipeEmoji}>{recipe.emoji || '\u{1F37D}'}</Text>
      </LinearGradient>

      {/* Recipe Content */}
      <View style={styles.cardContent}>
        <Text style={styles.recipeTitle}>{recipe.name}</Text>

        {/* Meta info */}
        <View style={styles.recipeMeta}>
          {recipe.total_time && (
            <Text style={styles.metaText}>{'\u{23F1}'} {recipe.total_time}</Text>
          )}
          <Text style={styles.metaText}>{'\u{1F465}'} {recipe.servings} servings</Text>
          {recipe.source === 'mira' && (
            <Text style={styles.metaText}>{'\u2726'} By Mira</Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Pressable style={styles.secondaryButton} onPress={onViewRecipe}>
            <View style={styles.secondaryButtonBg} />
            <Text style={styles.secondaryButtonText}>View Recipe</Text>
          </Pressable>

          <Pressable
            style={[styles.primaryButton, isAddingToList && styles.primaryButtonDisabled]}
            onPress={onAddToList}
            disabled={isAddingToList}
          >
            <LinearGradient
              colors={[COLORS.gold.light, COLORS.gold.base]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryButtonGradient}
            />
            <View style={styles.primaryButtonBorder} />
            {isAddingToList ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.primaryButtonText}>Add to List</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

interface RecipeDetailViewProps {
  recipe: Recipe;
  onClose: () => void;
  onAddToList: () => void;
}

function RecipeDetailView({ recipe, onClose, onAddToList }: RecipeDetailViewProps) {
  return (
    <View style={styles.modalContainer}>
      {/* Modal Header */}
      <LinearGradient
        colors={[COLORS.gold.light, COLORS.gold.base]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.modalHeader}
      >
        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>{'\u2715'}</Text>
        </Pressable>
        <Text style={styles.modalEmoji}>{recipe.emoji || '\u{1F37D}'}</Text>
        <Text style={styles.modalTitle}>{recipe.name}</Text>
        <View style={styles.modalMeta}>
          {recipe.total_time && (
            <Text style={styles.modalMetaText}>{'\u{23F1}'} {recipe.total_time}</Text>
          )}
          <Text style={styles.modalMetaText}>{'\u{1F465}'} {recipe.servings} servings</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
        {/* Description */}
        {recipe.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.descriptionText}>{recipe.description}</Text>
          </View>
        )}

        {/* Ingredients */}
        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            {recipe.ingredients.map((ingredient, index) => (
              <View key={index} style={styles.ingredientRow}>
                <Text style={styles.bulletPoint}>{'\u2022'}</Text>
                <Text style={styles.ingredientText}>
                  {ingredient.amount ? `${ingredient.amount} ` : ''}{ingredient.item}
                  {ingredient.optional && <Text style={styles.optionalText}> (optional)</Text>}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Instructions */}
        {recipe.instructions && recipe.instructions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            {recipe.instructions.map((step, index) => (
              <View key={index} style={styles.instructionRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.instructionText}>{step}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Add to List Button */}
        <Pressable style={styles.modalAddButton} onPress={onAddToList}>
          <LinearGradient
            colors={[COLORS.gold.light, COLORS.gold.base]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalAddButtonGradient}
          />
          <Text style={styles.modalAddButtonText}>Add Ingredients to List</Text>
        </Pressable>

        <View style={styles.modalBottomSpacer} />
      </ScrollView>
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
  miraButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  miraButtonBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  miraButtonGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  miraButtonBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.frost.border,
  },
  miraButtonText: {
    fontSize: 20,
    color: COLORS.gold.base,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: SPACING.xl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  emptyButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
  },
  emptyButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
  },
  sectionLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.gold.base,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: SPACING.md,
    paddingLeft: 4,
  },
  card: {
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.glass,
  },
  cardBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  cardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.frost.border,
  },
  imageHeader: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
  },
  recipeEmoji: {
    fontSize: 48,
  },
  cardContent: {
    padding: SPACING.md,
  },
  recipeTitle: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.xl,
    color: COLORS.text.primary,
    marginBottom: 6,
  },
  recipeMeta: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  metaText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm + 2,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: SPACING.md - 4,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    overflow: 'hidden',
  },
  secondaryButtonBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.frost.border,
  },
  secondaryButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: SPACING.md - 4,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...SHADOWS.goldGlow,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.md,
  },
  primaryButtonBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 220, 180, 0.5)',
  },
  primaryButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.white,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background.start,
  },
  modalHeader: {
    paddingTop: 60,
    paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: '600',
  },
  modalEmoji: {
    fontSize: 64,
    marginBottom: SPACING.sm,
  },
  modalTitle: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.title,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  modalMeta: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  modalMetaText: {
    fontSize: FONT_SIZES.md,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  descriptionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    lineHeight: 24,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  bulletPoint: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gold.base,
    marginRight: SPACING.sm,
    marginTop: 2,
  },
  ingredientText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
    lineHeight: 22,
  },
  optionalText: {
    color: COLORS.text.secondary,
    fontStyle: 'italic',
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.gold.base,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  stepNumberText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.white,
  },
  instructionText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
    lineHeight: 24,
  },
  modalAddButton: {
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: SPACING.md,
  },
  modalAddButtonGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
  },
  modalAddButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
  },
  modalBottomSpacer: {
    height: 40,
  },
});
