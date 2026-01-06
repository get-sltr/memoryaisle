import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Share,
} from 'react-native';
import { BlurView } from 'expo-blur';
import QRCode from 'react-native-qrcode-svg';
import { router } from 'expo-router';
import { GroceryList } from '../../src/components/GroceryList';
import { useAuthStore } from '../../src/stores/authStore';
import { signOut } from '../../src/services/auth';
import {
  getActiveList,
  getListItems,
  addItem,
  completeItem,
  subscribeToList,
} from '../../src/services/lists';
import { COLORS, FONTS, FONT_SIZES, SPACING } from '../../src/constants/theme';
import type { ListItem, GroceryList as GroceryListType } from '../../src/types';

export default function MainList() {
  const { user, household, setUser, setHousehold } = useAuthStore();
  const [list, setList] = useState<GroceryListType | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);

  const handleShare = async () => {
    if (!household?.invite_code) return;
    try {
      await Share.share({
        message: `Join my household "${household.name}" on Memoryaisle!\n\nInvite code: ${household.invite_code}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  // Load list and items
  useEffect(() => {
    async function loadList() {
      if (!household) return;

      setLoading(true);
      const activeList = await getActiveList(household.id);
      setList(activeList);

      if (activeList) {
        const listItems = await getListItems(activeList.id);
        setItems(listItems);
      }
      setLoading(false);
    }

    loadList();
  }, [household]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!list) return;

    const unsubscribe = subscribeToList(
      list.id,
      // On insert - add if not already present and not completed
      (newItem) => {
        if (!newItem.is_completed) {
          setItems((current) => {
            // Check if item already exists
            if (current.some((item) => item.id === newItem.id)) {
              return current;
            }
            return [...current, newItem];
          });
        }
      },
      // On update - remove if completed, update otherwise
      (updatedItem) => {
        if (updatedItem.is_completed) {
          setItems((current) => current.filter((item) => item.id !== updatedItem.id));
        } else {
          setItems((current) =>
            current.map((item) => (item.id === updatedItem.id ? updatedItem : item))
          );
        }
      },
      // On delete
      (itemId) => {
        setItems((current) => current.filter((item) => item.id !== itemId));
      }
    );

    return unsubscribe;
  }, [list]);

  const handleAddItem = async () => {
    if (!newItemName.trim() || !list) return;

    const item = await addItem(list.id, newItemName.trim());
    if (item) {
      // Don't add here - realtime will handle it
      setNewItemName('');
    }
  };

  const handleCompleteItem = useCallback(async (itemId: string) => {
    // Optimistically remove from UI
    setItems((current) => current.filter((item) => item.id !== itemId));

    // Update in database
    const success = await completeItem(itemId);
    if (!success) {
      // Reload on failure
      if (list) {
        const listItems = await getListItems(list.id);
        setItems(listItems);
      }
    }
  }, [list]);

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    setHousehold(null);
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>MemoryAisle</Text>
            <Text style={styles.household}>{household?.name}</Text>
          </View>
          <View style={styles.headerButtons}>
            {household?.invite_code && (
              <Pressable onPress={() => setShowQR(true)} style={styles.shareButton}>
                <Text style={styles.shareIcon}>👥</Text>
              </Pressable>
            )}
            <Pressable onPress={handleSignOut} style={styles.signOutButton}>
              <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
          </View>
        </View>

        {/* QR Code Modal */}
        <Modal
          visible={showQR}
          transparent
          animationType="fade"
          onRequestClose={() => setShowQR(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowQR(false)}>
            <BlurView intensity={90} tint="dark" style={styles.modalBlur}>
              <Pressable style={styles.qrCard} onPress={(e) => e.stopPropagation()}>
                <Text style={styles.qrTitle}>Invite Family</Text>
                <Text style={styles.qrSubtitle}>Scan to join {household?.name}</Text>

                <View style={styles.qrContainer}>
                  {household?.invite_code && (
                    <QRCode
                      value={`memoryaisle://join/${household.invite_code}`}
                      size={200}
                      color={COLORS.ink}
                      backgroundColor="white"
                    />
                  )}
                </View>

                <Text style={styles.qrCode}>{household?.invite_code}</Text>

                <Pressable style={styles.shareButtonLarge} onPress={handleShare}>
                  <Text style={styles.shareButtonText}>Share Invite</Text>
                </Pressable>

                <Pressable style={styles.closeButton} onPress={() => setShowQR(false)}>
                  <Text style={styles.closeButtonText}>Done</Text>
                </Pressable>
              </Pressable>
            </BlurView>
          </Pressable>
        </Modal>

        {/* List */}
        <View style={styles.listContainer}>
          {loading ? (
            <Text style={styles.loadingText}>Loading...</Text>
          ) : (
            <GroceryList items={items} onItemComplete={handleCompleteItem} />
          )}
        </View>

        {/* Add Item Input Bar - Frosted Glass */}
        <BlurView intensity={80} tint="light" style={styles.inputBar}>
          {/* Camera Button */}
          <Pressable
            style={styles.cameraButton}
            onPress={() => {
              Alert.alert(
                'Scan Receipt',
                'Receipt scanning coming soon!',
                [{ text: 'OK' }]
              );
            }}
          >
            <Text style={styles.cameraIcon}>📷</Text>
          </Pressable>

          {/* Text Input */}
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Add an item..."
              placeholderTextColor="rgba(0,0,0,0.4)"
              value={newItemName}
              onChangeText={setNewItemName}
              onSubmitEditing={handleAddItem}
              returnKeyType="done"
            />
            {/* Mic Button - Voice to Text */}
            <Pressable
              style={styles.micButton}
              onPress={() => {
                Alert.alert(
                  'Voice to Text',
                  'Dictate items directly - coming soon!',
                  [{ text: 'OK' }]
                );
              }}
            >
              <Text style={styles.micIcon}>🎤</Text>
            </Pressable>
          </View>

          {/* AI Chat Button - Large circular */}
          <Pressable
            style={styles.aiButton}
            onPress={() => {
              Alert.alert(
                'AI Assistant',
                'Chat with AI to add items:\n\n"I need stuff for tacos"\n"What do I usually get on Mondays?"',
                [{ text: 'OK' }]
              );
            }}
          >
            <Text style={styles.aiIcon}>〰️</Text>
          </Pressable>
        </BlurView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paper,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.paperDark,
  },
  title: {
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.xxl,
    color: COLORS.ink,
    letterSpacing: -1,
  },
  household: {
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.inkLight,
    fontStyle: 'italic',
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.paperDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareIcon: {
    fontSize: 18,
  },
  signOutButton: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  signOutText: {
    fontFamily: FONTS.sans.medium,
    fontSize: FONT_SIZES.sm,
    color: COLORS.inkLight,
  },
  // QR Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBlur: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: SPACING.xl,
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  qrTitle: {
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.xl,
    color: COLORS.ink,
    marginBottom: SPACING.xs,
  },
  qrSubtitle: {
    fontFamily: FONTS.sans.regular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.inkLight,
    marginBottom: SPACING.lg,
  },
  qrContainer: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.paperDark,
  },
  qrCode: {
    fontFamily: FONTS.sans.medium,
    fontSize: FONT_SIZES.lg,
    color: COLORS.inkLight,
    letterSpacing: 4,
    marginTop: SPACING.md,
    textTransform: 'uppercase',
  },
  shareButtonLarge: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxl,
    borderRadius: 12,
    marginTop: SPACING.lg,
    width: '100%',
  },
  shareButtonText: {
    fontFamily: FONTS.sans.medium,
    fontSize: FONT_SIZES.md,
    color: COLORS.white,
    textAlign: 'center',
  },
  closeButton: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  closeButtonText: {
    fontFamily: FONTS.sans.medium,
    fontSize: FONT_SIZES.md,
    color: COLORS.inkLight,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  loadingText: {
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.md,
    color: COLORS.inkLight,
    textAlign: 'center',
    marginTop: SPACING.xxl,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.3)',
  },
  cameraButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.xs,
  },
  cameraIcon: {
    fontSize: 22,
    opacity: 0.6,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 24,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  input: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontFamily: FONTS.serif.regular,
    color: COLORS.ink,
    paddingVertical: 2,
  },
  micButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micIcon: {
    fontSize: 18,
    opacity: 0.5,
  },
  aiButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  aiIcon: {
    fontSize: 24,
  },
});
