import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Image,
  Alert,
  Dimensions,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { useAuthStore } from '../../src/stores/authStore';
import { useSubscriptionStore } from '../../src/stores/subscriptionStore';
import { useMealMemoriesStore } from '../../src/stores/mealMemoriesStore';
import { mealMemoriesService, type MealMemory } from '../../src/services/mealMemories';
import { photoUploadService } from '../../src/services/photoUpload';
import { useFeatureAccess } from '../../src/hooks/useSubscription';
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../../src/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_SIZE = (SCREEN_WIDTH - SPACING.lg * 2 - SPACING.sm * 2) / 3;
const FREE_MONTHLY_LIMIT = 5;

const HOLIDAY_OPTIONS = [
  { id: 'thanksgiving', label: 'Thanksgiving' },
  { id: 'christmas', label: 'Christmas' },
  { id: 'eid', label: 'Eid' },
  { id: 'lunar_new_year', label: 'Lunar New Year' },
  { id: 'passover', label: 'Passover' },
  { id: 'diwali', label: 'Diwali' },
  { id: 'hanukkah', label: 'Hanukkah' },
  { id: 'easter', label: 'Easter' },
  { id: 'birthday', label: 'Birthday' },
  { id: 'other', label: 'Other' },
];

export default function MealMemoriesScreen() {
  const { user } = useAuthStore();
  const { subscription } = useSubscriptionStore();
  const isPremium = subscription.tier === 'premium';
  const {
    memories,
    recentMemories,
    isLoading,
    hasMore,
    monthlyCount,
    initialize,
    loadMore,
    addMemory,
    removeMemory,
  } = useMealMemoriesStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<MealMemory | null>(null);
  const [newCaption, setNewCaption] = useState('');
  const [newHoliday, setNewHoliday] = useState<string | null>(null);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const householdId = user?.household_id;

  useEffect(() => {
    if (householdId) {
      initialize(householdId);
    }
  }, [householdId]);

  const handleAddPhoto = useCallback(async (source: 'camera' | 'gallery') => {
    // Check free tier limit
    if (!isPremium && monthlyCount >= FREE_MONTHLY_LIMIT) {
      Alert.alert(
        'Monthly Limit Reached',
        `Free accounts can save ${FREE_MONTHLY_LIMIT} photos per month. Upgrade to Premium for unlimited memories!`,
        [
          { text: 'Maybe Later', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/(app)/upgrade') },
        ]
      );
      return;
    }

    const uri = source === 'camera'
      ? await photoUploadService.capturePhoto()
      : await photoUploadService.pickFromGallery(false, [4, 3]);

    if (uri) {
      setSelectedImageUri(uri);
      setShowAddModal(true);
    }
  }, [isPremium, monthlyCount]);

  const handleSaveMemory = async () => {
    if (!selectedImageUri || !householdId || !user) return;

    setIsSaving(true);
    try {
      const result = await mealMemoriesService.saveMemory(householdId, user.id, {
        imageUri: selectedImageUri,
        caption: newCaption || undefined,
        holiday: newHoliday || undefined,
      });

      if (result.success && result.memory) {
        addMemory(result.memory);
        setShowAddModal(false);
        setSelectedImageUri(null);
        setNewCaption('');
        setNewHoliday(null);
      } else {
        Alert.alert('Error', result.error || 'Could not save memory');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMemory = (memory: MealMemory) => {
    Alert.alert(
      'Delete Memory',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await mealMemoriesService.deleteMemory(memory.id);
            if (result.success) {
              removeMemory(memory.id);
              setSelectedMemory(null);
            }
          },
        },
      ]
    );
  };

  const handleLoadMore = () => {
    if (householdId && hasMore && !isLoading) {
      loadMore(householdId);
    }
  };

  // Group memories by month
  const groupedMemories = memories.reduce<{ month: string; data: MealMemory[] }[]>((groups, memory) => {
    const date = new Date(memory.created_at);
    const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    const existing = groups.find(g => g.month === monthKey);
    if (existing) {
      existing.data.push(memory);
    } else {
      groups.push({ month: monthKey, data: [memory] });
    }
    return groups;
  }, []);

  const renderMemoryItem = ({ item }: { item: MealMemory }) => (
    <Pressable
      style={styles.photoItem}
      onPress={() => setSelectedMemory(item)}
    >
      <Image source={{ uri: item.image_url }} style={styles.photoImage} />
      {item.holiday && (
        <View style={styles.holidayBadge}>
          <Text style={styles.holidayBadgeText}>
            {HOLIDAY_OPTIONS.find(h => h.id === item.holiday)?.label || item.holiday}
          </Text>
        </View>
      )}
    </Pressable>
  );

  const renderSectionHeader = (month: string) => (
    <View style={styles.monthHeader}>
      <Text style={styles.monthText}>{month}</Text>
    </View>
  );

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
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>Meal Memories</Text>
            <Text style={styles.subtitle}>Your Family Food Journey</Text>
          </View>
          {!isPremium && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{monthlyCount}/{FREE_MONTHLY_LIMIT}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Add Photo Buttons */}
      <View style={styles.addButtonRow}>
        <Pressable style={styles.addButton} onPress={() => handleAddPhoto('camera')}>
          <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0.35)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.addButtonBorder} />
          <Text style={styles.addButtonIcon}>📷</Text>
          <Text style={styles.addButtonLabel}>Camera</Text>
        </Pressable>
        <Pressable style={styles.addButton} onPress={() => handleAddPhoto('gallery')}>
          <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0.35)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.addButtonBorder} />
          <Text style={styles.addButtonIcon}>🖼️</Text>
          <Text style={styles.addButtonLabel}>Gallery</Text>
        </Pressable>
      </View>

      {/* Photo Timeline */}
      {memories.length === 0 && !isLoading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📸</Text>
          <Text style={styles.emptyTitle}>No Memories Yet</Text>
          <Text style={styles.emptyText}>
            Capture your family's food moments — meal prep, holiday dinners, baked goods, and more!
          </Text>
        </View>
      ) : (
        <FlatList
          data={groupedMemories}
          keyExtractor={(item) => item.month}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: group }) => (
            <View>
              {renderSectionHeader(group.month)}
              <View style={styles.photoGrid}>
                {group.data.map((memory) => (
                  <View key={memory.id}>
                    {renderMemoryItem({ item: memory })}
                  </View>
                ))}
              </View>
            </View>
          )}
          ListFooterComponent={
            isLoading ? (
              <ActivityIndicator color={COLORS.gold.base} style={{ padding: SPACING.lg }} />
            ) : null
          }
        />
      )}

      {/* Add Memory Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.9)', 'rgba(250, 246, 240, 0.95)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>New Memory</Text>

              {selectedImageUri && (
                <Image source={{ uri: selectedImageUri }} style={styles.previewImage} />
              )}

              <TextInput
                style={styles.captionInput}
                placeholder="Add a caption... (optional)"
                placeholderTextColor={COLORS.text.secondary}
                value={newCaption}
                onChangeText={setNewCaption}
                multiline
                maxLength={200}
              />

              <Text style={styles.sectionLabel}>Tag a Holiday (optional)</Text>
              <View style={styles.holidayChips}>
                {HOLIDAY_OPTIONS.map((holiday) => (
                  <Pressable
                    key={holiday.id}
                    style={[
                      styles.chip,
                      newHoliday === holiday.id && styles.chipSelected,
                    ]}
                    onPress={() =>
                      setNewHoliday(newHoliday === holiday.id ? null : holiday.id)
                    }
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        newHoliday === holiday.id && styles.chipLabelSelected,
                      ]}
                    >
                      {holiday.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.modalButtons}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowAddModal(false);
                    setSelectedImageUri(null);
                    setNewCaption('');
                    setNewHoliday(null);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                  onPress={handleSaveMemory}
                  disabled={isSaving}
                >
                  <LinearGradient
                    colors={[COLORS.gold.light, COLORS.gold.base]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  {isSaving ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Memory</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* View Memory Modal */}
      <Modal visible={!!selectedMemory} animationType="fade" transparent>
        <Pressable style={styles.viewOverlay} onPress={() => setSelectedMemory(null)}>
          <View style={styles.viewContainer}>
            {selectedMemory && (
              <>
                <Image
                  source={{ uri: selectedMemory.image_url }}
                  style={styles.viewImage}
                  resizeMode="contain"
                />
                {selectedMemory.caption && (
                  <View style={styles.viewCaption}>
                    <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                    <Text style={styles.viewCaptionText}>{selectedMemory.caption}</Text>
                    <Text style={styles.viewDateText}>
                      {new Date(selectedMemory.created_at).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                )}
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => handleDeleteMemory(selectedMemory)}
                >
                  <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </ScreenWrapper>
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  countBadge: {
    backgroundColor: `${COLORS.gold.base}20`,
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.gold.light,
  },
  countText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gold.dark,
  },
  addButtonRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm + 4,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    gap: SPACING.xs,
    ...SHADOWS.glass,
  },
  addButtonBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  addButtonIcon: {
    fontSize: 20,
  },
  addButtonLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 120,
  },
  monthHeader: {
    paddingVertical: SPACING.sm,
    marginTop: SPACING.sm,
  },
  monthText: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  holidayBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  holidayBadgeText: {
    fontSize: 9,
    color: '#FFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontFamily: 'Georgia',
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
  },
  // Add Memory Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  modalContent: {
    padding: SPACING.lg,
    paddingBottom: 40,
  },
  modalTitle: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
  },
  captionInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
    borderWidth: 0.5,
    borderColor: 'rgba(200, 200, 210, 0.4)',
    minHeight: 50,
    marginBottom: SPACING.md,
  },
  sectionLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginBottom: SPACING.sm,
  },
  holidayChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  chip: {
    paddingHorizontal: SPACING.sm + 4,
    paddingVertical: SPACING.xs + 2,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 0.5,
    borderColor: 'rgba(200, 200, 210, 0.4)',
  },
  chipSelected: {
    backgroundColor: `${COLORS.gold.base}20`,
    borderColor: COLORS.gold.base,
  },
  chipLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  chipLabelSelected: {
    color: COLORS.gold.dark,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 0.5,
    borderColor: 'rgba(200, 200, 210, 0.4)',
  },
  cancelButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  saveButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...SHADOWS.goldGlow,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: '#FFF',
  },
  // View Memory Modal
  viewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewContainer: {
    width: '100%',
    alignItems: 'center',
  },
  viewImage: {
    width: SCREEN_WIDTH - SPACING.lg * 2,
    height: SCREEN_WIDTH - SPACING.lg * 2,
    borderRadius: BORDER_RADIUS.lg,
  },
  viewCaption: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    maxWidth: SCREEN_WIDTH - SPACING.lg * 2,
  },
  viewCaptionText: {
    fontSize: FONT_SIZES.md,
    color: '#FFF',
    textAlign: 'center',
  },
  viewDateText: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 4,
  },
  deleteButton: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  deleteButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.error,
  },
});
