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
import { MiraSuggestions } from '../../src/components/MiraSuggestions';
import { MiraChat } from '../../src/components/MiraChat';
import { StoreArrivalBanner } from '../../src/components/StoreArrivalBanner';
import { MissingItemsAlert } from '../../src/components/MissingItemsAlert';
import { useAuthStore } from '../../src/stores/authStore';
import { geofenceService, SavedStore } from '../../src/services/geofence';
import { receiptService } from '../../src/services/receipt';
import { signOut } from '../../src/services/auth';
import {
  getActiveList,
  getListItems,
  addItem,
  completeItem,
  subscribeToList,
} from '../../src/services/lists';
import { mira, getRandomResponse } from '../../src/services/mira';
import type { MiraSuggestion, ConversationTurn } from '../../src/services/mira';
import { wakeWord } from '../../src/services/wakeWord';
import { COLORS, FONTS, FONT_SIZES, SPACING } from '../../src/constants/theme';
import { useThemeStore } from '../../src/stores/themeStore';
import type { ListItem, GroceryList as GroceryListType } from '../../src/types';

export default function MainList() {
  const { user, household, setUser, setHousehold } = useAuthStore();
  const { colors, isDark, toggleTheme, loadTheme } = useThemeStore();
  const [list, setList] = useState<GroceryListType | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [miraStatus, setMiraStatus] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<MiraSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [wakeWordActive, setWakeWordActive] = useState(false);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [arrivedStore, setArrivedStore] = useState<SavedStore | null>(null);
  const [showSaveStore, setShowSaveStore] = useState(false);
  const [storeNameInput, setStoreNameInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [missingItems, setMissingItems] = useState<string[]>([]);

  // Load theme preference
  useEffect(() => {
    loadTheme();
  }, []);

  // Geofence monitoring - auto-surface list at store
  useEffect(() => {
    const startGeofence = async () => {
      await geofenceService.startMonitoring(
        // On arrival
        (store) => {
          setArrivedStore(store);
          mira.speak(`You're at ${store.name}. Here's your list!`);
          setTimeout(() => setArrivedStore(null), 10000);
        },
        // On departure - remind to scan receipt
        (store) => {
          if (items.length > 0) {
            mira.speak("Wait! Scan your receipt before you leave to check if you forgot anything.");
            setMiraStatus("Scan receipt before leaving!");
            // Keep the reminder visible longer
            setTimeout(() => setMiraStatus(null), 8000);
          }
        }
      );
    };

    startGeofence();

    return () => {
      geofenceService.stopMonitoring();
    };
  }, [items.length]);

  // Wake word detection - "Hey Mira"
  useEffect(() => {
    const startWakeWord = async () => {
      const started = await wakeWord.start(
        // On wake word detected
        async () => {
          setWakeWordActive(true);

          // Pause wake word while Mira listens
          await wakeWord.pause();

          // Greet user with TTS
          setMiraStatus("What can I get for you?");
          await mira.greet(); // Speaks greeting

          // Start Mira recording after greeting
          const recordingStarted = await mira.startListening();
          if (recordingStarted) {
            setIsListening(true);
            // Auto-stop after 5 seconds of listening
            setTimeout(async () => {
              if (mira.getIsRecording()) {
                await handleMiraResponse();
              }
            }, 5000);
          } else {
            setMiraStatus("Couldn't start listening");
            await mira.speak("Sorry, I couldn't start listening.");
            setTimeout(() => setMiraStatus(null), 2000);
            await wakeWord.resume();
            setWakeWordActive(false);
          }
        },
        // On error
        (error) => {
          console.error('Wake word error:', error);
        }
      );

      if (started) {
        console.log(`Say "${wakeWord.getWakeWordName()}" to activate!`);
      }
    };

    startWakeWord();

    // Cleanup on unmount
    return () => {
      wakeWord.stop();
      mira.stopSpeaking();
    };
  }, []);

  // Handle Mira response after wake word activation
  const handleMiraResponse = async () => {
    if (!list) return;

    setIsListening(false);
    setIsThinking(true);
    setMiraStatus(getRandomResponse('thinking'));

    const context = {
      currentListItems: items.map((i) => i.name),
    };

    // Use the new conversational method that speaks the response
    setIsSpeaking(true);
    const result = await mira.stopListeningAndRespond(context);
    setIsThinking(false);
    setIsSpeaking(false);

    // Update conversation display
    setConversation(mira.getConversationHistory());

    if (result.success) {
      // Handle based on intent
      if (result.intent === 'add_items' && result.items.length > 0) {
        for (const item of result.items) {
          await addItem(list.id, item.name, item.quantity, 'voice');
        }
      } else if (result.intent === 'get_suggestions') {
        loadSuggestions();
      }

      setMiraStatus(result.response);

      // Keep status visible longer for conversation
      setTimeout(() => setMiraStatus(null), 3000);
    } else {
      setMiraStatus(getRandomResponse('notUnderstood'));
      await mira.speak(getRandomResponse('notUnderstood'));
      setTimeout(() => setMiraStatus(null), 2500);
    }

    // Resume wake word detection
    await wakeWord.resume();
    setWakeWordActive(false);
  };

  // Load suggestions on mount and when household changes
  const loadSuggestions = useCallback(async () => {
    if (!household?.id) return;

    setSuggestionsLoading(true);
    try {
      const result = await mira.getSuggestions(household.id);
      if (result.success) {
        // Filter out dismissed suggestions
        const filtered = result.suggestions.filter(
          (s) => !dismissedSuggestions.has(s.itemName)
        );
        setSuggestions(filtered);
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setSuggestionsLoading(false);
    }
  }, [household?.id, dismissedSuggestions]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  // Handle adding a suggested item
  const handleAddSuggestion = async (itemName: string) => {
    if (!list) return;

    // Remove from suggestions immediately
    setSuggestions((current) => current.filter((s) => s.itemName !== itemName));

    // Add to list
    await addItem(list.id, itemName, 1, 'ai_suggested');
  };

  // Handle dismissing a suggestion
  const handleDismissSuggestion = (itemName: string) => {
    setDismissedSuggestions((current) => new Set(current).add(itemName));
    setSuggestions((current) => current.filter((s) => s.itemName !== itemName));
  };

  // Handle Mira AI button
  const handleMira = async () => {
    if (!list) return;

    if (isListening) {
      // Stop listening and process with GPT-4
      setMiraStatus(getRandomResponse('thinking'));

      // Get current list context
      const context = {
        currentListItems: items.map((i) => i.name),
      };

      const result = await mira.stopListening(context);

      if (result.success) {
        // Handle based on intent
        switch (result.intent) {
          case 'add_items':
            if (result.items.length > 0) {
              // Add all items with quantities
              for (const item of result.items) {
                await addItem(list.id, item.name, item.quantity, 'voice');
              }
            }
            break;

          case 'get_suggestions':
            // Refresh suggestions
            loadSuggestions();
            break;

          case 'check_item':
            // For now, just show the response
            break;

          default:
            break;
        }

        // Show Mira's response
        setMiraStatus(result.response);
        setTimeout(() => setMiraStatus(null), 2500);
      } else {
        setMiraStatus(getRandomResponse('notUnderstood'));
        setTimeout(() => setMiraStatus(null), 2000);
      }
      setIsListening(false);
    } else {
      // Start listening
      const started = await mira.startListening();
      if (started) {
        setIsListening(true);
        setMiraStatus(getRandomResponse('greeting'));
      } else {
        Alert.alert('Microphone Access', 'Please allow microphone access to use Mira.');
      }
    }
  };

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

  // Receipt scanning - check for missing items
  const handleScanReceipt = async () => {
    if (items.length === 0) {
      Alert.alert('Empty List', 'Your list is empty! Nothing to check.');
      return;
    }

    setIsScanning(true);
    setMiraStatus('Taking photo...');

    try {
      const receiptImage = await receiptService.captureReceipt();

      if (!receiptImage) {
        setIsScanning(false);
        setMiraStatus(null);
        return;
      }

      setMiraStatus('Scanning receipt...');

      const listItemNames = items.map(i => i.name);
      const result = await receiptService.scanAndCompare(receiptImage, listItemNames);

      setIsScanning(false);

      if (result.success) {
        if (result.missingItems.length > 0) {
          setMissingItems(result.missingItems);
          // Mira warns about missing items
          await mira.speak(result.message);
          setMiraStatus(result.message);
        } else {
          // All good!
          await mira.speak(result.message);
          setMiraStatus(result.message);
          setTimeout(() => setMiraStatus(null), 3000);
        }
      } else {
        await mira.speak(result.message);
        setMiraStatus(result.message);
        setTimeout(() => setMiraStatus(null), 3000);
      }
    } catch (error) {
      console.error('Receipt scan error:', error);
      setIsScanning(false);
      const errorMessage = 'Something went wrong scanning the receipt. Please try again.';
      setMiraStatus(errorMessage);
      Alert.alert(
        'Scan Failed',
        errorMessage,
        [{ text: 'OK', onPress: () => setMiraStatus(null) }]
      );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.paperDark }]}>
          <View>
            <Text style={[styles.title, { color: colors.ink }]}>MemoryAisle</Text>
            <Text style={[styles.household, { color: colors.inkLight }]}>{household?.name}</Text>
          </View>
          <View style={styles.headerButtons}>
            {/* Dark Mode Toggle */}
            <Pressable onPress={toggleTheme} style={[styles.themeButton, { backgroundColor: colors.paperDark }]}>
              <Text style={styles.themeIcon}>{isDark ? '☀️' : '🌙'}</Text>
            </Pressable>
            {household?.invite_code && (
              <Pressable onPress={() => setShowQR(true)} style={[styles.shareButton, { backgroundColor: colors.paperDark }]}>
                <Text style={styles.shareIcon}>👥</Text>
              </Pressable>
            )}
            <Pressable onPress={handleSignOut} style={styles.signOutButton}>
              <Text style={[styles.signOutText, { color: colors.inkLight }]}>Sign Out</Text>
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

        {/* Save Store Modal */}
        <Modal
          visible={showSaveStore}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSaveStore(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowSaveStore(false)}>
            <BlurView intensity={90} tint="dark" style={styles.modalBlur}>
              <Pressable style={styles.qrCard} onPress={(e) => e.stopPropagation()}>
                <Text style={styles.qrTitle}>Save Store</Text>
                <Text style={styles.qrSubtitle}>Your list will auto-surface when you arrive here</Text>

                <TextInput
                  style={styles.storeInput}
                  placeholder="Store name (e.g., Ralph's)"
                  placeholderTextColor={COLORS.inkLight}
                  value={storeNameInput}
                  onChangeText={setStoreNameInput}
                  autoFocus
                />

                <Pressable
                  style={[styles.shareButtonLarge, !storeNameInput.trim() && styles.buttonDisabled]}
                  onPress={async () => {
                    if (!storeNameInput.trim()) return;
                    const store = await geofenceService.saveCurrentLocationAsStore(storeNameInput.trim());
                    if (store) {
                      setShowSaveStore(false);
                      setStoreNameInput('');
                      Alert.alert('Saved!', `${store.name} saved. Your list will pop up when you arrive.`);
                    } else {
                      Alert.alert('Error', 'Could not save location. Check location permissions.');
                    }
                  }}
                >
                  <Text style={styles.shareButtonText}>Save Location</Text>
                </Pressable>

                <Pressable style={styles.closeButton} onPress={() => setShowSaveStore(false)}>
                  <Text style={styles.closeButtonText}>Cancel</Text>
                </Pressable>
              </Pressable>
            </BlurView>
          </Pressable>
        </Modal>

        {/* Store Arrival Banner */}
        {arrivedStore && (
          <StoreArrivalBanner
            store={arrivedStore}
            onDismiss={() => setArrivedStore(null)}
            colors={colors}
          />
        )}

        {/* Mira Suggestions */}
        {!loading && (suggestions.length > 0 || suggestionsLoading) && (
          <MiraSuggestions
            suggestions={suggestions}
            onAddItem={handleAddSuggestion}
            onDismiss={handleDismissSuggestion}
            onRefresh={loadSuggestions}
            isLoading={suggestionsLoading}
            colors={colors}
          />
        )}

        {/* Mira Chat Bubbles */}
        {(conversation.length > 0 || isListening || isThinking || isSpeaking) && (
          <MiraChat
            conversation={conversation}
            isListening={isListening}
            isThinking={isThinking}
            isSpeaking={isSpeaking}
            colors={colors}
          />
        )}

        {/* List */}
        <View style={styles.listContainer}>
          {loading ? (
            <Text style={[styles.loadingText, { color: colors.inkLight }]}>Loading...</Text>
          ) : (
            <GroceryList items={items} onItemComplete={handleCompleteItem} colors={colors} />
          )}
        </View>

        {/* Add Item Input Bar - Frosted Glass */}
        <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={styles.inputBar}>
          {/* Camera Button - with store save option */}
          <Pressable
            style={styles.cameraButton}
            onPress={() => {
              Alert.alert(
                'Quick Actions',
                'What would you like to do?',
                [
                  {
                    text: 'Save This Store',
                    onPress: () => setShowSaveStore(true),
                  },
                  {
                    text: 'Scan Receipt',
                    onPress: handleScanReceipt,
                  },
                  { text: 'Cancel', style: 'cancel' },
                ]
              );
            }}
          >
            <Text style={styles.cameraIcon}>📷</Text>
          </Pressable>

          {/* Text Input */}
          <View style={[styles.inputWrapper, isDark && styles.inputWrapperDark]}>
            <TextInput
              style={[styles.input, { color: isDark ? '#FFF' : colors.ink }]}
              placeholder="Add an item..."
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'}
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

          {/* Mira AI Button - Large circular */}
          <Pressable
            style={[
              styles.aiButton,
              isListening && styles.aiButtonListening,
            ]}
            onPress={handleMira}
          >
            <Text style={styles.aiIcon}>{isListening ? '🎙️' : '✨'}</Text>
          </Pressable>
        </BlurView>

        {/* Mira Status */}
        {miraStatus && (
          <View style={[styles.miraStatus, { backgroundColor: colors.paperDark }]}>
            <Text style={[styles.miraStatusText, { color: colors.ink }]}>
              {isListening ? '🎙️ ' : '✨ '}Mira: {miraStatus}
            </Text>
          </View>
        )}

        {/* Wake Word Indicator */}
        {!miraStatus && !isListening && (
          <View style={styles.wakeWordIndicator}>
            <Text style={[styles.wakeWordText, { color: colors.inkFaded }]}>
              Say "{wakeWord.getWakeWordName()}" to add items
            </Text>
          </View>
        )}

        {/* Missing Items Alert */}
        {missingItems.length > 0 && (
          <MissingItemsAlert
            items={missingItems}
            onDismiss={() => setMissingItems([])}
            colors={colors}
          />
        )}
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
  themeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeIcon: {
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
  inputWrapperDark: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.2)',
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
  aiButtonListening: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  aiIcon: {
    fontSize: 24,
  },
  miraStatus: {
    position: 'absolute',
    bottom: 100,
    left: SPACING.lg,
    right: SPACING.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  miraStatusText: {
    fontFamily: FONTS.sans.medium,
    fontSize: FONT_SIZES.md,
  },
  wakeWordIndicator: {
    position: 'absolute',
    bottom: 100,
    left: SPACING.lg,
    right: SPACING.lg,
    alignItems: 'center',
  },
  wakeWordText: {
    fontFamily: FONTS.sans.regular,
    fontSize: FONT_SIZES.sm,
    fontStyle: 'italic',
  },
  storeInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.paperDark,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.md,
    color: COLORS.ink,
    marginBottom: SPACING.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
