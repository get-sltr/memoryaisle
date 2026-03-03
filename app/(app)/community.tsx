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
  ActivityIndicator,
  Image,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { useAuthStore } from '../../src/stores/authStore';
import { useCommunityStore } from '../../src/stores/communityStore';
import { communityService, type CommunityRecipe } from '../../src/services/community';
import { CUISINE_OPTIONS, DIETARY_TAG_OPTIONS } from '../../src/services/cookbook';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';

const CUISINE_EMOJIS: Record<string, string> = {
  American: '🍔', Italian: '🍝', Mexican: '🌮', Chinese: '🥡', Indian: '🍛',
  Japanese: '🍣', Thai: '🍜', Mediterranean: '🫒', French: '🥐', Korean: '🍱',
  'Middle Eastern': '🧆', African: '🍲', Caribbean: '🥥', Vietnamese: '🍲', Other: '🍽️',
};

const SORT_OPTIONS = [
  { key: 'popular' as const, label: 'Popular', emoji: '🔥' },
  { key: 'newest' as const, label: 'New', emoji: '✨' },
  { key: 'top_rated' as const, label: 'Top Rated', emoji: '⭐' },
];

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const {
    recipes, savedRecipes, isLoading, hasMore, selectedCuisine, sortBy, searchQuery, tab,
    initialize, loadMore, setCuisine, setSortBy, setSearch, setTab, loadSaved, toggleSave, rateRecipe,
  } = useCommunityStore();

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<CommunityRecipe | null>(null);
  const [searchText, setSearchText] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [userRating, setUserRating] = useState(0);

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (tab === 'saved' && user?.id) {
      loadSaved(user.id);
    }
  }, [tab, user?.id]);

  const handleSearch = useCallback((text: string) => {
    setSearchText(text);
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => {
      setSearch(text);
    }, 400);
    setSearchTimeout(timeout);
  }, [searchTimeout]);

  const handleOpenRecipe = async (recipe: CommunityRecipe) => {
    const full = await communityService.getRecipe(recipe.id, user?.id);
    if (full) {
      setSelectedRecipe(full);
      setUserRating(full.user_rating || 0);
      setShowDetailModal(true);
    }
  };

  const handleToggleSave = (recipeId: string, isSaved: boolean) => {
    if (!user?.id) return;
    toggleSave(user.id, recipeId, isSaved);
  };

  const handleRate = async (rating: number) => {
    if (!user?.id || !selectedRecipe) return;
    setUserRating(rating);
    await rateRecipe(user.id, selectedRecipe.id, rating);
    setSelectedRecipe((prev) => prev ? { ...prev, user_rating: rating } : null);
  };

  const displayRecipes = tab === 'browse' ? recipes : savedRecipes;

  const renderRecipeCard = ({ item }: { item: CommunityRecipe }) => (
    <Pressable style={styles.recipeCard} onPress={() => handleOpenRecipe(item)}>
      <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255,255,255,0.85)', 'rgba(250,248,245,0.75)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.recipeCardInner}>
        {item.photo_urls?.[0] && (
          <Image source={{ uri: item.photo_urls[0] }} style={styles.recipeImage} />
        )}
        <View style={styles.recipeInfo}>
          <Text style={styles.recipeName} numberOfLines={2}>{item.title}</Text>
          {item.author_name && (
            <Text style={styles.recipeAuthor}>by {item.author_name}</Text>
          )}
          <View style={styles.recipeMeta}>
            {item.cuisine && (
              <View style={styles.cuisineChip}>
                <Text style={styles.cuisineChipText}>
                  {CUISINE_EMOJIS[item.cuisine] || '🍽️'} {item.cuisine}
                </Text>
              </View>
            )}
            {item.rating_count > 0 && (
              <Text style={styles.ratingText}>
                ⭐ {item.rating_avg.toFixed(1)} ({item.rating_count})
              </Text>
            )}
          </View>
          <View style={styles.recipeStats}>
            {item.prep_time && (
              <Text style={styles.statText}>⏱ {item.prep_time}</Text>
            )}
            {item.servings && (
              <Text style={styles.statText}>🍽 {item.servings} servings</Text>
            )}
            <Text style={styles.saveCountText}>
              ❤️ {item.save_count}
            </Text>
          </View>
        </View>
        <Pressable
          style={styles.saveButton}
          onPress={() => handleToggleSave(item.id, !!item.is_saved)}
        >
          <Text style={styles.saveIcon}>{item.is_saved ? '❤️' : '🤍'}</Text>
        </Pressable>
      </View>
    </Pressable>
  );

  return (
    <ScreenWrapper>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backButtonText}>←</Text>
            </Pressable>
            <View>
              <Text style={styles.title}>Community</Text>
              <Text style={styles.subtitle}>Discover recipes from others</Text>
            </View>
          </View>
        </View>

        {/* Tab Switch */}
        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabButton, tab === 'browse' && styles.tabActive]}
            onPress={() => setTab('browse')}
          >
            <Text style={[styles.tabText, tab === 'browse' && styles.tabTextActive]}>
              🌍 Browse
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, tab === 'saved' && styles.tabActive]}
            onPress={() => setTab('saved')}
          >
            <Text style={[styles.tabText, tab === 'saved' && styles.tabTextActive]}>
              ❤️ Saved
            </Text>
          </Pressable>
        </View>

        {/* Browse Tab Content */}
        {tab === 'browse' && (
          <>
            {/* Search */}
            <View style={styles.searchRow}>
              <View style={styles.searchBar}>
                <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search community recipes..."
                  placeholderTextColor={COLORS.text.secondary}
                  value={searchText}
                  onChangeText={handleSearch}
                />
              </View>
            </View>

            {/* Sort Options */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {SORT_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  style={[styles.filterChip, sortBy === opt.key && styles.filterChipActive]}
                  onPress={() => setSortBy(opt.key)}
                >
                  <Text style={[styles.filterChipText, sortBy === opt.key && styles.filterChipTextActive]}>
                    {opt.emoji} {opt.label}
                  </Text>
                </Pressable>
              ))}
              <View style={styles.filterDivider} />
              {CUISINE_OPTIONS.map((cuisine) => (
                <Pressable
                  key={cuisine}
                  style={[styles.filterChip, selectedCuisine === cuisine && styles.filterChipActive]}
                  onPress={() => setCuisine(selectedCuisine === cuisine ? null : cuisine)}
                >
                  <Text style={[styles.filterChipText, selectedCuisine === cuisine && styles.filterChipTextActive]}>
                    {CUISINE_EMOJIS[cuisine] || '🍽️'} {cuisine}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {/* Recipe List */}
        <FlatList
          data={displayRecipes}
          keyExtractor={(item) => item.id}
          renderItem={renderRecipeCard}
          contentContainerStyle={styles.listContent}
          onEndReached={tab === 'browse' ? loadMore : undefined}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              {isLoading ? (
                <ActivityIndicator color={COLORS.gold.base} />
              ) : (
                <>
                  <Text style={styles.emptyEmoji}>{tab === 'browse' ? '🌍' : '❤️'}</Text>
                  <Text style={styles.emptyTitle}>
                    {tab === 'browse' ? 'No recipes found' : 'No saved recipes yet'}
                  </Text>
                  <Text style={styles.emptyText}>
                    {tab === 'browse'
                      ? 'Try adjusting your filters or search'
                      : 'Browse community recipes and save your favorites'}
                  </Text>
                </>
              )}
            </View>
          }
          ListFooterComponent={
            isLoading && displayRecipes.length > 0 ? (
              <ActivityIndicator color={COLORS.gold.base} style={{ padding: SPACING.lg }} />
            ) : null
          }
        />
      </View>

      {/* Recipe Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" presentationStyle="pageSheet">
        <ScreenWrapper>
          <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { paddingTop: SPACING.md }]}>
              <Pressable onPress={() => setShowDetailModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
              <Text style={styles.modalHeaderTitle}>Recipe</Text>
              <View style={{ width: 30 }} />
            </View>

            {selectedRecipe && (
              <>
                {/* Photo */}
                {selectedRecipe.photo_urls?.[0] && (
                  <Image
                    source={{ uri: selectedRecipe.photo_urls[0] }}
                    style={styles.detailImage}
                  />
                )}

                {/* Title & Author */}
                <Text style={styles.detailTitle}>{selectedRecipe.title}</Text>
                {selectedRecipe.author_name && (
                  <Text style={styles.detailAuthor}>by {selectedRecipe.author_name}</Text>
                )}
                {selectedRecipe.description && (
                  <Text style={styles.detailDescription}>{selectedRecipe.description}</Text>
                )}

                {/* Meta Row */}
                <View style={styles.detailMetaRow}>
                  {selectedRecipe.prep_time && (
                    <View style={styles.detailMetaChip}>
                      <Text style={styles.detailMetaText}>⏱ {selectedRecipe.prep_time}</Text>
                    </View>
                  )}
                  {selectedRecipe.cook_time && (
                    <View style={styles.detailMetaChip}>
                      <Text style={styles.detailMetaText}>🔥 {selectedRecipe.cook_time}</Text>
                    </View>
                  )}
                  {selectedRecipe.servings && (
                    <View style={styles.detailMetaChip}>
                      <Text style={styles.detailMetaText}>🍽 {selectedRecipe.servings} servings</Text>
                    </View>
                  )}
                  {selectedRecipe.calories && (
                    <View style={styles.detailMetaChip}>
                      <Text style={styles.detailMetaText}>🔢 {selectedRecipe.calories} cal</Text>
                    </View>
                  )}
                </View>

                {/* Cuisine & Tags */}
                <View style={styles.tagRow}>
                  {selectedRecipe.cuisine && (
                    <View style={styles.cuisineTag}>
                      <Text style={styles.cuisineTagText}>
                        {CUISINE_EMOJIS[selectedRecipe.cuisine] || '🍽️'} {selectedRecipe.cuisine}
                      </Text>
                    </View>
                  )}
                  {selectedRecipe.dietary_tags?.map((tag) => (
                    <View key={tag} style={styles.dietaryTag}>
                      <Text style={styles.dietaryTagText}>{tag}</Text>
                    </View>
                  ))}
                </View>

                {/* Rating & Save */}
                <View style={styles.detailActions}>
                  {/* Star Rating */}
                  <View style={styles.ratingRow}>
                    <Text style={styles.ratingLabel}>Your Rating:</Text>
                    <View style={styles.starRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Pressable key={star} onPress={() => handleRate(star)}>
                          <Text style={styles.star}>
                            {star <= userRating ? '⭐' : '☆'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* Save Button */}
                  <Pressable
                    style={[styles.detailSaveButton, selectedRecipe.is_saved && styles.detailSaveButtonActive]}
                    onPress={() => handleToggleSave(selectedRecipe.id, !!selectedRecipe.is_saved)}
                  >
                    <Text style={styles.detailSaveText}>
                      {selectedRecipe.is_saved ? '❤️ Saved' : '🤍 Save Recipe'}
                    </Text>
                  </Pressable>
                </View>

                {/* Community Stats */}
                <View style={styles.statsCard}>
                  <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                  <LinearGradient
                    colors={['rgba(255,255,255,0.85)', 'rgba(250,248,245,0.75)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.statsInner}>
                    <View style={styles.statItem}>
                      <Text style={styles.statNumber}>{selectedRecipe.save_count}</Text>
                      <Text style={styles.statLabel}>Saves</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statNumber}>
                        {selectedRecipe.rating_count > 0 ? selectedRecipe.rating_avg.toFixed(1) : '—'}
                      </Text>
                      <Text style={styles.statLabel}>Rating</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statNumber}>{selectedRecipe.rating_count}</Text>
                      <Text style={styles.statLabel}>Reviews</Text>
                    </View>
                  </View>
                </View>

                {/* Ingredients */}
                {selectedRecipe.ingredients?.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Ingredients</Text>
                    {selectedRecipe.ingredients.map((ing, i) => (
                      <View key={i} style={styles.ingredientRow}>
                        <Text style={styles.ingredientBullet}>•</Text>
                        <Text style={styles.ingredientText}>{ing}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Instructions */}
                {selectedRecipe.instructions?.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Instructions</Text>
                    {selectedRecipe.instructions.map((step, i) => (
                      <View key={i} style={styles.instructionRow}>
                        <View style={styles.stepNumber}>
                          <Text style={styles.stepNumberText}>{i + 1}</Text>
                        </View>
                        <Text style={styles.instructionText}>{step}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Notes */}
                {selectedRecipe.notes && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Notes</Text>
                    <Text style={styles.notesText}>{selectedRecipe.notes}</Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </ScreenWrapper>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backButtonText: { fontSize: 24, color: COLORS.text.primary },
  title: { fontSize: FONT_SIZES.title, fontWeight: '700', color: COLORS.text.primary },
  subtitle: { fontSize: FONT_SIZES.sm, color: COLORS.text.secondary, marginTop: 2 },

  // Tabs
  tabRow: { flexDirection: 'row', paddingHorizontal: SPACING.lg, gap: SPACING.sm, marginBottom: SPACING.sm },
  tabButton: { flex: 1, height: 44, borderRadius: BORDER_RADIUS.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.04)' },
  tabActive: { backgroundColor: COLORS.gold.lightest },
  tabText: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.text.secondary },
  tabTextActive: { color: COLORS.gold.dark },

  // Search
  searchRow: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm },
  searchBar: { flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: BORDER_RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.frost.border, paddingHorizontal: SPACING.md },
  searchIcon: { fontSize: 16, marginRight: SPACING.sm },
  searchInput: { flex: 1, fontSize: FONT_SIZES.md, color: COLORS.text.primary },

  // Filters
  filterRow: { paddingHorizontal: SPACING.lg, gap: SPACING.sm, paddingBottom: SPACING.sm },
  filterChip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2, borderRadius: BORDER_RADIUS.full, backgroundColor: 'rgba(0,0,0,0.04)' },
  filterChipActive: { backgroundColor: COLORS.gold.lightest },
  filterChipText: { fontSize: FONT_SIZES.sm, color: COLORS.text.secondary, fontWeight: '500' },
  filterChipTextActive: { color: COLORS.gold.dark },
  filterDivider: { width: 1, height: 20, backgroundColor: COLORS.platinum.base, alignSelf: 'center' },

  // List
  listContent: { paddingHorizontal: SPACING.lg, paddingBottom: 100, gap: SPACING.sm },

  // Recipe Card
  recipeCard: { borderRadius: BORDER_RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.frost.border, ...SHADOWS.glass },
  recipeCardInner: { flexDirection: 'row', padding: SPACING.md },
  recipeImage: { width: 80, height: 80, borderRadius: BORDER_RADIUS.md, marginRight: SPACING.md },
  recipeInfo: { flex: 1 },
  recipeName: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.text.primary, marginBottom: 2 },
  recipeAuthor: { fontSize: FONT_SIZES.sm, color: COLORS.text.secondary, marginBottom: SPACING.xs },
  recipeMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  cuisineChip: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.gold.lightest },
  cuisineChipText: { fontSize: FONT_SIZES.xs, color: COLORS.gold.dark, fontWeight: '600' },
  ratingText: { fontSize: FONT_SIZES.xs, color: COLORS.text.secondary },
  recipeStats: { flexDirection: 'row', gap: SPACING.md },
  statText: { fontSize: FONT_SIZES.xs, color: COLORS.text.tertiary },
  saveCountText: { fontSize: FONT_SIZES.xs, color: COLORS.text.tertiary },
  saveButton: { width: 44, alignItems: 'center', justifyContent: 'center' },
  saveIcon: { fontSize: 22 },

  // Empty state
  emptyState: { paddingTop: 80, alignItems: 'center' },
  emptyEmoji: { fontSize: 56, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.text.primary, marginBottom: SPACING.xs },
  emptyText: { fontSize: FONT_SIZES.md, color: COLORS.text.secondary, textAlign: 'center', paddingHorizontal: SPACING.xl },

  // Modal
  modalScroll: { flex: 1, paddingHorizontal: SPACING.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: SPACING.md },
  modalClose: { fontSize: 20, color: COLORS.text.secondary, fontWeight: '600', width: 30 },
  modalHeaderTitle: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.text.primary },

  // Detail
  detailImage: { width: '100%', height: 200, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.md },
  detailTitle: { fontSize: FONT_SIZES.xxl, fontWeight: '700', color: COLORS.text.primary, marginBottom: 4 },
  detailAuthor: { fontSize: FONT_SIZES.md, color: COLORS.text.secondary, marginBottom: SPACING.xs },
  detailDescription: { fontSize: FONT_SIZES.md, color: COLORS.text.secondary, lineHeight: 22, marginBottom: SPACING.md },
  detailMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  detailMetaChip: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.full, backgroundColor: 'rgba(0,0,0,0.04)' },
  detailMetaText: { fontSize: FONT_SIZES.sm, color: COLORS.text.secondary },

  // Tags
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.md },
  cuisineTag: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.gold.lightest },
  cuisineTagText: { fontSize: FONT_SIZES.xs, color: COLORS.gold.dark, fontWeight: '600' },
  dietaryTag: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: BORDER_RADIUS.full, backgroundColor: 'rgba(126,184,138,0.15)' },
  dietaryTagText: { fontSize: FONT_SIZES.xs, color: '#5A9E68', fontWeight: '600' },

  // Rating & Actions
  detailActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  ratingLabel: { fontSize: FONT_SIZES.sm, color: COLORS.text.secondary },
  starRow: { flexDirection: 'row', gap: 2 },
  star: { fontSize: 22 },
  detailSaveButton: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg, backgroundColor: 'rgba(0,0,0,0.04)' },
  detailSaveButtonActive: { backgroundColor: 'rgba(212,165,71,0.12)' },
  detailSaveText: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.text.primary },

  // Stats Card
  statsCard: { borderRadius: BORDER_RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.frost.border, marginBottom: SPACING.lg, ...SHADOWS.glass },
  statsInner: { flexDirection: 'row', paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.text.primary },
  statLabel: { fontSize: FONT_SIZES.xs, color: COLORS.text.secondary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: COLORS.platinum.light, marginVertical: 4 },

  // Sections
  section: { marginBottom: SPACING.lg },
  sectionTitle: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.text.primary, marginBottom: SPACING.sm },
  ingredientRow: { flexDirection: 'row', paddingVertical: 4, gap: SPACING.sm },
  ingredientBullet: { fontSize: FONT_SIZES.md, color: COLORS.gold.base, fontWeight: '700' },
  ingredientText: { fontSize: FONT_SIZES.md, color: COLORS.text.primary, flex: 1 },
  instructionRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.sm },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.gold.lightest, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: FONT_SIZES.sm, fontWeight: '700', color: COLORS.gold.dark },
  instructionText: { fontSize: FONT_SIZES.md, color: COLORS.text.primary, flex: 1, lineHeight: 22 },
  notesText: { fontSize: FONT_SIZES.md, color: COLORS.text.secondary, lineHeight: 22, fontStyle: 'italic' },
});
