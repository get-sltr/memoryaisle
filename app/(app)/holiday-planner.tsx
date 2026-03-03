import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { useAuthStore } from '../../src/stores/authStore';
import { useHolidayPlannerStore } from '../../src/stores/holidayPlannerStore';
import { holidayPlannerService, HOLIDAYS, type HolidayPlan } from '../../src/services/holidayPlanner';
import { getActiveList, addItem } from '../../src/services/lists';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';

const STATUS_CONFIG = {
  planning: { label: 'Planning', color: '#3498db', emoji: '📋' },
  shopping: { label: 'Shopping', color: '#f39c12', emoji: '🛒' },
  prepping: { label: 'Prepping', color: '#e67e22', emoji: '👨‍🍳' },
  completed: { label: 'Completed', color: '#27ae60', emoji: '✅' },
};

export default function HolidayPlannerScreen() {
  const insets = useSafeAreaInsets();
  const { household, user } = useAuthStore();
  const {
    plans, upcomingPlans, isLoading,
    initialize, addPlan, removePlan, updatePlan: updatePlanInStore,
  } = useHolidayPlannerStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<HolidayPlan | null>(null);
  const [showPastPlans, setShowPastPlans] = useState(false);

  // Create form state
  const [formHoliday, setFormHoliday] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formGuests, setFormGuests] = useState('');
  const [formDietary, setFormDietary] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (household?.id) initialize(household.id);
  }, [household?.id]);

  const handleCreate = async () => {
    if (!household?.id || !formHoliday || !formDate) return;
    setIsSaving(true);

    const result = await holidayPlannerService.createPlan(
      household.id,
      {
        holiday_name: formHoliday,
        holiday_date: formDate,
        guest_count: formGuests ? parseInt(formGuests) : 0,
        dietary_notes: formDietary || undefined,
      },
      user?.id
    );

    if (result.success && result.plan) {
      addPlan(result.plan);
      setShowCreateModal(false);
      setFormHoliday('');
      setFormDate('');
      setFormGuests('');
      setFormDietary('');
      // Open the new plan
      setSelectedPlan(result.plan);
      setShowDetailModal(true);
    } else {
      Alert.alert('Error', result.error || 'Failed to create plan.');
    }
    setIsSaving(false);
  };

  const handleDelete = (plan: HolidayPlan) => {
    Alert.alert('Delete Plan', `Delete your ${plan.holiday_name} plan?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          removePlan(plan.id);
          await holidayPlannerService.deletePlan(plan.id);
          setShowDetailModal(false);
        },
      },
    ]);
  };

  const handleStatusUpdate = async (plan: HolidayPlan, newStatus: HolidayPlan['status']) => {
    updatePlanInStore(plan.id, { status: newStatus });
    await holidayPlannerService.updatePlan(plan.id, { status: newStatus } as any);
    setSelectedPlan({ ...plan, status: newStatus });
  };

  const handleAddToGroceryList = async (plan: HolidayPlan) => {
    if (!household?.id || plan.shopping_list.length === 0) {
      Alert.alert('No Items', 'Ask Mira to generate a shopping list for this holiday first.');
      return;
    }
    const list = await getActiveList(household.id);
    if (!list) {
      Alert.alert('No List', 'Create a shopping list first.');
      return;
    }
    for (const item of plan.shopping_list) {
      await addItem(list.id, item);
    }
    Alert.alert('Added!', `${plan.shopping_list.length} items added to your shopping list.`);
  };

  const getDaysUntil = (dateStr: string) => {
    const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today!';
    if (diff === 1) return 'Tomorrow';
    if (diff < 0) return `${Math.abs(diff)} days ago`;
    return `${diff} days away`;
  };

  const getHolidayEmoji = (name: string) => {
    const match = HOLIDAYS.find(h => h.name === name);
    return match?.emoji || '🎉';
  };

  const displayPlans = showPastPlans ? plans : upcomingPlans;

  const renderPlanCard = ({ item }: { item: HolidayPlan }) => {
    const statusInfo = STATUS_CONFIG[item.status];
    const daysText = getDaysUntil(item.holiday_date);

    return (
      <Pressable style={styles.planCard} onPress={() => { setSelectedPlan(item); setShowDetailModal(true); }}>
        <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.75)', 'rgba(250, 248, 245, 0.6)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.planCardBorder} />

        <View style={styles.planCardContent}>
          <View style={styles.planCardHeader}>
            <Text style={styles.planEmoji}>{getHolidayEmoji(item.holiday_name)}</Text>
            <View style={styles.planCardTitleArea}>
              <Text style={styles.planCardTitle}>{item.holiday_name}</Text>
              <Text style={styles.planCardDate}>
                {new Date(item.holiday_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                {' · '}{daysText}
              </Text>
            </View>
          </View>

          <View style={styles.planCardMeta}>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
              <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>
                {statusInfo.emoji} {statusInfo.label}
              </Text>
            </View>
            {item.guest_count > 0 && (
              <View style={styles.metaItem}>
                <Text style={styles.metaItemText}>👥 {item.guest_count} guests</Text>
              </View>
            )}
            {item.menu.length > 0 && (
              <View style={styles.metaItem}>
                <Text style={styles.metaItemText}>🍽️ {item.menu.reduce((sum, m) => sum + m.dishes.length, 0)} dishes</Text>
              </View>
            )}
            {item.budget_estimate && (
              <View style={styles.metaItem}>
                <Text style={styles.metaItemText}>💰 ${item.budget_estimate}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <ScreenWrapper>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.backButton}>‹ Back</Text>
          </Pressable>
          <Text style={styles.pageTitle}>Holiday Planner</Text>
          <Pressable onPress={() => setShowPastPlans(!showPastPlans)}>
            <Text style={styles.toggleText}>{showPastPlans ? 'Upcoming' : 'All Plans'}</Text>
          </Pressable>
        </View>

        {/* Plans List */}
        <FlatList
          data={displayPlans}
          renderItem={renderPlanCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            isLoading ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator color={COLORS.gold.base} />
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>🎉</Text>
                <Text style={styles.emptyTitle}>No holiday plans yet</Text>
                <Text style={styles.emptySubtext}>
                  Start planning your next celebration — Mira will help with menus, shopping lists, and prep timelines
                </Text>
              </View>
            )
          }
        />

        {/* Create FAB */}
        <Pressable style={[styles.fab, { bottom: insets.bottom + 90 }]} onPress={() => setShowCreateModal(true)}>
          <LinearGradient colors={[COLORS.gold.light, COLORS.gold.base]} style={StyleSheet.absoluteFill} />
          <Text style={styles.fabText}>+</Text>
        </Pressable>

        {/* Create Plan Modal */}
        <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
          <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.modalContent}>
              <LinearGradient
                colors={[COLORS.background.start, COLORS.background.mid1, COLORS.background.end]}
                style={StyleSheet.absoluteFill}
              />

              <View style={[styles.modalHeader, { paddingTop: insets.top + SPACING.sm }]}>
                <Pressable onPress={() => setShowCreateModal(false)}>
                  <Text style={styles.modalCancel}>Cancel</Text>
                </Pressable>
                <Text style={styles.modalTitle}>New Holiday Plan</Text>
                <Pressable onPress={handleCreate} disabled={!formHoliday || !formDate || isSaving}>
                  <Text style={[styles.modalSave, (!formHoliday || !formDate) && styles.modalSaveDisabled]}>
                    {isSaving ? 'Creating...' : 'Create'}
                  </Text>
                </Pressable>
              </View>

              <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent}>
                <Text style={styles.formLabel}>Holiday *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {HOLIDAYS.map((h) => (
                    <Pressable
                      key={h.name}
                      style={[styles.holidayChip, formHoliday === h.name && styles.holidayChipActive]}
                      onPress={() => setFormHoliday(formHoliday === h.name ? '' : h.name)}
                    >
                      <Text style={styles.holidayChipEmoji}>{h.emoji}</Text>
                      <Text style={[styles.holidayChipText, formHoliday === h.name && styles.holidayChipTextActive]}>
                        {h.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Text style={styles.formLabel}>Date * (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="2026-11-26"
                  placeholderTextColor={COLORS.text.secondary}
                  value={formDate}
                  onChangeText={setFormDate}
                  keyboardType="numbers-and-punctuation"
                />

                <Text style={styles.formLabel}>Number of Guests</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="12"
                  placeholderTextColor={COLORS.text.secondary}
                  value={formGuests}
                  onChangeText={setFormGuests}
                  keyboardType="number-pad"
                />

                <Text style={styles.formLabel}>Guest Dietary Notes</Text>
                <TextInput
                  style={[styles.formInput, { minHeight: 60, textAlignVertical: 'top' }]}
                  placeholder="Uncle Joe is gluten-free, Aunt Sara is vegetarian..."
                  placeholderTextColor={COLORS.text.secondary}
                  value={formDietary}
                  onChangeText={setFormDietary}
                  multiline
                />

                <View style={styles.tipCard}>
                  <Text style={styles.tipText}>
                    💡 After creating your plan, ask Mira to generate a complete menu, shopping list, and prep timeline!
                  </Text>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Plan Detail Modal */}
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
                  {selectedPlan ? `${getHolidayEmoji(selectedPlan.holiday_name)} ${selectedPlan.holiday_name}` : ''}
                </Text>
                <Pressable onPress={() => selectedPlan && handleDelete(selectedPlan)}>
                  <Text style={styles.modalDelete}>Delete</Text>
                </Pressable>
              </View>

              {selectedPlan && (
                <ScrollView
                  style={styles.formScroll}
                  contentContainerStyle={[styles.detailContent, { paddingBottom: insets.bottom + 40 }]}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Overview */}
                  <View style={styles.overviewCard}>
                    <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                    <LinearGradient
                      colors={['rgba(255,255,255,0.75)', 'rgba(250,248,245,0.6)']}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.planCardBorder} />
                    <Text style={styles.overviewDate}>
                      {new Date(selectedPlan.holiday_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </Text>
                    <Text style={styles.overviewDays}>{getDaysUntil(selectedPlan.holiday_date)}</Text>
                    {selectedPlan.guest_count > 0 && (
                      <Text style={styles.overviewGuests}>👥 {selectedPlan.guest_count} guests</Text>
                    )}
                    {selectedPlan.dietary_notes && (
                      <Text style={styles.overviewDietary}>📝 {selectedPlan.dietary_notes}</Text>
                    )}
                  </View>

                  {/* Status Buttons */}
                  <View style={styles.statusRow}>
                    {(Object.entries(STATUS_CONFIG) as [HolidayPlan['status'], typeof STATUS_CONFIG['planning']][]).map(([key, config]) => (
                      <Pressable
                        key={key}
                        style={[styles.statusButton, selectedPlan.status === key && { backgroundColor: config.color + '25', borderColor: config.color }]}
                        onPress={() => handleStatusUpdate(selectedPlan, key)}
                      >
                        <Text style={styles.statusButtonText}>{config.emoji} {config.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Menu */}
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Menu</Text>
                    {selectedPlan.menu.length > 0 ? (
                      selectedPlan.menu.map((menuItem, i) => (
                        <View key={i} style={styles.menuGroup}>
                          <Text style={styles.menuGroupTitle}>{menuItem.meal}</Text>
                          {menuItem.dishes.map((dish, j) => (
                            <Text key={j} style={styles.menuDish}>• {dish.name} (serves {dish.servings})</Text>
                          ))}
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptySection}>Ask Mira to plan your menu!</Text>
                    )}
                  </View>

                  {/* Prep Timeline */}
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Prep Timeline</Text>
                    {selectedPlan.prep_timeline.length > 0 ? (
                      selectedPlan.prep_timeline.map((entry, i) => (
                        <View key={i} style={styles.timelineEntry}>
                          <View style={styles.timelineDot} />
                          <View style={styles.timelineContent}>
                            <Text style={styles.timelineLabel}>{entry.label}</Text>
                            {entry.tasks.map((task, j) => (
                              <Text key={j} style={styles.timelineTask}>☐ {task}</Text>
                            ))}
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptySection}>Ask Mira for a prep schedule!</Text>
                    )}
                  </View>

                  {/* Shopping List */}
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Shopping List ({selectedPlan.shopping_list.length} items)</Text>
                    {selectedPlan.shopping_list.length > 0 ? (
                      <>
                        {selectedPlan.shopping_list.map((item, i) => (
                          <Text key={i} style={styles.shoppingItem}>• {item}</Text>
                        ))}
                        <Pressable style={styles.addToListButton} onPress={() => handleAddToGroceryList(selectedPlan)}>
                          <LinearGradient colors={[COLORS.gold.light, COLORS.gold.base]} style={StyleSheet.absoluteFill} />
                          <Text style={styles.addToListText}>🛒 Add All to Shopping List</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Text style={styles.emptySection}>Shopping list will appear after menu is planned</Text>
                    )}
                  </View>

                  {/* Budget */}
                  {(selectedPlan.budget_estimate || selectedPlan.actual_spent) && (
                    <View style={styles.detailSection}>
                      <Text style={styles.sectionTitle}>Budget</Text>
                      <View style={styles.budgetRow}>
                        {selectedPlan.budget_estimate && (
                          <View style={styles.budgetItem}>
                            <Text style={styles.budgetLabel}>Estimated</Text>
                            <Text style={styles.budgetValue}>${selectedPlan.budget_estimate}</Text>
                          </View>
                        )}
                        {selectedPlan.actual_spent && (
                          <View style={styles.budgetItem}>
                            <Text style={styles.budgetLabel}>Actual</Text>
                            <Text style={styles.budgetValue}>${selectedPlan.actual_spent}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
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
  container: { flex: 1 },
  header: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm },
  backButton: { fontSize: FONT_SIZES.lg, color: COLORS.gold.dark, fontWeight: '600', marginBottom: SPACING.xs },
  pageTitle: { fontSize: FONT_SIZES.title, fontWeight: '700', color: COLORS.text.primary },
  toggleText: { fontSize: FONT_SIZES.sm, color: COLORS.gold.dark, fontWeight: '600', marginTop: SPACING.xs },

  listContent: { paddingHorizontal: SPACING.lg, paddingBottom: 160, gap: SPACING.md },
  planCard: { borderRadius: BORDER_RADIUS.xl, overflow: 'hidden', ...SHADOWS.glass },
  planCardBorder: { ...StyleSheet.absoluteFillObject, borderRadius: BORDER_RADIUS.xl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  planCardContent: { padding: SPACING.md },
  planCardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  planEmoji: { fontSize: 32 },
  planCardTitleArea: { flex: 1 },
  planCardTitle: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.text.primary },
  planCardDate: { fontSize: FONT_SIZES.sm, color: COLORS.text.secondary, marginTop: 2 },
  planCardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: BORDER_RADIUS.full },
  statusBadgeText: { fontSize: FONT_SIZES.xs, fontWeight: '600' },
  metaItem: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: BORDER_RADIUS.full, backgroundColor: 'rgba(0,0,0,0.04)' },
  metaItemText: { fontSize: FONT_SIZES.xs, color: COLORS.text.secondary },

  emptyContainer: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 56, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.text.primary, marginBottom: SPACING.xs },
  emptySubtext: { fontSize: FONT_SIZES.md, color: COLORS.text.secondary, textAlign: 'center', paddingHorizontal: SPACING.xl },

  fab: { position: 'absolute', right: SPACING.lg, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...SHADOWS.glassElevated },
  fabText: { fontSize: 28, fontWeight: '600', color: '#fff', lineHeight: 32 },

  // Modal
  modalContainer: { flex: 1 },
  modalContent: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: 'rgba(200,205,215,0.3)' },
  modalCancel: { fontSize: FONT_SIZES.md, color: COLORS.text.secondary, fontWeight: '500' },
  modalTitle: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.text.primary, flex: 1, textAlign: 'center', marginHorizontal: SPACING.sm },
  modalSave: { fontSize: FONT_SIZES.md, color: COLORS.gold.dark, fontWeight: '700' },
  modalSaveDisabled: { opacity: 0.4 },
  modalDelete: { fontSize: FONT_SIZES.md, color: COLORS.error, fontWeight: '500' },

  // Form
  formScroll: { flex: 1 },
  formContent: { padding: SPACING.lg, paddingBottom: 100 },
  formLabel: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.text.primary, marginBottom: SPACING.xs, marginTop: SPACING.md },
  formInput: { backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 2, fontSize: FONT_SIZES.md, color: COLORS.text.primary, borderWidth: 1, borderColor: 'rgba(200,200,200,0.3)' },
  chipScroll: { marginTop: SPACING.xs },
  holidayChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, backgroundColor: 'rgba(255,255,255,0.5)', borderWidth: 1, borderColor: 'rgba(200,200,200,0.3)', marginRight: SPACING.xs, gap: SPACING.xs },
  holidayChipActive: { backgroundColor: COLORS.gold.lightest, borderColor: COLORS.gold.light },
  holidayChipEmoji: { fontSize: 18 },
  holidayChipText: { fontSize: FONT_SIZES.sm, color: COLORS.text.secondary },
  holidayChipTextActive: { color: COLORS.gold.dark, fontWeight: '600' },
  tipCard: { backgroundColor: 'rgba(212,175,55,0.08)', borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginTop: SPACING.lg, borderWidth: 1, borderColor: COLORS.gold.light },
  tipText: { fontSize: FONT_SIZES.sm, color: COLORS.gold.dark, lineHeight: 20 },

  // Detail
  detailContent: { padding: SPACING.lg },
  overviewCard: { borderRadius: BORDER_RADIUS.xl, overflow: 'hidden', padding: SPACING.md, marginBottom: SPACING.lg, ...SHADOWS.glass },
  overviewDate: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.text.primary },
  overviewDays: { fontSize: FONT_SIZES.md, color: COLORS.gold.dark, fontWeight: '600', marginTop: 4 },
  overviewGuests: { fontSize: FONT_SIZES.md, color: COLORS.text.secondary, marginTop: SPACING.xs },
  overviewDietary: { fontSize: FONT_SIZES.sm, color: COLORS.text.secondary, marginTop: SPACING.xs, fontStyle: 'italic' },

  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.lg },
  statusButton: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: 'rgba(200,200,200,0.3)', backgroundColor: 'rgba(255,255,255,0.5)' },
  statusButtonText: { fontSize: FONT_SIZES.sm, color: COLORS.text.secondary, fontWeight: '500' },

  detailSection: { marginBottom: SPACING.lg },
  sectionTitle: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.text.primary, marginBottom: SPACING.sm },
  emptySection: { fontSize: FONT_SIZES.md, color: COLORS.text.secondary, fontStyle: 'italic' },

  menuGroup: { marginBottom: SPACING.sm },
  menuGroupTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.gold.dark, marginBottom: 4 },
  menuDish: { fontSize: FONT_SIZES.md, color: COLORS.text.primary, lineHeight: 22, paddingLeft: SPACING.sm },

  timelineEntry: { flexDirection: 'row', marginBottom: SPACING.md },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.gold.base, marginTop: 4, marginRight: SPACING.sm },
  timelineContent: { flex: 1 },
  timelineLabel: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.text.primary, marginBottom: 4 },
  timelineTask: { fontSize: FONT_SIZES.sm, color: COLORS.text.secondary, lineHeight: 20 },

  shoppingItem: { fontSize: FONT_SIZES.md, color: COLORS.text.primary, lineHeight: 24 },
  addToListButton: { height: 48, borderRadius: BORDER_RADIUS.lg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginTop: SPACING.md, ...SHADOWS.goldGlow },
  addToListText: { fontSize: FONT_SIZES.md, fontWeight: '700', color: '#fff' },

  budgetRow: { flexDirection: 'row', gap: SPACING.xl },
  budgetItem: { alignItems: 'center' },
  budgetLabel: { fontSize: FONT_SIZES.xs, color: COLORS.text.secondary },
  budgetValue: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.gold.dark },
});
