// My Store Cards - Loyalty cards only
// Store rewards and membership cards

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import QRCode from 'react-native-qrcode-svg';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../src/constants/theme';
import { supabase } from '../../src/services/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { useThemeStore } from '../../src/stores/themeStore';

interface LoyaltyCard {
  id: string;
  store_name: string;
  card_number: string;
  barcode?: string;
  color: string;
  points?: number;
}

const STORE_COLORS: Record<string, string> = {
  'Walmart': '#0071ce',
  'Target': '#cc0000',
  'Costco': '#e31837',
  'Kroger': '#0066b3',
  'Ralphs': '#e31837',
  'Safeway': '#ed1c24',
  'Vons': '#ed1c24',
  'Whole Foods': '#00674b',
  'Trader Joes': '#c5282a',
  'CVS': '#cc0000',
  'Walgreens': '#e31837',
  'Amazon': '#ff9900',
  'Starbucks': '#00704a',
  'default': COLORS.gold.base,
};

export default function StoreCardsPage() {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useThemeStore();
  const router = useRouter();
  const { user } = useAuthStore();
  const [loyaltyCards, setLoyaltyCards] = useState<LoyaltyCard[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<LoyaltyCard | null>(null);

  // Form fields for adding cards
  const [formStoreName, setFormStoreName] = useState('');
  const [formCardNumber, setFormCardNumber] = useState('');
  const [formPoints, setFormPoints] = useState('');

  // Load data
  useEffect(() => {
    if (user?.id) {
      loadCards();
    }
  }, [user?.id]);

  const loadCards = async () => {
    if (!user?.id) return;

    const { data: cardsData } = await supabase
      .from('loyalty_cards')
      .select('*')
      .eq('user_id', user.id);
    if (cardsData) {
      setLoyaltyCards(cardsData.map(c => ({
        ...c,
        points: c.points_balance,
      })));
    }
  };

  const resetForm = () => {
    setFormStoreName('');
    setFormCardNumber('');
    setFormPoints('');
  };

  const handleSaveCard = async () => {
    if (!user?.id) return;
    if (!formStoreName || !formCardNumber) {
      Alert.alert('Missing Fields', 'Please enter store name and card number');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from('loyalty_cards').insert({
        user_id: user.id,
        store_name: formStoreName,
        card_number: formCardNumber,
        points_balance: formPoints ? parseInt(formPoints, 10) : 0,
        color: STORE_COLORS[formStoreName] || STORE_COLORS.default,
      });
      if (error) throw error;

      setShowAddModal(false);
      resetForm();
      loadCards();
      Alert.alert('Success', 'Card added successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add card');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCard = async (id: string) => {
    Alert.alert(
      'Delete Card',
      'Are you sure you want to delete this card?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('loyalty_cards').delete().eq('id', id);
              if (error) throw error;
              loadCards();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete card');
            }
          },
        },
      ]
    );
  };

  const cardBg = isDark ? colors.frost.bgHeavy : '#fff';
  const textPrimary = colors.text.primary;
  const textSecondary = colors.text.secondary;

  const renderLoyaltyCard = ({ item }: { item: LoyaltyCard }) => (
    <Pressable
      style={styles.loyaltyCard}
      onPress={() => setSelectedCard(item)}
      onLongPress={() => handleDeleteCard(item.id)}
    >
      <LinearGradient
        colors={[item.color || STORE_COLORS.default, adjustColor(item.color || STORE_COLORS.default, -20)]}
        style={styles.loyaltyCardGradient}
      >
        <Text style={styles.loyaltyStoreName}>{item.store_name}</Text>
        <Text style={styles.loyaltyCardNumber}>{formatCardNumber(item.card_number || '')}</Text>
        {item.points !== undefined && item.points > 0 && (
          <Text style={styles.loyaltyPoints}>{item.points.toLocaleString()} points</Text>
        )}
        <Text style={styles.tapToScan}>Tap to show barcode</Text>
      </LinearGradient>
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background.end }]}>
      <LinearGradient
        colors={[colors.background.start, colors.background.end]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: textPrimary }]}>←</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>My Store Cards</Text>
        <Pressable onPress={() => { resetForm(); setShowAddModal(true); }}>
          <Text style={styles.addText}>+ Add</Text>
        </Pressable>
      </View>

      {/* Content */}
      <View style={[styles.content, { paddingBottom: insets.bottom }]}>
        {loyaltyCards.length > 0 ? (
          <FlatList
            data={loyaltyCards}
            renderItem={renderLoyaltyCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💳</Text>
            <Text style={[styles.emptyTitle, { color: textPrimary }]}>No Store Cards</Text>
            <Text style={[styles.emptyDescription, { color: textSecondary }]}>
              Add your store loyalty and rewards cards to access them quickly
            </Text>
            <Pressable style={styles.emptyButton} onPress={() => { resetForm(); setShowAddModal(true); }}>
              <Text style={styles.emptyButtonText}>+ Add Card</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Add Card Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalContainer, { backgroundColor: colors.background.end }]}
        >
          <View style={[styles.modalHeader, { backgroundColor: cardBg }]}>
            <Pressable onPress={() => setShowAddModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: textPrimary }]}>Add Store Card</Text>
            <Pressable onPress={handleSaveCard} disabled={isLoading}>
              <Text style={[styles.modalSave, isLoading && styles.modalSaveDisabled]}>
                {isLoading ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: textPrimary }]}>Store Name</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: cardBg, color: textPrimary }]}
                value={formStoreName}
                onChangeText={setFormStoreName}
                placeholder="e.g. Walmart, Target, Costco"
                placeholderTextColor={textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: textPrimary }]}>Card Number</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: cardBg, color: textPrimary }]}
                value={formCardNumber}
                onChangeText={setFormCardNumber}
                placeholder="Enter card number or barcode"
                placeholderTextColor={textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: textPrimary }]}>Points Balance (optional)</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: cardBg, color: textPrimary }]}
                value={formPoints}
                onChangeText={setFormPoints}
                placeholder="0"
                placeholderTextColor={textSecondary}
                keyboardType="number-pad"
              />
            </View>

            <Text style={[styles.hint, { color: textSecondary }]}>
              Long-press a card to delete it
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Barcode Modal */}
      <Modal
        visible={!!selectedCard}
        animationType="fade"
        transparent
        onRequestClose={() => setSelectedCard(null)}
      >
        <Pressable
          style={styles.barcodeOverlay}
          onPress={() => setSelectedCard(null)}
        >
          <View style={styles.barcodeModal}>
            <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.95)', 'rgba(250, 248, 245, 0.9)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.barcodeContent}>
              <Text style={styles.barcodeStoreName}>{selectedCard?.store_name}</Text>
              <View style={styles.barcodeContainer}>
                {selectedCard?.card_number && (
                  <QRCode
                    value={selectedCard.card_number}
                    size={200}
                    backgroundColor="white"
                    color="#000"
                  />
                )}
              </View>
              <Text style={styles.barcodeNumber}>{selectedCard?.card_number}</Text>
              <Text style={styles.barcodeHint}>Show this to the cashier to scan</Text>
              <Pressable
                style={styles.barcodeCloseButton}
                onPress={() => setSelectedCard(null)}
              >
                <Text style={styles.barcodeCloseText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// Helper functions
function formatCardNumber(number: string): string {
  return number.replace(/(.{4})/g, '$1 ').trim();
}

function adjustColor(color: string, _amount: number): string {
  return color;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.end,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 24,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
  },
  addText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gold.dark,
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },

  // Loyalty Card
  loyaltyCard: {
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  loyaltyCardGradient: {
    padding: SPACING.lg,
    minHeight: 120,
  },
  loyaltyStoreName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: '#fff',
  },
  loyaltyCardNumber: {
    fontSize: FONT_SIZES.md,
    color: 'rgba(255,255,255,0.8)',
    marginTop: SPACING.xs,
    letterSpacing: 2,
  },
  loyaltyPoints: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.9)',
    marginTop: SPACING.md,
  },
  tapToScan: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.7)',
    marginTop: SPACING.sm,
    fontStyle: 'italic',
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
  },
  emptyDescription: {
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  emptyButton: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.gold.base,
    borderRadius: BORDER_RADIUS.lg,
  },
  emptyButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: '#fff',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.platinum.light,
  },
  modalCancel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
  },
  modalSave: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gold.base,
  },
  modalSaveDisabled: {
    opacity: 0.5,
  },
  modalContent: {
    flex: 1,
    padding: SPACING.lg,
  },
  formGroup: {
    marginBottom: SPACING.lg,
  },
  formLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  formInput: {
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.md,
    borderWidth: 1,
    borderColor: COLORS.platinum.light,
  },
  hint: {
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
    marginTop: SPACING.md,
  },

  // Barcode Modal
  barcodeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  barcodeModal: {
    width: '85%',
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    ...SHADOWS.glassElevated,
  },
  barcodeContent: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  barcodeStoreName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.lg,
  },
  barcodeContainer: {
    padding: SPACING.lg,
    backgroundColor: '#fff',
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
  },
  barcodeNumber: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
    letterSpacing: 2,
    marginBottom: SPACING.xs,
  },
  barcodeHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.lg,
  },
  barcodeCloseButton: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.gold.base,
    borderRadius: BORDER_RADIUS.lg,
  },
  barcodeCloseText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: '#fff',
  },
});
