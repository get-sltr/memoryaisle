import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { useAuthStore } from '../../src/stores/authStore';
import { useCookbookStore } from '../../src/stores/cookbookStore';
import { cookbookService, CUISINE_OPTIONS, DIETARY_TAG_OPTIONS, type CookbookRecipe } from '../../src/services/cookbook';
import { addItem, getActiveList } from '../../src/services/lists';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';

const CUISINE_EMOJIS: Record<string, string> = {
  American: '🍔', Italian: '🍝', Mexican: '🌮', Chinese: '🥡', Indian: '🍛',
  Japanese: '🍣', Thai: '🍜', Mediterranean: '🫒', French: '🥐', Korean: '🍱',
  'Middle Eastern': '🧆', African: '🍲', Caribbean: '🥥', Vietnamese: '🍲', Other: '🍽️',
};

export default function CookbookScreen() {
  const insets = useSafeAreaInsets();
  const { household, user } = useAuthStore();
  const {
    recipes, isLoading, hasMore, selectedCuisine, favoritesOnly, searchQuery, recipeCount,
    initialize, loadMore, setCuisine, setFavoritesOnly, setSearch, addRecipe, removeRecipe, updateRecipe,
  } = useCookbookStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<CookbookRecipe | null>(null);
  const [searchText, setSearchText] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Add recipe form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIngredients, setFormIngredients] = useState('');
  const [formInstructions, setFormInstructions] = useState('');
  const [formPrepTime, setFormPrepTime] = useState('');
  const [formCookTime, setFormCookTime] = useState('');
  const [formServings, setFormServings] = useState('');
  const [formCuisine, setFormCuisine] = useState('');
  const [formDietaryTags, setFormDietaryTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (household?.id) {
      initialize(household.id);
    }
  }, [household?.id]);

  const handleSearch = useCallback((text: string) => {
    setSearchText(text);
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => {
      if (household?.id) setSearch(household.id, text);
    }, 400);
    setSearchTimeout(timeout);
  }, [household?.id, searchTimeout]);

  const handleCuisineFilter = (cuisine: string | null) => {
    if (!household?.id) return;
    setCuisine(household.id, cuisine === selectedCuisine ? null : cuisine);
  };

  const handleToggleFavorites = () => {
    if (!household?.id) return;
    setFavoritesOnly(household.id, !favoritesOnly);
  };

  const handleToggleFavorite = async (recipe: CookbookRecipe) => {
    const newValue = !recipe.is_favorite;
    updateRecipe(recipe.id, { is_favorite: newValue });
    await cookbookService.toggleFavorite(recipe.id, newValue);
  };

  const handleDeleteRecipe = (recipe: CookbookRecipe) => {
    Alert.alert(
      'Delete Recipe',
      `Remove "${recipe.title}" from your cookbook?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            removeRecipe(recipe.id);
            await cookbookService.deleteRecipe(recipe.id);
            if (showDetailModal) setShowDetailModal(false);
          },
        },
      ]
    );
  };

  const handleCookAgain = async (recipe: CookbookRecipe) => {
    if (!household?.id) return;
    const list = await getActiveList(household.id);
    if (!list) {
      Alert.alert('No List', 'Create a shopping list first.');
      return;
    }
    for (const ingredient of recipe.ingredients) {
      await addItem(list.id, ingredient);
    }
    Alert.alert('Added!', `${recipe.ingredients.length} ingredients from "${recipe.title}" added to your shopping list.`);
  };

  const handleSaveRecipe = async () => {
    if (!household?.id || !formTitle.trim()) return;
    setIsSaving(true);

    const ingredients = formIngredients.split('\n').filter(l => l.trim());
    const instructions = formInstructions.split('\n').filter(l => l.trim());

    const result = await cookbookService.saveRecipe(household.id, {
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      ingredients,
      instructions,
      prep_time: formPrepTime.trim() || undefined,
      cook_time: formCookTime.trim() || undefined,
      servings: formServings ? parseInt(formServings) : undefined,
      cuisine: formCuisine || undefined,
      dietary_tags: formDietaryTags,
      photo_urls: [],
      source: 'manual',
    }, user?.id);

    if (result.success && result.recipe) {
      addRecipe(result.recipe);
      resetForm();
      setShowAddModal(false);
    } else {
      Alert.alert('Error', result.error || 'Failed to save recipe.');
    }
    setIsSaving(false);
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormIngredients('');
    setFormInstructions('');
    setFormPrepTime('');
    setFormCookTime('');
    setFormServings('');
    setFormCuisine('');
    setFormDietaryTags([]);
  };

  const openDetail = (recipe: CookbookRecipe) => {
    setSelectedRecipe(recipe);
    setShowDetailModal(true);
  };

  // Cuisine filter chips
  const availableCuisines = ['All', ...CUISINE_OPTIONS.slice(0, 10)];

  const renderRecipeCard = ({ item }: { item: CookbookRecipe }) => (
    <Pressable style={styles.recipeCard} onPress={() => openDetail(item)}>
      <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.75)', 'rgba(250, 248, 245, 0.6)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.recipeCardBorder} />

      {item.photo_urls.length > 0 && (
        <Image source={{ uri: item.photo_urls[0] }} style={styles.recipeImage} />
      )}

      <View style={styles.recipeCardContent}>
        <View style={styles.recipeCardHeader}>
          <View style={styles.recipeCardTitleRow}>
            <Text style={styles.recipeCardEmoji}>
              {CUISINE_EMOJIS[item.cuisine || ''] || '🍽️'}
            </Text>
            <Text style={styles.recipeCardTitle} numberOfLines={2}>{item.title}</Text>
          </View>
          <Pressable onPress={() => handleToggleFavorite(item)} hitSlop={8}>
            <Text style={styles.favoriteIcon}>{item.is_favorite ? '❤️' : '🤍'}</Text>
          </Pressable>
        </View>

        {item.description && (
          <Text style={styles.recipeCardDescription} numberOfLines={2}>{item.description}</Text>
        )}

        <View style={styles.recipeCardMeta}>
          {item.prep_time && (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>Prep: {item.prep_time}</Text>
            </View>
          )}
          {item.cook_time && (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>Cook: {item.cook_time}</Text>
            </View>
          )}
          {item.servings && (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>Serves {item.servings}</Text>
            </View>
          )}
          {item.source === 'mira' && (
            <View style={[styles.metaChip, styles.miraChip]}>
              <Text style={styles.miraChipText}>Mira</Text>
            </View>
          )}
        </View>

        {item.dietary_tags.length > 0 && (
          <View style={styles.tagRow}>
            {item.dietary_tags.slice(0, 3).map((tag) => (
              <View key={tag} style={styles.dietTag}>
                <Text style={styles.dietTagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );

  return (
    <ScreenWrapper>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.backButton}>‹ Back</Text>
          </Pressable>
          <Text style={styles.pageTitle}>Family Cookbook</Text>
          <Text style={styles.recipeCountText}>{recipeCount} recipes</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.8)', 'rgba(255, 255, 255, 0.6)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.searchBorder} />
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search recipes..."
            placeholderTextColor={COLORS.text.secondary}
            value={searchText}
            onChangeText={handleSearch}
          />
        </View>

        {/* Filter Row */}
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            <Pressable
              style={[styles.filterChip, favoritesOnly && styles.filterChipActive]}
              onPress={handleToggleFavorites}
            >
              <Text style={[styles.filterChipText, favoritesOnly && styles.filterChipTextActive]}>
                ❤️ Favorites
              </Text>
            </Pressable>
            {availableCuisines.map((cuisine) => {
              const isAll = cuisine === 'All';
              const isActive = isAll ? !selectedCuisine : selectedCuisine === cuisine;
              return (
                <Pressable
                  key={cuisine}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => handleCuisineFilter(isAll ? null : cuisine)}
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {isAll ? '🍽️ All' : `${CUISINE_EMOJIS[cuisine] || ''} ${cuisine}`}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Recipe List */}
        <FlatList
          data={recipes}
          renderItem={renderRecipeCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={() => hasMore && household?.id && loadMore(household.id)}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            isLoading ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator color={COLORS.gold.base} />
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>📖</Text>
                <Text style={styles.emptyTitle}>Your cookbook is empty</Text>
                <Text style={styles.emptySubtext}>
                  Save recipes from Mira or add your own family favorites
                </Text>
              </View>
            )
          }
        />

        {/* Add Recipe FAB */}
        <Pressable style={[styles.fab, { bottom: insets.bottom + 90 }]} onPress={() => setShowAddModal(true)}>
          <LinearGradient colors={[COLORS.gold.light, COLORS.gold.base]} style={StyleSheet.absoluteFill} />
          <Text style={styles.fabText}>+</Text>
        </Pressable>

        {/* Add Recipe Modal */}
        <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
          <KeyboardAvoidingView
            style={styles.modalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalContent}>
              <LinearGradient
                colors={[COLORS.background.start, COLORS.background.mid1, COLORS.background.end]}
                style={StyleSheet.absoluteFill}
              />

              <View style={[styles.modalHeader, { paddingTop: insets.top + SPACING.sm }]}>
                <Pressable onPress={() => setShowAddModal(false)}>
                  <Text style={styles.modalCancel}>Cancel</Text>
                </Pressable>
                <Text style={styles.modalTitle}>New Recipe</Text>
                <Pressable
                  onPress={handleSaveRecipe}
                  disabled={!formTitle.trim() || isSaving}
                >
                  <Text style={[styles.modalSave, !formTitle.trim() && styles.modalSaveDisabled]}>
                    {isSaving ? 'Saving...' : 'Save'}
                  </Text>
                </Pressable>
              </View>

              <ScrollView
                style={styles.formScroll}
                contentContainerStyle={[styles.formContent, { paddingBottom: insets.bottom + 40 }]}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.formLabel}>Recipe Name *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g., Grandma's Chicken Biryani"
                  placeholderTextColor={COLORS.text.secondary}
                  value={formTitle}
                  onChangeText={setFormTitle}
                />

                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextArea]}
                  placeholder="A brief description..."
                  placeholderTextColor={COLORS.text.secondary}
                  value={formDescription}
                  onChangeText={setFormDescription}
                  multiline
                />

                <Text style={styles.formLabel}>Ingredients (one per line)</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextAreaLarge]}
                  placeholder={'1 cup rice\n2 chicken breasts\n1 tsp cumin...'}
                  placeholderTextColor={COLORS.text.secondary}
                  value={formIngredients}
                  onChangeText={setFormIngredients}
                  multiline
                />

                <Text style={styles.formLabel}>Instructions (one step per line)</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextAreaLarge]}
                  placeholder={'Marinate chicken for 30 min\nCook rice until fluffy\n...'}
                  placeholderTextColor={COLORS.text.secondary}
                  value={formInstructions}
                  onChangeText={setFormInstructions}
                  multiline
                />

                <View style={styles.formRow}>
                  <View style={styles.formHalf}>
                    <Text style={styles.formLabel}>Prep Time</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="15 min"
                      placeholderTextColor={COLORS.text.secondary}
                      value={formPrepTime}
                      onChangeText={setFormPrepTime}
                    />
                  </View>
                  <View style={styles.formHalf}>
                    <Text style={styles.formLabel}>Cook Time</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="30 min"
                      placeholderTextColor={COLORS.text.secondary}
                      value={formCookTime}
                      onChangeText={setFormCookTime}
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formHalf}>
                    <Text style={styles.formLabel}>Servings</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="4"
                      placeholderTextColor={COLORS.text.secondary}
                      value={formServings}
                      onChangeText={setFormServings}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>

                <Text style={styles.formLabel}>Cuisine</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {CUISINE_OPTIONS.map((c) => (
                    <Pressable
                      key={c}
                      style={[styles.chipOption, formCuisine === c && styles.chipOptionActive]}
                      onPress={() => setFormCuisine(formCuisine === c ? '' : c)}
                    >
                      <Text style={[styles.chipOptionText, formCuisine === c && styles.chipOptionTextActive]}>
                        {CUISINE_EMOJIS[c] || ''} {c}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Text style={styles.formLabel}>Dietary Tags</Text>
                <View style={styles.chipGrid}>
                  {DIETARY_TAG_OPTIONS.map((tag) => {
                    const isSelected = formDietaryTags.includes(tag);
                    return (
                      <Pressable
                        key={tag}
                        style={[styles.chipOption, isSelected && styles.chipOptionActive]}
                        onPress={() => {
                          setFormDietaryTags(
                            isSelected
                              ? formDietaryTags.filter((t) => t !== tag)
                              : [...formDietaryTags, tag]
                          );
                        }}
                      >
                        <Text style={[styles.chipOptionText, isSelected && styles.chipOptionTextActive]}>
                          {tag}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Recipe Detail Modal */}
        <Modal visible={showDetailModal} transparent animationType="slide" onRequestClose={() => setShowDetailModal(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <LinearGradient
                colors={[COLORS.background.start, COLORS.background.mid1, COLORS.background.end]}
                style={StyleSheet.absoluteFill}
              />

              <View style={[styles.modalHeader, { paddingTop: insets.top + SPACING.sm }]}>
                <Pressable onPress={() => setShowDetailModal(false)}>
                  <Text style={styles.modalCancel}>Close</Text>
                </Pressable>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {selectedRecipe?.title || 'Recipe'}
                </Text>
                <Pressable onPress={() => selectedRecipe && handleDeleteRecipe(selectedRecipe)}>
                  <Text style={styles.modalDelete}>Delete</Text>
                </Pressable>
              </View>

              {selectedRecipe && (
                <ScrollView
                  style={styles.formScroll}
                  contentContainerStyle={[styles.detailContent, { paddingBottom: insets.bottom + 40 }]}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Photo */}
                  {selectedRecipe.photo_urls.length > 0 && (
                    <Image source={{ uri: selectedRecipe.photo_urls[0] }} style={styles.detailImage} />
                  )}

                  {/* Title & Meta */}
                  <View style={styles.detailHeader}>
                    <Text style={styles.detailTitle}>{selectedRecipe.title}</Text>
                    <Pressable onPress={() => handleToggleFavorite(selectedRecipe)} hitSlop={8}>
                      <Text style={{ fontSize: 24 }}>{selectedRecipe.is_favorite ? '❤️' : '🤍'}</Text>
                    </Pressable>
                  </View>

                  {selectedRecipe.description && (
                    <Text style={styles.detailDescription}>{selectedRecipe.description}</Text>
                  )}

                  <View style={styles.detailMetaRow}>
                    {selectedRecipe.prep_time && (
                      <View style={styles.detailMetaItem}>
                        <Text style={styles.detailMetaLabel}>Prep</Text>
                        <Text style={styles.detailMetaValue}>{selectedRecipe.prep_time}</Text>
                      </View>
                    )}
                    {selectedRecipe.cook_time && (
                      <View style={styles.detailMetaItem}>
                        <Text style={styles.detailMetaLabel}>Cook</Text>
                        <Text style={styles.detailMetaValue}>{selectedRecipe.cook_time}</Text>
                      </View>
                    )}
                    {selectedRecipe.servings && (
                      <View style={styles.detailMetaItem}>
                        <Text style={styles.detailMetaLabel}>Serves</Text>
                        <Text style={styles.detailMetaValue}>{selectedRecipe.servings}</Text>
                      </View>
                    )}
                    {selectedRecipe.calories && (
                      <View style={styles.detailMetaItem}>
                        <Text style={styles.detailMetaLabel}>Cal</Text>
                        <Text style={styles.detailMetaValue}>{selectedRecipe.calories}</Text>
                      </View>
                    )}
                  </View>

                  {/* Macros */}
                  {(selectedRecipe.protein || selectedRecipe.carbs || selectedRecipe.fat) && (
                    <View style={styles.macroRow}>
                      {selectedRecipe.protein && (
                        <View style={styles.macroItem}>
                          <Text style={styles.macroValue}>{selectedRecipe.protein}</Text>
                          <Text style={styles.macroLabel}>Protein</Text>
                        </View>
                      )}
                      {selectedRecipe.carbs && (
                        <View style={styles.macroItem}>
                          <Text style={styles.macroValue}>{selectedRecipe.carbs}</Text>
                          <Text style={styles.macroLabel}>Carbs</Text>
                        </View>
                      )}
                      {selectedRecipe.fat && (
                        <View style={styles.macroItem}>
                          <Text style={styles.macroValue}>{selectedRecipe.fat}</Text>
                          <Text style={styles.macroLabel}>Fat</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Cuisine & Tags */}
                  <View style={styles.detailTagRow}>
                    {selectedRecipe.cuisine && (
                      <View style={[styles.metaChip, { marginRight: SPACING.xs }]}>
                        <Text style={styles.metaChipText}>
                          {CUISINE_EMOJIS[selectedRecipe.cuisine] || ''} {selectedRecipe.cuisine}
                        </Text>
                      </View>
                    )}
                    {selectedRecipe.dietary_tags.map((tag) => (
                      <View key={tag} style={[styles.dietTag, { marginRight: SPACING.xs }]}>
                        <Text style={styles.dietTagText}>{tag}</Text>
                      </View>
                    ))}
                    {selectedRecipe.source === 'mira' && (
                      <View style={[styles.metaChip, styles.miraChip]}>
                        <Text style={styles.miraChipText}>From Mira</Text>
                      </View>
                    )}
                  </View>

                  {/* Ingredients */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Ingredients</Text>
                    <View style={styles.detailCard}>
                      <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                      <LinearGradient
                        colors={['rgba(255, 255, 255, 0.75)', 'rgba(250, 248, 245, 0.6)']}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={styles.recipeCardBorder} />
                      {selectedRecipe.ingredients.map((ing, i) => (
                        <Text key={i} style={styles.ingredientItem}>• {ing}</Text>
                      ))}
                    </View>
                  </View>

                  {/* Instructions */}
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Instructions</Text>
                    <View style={styles.detailCard}>
                      <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                      <LinearGradient
                        colors={['rgba(255, 255, 255, 0.75)', 'rgba(250, 248, 245, 0.6)']}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={styles.recipeCardBorder} />
                      {selectedRecipe.instructions.map((step, i) => (
                        <View key={i} style={styles.stepRow}>
                          <View style={styles.stepNumber}>
                            <Text style={styles.stepNumberText}>{i + 1}</Text>
                          </View>
                          <Text style={styles.stepText}>{step}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Notes */}
                  {selectedRecipe.notes && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Notes & Tips</Text>
                      <Text style={styles.notesText}>{selectedRecipe.notes}</Text>
                    </View>
                  )}

                  {/* Cook Again Button */}
                  <Pressable style={styles.cookAgainButton} onPress={() => handleCookAgain(selectedRecipe)}>
                    <LinearGradient colors={[COLORS.gold.light, COLORS.gold.base]} style={StyleSheet.absoluteFill} />
                    <Text style={styles.cookAgainText}>🛒 Cook Again — Add Ingredients to List</Text>
                  </Pressable>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  backButton: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.gold.dark,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  pageTitle: {
    fontSize: FONT_SIZES.title,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  recipeCountText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginTop: 2,
  },

  // Search
  searchContainer: {
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
  },
  searchBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  searchIcon: {
    fontSize: 16,
    marginLeft: SPACING.md,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
  },

  // Filters
  filterRow: {
    marginBottom: SPACING.sm,
  },
  filterScroll: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.xs,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(200, 200, 200, 0.3)',
  },
  filterChipActive: {
    backgroundColor: COLORS.gold.lightest,
    borderColor: COLORS.gold.light,
  },
  filterChipText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: COLORS.gold.dark,
    fontWeight: '600',
  },

  // Recipe Card
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 160,
    gap: SPACING.md,
  },
  recipeCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    ...SHADOWS.glass,
  },
  recipeCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  recipeImage: {
    width: '100%',
    height: 160,
  },
  recipeCardContent: {
    padding: SPACING.md,
  },
  recipeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
  },
  recipeCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.xs,
  },
  recipeCardEmoji: {
    fontSize: 20,
  },
  recipeCardTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
    flex: 1,
  },
  favoriteIcon: {
    fontSize: 20,
    marginLeft: SPACING.sm,
  },
  recipeCardDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    lineHeight: 18,
    marginBottom: SPACING.sm,
  },
  recipeCardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  metaChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  metaChipText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
  },
  miraChip: {
    backgroundColor: COLORS.gold.lightest,
  },
  miraChipText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gold.dark,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  dietTag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  dietTagText: {
    fontSize: FONT_SIZES.xs,
    color: '#2E7D32',
    fontWeight: '500',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  emptySubtext: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...SHADOWS.glassElevated,
  },
  fabText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 32,
  },

  // Modal
  modalContainer: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(200, 205, 215, 0.3)',
  },
  modalCancel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: SPACING.sm,
  },
  modalSave: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gold.dark,
    fontWeight: '700',
  },
  modalSaveDisabled: {
    opacity: 0.4,
  },
  modalDelete: {
    fontSize: FONT_SIZES.md,
    color: COLORS.error,
    fontWeight: '500',
  },

  // Form
  formScroll: {
    flex: 1,
  },
  formContent: {
    padding: SPACING.lg,
  },
  formLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },
  formInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
    borderWidth: 1,
    borderColor: 'rgba(200, 200, 200, 0.3)',
  },
  formTextArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  formTextAreaLarge: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  formHalf: {
    flex: 1,
  },
  chipScroll: {
    marginTop: SPACING.xs,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  chipOption: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(200, 200, 200, 0.3)',
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  chipOptionActive: {
    backgroundColor: COLORS.gold.lightest,
    borderColor: COLORS.gold.light,
  },
  chipOptionText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
  },
  chipOptionTextActive: {
    color: COLORS.gold.dark,
    fontWeight: '600',
  },

  // Detail
  detailContent: {
    padding: SPACING.lg,
  },
  detailImage: {
    width: '100%',
    height: 220,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  detailTitle: {
    fontSize: FONT_SIZES.title,
    fontWeight: '700',
    color: COLORS.text.primary,
    flex: 1,
    marginRight: SPACING.sm,
  },
  detailDescription: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  detailMetaRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginBottom: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  detailMetaItem: {
    alignItems: 'center',
  },
  detailMetaLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    marginBottom: 2,
  },
  detailMetaValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  macroItem: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.gold.dark,
  },
  macroLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
  },
  detailTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SPACING.lg,
  },

  // Sections
  detailSection: {
    marginBottom: SPACING.lg,
  },
  detailSectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  detailCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    padding: SPACING.md,
    ...SHADOWS.glass,
  },
  ingredientItem: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
    lineHeight: 24,
    paddingLeft: SPACING.xs,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.gold.lightest,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.gold.dark,
  },
  stepText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
    lineHeight: 22,
    flex: 1,
  },
  notesText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    lineHeight: 22,
    fontStyle: 'italic',
  },

  // Cook Again
  cookAgainButton: {
    height: 52,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: SPACING.md,
    ...SHADOWS.goldGlow,
  },
  cookAgainText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: '#fff',
  },
});
