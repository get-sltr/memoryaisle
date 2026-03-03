import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { useAuthStore } from '../../src/stores/authStore';
import { usePantryStore } from '../../src/stores/pantryStore';
import { pantryService, PANTRY_CATEGORIES, PANTRY_UNITS, type PantryItem } from '../../src/services/pantry';
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../../src/constants/theme';

export default function PantryScreen() {
  const { user } = useAuthStore();
  const {
    items,
    expiringItems,
    isLoading,
    initialize,
    refresh,
    addItem,
    removeItem,
  } = usePantryStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Add form state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('pantry');
  const [newQuantity, setNewQuantity] = useState('1');
  const [newUnit, setNewUnit] = useState('item');
  const [newExpiry, setNewExpiry] = useState('');
  const [newAutoReplenish, setNewAutoReplenish] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const householdId = user?.household_id;

  useEffect(() => {
    if (householdId) initialize(householdId);
  }, [householdId]);

  const filteredItems = items.filter((item) => {
    const matchesSearch = !searchQuery || item.item_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group by category
  const groupedItems = filteredItems.reduce<Record<string, PantryItem[]>>((groups, item) => {
    const cat = item.category || 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
    return groups;
  }, {});

  const handleAddItem = async () => {
    if (!newName.trim() || !householdId) return;

    setIsSaving(true);
    try {
      const result = await pantryService.addItem(householdId, {
        itemName: newName.trim(),
        category: newCategory,
        quantity: parseFloat(newQuantity) || 1,
        unit: newUnit,
        estimatedExpiry: newExpiry || undefined,
        autoReplenish: newAutoReplenish,
      });

      if (result.success && result.item) {
        addItem(result.item);
        resetForm();
        setShowAddModal(false);
      } else {
        Alert.alert('Error', result.error || 'Could not add item');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = (item: PantryItem) => {
    Alert.alert('Remove Item', `Remove ${item.item_name} from pantry?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const result = await pantryService.deleteItem(item.id);
          if (result.success) removeItem(item.id);
        },
      },
    ]);
  };

  const handleUseItem = async (item: PantryItem) => {
    const newQty = item.quantity - 1;
    if (newQty <= 0) {
      handleDeleteItem(item);
    } else {
      await pantryService.updateQuantity(item.id, newQty);
      if (householdId) refresh(householdId);
    }
  };

  const resetForm = () => {
    setNewName('');
    setNewCategory('pantry');
    setNewQuantity('1');
    setNewUnit('item');
    setNewExpiry('');
    setNewAutoReplenish(false);
  };

  const getCategoryEmoji = (cat: string) =>
    PANTRY_CATEGORIES.find(c => c.id === cat)?.emoji || '📦';

  const renderItem = ({ item }: { item: PantryItem }) => {
    const isExpiring = expiringItems.some(e => e.id === item.id);

    return (
      <View style={[styles.itemCard, isExpiring && styles.itemCardExpiring]}>
        <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={isExpiring
            ? ['rgba(212, 97, 76, 0.1)', 'rgba(255, 255, 255, 0.3)']
            : ['rgba(255, 255, 255, 0.55)', 'rgba(250, 252, 255, 0.35)']
          }
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.itemCardBorder} />

        <View style={styles.itemRow}>
          <Text style={styles.itemEmoji}>{getCategoryEmoji(item.category)}</Text>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.item_name}</Text>
            <Text style={styles.itemMeta}>
              {item.quantity} {item.unit}
              {item.estimated_expiry && ` • Exp: ${new Date(item.estimated_expiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
              {item.auto_replenish && ' • Auto-restock'}
            </Text>
          </View>
          <View style={styles.itemActions}>
            <Pressable style={styles.useButton} onPress={() => handleUseItem(item)}>
              <Text style={styles.useButtonText}>-1</Text>
            </Pressable>
            <Pressable style={styles.deleteBtn} onPress={() => handleDeleteItem(item)}>
              <Text style={styles.deleteBtnText}>✕</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  // Build flat data with section headers
  const flatData: ({ type: 'header'; category: string } | { type: 'item'; item: PantryItem })[] = [];
  for (const [category, categoryItems] of Object.entries(groupedItems)) {
    flatData.push({ type: 'header', category });
    for (const item of categoryItems) {
      flatData.push({ type: 'item', item });
    }
  }

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
            <Text style={styles.title}>Pantry</Text>
            <Text style={styles.subtitle}>{items.length} items in your kitchen</Text>
          </View>
          <Pressable style={styles.addBtn} onPress={() => setShowAddModal(true)}>
            <LinearGradient
              colors={[COLORS.gold.light, COLORS.gold.base]}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.addBtnText}>+ Add</Text>
          </Pressable>
        </View>
      </View>

      {/* Expiring Items Alert */}
      {expiringItems.length > 0 && (
        <View style={styles.expiryAlert}>
          <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(212, 97, 76, 0.15)', 'rgba(212, 97, 76, 0.05)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.expiryAlertBorder} />
          <Text style={styles.expiryAlertText}>
            ⚠️ {expiringItems.length} item{expiringItems.length > 1 ? 's' : ''} expiring soon: {expiringItems.map(i => i.item_name).join(', ')}
          </Text>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <BlurView intensity={15} tint="light" style={StyleSheet.absoluteFill} />
          <TextInput
            style={styles.searchText}
            placeholder="Search pantry..."
            placeholderTextColor={COLORS.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Category Filter */}
      <FlatList
        horizontal
        data={[{ id: 'all', label: 'All', emoji: '🏠' }, ...PANTRY_CATEGORIES]}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContent}
        renderItem={({ item: cat }) => (
          <Pressable
            style={[styles.catChip, selectedCategory === cat.id && styles.catChipActive]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Text style={styles.catChipEmoji}>{cat.emoji}</Text>
            <Text style={[styles.catChipLabel, selectedCategory === cat.id && styles.catChipLabelActive]}>
              {cat.label}
            </Text>
          </Pressable>
        )}
      />

      {/* Items List */}
      {items.length === 0 && !isLoading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🥫</Text>
          <Text style={styles.emptyTitle}>Pantry is Empty</Text>
          <Text style={styles.emptyText}>
            Add items to track what's in your kitchen. Mira will use this to suggest recipes with what you already have!
          </Text>
        </View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(item, index) => item.type === 'header' ? `h-${item.category}` : `i-${item.item.id}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: row }) => {
            if (row.type === 'header') {
              const catInfo = PANTRY_CATEGORIES.find(c => c.id === row.category);
              return (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionEmoji}>{catInfo?.emoji || '📦'}</Text>
                  <Text style={styles.sectionTitle}>{catInfo?.label || row.category}</Text>
                  <Text style={styles.sectionCount}>{groupedItems[row.category]?.length || 0}</Text>
                </View>
              );
            }
            return renderItem({ item: row.item });
          }}
          ListFooterComponent={
            isLoading ? <ActivityIndicator color={COLORS.gold.base} style={{ padding: SPACING.lg }} /> : <View style={{ height: 120 }} />
          }
        />
      )}

      {/* Add Item Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.9)', 'rgba(250, 246, 240, 0.95)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add to Pantry</Text>

              <TextInput
                style={styles.input}
                placeholder="Item name"
                placeholderTextColor={COLORS.text.tertiary}
                value={newName}
                onChangeText={setNewName}
                autoFocus
              />

              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.chipRow}>
                {PANTRY_CATEGORIES.slice(0, 6).map((cat) => (
                  <Pressable
                    key={cat.id}
                    style={[styles.miniChip, newCategory === cat.id && styles.miniChipActive]}
                    onPress={() => setNewCategory(cat.id)}
                  >
                    <Text style={styles.miniChipText}>{cat.emoji} {cat.label}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Quantity</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="1"
                    placeholderTextColor={COLORS.text.tertiary}
                    value={newQuantity}
                    onChangeText={setNewQuantity}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                  <Text style={styles.fieldLabel}>Unit</Text>
                  <View style={styles.chipRow}>
                    {['item', 'lb', 'oz', 'bag', 'box', 'can'].map((u) => (
                      <Pressable
                        key={u}
                        style={[styles.tinyChip, newUnit === u && styles.tinyChipActive]}
                        onPress={() => setNewUnit(u)}
                      >
                        <Text style={[styles.tinyChipText, newUnit === u && styles.tinyChipTextActive]}>{u}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <Pressable
                style={[styles.toggleRow]}
                onPress={() => setNewAutoReplenish(!newAutoReplenish)}
              >
                <Text style={styles.toggleLabel}>Auto-restock when empty</Text>
                <View style={[styles.toggleDot, newAutoReplenish && styles.toggleDotActive]}>
                  {newAutoReplenish && <Text style={styles.toggleCheck}>✓</Text>}
                </View>
              </Pressable>

              <View style={styles.modalButtons}>
                <Pressable style={styles.cancelButton} onPress={() => { setShowAddModal(false); resetForm(); }}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.saveButton, isSaving && { opacity: 0.6 }]}
                  onPress={handleAddItem}
                  disabled={isSaving || !newName.trim()}
                >
                  <LinearGradient
                    colors={[COLORS.gold.light, COLORS.gold.base]}
                    style={StyleSheet.absoluteFill}
                  />
                  {isSaving ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Add Item</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.md },
  backButton: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.lg, overflow: 'hidden', marginBottom: SPACING.md,
  },
  backText: { fontSize: FONT_SIZES.md, color: COLORS.text.primary, fontWeight: '500' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: 'Georgia', fontSize: FONT_SIZES.title, fontWeight: '500', color: COLORS.text.primary, letterSpacing: -0.5 },
  subtitle: { fontSize: FONT_SIZES.sm, color: COLORS.gold.dark, fontStyle: 'italic', marginTop: 2 },
  addBtn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, overflow: 'hidden', ...SHADOWS.goldGlow },
  addBtnText: { fontSize: FONT_SIZES.sm, fontWeight: '700', color: '#FFF' },
  expiryAlert: {
    marginHorizontal: SPACING.lg, borderRadius: BORDER_RADIUS.lg, overflow: 'hidden',
    marginBottom: SPACING.sm, ...SHADOWS.subtle,
  },
  expiryAlertBorder: { ...StyleSheet.absoluteFillObject, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: 'rgba(212, 97, 76, 0.3)' },
  expiryAlertText: { padding: SPACING.sm + 2, fontSize: FONT_SIZES.sm, color: COLORS.error, fontWeight: '500' },
  searchRow: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm },
  searchInput: { borderRadius: BORDER_RADIUS.lg, overflow: 'hidden' },
  searchText: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONT_SIZES.md, color: COLORS.text.primary },
  categoryScroll: { maxHeight: 40, marginBottom: SPACING.sm },
  categoryContent: { paddingHorizontal: SPACING.lg, gap: SPACING.xs },
  catChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm + 2, paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full, backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderWidth: 0.5, borderColor: 'rgba(200, 200, 210, 0.3)', gap: 4,
  },
  catChipActive: { backgroundColor: `${COLORS.gold.base}20`, borderColor: COLORS.gold.base },
  catChipEmoji: { fontSize: 14 },
  catChipLabel: { fontSize: FONT_SIZES.xs, fontWeight: '500', color: COLORS.text.secondary },
  catChipLabelActive: { color: COLORS.gold.dark, fontWeight: '600' },
  listContent: { paddingHorizontal: SPACING.lg, paddingBottom: 120 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingVertical: SPACING.sm, marginTop: SPACING.xs },
  sectionEmoji: { fontSize: 18 },
  sectionTitle: { fontFamily: 'Georgia', fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.text.primary, flex: 1 },
  sectionCount: { fontSize: FONT_SIZES.xs, color: COLORS.text.tertiary, fontWeight: '600' },
  itemCard: { borderRadius: BORDER_RADIUS.lg, overflow: 'hidden', marginBottom: SPACING.xs, ...SHADOWS.subtle },
  itemCardExpiring: { borderWidth: 1, borderColor: 'rgba(212, 97, 76, 0.3)' },
  itemCardBorder: { ...StyleSheet.absoluteFillObject, borderRadius: BORDER_RADIUS.lg, borderWidth: 0.5, borderColor: 'rgba(255, 255, 255, 0.4)' },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.sm + 2, gap: SPACING.sm },
  itemEmoji: { fontSize: 22, width: 30, textAlign: 'center' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.text.primary },
  itemMeta: { fontSize: FONT_SIZES.xs, color: COLORS.text.secondary, marginTop: 2 },
  itemActions: { flexDirection: 'row', gap: SPACING.xs },
  useButton: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(200, 200, 210, 0.4)',
  },
  useButtonText: { fontSize: FONT_SIZES.sm, fontWeight: '700', color: COLORS.text.secondary },
  deleteBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(212, 97, 76, 0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 12, color: COLORS.error, fontWeight: '600' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl, paddingTop: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontFamily: 'Georgia', fontSize: FONT_SIZES.xl, fontWeight: '600', color: COLORS.text.primary, marginBottom: SPACING.sm },
  emptyText: { fontSize: FONT_SIZES.md, color: COLORS.text.secondary, textAlign: 'center', lineHeight: 22 },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContainer: { borderTopLeftRadius: BORDER_RADIUS.xxl, borderTopRightRadius: BORDER_RADIUS.xxl, overflow: 'hidden', maxHeight: '85%' },
  modalContent: { padding: SPACING.lg, paddingBottom: 40 },
  modalTitle: { fontFamily: 'Georgia', fontSize: FONT_SIZES.xl, fontWeight: '600', color: COLORS.text.primary, textAlign: 'center', marginBottom: SPACING.md },
  fieldLabel: { fontSize: FONT_SIZES.sm, fontWeight: '600', color: COLORS.text.secondary, marginBottom: SPACING.xs, marginTop: SPACING.sm },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)', borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.sm + 2, fontSize: FONT_SIZES.md, color: COLORS.text.primary,
    borderWidth: 0.5, borderColor: 'rgba(200, 200, 210, 0.4)',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  miniChip: {
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.5)', borderWidth: 0.5, borderColor: 'rgba(200, 200, 210, 0.3)',
  },
  miniChipActive: { backgroundColor: `${COLORS.gold.base}20`, borderColor: COLORS.gold.base },
  miniChipText: { fontSize: FONT_SIZES.xs, color: COLORS.text.secondary, fontWeight: '500' },
  tinyChip: {
    paddingHorizontal: SPACING.xs + 4, paddingVertical: 3, borderRadius: BORDER_RADIUS.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.4)', borderWidth: 0.5, borderColor: 'rgba(200, 200, 210, 0.3)',
  },
  tinyChipActive: { backgroundColor: `${COLORS.gold.base}20`, borderColor: COLORS.gold.base },
  tinyChipText: { fontSize: 11, color: COLORS.text.tertiary, fontWeight: '500' },
  tinyChipTextActive: { color: COLORS.gold.dark, fontWeight: '600' },
  row: { flexDirection: 'row' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.md, paddingVertical: SPACING.sm },
  toggleLabel: { fontSize: FONT_SIZES.sm, fontWeight: '500', color: COLORS.text.primary },
  toggleDot: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.platinum.base,
    alignItems: 'center', justifyContent: 'center',
  },
  toggleDotActive: { borderColor: COLORS.gold.base, backgroundColor: `${COLORS.gold.base}20` },
  toggleCheck: { fontSize: 14, color: COLORS.gold.dark, fontWeight: '700' },
  modalButtons: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  cancelButton: {
    flex: 1, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 0.5, borderColor: 'rgba(200, 200, 210, 0.4)',
  },
  cancelButtonText: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.text.secondary },
  saveButton: {
    flex: 1, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...SHADOWS.goldGlow,
  },
  saveButtonText: { fontSize: FONT_SIZES.md, fontWeight: '600', color: '#FFF' },
});
