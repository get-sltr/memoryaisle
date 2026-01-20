import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Image,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../../src/constants/theme';

// Mock recipes data
const RECIPES = [
  {
    id: '1',
    title: 'Honey Garlic Chicken',
    emoji: '\u{1F357}',
    time: '35 min',
    servings: 4,
    byMira: true,
  },
  {
    id: '2',
    title: 'Creamy Tuscan Pasta',
    emoji: '\u{1F35D}',
    time: '25 min',
    servings: 4,
    byMira: true,
  },
  {
    id: '3',
    title: 'Mediterranean Salad',
    emoji: '\u{1F957}',
    time: '15 min',
    servings: 2,
    byMira: true,
  },
  {
    id: '4',
    title: 'Avocado Toast',
    emoji: '\u{1F951}',
    time: '10 min',
    servings: 2,
    byMira: false,
  },
];

export default function RecipesScreen() {
  const handleOpenMira = () => {
    // TODO: Open Mira chat for recipe suggestions
    console.log('Opening Mira for recipes');
  };

  const handleAddToList = (id: string) => {
    // TODO: Add recipe ingredients to list
    console.log('Adding recipe to list:', id);
  };

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
      >
        {/* Section Label */}
        <Text style={styles.sectionLabel}>Recent from Mira</Text>

        {/* Recipes List */}
        {RECIPES.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onAddToList={() => handleAddToList(recipe.id)}
          />
        ))}
      </ScrollView>
    </ScreenWrapper>
  );
}

interface RecipeCardProps {
  recipe: typeof RECIPES[0];
  onAddToList: () => void;
}

function RecipeCard({ recipe, onAddToList }: RecipeCardProps) {
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
        <Text style={styles.recipeEmoji}>{recipe.emoji}</Text>
      </LinearGradient>

      {/* Recipe Content */}
      <View style={styles.cardContent}>
        <Text style={styles.recipeTitle}>{recipe.title}</Text>

        {/* Meta info */}
        <View style={styles.recipeMeta}>
          <Text style={styles.metaText}>{'\u{23F1}'} {recipe.time}</Text>
          <Text style={styles.metaText}>{'\u{1F465}'} {recipe.servings} servings</Text>
          {recipe.byMira && (
            <Text style={styles.metaText}>{'\u2726'} By Mira</Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Pressable style={styles.secondaryButton}>
            <View style={styles.secondaryButtonBg} />
            <Text style={styles.secondaryButtonText}>View Recipe</Text>
          </Pressable>

          <Pressable style={styles.primaryButton} onPress={onAddToList}>
            <LinearGradient
              colors={[COLORS.gold.light, COLORS.gold.base]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryButtonGradient}
            />
            <View style={styles.primaryButtonBorder} />
            <Text style={styles.primaryButtonText}>Add to List</Text>
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
    paddingBottom: 120, // Extra padding for scroll
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
    overflow: 'hidden',
    ...SHADOWS.goldGlow,
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
});
