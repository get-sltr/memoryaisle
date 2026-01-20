// Wallet - Loyalty cards, credits, promos, gift cards
// Store all rewards and payment methods

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

type TabType = 'cards' | 'credits' | 'promos' | 'giftcards';

interface LoyaltyCard {
  id: string;
  store_name: string;
  card_number: string;
  barcode?: string;
  color: string;
  points?: number;
}

interface Credit {
  id: string;
  name: string; // Maps from 'description' in DB
  amount: number;
  expires_at?: string;
  type?: string;
}

interface Promo {
  id: string;
  code: string;
  description: string;
  store?: string;
  expires_at?: string;
  used: boolean;
}

interface GiftCard {
  id: string;
  store_name: string;
  balance: number;
  card_number: string;
  pin?: string;
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

export default function WalletPage() {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useThemeStore();
  const router = useRouter();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('cards');
  const [loyaltyCards, setLoyaltyCards] = useState<LoyaltyCard[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [totalCredits, setTotalCredits] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalType, setAddModalType] = useState<'card' | 'credit' | 'promo' | 'giftcard'>('card');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<LoyaltyCard | null>(null);

  // Form fields for adding items
  const [formStoreName, setFormStoreName] = useState('');
  const [formCardNumber, setFormCardNumber] = useState('');
  const [formPoints, setFormPoints] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPin, setFormPin] = useState('');

  // Calculate total credits
  useEffect(() => {
    const total = credits.reduce((sum, c) => sum + c.amount, 0) +
      giftCards.reduce((sum, g) => sum + g.balance, 0);
    setTotalCredits(total);
  }, [credits, giftCards]);

  // Load data
  useEffect(() => {
    if (user?.id) {
      loadWalletData();
    }
  }, [user?.id]);

  const loadWalletData = async () => {
    if (!user?.id) return;

    // Load loyalty cards
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

    // Load credits
    const { data: creditsData } = await supabase
      .from('wallet_credits')
      .select('*')
      .eq('user_id', user.id);
    if (creditsData) {
      setCredits(creditsData.map(c => ({
        ...c,
        name: c.description || c.type || 'Credit',
      })));
    }

    // Load promos - get global promos and user-specific ones
    const { data: promosData } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('is_active', true)
      .or(`user_id.is.null,user_id.eq.${user.id}`);

    // Filter out already redeemed promos
    if (promosData) {
      const { data: redemptions } = await supabase
        .from('promo_redemptions')
        .select('promo_code_id')
        .eq('user_id', user.id);

      const redeemedIds = new Set((redemptions || []).map(r => r.promo_code_id));
      const availablePromos = promosData
        .filter(p => !redeemedIds.has(p.id))
        .map(p => ({ ...p, used: false }));
      setPromos(availablePromos);
    }

    // Load gift cards
    const { data: giftData } = await supabase
      .from('gift_cards')
      .select('*')
      .eq('user_id', user.id);
    if (giftData) {
      setGiftCards(giftData.map(g => ({
        ...g,
        balance: g.current_balance,
      })));
    }
  };

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'cards', label: 'Loyalty', icon: '💳' },
    { key: 'credits', label: 'Credits', icon: '💰' },
    { key: 'promos', label: 'Promos', icon: '🏷️' },
    { key: 'giftcards', label: 'Gift Cards', icon: '🎁' },
  ];

  const renderLoyaltyCard = ({ item }: { item: LoyaltyCard }) => (
    <Pressable
      style={styles.loyaltyCard}
      onPress={() => setSelectedCard(item)}
      onLongPress={() => handleDeleteItem('card', item.id)}
    >
      <LinearGradient
        colors={[item.color || STORE_COLORS.default, adjustColor(item.color || STORE_COLORS.default, -20)]}
        style={styles.loyaltyCardGradient}
      >
        <Text style={styles.loyaltyStoreName}>{item.store_name}</Text>
        <Text style={styles.loyaltyCardNumber}>{formatCardNumber(item.card_number || '')}</Text>
        {item.points !== undefined && (
          <Text style={styles.loyaltyPoints}>{item.points.toLocaleString()} points</Text>
        )}
        <Text style={styles.tapToScan}>Tap to show barcode</Text>
      </LinearGradient>
    </Pressable>
  );

  const renderCredit = ({ item }: { item: Credit }) => (
    <Pressable
      style={[styles.creditRow, { backgroundColor: cardBg }]}
      onLongPress={() => handleDeleteItem('credit', item.id)}
    >
      <View>
        <Text style={styles.creditName}>{item.name || 'Credit'}</Text>
        {item.expires_at && (
          <Text style={styles.creditExpiry}>
            Expires {new Date(item.expires_at).toLocaleDateString()}
          </Text>
        )}
      </View>
      <Text style={styles.creditAmount}>${item.amount.toFixed(2)}</Text>
    </Pressable>
  );

  const renderPromo = ({ item }: { item: Promo }) => (
    <Pressable
      style={[styles.promoCard, { backgroundColor: cardBg }]}
      onPress={() => {
        // Copy to clipboard functionality would go here
        Alert.alert('Promo Code', `Code: ${item.code}\n\n${item.description}`);
      }}
    >
      <View style={styles.promoIcon}>
        <Text style={styles.promoIconText}>%</Text>
      </View>
      <View style={styles.promoContent}>
        <Text style={styles.promoCode}>{item.code}</Text>
        <Text style={styles.promoDesc}>{item.description}</Text>
        {item.store && <Text style={styles.promoStore}>{item.store}</Text>}
      </View>
      <Text style={styles.promoArrow}>→</Text>
    </Pressable>
  );

  const renderGiftCard = ({ item }: { item: GiftCard }) => (
    <Pressable
      style={[styles.giftCardItem, { backgroundColor: cardBg }]}
      onLongPress={() => handleDeleteItem('giftcard', item.id)}
    >
      <View style={[styles.giftCardIcon, { backgroundColor: STORE_COLORS[item.store_name] || STORE_COLORS.default }]}>
        <Text style={styles.giftCardIconText}>🎁</Text>
      </View>
      <View style={styles.giftCardContent}>
        <Text style={styles.giftCardStore}>{item.store_name}</Text>
        <Text style={styles.giftCardNumber}>****{(item.card_number || '').slice(-4)}</Text>
      </View>
      <Text style={styles.giftCardBalance}>${item.balance.toFixed(2)}</Text>
    </Pressable>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'cards':
        return loyaltyCards.length > 0 ? (
          <FlatList
            data={loyaltyCards}
            renderItem={renderLoyaltyCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <EmptyState
            icon="💳"
            title="No Loyalty Cards"
            description="Add your store loyalty cards to earn and track rewards"
            onAdd={() => handleAddItem('card')}
          />
        );

      case 'credits':
        return credits.length > 0 ? (
          <FlatList
            data={credits}
            renderItem={renderCredit}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <EmptyState
            icon="💰"
            title="No Credits"
            description="Store credits and cashback will appear here"
            onAdd={() => handleAddItem('credit')}
          />
        );

      case 'promos':
        return promos.length > 0 ? (
          <FlatList
            data={promos}
            renderItem={renderPromo}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <EmptyState
            icon="🏷️"
            title="No Promotions"
            description="Save promo codes to use them later"
            onAdd={() => handleAddItem('promo')}
          />
        );

      case 'giftcards':
        return giftCards.length > 0 ? (
          <FlatList
            data={giftCards}
            renderItem={renderGiftCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <EmptyState
            icon="🎁"
            title="No Gift Cards"
            description="Add gift cards to track balances"
            onAdd={() => handleAddItem('giftcard')}
          />
        );
    }
  };

  const handleAddItem = (type: string) => {
    const modalType = type === 'card' ? 'card' : type === 'credit' ? 'credit' : type === 'promo' ? 'promo' : 'giftcard';
    setAddModalType(modalType);
    resetForm();
    setShowAddModal(true);
  };

  const resetForm = () => {
    setFormStoreName('');
    setFormCardNumber('');
    setFormPoints('');
    setFormAmount('');
    setFormCode('');
    setFormDescription('');
    setFormPin('');
  };

  const handleSaveItem = async () => {
    if (!user?.id) return;
    setIsLoading(true);

    try {
      switch (addModalType) {
        case 'card':
          if (!formStoreName || !formCardNumber) {
            Alert.alert('Missing Fields', 'Please enter store name and card number');
            setIsLoading(false);
            return;
          }
          const { error: cardError } = await supabase.from('loyalty_cards').insert({
            user_id: user.id,
            store_name: formStoreName,
            card_number: formCardNumber,
            points_balance: formPoints ? parseInt(formPoints, 10) : 0,
            color: STORE_COLORS[formStoreName] || STORE_COLORS.default,
          });
          if (cardError) throw cardError;
          break;

        case 'credit':
          if (!formDescription || !formAmount) {
            Alert.alert('Missing Fields', 'Please enter description and amount');
            setIsLoading(false);
            return;
          }
          const { error: creditError } = await supabase.from('wallet_credits').insert({
            user_id: user.id,
            amount: parseFloat(formAmount),
            type: 'purchased',
            description: formDescription,
          });
          if (creditError) throw creditError;
          break;

        case 'promo':
          if (!formCode || !formDescription) {
            Alert.alert('Missing Fields', 'Please enter promo code and description');
            setIsLoading(false);
            return;
          }
          const { error: promoError } = await supabase.from('promo_codes').insert({
            code: formCode.toUpperCase(),
            description: formDescription,
            discount_type: 'fixed',
            discount_value: 0,
            user_id: user.id,
            is_active: true,
          });
          if (promoError) throw promoError;
          break;

        case 'giftcard':
          if (!formStoreName || !formCardNumber || !formAmount) {
            Alert.alert('Missing Fields', 'Please enter store name, card number, and balance');
            setIsLoading(false);
            return;
          }
          const { error: giftError } = await supabase.from('gift_cards').insert({
            user_id: user.id,
            card_type: 'store',
            store_name: formStoreName,
            card_number: formCardNumber,
            pin: formPin || null,
            initial_balance: parseFloat(formAmount),
            current_balance: parseFloat(formAmount),
          });
          if (giftError) throw giftError;
          break;
      }

      setShowAddModal(false);
      loadWalletData();
      Alert.alert('Success', 'Item added successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add item');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteItem = async (type: string, id: string) => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const table = type === 'card' ? 'loyalty_cards' : type === 'credit' ? 'wallet_credits' : type === 'giftcard' ? 'gift_cards' : 'promo_codes';
              const { error } = await supabase.from(table).delete().eq('id', id);
              if (error) throw error;
              loadWalletData();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  // Theme-aware background for cards
  const cardBg = isDark ? colors.frost.bgHeavy : '#fff';
  const cardBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
  const textPrimary = colors.text.primary;
  const textSecondary = colors.text.secondary;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background.end }]}>
      <LinearGradient
        colors={['#1a472a', '#2d5a3d']}
        style={styles.headerGradient}
      >
        {/* Decorative elements like the screenshot */}
        <View style={styles.decorativeElements}>
          <Text style={styles.decorativeIcon1}>💰</Text>
          <Text style={styles.decorativeIcon2}>💳</Text>
          <Text style={styles.decorativeIcon3}>$</Text>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Wallet</Text>
          <Pressable onPress={() => handleAddItem(activeTab === 'cards' ? 'card' : activeTab)}>
            <Text style={styles.addText}>+ Add</Text>
          </Pressable>
        </View>

        {/* Total Credits Card */}
        <View style={[styles.creditsCard, { backgroundColor: cardBg }]}>
          <Text style={styles.creditsLabel}>Your credits</Text>
          <Text style={styles.creditsAmount}>${totalCredits.toFixed(2)}</Text>

          <View style={styles.creditsDivider} />

          <View style={styles.creditsRow}>
            <Text style={styles.creditsRowLabel}>Available Balance</Text>
            <Text style={styles.creditsRowValue}>${totalCredits.toFixed(2)}</Text>
          </View>

          <View style={styles.creditsButtons}>
            <Pressable style={styles.creditsButton}>
              <Text style={styles.creditsButtonText}>View balances</Text>
            </Pressable>
            <Pressable style={styles.creditsButton}>
              <Text style={styles.creditsButtonText}>Add</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      {/* Promotions Banner */}
      <Pressable style={[styles.promoBanner, { backgroundColor: cardBg }]} onPress={() => setActiveTab('promos')}>
        <View style={styles.promoIconBanner}>
          <Text style={styles.promoIconBannerText}>%</Text>
        </View>
        <View style={styles.promoBannerContent}>
          <Text style={styles.promoBannerTitle}>{promos.length} promotions available</Text>
          <Text style={styles.promoBannerSubtitle}>View promotions</Text>
        </View>
        <Text style={styles.promoBannerArrow}>→</Text>
      </Pressable>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: cardBg }]}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      <View style={[styles.content, { paddingBottom: insets.bottom }]}>
        {renderContent()}
      </View>

      {/* Add Item Modal */}
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
            <Text style={styles.modalTitle}>
              Add {addModalType === 'card' ? 'Loyalty Card' : addModalType === 'credit' ? 'Credit' : addModalType === 'promo' ? 'Promo Code' : 'Gift Card'}
            </Text>
            <Pressable onPress={handleSaveItem} disabled={isLoading}>
              <Text style={[styles.modalSave, isLoading && styles.modalSaveDisabled]}>
                {isLoading ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            {(addModalType === 'card' || addModalType === 'giftcard') && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Store Name</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: cardBg, color: textPrimary }]}
                  value={formStoreName}
                  onChangeText={setFormStoreName}
                  placeholder="e.g. Walmart, Target, Costco"
                  placeholderTextColor={textSecondary}
                />
              </View>
            )}

            {(addModalType === 'card' || addModalType === 'giftcard') && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Card Number</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: cardBg, color: textPrimary }]}
                  value={formCardNumber}
                  onChangeText={setFormCardNumber}
                  placeholder="Enter card number"
                  placeholderTextColor={textSecondary}
                  keyboardType="number-pad"
                />
              </View>
            )}

            {addModalType === 'card' && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Points Balance (optional)</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: cardBg, color: textPrimary }]}
                  value={formPoints}
                  onChangeText={setFormPoints}
                  placeholder="0"
                  placeholderTextColor={textSecondary}
                  keyboardType="number-pad"
                />
              </View>
            )}

            {addModalType === 'promo' && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Promo Code</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: cardBg, color: textPrimary }]}
                  value={formCode}
                  onChangeText={setFormCode}
                  placeholder="Enter promo code"
                  placeholderTextColor={textSecondary}
                  autoCapitalize="characters"
                />
              </View>
            )}

            {(addModalType === 'credit' || addModalType === 'promo') && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: cardBg, color: textPrimary }]}
                  value={formDescription}
                  onChangeText={setFormDescription}
                  placeholder={addModalType === 'promo' ? 'e.g. 20% off your next order' : 'e.g. Store credit from return'}
                  placeholderTextColor={textSecondary}
                />
              </View>
            )}

            {(addModalType === 'credit' || addModalType === 'giftcard') && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{addModalType === 'giftcard' ? 'Balance' : 'Amount'}</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: cardBg, color: textPrimary }]}
                  value={formAmount}
                  onChangeText={setFormAmount}
                  placeholder="0.00"
                  placeholderTextColor={textSecondary}
                  keyboardType="decimal-pad"
                />
              </View>
            )}

            {addModalType === 'giftcard' && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>PIN (optional)</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: cardBg, color: textPrimary }]}
                  value={formPin}
                  onChangeText={setFormPin}
                  placeholder="Enter PIN if required"
                  placeholderTextColor={textSecondary}
                  keyboardType="number-pad"
                  secureTextEntry
                />
              </View>
            )}
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

// Empty state component
function EmptyState({
  icon,
  title,
  description,
  onAdd
}: {
  icon: string;
  title: string;
  description: string;
  onAdd: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      <Pressable style={styles.emptyButton} onPress={onAdd}>
        <Text style={styles.emptyButtonText}>+ Add</Text>
      </Pressable>
    </View>
  );
}

// Helper functions
function formatCardNumber(number: string): string {
  return number.replace(/(.{4})/g, '$1 ').trim();
}

function adjustColor(color: string, amount: number): string {
  // Simple color adjustment for gradient
  return color;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.end,
  },
  headerGradient: {
    paddingBottom: SPACING.xl,
  },
  decorativeElements: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  decorativeIcon1: {
    position: 'absolute',
    top: 20,
    right: 30,
    fontSize: 40,
    opacity: 0.2,
  },
  decorativeIcon2: {
    position: 'absolute',
    top: 80,
    left: 20,
    fontSize: 30,
    opacity: 0.15,
  },
  decorativeIcon3: {
    position: 'absolute',
    bottom: 60,
    right: 60,
    fontSize: 60,
    opacity: 0.1,
    color: '#fff',
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 24,
    color: '#fff',
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: '#fff',
  },
  addText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: '#fff',
  },

  // Credits Card
  creditsCard: {
    backgroundColor: '#fff',
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginTop: SPACING.md,
  },
  creditsLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  creditsAmount: {
    fontSize: 48,
    fontWeight: '800',
    color: COLORS.text.primary,
    textAlign: 'center',
    marginVertical: SPACING.sm,
  },
  creditsDivider: {
    height: 1,
    backgroundColor: COLORS.platinum.light,
    marginVertical: SPACING.md,
  },
  creditsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  creditsRowLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  creditsRowValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
  },
  creditsButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  creditsButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.platinum.light,
    alignItems: 'center',
  },
  creditsButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
  },

  // Promo Banner
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  promoIconBanner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e8f5e9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoIconBannerText: {
    fontSize: 24,
    color: '#4caf50',
  },
  promoBannerContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  promoBannerTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  promoBannerSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
  },
  promoBannerArrow: {
    fontSize: 20,
    color: COLORS.text.secondary,
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    backgroundColor: '#fff',
    borderRadius: BORDER_RADIUS.lg,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: 4,
  },
  tabActive: {
    backgroundColor: COLORS.gold.light + '30',
  },
  tabIcon: {
    fontSize: 16,
  },
  tabLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  tabLabelActive: {
    color: COLORS.gold.dark,
  },

  // Content
  content: {
    flex: 1,
    marginTop: SPACING.md,
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

  // Credit Row
  creditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  creditName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  creditExpiry: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  creditAmount: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.success,
  },

  // Promo Card
  promoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  promoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8f5e9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoIconText: {
    fontSize: 20,
    color: '#4caf50',
  },
  promoContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  promoCode: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  promoDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
  },
  promoStore: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gold.dark,
    marginTop: 2,
  },
  promoArrow: {
    fontSize: 16,
    color: COLORS.text.secondary,
  },

  // Gift Card
  giftCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  giftCardIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftCardIconText: {
    fontSize: 24,
  },
  giftCardContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  giftCardStore: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  giftCardNumber: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
  },
  giftCardBalance: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
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
    color: COLORS.text.primary,
  },
  emptyDescription: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
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
    backgroundColor: COLORS.background.end,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.platinum.light,
    backgroundColor: '#fff',
  },
  modalCancel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
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
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  formInput: {
    backgroundColor: '#fff',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
    borderWidth: 1,
    borderColor: COLORS.platinum.light,
  },

  // Tap to scan hint
  tapToScan: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.7)',
    marginTop: SPACING.sm,
    fontStyle: 'italic',
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
