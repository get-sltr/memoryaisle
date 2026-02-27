import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Image,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { logger } from '../../src/utils/logger';
import { useAuthStore } from '../../src/stores/authStore';
import {
  getFrequentItems,
  toggleFavorite,
  addCustomFavorite,
  FavoriteItem,
} from '../../src/services/favorites';
import { getActiveList, addItem } from '../../src/services/lists';
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../../src/constants/theme';

export default function FavoritesScreen() {
  const { household } = useAuthStore();
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newItemName, setNewItemName] = useState('');

  const loadItems = useCallback(async () => {
    if (!household?.id) return;

    try {
      const frequentItems = await getFrequentItems(household.id);
      setItems(frequentItems);
    } catch (error) {
      logger.error('Error loading favorites:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [household?.id]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadItems();
  }, [loadItems]);

  const handleToggleFavorite = useCallback(async (item: FavoriteItem) => {
    if (!household?.id) return;
    const isNowFavorite = await toggleFavorite(household.id, item.name);
    setItems(prev =>
      prev.map(i =>
        i.id === item.id ? { ...i, isFavorite: isNowFavorite } : i
      ).sort((a, b) => {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        return b.count - a.count;
      })
    );
  }, []);

  const handleAddToList = useCallback(async (item: FavoriteItem) => {
    if (!household?.id) return;

    const list = await getActiveList(household.id);
    if (!list) {
      Alert.alert('Error', 'Could not find your shopping list');
      return;
    }

    const added = await addItem(list.id, item.name);
    if (added) {
      Alert.alert('Added!', `${item.name} added to your list`);
    }
  }, [household?.id]);

  const handleAddCustomFavorite = useCallback(async () => {
    if (!newItemName.trim()) {
      Alert.alert('Missing Name', 'Please enter an item name');
      return;
    }

    await addCustomFavorite(household!.id, newItemName.trim());
    setNewItemName('');
    setModalVisible(false);
    loadItems();
  }, [newItemName, loadItems]);

  // Separate favorites and frequent items
  const favoriteItems = items.filter(i => i.isFavorite);
  const frequentItems = items.filter(i => !i.isFavorite);

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.gold.base} />
          <Text style={styles.loadingText}>Loading favorites...</Text>
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
            <Text style={styles.title}>Favorites</Text>
            <Text style={styles.subtitle}>Your go-to items</Text>
          </View>
        </View>
        <Pressable style={styles.addButton} onPress={() => setModalVisible(true)}>
          <BlurView intensity={20} tint="light" style={styles.addButtonBlur} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.7)', 'rgba(245, 245, 250, 0.5)']}
            style={styles.addButtonGradient}
          />
          <View style={styles.addButtonBorder} />
          <Text style={styles.addButtonText}>+</Text>
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
        {/* Your Favorites Section */}
        {favoriteItems.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Your Favorites</Text>
            <Text style={styles.sectionHint}>Tap star to remove, tap card to add to list</Text>
            <View style={styles.grid}>
              {favoriteItems.map((item) => (
                <FavoriteCard
                  key={item.id}
                  item={item}
                  onToggleFavorite={() => handleToggleFavorite(item)}
                  onAddToList={() => handleAddToList(item)}
                />
              ))}
            </View>
          </>
        )}

        {/* Frequently Purchased Section */}
        {frequentItems.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, favoriteItems.length > 0 && styles.sectionLabelSpaced]}>
              Frequently Purchased
            </Text>
            <Text style={styles.sectionHint}>Tap star to add to favorites</Text>
            <View style={styles.grid}>
              {frequentItems.slice(0, 12).map((item) => (
                <FavoriteCard
                  key={item.id}
                  item={item}
                  onToggleFavorite={() => handleToggleFavorite(item)}
                  onAddToList={() => handleAddToList(item)}
                />
              ))}
            </View>
          </>
        )}

        {/* Empty State */}
        {items.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>⭐</Text>
            <Text style={styles.emptyTitle}>No favorites yet</Text>
            <Text style={styles.emptyText}>
              As you shop, items you buy frequently will appear here.
              You can also add custom favorites!
            </Text>
            <Pressable
              style={styles.emptyButton}
              onPress={() => setModalVisible(true)}
            >
              <LinearGradient
                colors={[COLORS.gold.light, COLORS.gold.base]}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.emptyButtonText}>Add Your First Favorite</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Add Custom Favorite Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
        >
          <Pressable style={styles.modalContainer} onPress={e => e.stopPropagation()}>
            <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.95)', 'rgba(250, 252, 255, 0.9)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.modalBorder} />

            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add Favorite</Text>
              <Text style={styles.modalSubtitle}>
                Add an item you want quick access to
              </Text>

              <TextInput
                style={styles.modalInput}
                placeholder="e.g., Organic Almond Milk"
                placeholderTextColor={COLORS.text.tertiary}
                value={newItemName}
                onChangeText={setNewItemName}
                autoFocus
              />

              <View style={styles.modalButtons}>
                <Pressable
                  style={styles.modalCancelButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.modalSaveButton}
                  onPress={handleAddCustomFavorite}
                >
                  <LinearGradient
                    colors={[COLORS.gold.light, COLORS.gold.base]}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={styles.modalSaveText}>Add Favorite</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenWrapper>
  );
}

interface FavoriteCardProps {
  item: FavoriteItem;
  onToggleFavorite: () => void;
  onAddToList: () => void;
}

function FavoriteCard({ item, onToggleFavorite, onAddToList }: FavoriteCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
        item.isFavorite && styles.cardFavorite,
      ]}
      onPress={onAddToList}
    >
      <BlurView intensity={20} tint="light" style={styles.cardBlur} />
      <LinearGradient
        colors={
          item.isFavorite
            ? ['rgba(212, 175, 55, 0.15)', 'rgba(212, 165, 71, 0.08)']
            : ['rgba(255, 255, 255, 0.7)', 'rgba(245, 245, 250, 0.6)']
        }
        style={styles.cardGradient}
      />
      {/* Top shine */}
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.12)', 'transparent']}
        style={styles.cardShine}
      />
      <View style={[styles.cardBorder, item.isFavorite && styles.cardBorderFavorite]} />

      {/* Star badge - toggles favorite */}
      <Pressable
        style={styles.starBadge}
        onPress={onToggleFavorite}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={[styles.starText, item.isFavorite && styles.starTextActive]}>
          {item.isFavorite ? '★' : '☆'}
        </Text>
      </Pressable>

      <View style={styles.cardContent}>
        <Text style={styles.emoji}>{item.emoji}</Text>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        {item.count > 0 && (
          <Text style={styles.count}>
            {item.count === 1 ? 'Added once' : `Added ${item.count} times`}
          </Text>
        )}
      </View>
    </Pressable>
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
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 120,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
  },
  sectionLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.gold.base,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 4,
    paddingLeft: 4,
  },
  sectionLabelSpaced: {
    marginTop: SPACING.xl,
  },
  sectionHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.tertiary,
    marginBottom: SPACING.md,
    paddingLeft: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  card: {
    width: '47%',
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    ...SHADOWS.glass,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  cardFavorite: {
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
  cardBorderFavorite: {
    borderColor: 'rgba(212, 175, 55, 0.4)',
  },
  starBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starText: {
    fontSize: 18,
    color: COLORS.text.tertiary,
  },
  starTextActive: {
    color: COLORS.gold.base,
  },
  cardContent: {
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 32,
    marginBottom: SPACING.sm + 2,
  },
  name: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 4,
    textAlign: 'center',
  },
  count: {
    fontSize: FONT_SIZES.xs + 1,
    color: COLORS.text.secondary,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  emptyButton: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  emptyButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 340,
    borderRadius: BORDER_RADIUS.xxl,
    overflow: 'hidden',
  },
  modalBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    borderColor: COLORS.frost.border,
  },
  modalContent: {
    padding: SPACING.xl,
  },
  modalTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  modalSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  modalInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: COLORS.frost.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
    marginBottom: SPACING.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  modalCancelText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  modalSaveText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
  },
});
