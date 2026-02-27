import { useEffect, useState, useCallback, useMemo, memo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  SectionList,
  ScrollView,
  Modal,
  Share,
  Alert,
  Image,
  LayoutAnimation,
  UIManager,
  Platform,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { StoreArrivalBanner } from '../../src/components/StoreArrivalBanner';
import { MissingItemsAlert } from '../../src/components/MissingItemsAlert';
import { useAuthStore } from '../../src/stores/authStore';
import { geofenceService, SavedStore } from '../../src/services/geofence';
import { signOut } from '../../src/services/auth';
import { router as appRouter } from 'expo-router';
import {
  getActiveList,
  getAllLists,
  createList,
  archiveList,
  getListItems,
  getCompletedCount,
  addItem,
  completeItem,
  deleteItem,
} from '../../src/services/lists';
import { mira } from '../../src/services/mira';
import { useWakeWord } from '../../src/services/wakeWord';
import { useRealtimeSync } from '../../src/hooks/useRealtimeSync';
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  NAV_HEIGHT,
  HIG,
} from '../../src/constants/theme';
import { useThemeStore } from '../../src/stores/themeStore';
import {
  VoiceIcon,
  FamilyIcon,
  SunIcon,
  MoonIcon,
} from '../../src/components/icons';
import {
  FamilyGlassIcon,
  LocationGlassIcon,
  LogoutGlassIcon,
  GlassIconWrapper,
  CategoryIcons,
  AllergyBadgeIcon,
  ListGlassIcon,
  PlanGlassIcon,
  FavoritesGlassIcon,
  RecipeGlassIcon,
  ProfileGlassIcon,
  FamilyHomeGlassIcon,
  CalendarGlassIcon,
  TripGlassIcon,
} from '../../src/components/GlassIcons';
import {
  ALLERGENS,
  checkSelfAllergen,
  formatSelfAllergyAlert,
} from '../../src/utils/allergenDetection';
import {
  groupItemsByCategory,
  getCategoryInfo,
  CATEGORY_ORDER,
  preloadKeywords,
  invalidateKeywordCache,
  type GroceryCategory,
} from '../../src/utils/categoryDetection';
import type { ListItem, GroceryList as GroceryListType } from '../../src/types';
import { notificationService } from '../../src/services/notifications';
import { logger } from '../../src/utils/logger';

export default function MainList() {
  const { user, household, setUser, setHousehold, isGuest } = useAuthStore();
  const { colors, isDark, toggleTheme, loadTheme } = useThemeStore();
  const insets = useSafeAreaInsets();

  const [list, setList] = useState<GroceryListType | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [miraStatus, setMiraStatus] = useState<string | null>(null);
  const [arrivedStore, setArrivedStore] = useState<SavedStore | null>(null);
  const [showSaveStore, setShowSaveStore] = useState(false);
  const [storeNameInput, setStoreNameInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [missingItems, setMissingItems] = useState<string[]>([]);
  const [isDictating, setIsDictating] = useState(false);
  const [isProcessingDictation, setIsProcessingDictation] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [keywordsReady, setKeywordsReady] = useState(false);
  const [allLists, setAllLists] = useState<GroceryListType[]>([]);
  const [showListPicker, setShowListPicker] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingPage, setOnboardingPage] = useState(0);

  // Wake word detection
  const { startWakeWord, stopWakeWord, pauseWakeWord, resumeWakeWord } = useWakeWord();

  // Guard for account-required actions - prompts guest users to sign up
  const requireAuth = (action: () => void) => {
    if (isGuest) {
      Alert.alert(
        'Account Required',
        'Create a free account to use this feature.',
        [
          { text: 'Not Now', style: 'cancel' },
          {
            text: 'Sign Up',
            onPress: () => appRouter.replace('/(auth)/landing'),
          },
        ]
      );
      return;
    }
    action();
  };

  // Toggle category collapse with animation
  const toggleCategory = useCallback((categoryId: string) => {
    LayoutAnimation.configureNext({
      duration: 300,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });

    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  // Stats
  const totalItems = items.length;
  const [completedItems, setCompletedItems] = useState(0);
  const familyMembers = household?.members?.length || household?.member_count || 1;

  // Memoized section data for SectionList
  const sections = useMemo(() => {
    const groupedItems = groupItemsByCategory(items);
    return CATEGORY_ORDER
      .filter((categoryId) => {
        const categoryItems = groupedItems.get(categoryId);
        return categoryItems && categoryItems.length > 0;
      })
      .map((categoryId) => {
        const categoryItems = groupedItems.get(categoryId)!;
        const categoryInfo = getCategoryInfo(categoryId);
        return {
          categoryId,
          categoryInfo,
          data: categoryItems,
        };
      });
  }, [items, keywordsReady]);

  // Load theme preference and preload category keywords
  useEffect(() => {
    loadTheme();
    preloadKeywords().then(() => {
      setKeywordsReady(true);
    });
    AsyncStorage.getItem('hasSeenOnboarding').then((value) => {
      if (!value) setShowOnboarding(true);
    });
  }, []);

  // Refs for wake word callback to avoid re-creating the listener
  const listRef = useRef(list);
  const isDictatingRef = useRef(isDictating);
  const isProcessingRef = useRef(isProcessingDictation);
  useEffect(() => { listRef.current = list; }, [list]);
  useEffect(() => { isDictatingRef.current = isDictating; }, [isDictating]);
  useEffect(() => { isProcessingRef.current = isProcessingDictation; }, [isProcessingDictation]);

  // Wake word detection — auto-start dictation when "Hey Mira" detected
  useEffect(() => {
    startWakeWord(async () => {
      if (!listRef.current || isDictatingRef.current || isProcessingRef.current) return;
      pauseWakeWord();
      const started = await mira.startListening();
      if (started) {
        setIsDictating(true);
        setMiraStatus('Listening... tap mic when done');
      } else {
        resumeWakeWord();
      }
    });
    return () => stopWakeWord();
  }, []);

  // Pause wake word during dictation, resume after
  useEffect(() => {
    if (isDictating || isProcessingDictation) {
      pauseWakeWord();
    } else {
      resumeWakeWord();
    }
  }, [isDictating, isProcessingDictation]);

  // Geofence monitoring
  useEffect(() => {
    if (!household?.id) return;

    const startGeofence = async () => {
      await geofenceService.startMonitoring(
        household.id,
        (store) => {
          setArrivedStore(store);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Notifications.scheduleNotificationAsync({ content: { title: "You're at " + store.name, body: "Your shopping list is ready!", sound: true }, trigger: null });
          notificationService.notifyStoreNearby(store.name, items.length);
          mira.speak(`You're at ${store.name}. Here's your list!`);
          setTimeout(() => setArrivedStore(null), 10000);
        },
        (store) => {
          if (items.length > 0) {
            mira.speak("Wait! Scan your receipt before you leave to check if you forgot anything.");
            setMiraStatus("Scan receipt before leaving!");
            setTimeout(() => setMiraStatus(null), 8000);
          }
        }
      );
    };

    startGeofence();
    return () => geofenceService.stopMonitoring();
  }, [household?.id, items.length]);

  // Cleanup Mira on unmount
  useEffect(() => {
    return () => {
      mira.stopSpeaking();
    };
  }, []);

  // Dictation
  const handleDictate = async () => {
    if (!list) return;
    if (isDictating) {
      setIsDictating(false);
      setMiraStatus('Processing...');
      const result = await mira.quickDictateAndRespond();
      if (result.success && result.items.length > 0) {
        for (const item of result.items) {
          await addItem(list.id, item.name, undefined, item.quantity || 1, 'voice');
        }
        setMiraStatus(result.message);
      } else {
        setMiraStatus(result.message || "Didn't catch that");
      }
      setTimeout(() => setMiraStatus(null), 2500);
    } else {
      const started = await mira.startListening();
      if (started) {
        setIsDictating(true);
        setMiraStatus('Listening... tap again when done');
      } else {
        Alert.alert('Microphone Access', 'Please allow microphone access to dictate items.');
      }
    }
  };

  const handleShare = async () => {
    if (!household?.invite_code) return;
    try {
      await Share.share({
        message: `Join my household "${household.name}" on MemoryAisle!\n\nInvite code: ${household.invite_code}`,
      });
    } catch (error) {
      logger.error('Share error:', error);
    }
  };

  // Load list helper
  const reloadListData = useCallback(async (listId: string) => {
    const listItems = await getListItems(listId);
    setItems(listItems);
    const doneCount = await getCompletedCount(listId);
    setCompletedItems(doneCount);
  }, []);

  // Initial Data Load
  useEffect(() => {
    async function loadList() {
      if (!household) return;
      setLoading(true);
      const activeList = await getActiveList(household.id);
      setList(activeList);
      if (activeList) {
        await reloadListData(activeList.id);
      }
      // Load all lists for the picker
      const lists = await getAllLists(household.id);
      setAllLists(lists);
      setLoading(false);
    }
    loadList();
  }, [household, reloadListData]);

  // Switch to a different list
  const switchToList = useCallback(async (targetList: GroceryListType) => {
    setShowListPicker(false);
    setLoading(true);
    setList(targetList);
    await reloadListData(targetList.id);
    setLoading(false);
  }, [reloadListData]);

  // 🪄 NEW REALTIME SYNC HOOK 🪄
  useRealtimeSync<ListItem>('list_items', (event) => {
    // Only react to events if we have an active list, and the event belongs to this list
    if (!list || event.record?.list_id !== list.id) return;
    
    // Fetch the freshest data from the server rather than trying to manually patch arrays
    reloadListData(list.id);
  });

  // Create a new list
  const handleCreateList = useCallback(() => {
    if (!household) return;
    Alert.prompt(
      'New List',
      'Enter a name for your new list:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async (name?: string) => {
            if (!name?.trim()) return;
            const newList = await createList(household.id, name.trim());
            if (newList) {
              setAllLists(prev => [newList, ...prev]);
              switchToList(newList);
            } else {
              Alert.alert('Error', 'Could not create list. Please try again.');
            }
          },
        },
      ],
      'plain-text',
      '',
      'default'
    );
  }, [household, switchToList]);

  // Archive the current list
  const handleArchiveList = useCallback(async () => {
    if (!list || !household) return;
    if (allLists.length <= 1) {
      Alert.alert('Cannot Archive', 'You need at least one list.');
      return;
    }
    Alert.alert(
      'Archive List',
      `Archive "${list.name}"? You can still find it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            const success = await archiveList(list.id);
            if (success) {
              const remaining = allLists.filter(l => l.id !== list.id);
              setAllLists(remaining);
              if (remaining.length > 0) {
                switchToList(remaining[0]);
              }
            } else {
              Alert.alert('Error', 'Could not archive list.');
            }
          },
        },
      ]
    );
  }, [list, household, allLists, switchToList]);

  const handleAddItem = async (confirmedAllergens?: string[], skipDuplicateCheck?: boolean) => {
    if (isGuest) {
      requireAuth(() => {});
      return;
    }
    if (!newItemName.trim() || !list) return;

    const itemName = newItemName.trim();
    // Clear input instantly for UI responsiveness
    setNewItemName('');

    // Check if user has allergies and if item contains their allergen
    const userAllergies = user?.allergies || [];
    const allergenMatch = checkSelfAllergen(itemName, userAllergies);

    // If allergens detected and not yet confirmed, show alert
    if (allergenMatch && !confirmedAllergens) {
      const alertInfo = formatSelfAllergyAlert(itemName, allergenMatch);
      Alert.alert(
        alertInfo.title,
        alertInfo.message,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add Anyway',
            style: 'destructive',
            onPress: () => handleAddItem(allergenMatch.map(a => a.allergen), true),
          },
        ]
      );
      // Restore input text if they canceled
      setNewItemName(itemName);
      return;
    }

    // Check for duplicates
    if (!skipDuplicateCheck) {
      const duplicate = items.find(
        (item) => item.name.toLowerCase().trim() === itemName.toLowerCase()
      );
      if (duplicate) {
        Alert.alert(
          'Already on your list',
          `"${itemName}" is already on your list. Add anyway?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Add Anyway',
              onPress: () => handleAddItem(confirmedAllergens, true),
            },
          ]
        );
        setNewItemName(itemName);
        return;
      }
    }

    // Add item with allergy record if user confirmed despite allergy
    const allergyRecord = confirmedAllergens && confirmedAllergens.length > 0
      ? {
        addedByName: user?.name || 'You',
        allergens: confirmedAllergens,
        confirmedAt: new Date().toISOString(),
      }
      : undefined;

    const result = await addItem(list.id, itemName, allergyRecord);
    if (!result) {
      // Revert if network fails
      setNewItemName(itemName);
      Alert.alert('Error', 'Could not add item. Please try again.');
    }
  };

  const handleCompleteItem = useCallback(async (itemId: string) => {
    // Optimistic UI update
    setItems((current) => current.filter((item) => item.id !== itemId));
    setCompletedItems((prev) => prev + 1);
    
    const success = await completeItem(itemId);
    
    if (!success && list) {
      // Revert if network fails
      reloadListData(list.id);
      Alert.alert('Error', 'Could not complete item. Please try again.');
    }
  }, [list, reloadListData]);

  const handleDeleteItem = useCallback((item: ListItem) => {
    Alert.alert(
      'Delete Item',
      `Remove "${item.name}" from your list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Optimistic UI update
            setItems((current) => current.filter((i) => i.id !== item.id));
            
            const success = await deleteItem(item.id);
            if (!success && list) {
              // Revert if network fails
              reloadListData(list.id);
              Alert.alert('Error', 'Failed to delete item. Please try again.');
            }
          },
        },
      ]
    );
  }, [list, reloadListData]);

  const handleSignOut = async () => {
    if (isGuest) {
      useAuthStore.getState().signOut();
      appRouter.replace('/');
      return;
    }
    await signOut();
    setUser(null);
    setHousehold(null);
    appRouter.replace('/');
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenWrapper withBottomPadding={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.titleContainer}>
              <Text style={styles.title}>MemoryAisle</Text>
              <Image
                source={require('../../assets/theapp.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.headerActions}>
              {/* Menu Button */}
              <Pressable onPress={() => setShowMenu(true)} style={styles.iconButton}>
                <BlurView intensity={20} tint="light" style={styles.iconButtonBlur} />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.7)', 'rgba(245, 245, 250, 0.5)']}
                  style={styles.iconButtonGradient}
                />
                <View style={styles.iconButtonBorder} />
                <Text style={styles.menuIcon}>{'\u2630'}</Text>
              </Pressable>
            </View>
          </View>
          {/* List Switcher Pill */}
          <Pressable
            style={styles.storeSlot}
            onPress={() => setShowListPicker(true)}
          >
            <BlurView intensity={15} tint="light" style={styles.storeSlotBlur} />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.4)', 'rgba(250, 252, 255, 0.25)']}
              style={styles.storeSlotGradient}
            />
            <View style={styles.storeSlotBorder} />
            <ListGlassIcon size={14} color={COLORS.gold.dark} />
            <Text style={styles.storeSlotText}>
              {list?.name || 'Shopping List'}
            </Text>
            {allLists.length > 1 && (
              <Text style={styles.storeSlotArrow}>{'\u203A'}</Text>
            )}
          </Pressable>

          {/* Store Location Slot */}
          <Pressable
            style={styles.storeSlot}
            onPress={() => {
              setShowMenu(false);
              setTimeout(() => setShowSaveStore(true), 200);
            }}
          >
            <BlurView intensity={15} tint="light" style={styles.storeSlotBlur} />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.4)', 'rgba(250, 252, 255, 0.25)']}
              style={styles.storeSlotGradient}
            />
            <View style={styles.storeSlotBorder} />
            <LocationGlassIcon size={14} color={COLORS.gold.dark} />
            <Text style={styles.storeSlotText}>
              {arrivedStore ? arrivedStore.name : household?.name || 'Set your store'}
            </Text>
            <Text style={styles.storeSlotArrow}>{'\u203A'}</Text>
          </Pressable>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard value={totalItems} label="Items" />
          <StatCard value={completedItems} label="Done" isGold />
          <StatCard value={familyMembers} label="Family" />
        </View>

        {/* Menu Modal - Full Screen Frosted Glass */}
        <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
          <View style={styles.menuModalContainer}>
            {/* Full screen background gradient */}
            <LinearGradient
              colors={[
                COLORS.background.start,
                COLORS.background.mid1,
                COLORS.background.mid2,
                COLORS.background.end,
              ]}
              locations={[0, 0.4, 0.7, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.3, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Ambient light effects */}
            <View style={styles.menuAmbientLight} pointerEvents="none">
              <LinearGradient
                colors={['rgba(255,250,240,0.6)', 'transparent']}
                style={styles.menuAmbientTopLeft}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <LinearGradient
                colors={['rgba(212, 165, 71, 0.15)', 'transparent']}
                style={styles.menuAmbientGold}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
              />
            </View>

            {/* Header */}
            <View style={[styles.menuHeader, { paddingTop: insets.top + SPACING.md }]}>
              <Text style={styles.menuTitle}>Menu</Text>
              <Pressable style={styles.menuCloseX} onPress={() => setShowMenu(false)}>
                <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.7)', 'rgba(255, 255, 255, 0.4)']}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.menuCloseXBorder} />
                <Text style={styles.menuCloseXText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.menuScrollView}
              contentContainerStyle={[styles.menuScrollContent, { paddingBottom: insets.bottom + 40 }]}
              showsVerticalScrollIndicator={false}
            >

              {/* Main Navigation */}
              <Pressable
                style={styles.menuItem}
                onPress={() => setShowMenu(false)}
              >
                <BlurView intensity={25} tint="light" style={styles.menuItemBlur} />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.65)', 'rgba(250, 248, 245, 0.45)', 'rgba(245, 242, 235, 0.35)']}
                  style={styles.menuItemGradient}
                />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.4)', 'transparent']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.6 }}
                  style={styles.menuItemShine}
                />
                <View style={styles.menuItemBorder} />
                <View style={styles.menuItemInner}>
                  <GlassIconWrapper size={40} variant="gold">
                    <ListGlassIcon size={22} />
                  </GlassIconWrapper>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>Shopping List</Text>
                    <Text style={styles.menuItemSubtext}>Your current list</Text>
                  </View>
                </View>
              </Pressable>

              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  router.push('/mealplan');
                }}
              >
                <BlurView intensity={25} tint="light" style={styles.menuItemBlur} />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.65)', 'rgba(250, 248, 245, 0.45)', 'rgba(245, 242, 235, 0.35)']}
                  style={styles.menuItemGradient}
                />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.4)', 'transparent']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.6 }}
                  style={styles.menuItemShine}
                />
                <View style={styles.menuItemBorder} />
                <View style={styles.menuItemInner}>
                  <GlassIconWrapper size={40} variant="gold">
                    <PlanGlassIcon size={22} />
                  </GlassIconWrapper>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>Meal Plan</Text>
                    <Text style={styles.menuItemSubtext}>Plan your week</Text>
                  </View>
                </View>
              </Pressable>

              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  router.push('/favorites');
                }}
              >
                <BlurView intensity={25} tint="light" style={styles.menuItemBlur} />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.65)', 'rgba(250, 248, 245, 0.45)', 'rgba(245, 242, 235, 0.35)']}
                  style={styles.menuItemGradient}
                />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.4)', 'transparent']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.6 }}
                  style={styles.menuItemShine}
                />
                <View style={styles.menuItemBorder} />
                <View style={styles.menuItemInner}>
                  <GlassIconWrapper size={40} variant="gold">
                    <FavoritesGlassIcon size={22} />
                  </GlassIconWrapper>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>Favorites</Text>
                    <Text style={styles.menuItemSubtext}>Your go-to items</Text>
                  </View>
                </View>
              </Pressable>

              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  router.push('/recipes');
                }}
              >
                <BlurView intensity={25} tint="light" style={styles.menuItemBlur} />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.65)', 'rgba(250, 248, 245, 0.45)', 'rgba(245, 242, 235, 0.35)']}
                  style={styles.menuItemGradient}
                />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.4)', 'transparent']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.6 }}
                  style={styles.menuItemShine}
                />
                <View style={styles.menuItemBorder} />
                <View style={styles.menuItemInner}>
                  <GlassIconWrapper size={40} variant="gold">
                    <RecipeGlassIcon size={22} />
                  </GlassIconWrapper>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>Recipes</Text>
                    <Text style={styles.menuItemSubtext}>Family favorites</Text>
                  </View>
                </View>
              </Pressable>

              <View style={styles.menuDivider} />

              {/* Profile Section */}
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  router.push('/profile');
                }}
              >
                <BlurView intensity={25} tint="light" style={styles.menuItemBlur} />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.65)', 'rgba(250, 248, 245, 0.45)', 'rgba(245, 242, 235, 0.35)']}
                  style={styles.menuItemGradient}
                />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.4)', 'transparent']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.6 }}
                  style={styles.menuItemShine}
                />
                <View style={styles.menuItemBorder} />
                <View style={styles.menuItemInner}>
                  <GlassIconWrapper size={40} variant="gold">
                    <ProfileGlassIcon size={22} />
                  </GlassIconWrapper>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>My Profile</Text>
                    <Text style={styles.menuItemSubtext}>Your preferences & allergies</Text>
                  </View>
                </View>
              </Pressable>

              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  router.push('/family');
                }}
              >
                <BlurView intensity={25} tint="light" style={styles.menuItemBlur} />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.65)', 'rgba(250, 248, 245, 0.45)', 'rgba(245, 242, 235, 0.35)']}
                  style={styles.menuItemGradient}
                />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.4)', 'transparent']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.6 }}
                  style={styles.menuItemShine}
                />
                <View style={styles.menuItemBorder} />
                <View style={styles.menuItemInner}>
                  <GlassIconWrapper size={40} variant="gold">
                    <FamilyHomeGlassIcon size={22} />
                  </GlassIconWrapper>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>Our Family</Text>
                    <Text style={styles.menuItemSubtext}>Shared moments & traditions</Text>
                  </View>
                </View>
              </Pressable>

              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  router.push('/calendar');
                }}
              >
                <BlurView intensity={25} tint="light" style={styles.menuItemBlur} />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.65)', 'rgba(250, 248, 245, 0.45)', 'rgba(245, 242, 235, 0.35)']}
                  style={styles.menuItemGradient}
                />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.4)', 'transparent']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.6 }}
                  style={styles.menuItemShine}
                />
                <View style={styles.menuItemBorder} />
                <View style={styles.menuItemInner}>
                  <GlassIconWrapper size={40} variant="gold">
                    <CalendarGlassIcon size={22} />
                  </GlassIconWrapper>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>Smart Calendar</Text>
                    <Text style={styles.menuItemSubtext}>Holidays & traditions</Text>
                  </View>
                </View>
              </Pressable>

              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  router.push('/trips');
                }}
              >
                <BlurView intensity={25} tint="light" style={styles.menuItemBlur} />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.65)', 'rgba(250, 248, 245, 0.45)', 'rgba(245, 242, 235, 0.35)']}
                  style={styles.menuItemGradient}
                />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.4)', 'transparent']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.6 }}
                  style={styles.menuItemShine}
                />
                <View style={styles.menuItemBorder} />
                <View style={styles.menuItemInner}>
                  <GlassIconWrapper size={40} variant="gold">
                    <TripGlassIcon size={22} />
                  </GlassIconWrapper>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>Trip Planner</Text>
                    <Text style={styles.menuItemSubtext}>Camping, road trips & more</Text>
                  </View>
                </View>
              </Pressable>

              <View style={styles.menuDivider} />

              {/* Household Management */}
              {household?.invite_code && (
                <Pressable
                  style={styles.menuItem}
                  onPress={() => {
                    setShowMenu(false);
                    setTimeout(() => setShowQR(true), 200);
                  }}
                >
                  <BlurView intensity={25} tint="light" style={styles.menuItemBlur} />
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.65)', 'rgba(250, 248, 245, 0.45)', 'rgba(245, 242, 235, 0.35)']}
                    style={styles.menuItemGradient}
                  />
                  <View style={styles.menuItemBorder} />
                  <View style={styles.menuItemInner}>
                    <GlassIconWrapper size={40} variant="gold">
                      <FamilyGlassIcon size={22} />
                    </GlassIconWrapper>
                    <View style={styles.menuItemContent}>
                      <Text style={styles.menuItemText}>Invite Family</Text>
                      <Text style={styles.menuItemSubtext}>Share your household</Text>
                    </View>
                  </View>
                </Pressable>
              )}

              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  setTimeout(() => setShowSaveStore(true), 200);
                }}
              >
                <BlurView intensity={25} tint="light" style={styles.menuItemBlur} />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.65)', 'rgba(250, 248, 245, 0.45)', 'rgba(245, 242, 235, 0.35)']}
                  style={styles.menuItemGradient}
                />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.4)', 'transparent']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.6 }}
                  style={styles.menuItemShine}
                />
                <View style={styles.menuItemBorder} />
                <View style={styles.menuItemInner}>
                  <GlassIconWrapper size={40} variant="gold">
                    <LocationGlassIcon size={22} />
                  </GlassIconWrapper>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>Save Store Location</Text>
                    <Text style={styles.menuItemSubtext}>Auto-surface your list</Text>
                  </View>
                </View>
              </Pressable>

              {/* Theme Toggle */}
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  toggleTheme();
                }}
              >
                <BlurView intensity={25} tint="light" style={styles.menuItemBlur} />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.65)', 'rgba(250, 248, 245, 0.45)', 'rgba(245, 242, 235, 0.35)']}
                  style={styles.menuItemGradient}
                />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.4)', 'transparent']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.6 }}
                  style={styles.menuItemShine}
                />
                <View style={styles.menuItemBorder} />
                <View style={styles.menuItemInner}>
                  <GlassIconWrapper size={40} variant="gold">
                    {isDark ? <SunIcon size={22} /> : <MoonIcon size={22} />}
                  </GlassIconWrapper>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>{isDark ? 'Light Mode' : 'Dark Mode'}</Text>
                    <Text style={styles.menuItemSubtext}>Switch appearance</Text>
                  </View>
                </View>
              </Pressable>

              <View style={styles.menuDivider} />

              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  if (isGuest) {
                    // Guest -> go to sign in
                    setTimeout(() => {
                      useAuthStore.getState().signOut();
                      appRouter.replace('/(auth)/landing');
                    }, 200);
                  } else {
                    // Authenticated -> confirm sign out
                    setTimeout(() => {
                      Alert.alert(
                        'Sign Out',
                        'Are you sure you want to sign out?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Sign Out', style: 'destructive', onPress: handleSignOut },
                        ]
                      );
                    }, 200);
                  }
                }}
              >
                <BlurView intensity={25} tint="light" style={styles.menuItemBlur} />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.65)', 'rgba(250, 248, 245, 0.45)', 'rgba(245, 242, 235, 0.35)']}
                  style={styles.menuItemGradient}
                />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.4)', 'transparent']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.6 }}
                  style={styles.menuItemShine}
                />
                <View style={styles.menuItemBorder} />
                <View style={styles.menuItemInner}>
                  <GlassIconWrapper size={40} variant="subtle">
                    <LogoutGlassIcon size={22} />
                  </GlassIconWrapper>
                  <View style={styles.menuItemContent}>
                    <Text style={[styles.menuItemText, isGuest ? {} : styles.menuItemTextDanger]}>
                      {isGuest ? 'Sign In / Sign Up' : 'Sign Out'}
                    </Text>
                    <Text style={styles.menuItemSubtext}>
                      {isGuest ? 'Create an account for full access' : 'See you soon!'}
                    </Text>
                  </View>
                </View>
              </Pressable>

            </ScrollView>
          </View>
        </Modal>

        {/* QR Modal - Ultra Modern Frosted Glass */}
        <Modal visible={showQR} transparent animationType="fade" onRequestClose={() => setShowQR(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowQR(false)}>
            <BlurView intensity={100} tint="dark" style={styles.modalBlur}>
              <Pressable style={styles.qrCard} onPress={(e) => e.stopPropagation()}>
                {/* Ultra Transparent Frosted Glass */}
                <BlurView intensity={70} tint="light" style={styles.qrCardBlur} />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.4)', 'rgba(250, 252, 255, 0.3)', 'rgba(248, 250, 255, 0.2)']}
                  style={styles.qrCardGradient}
                />
                {/* Top shine reflection */}
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0.05)', 'transparent']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.5 }}
                  style={styles.qrCardShine}
                />
                {/* Glass border */}
                <View style={styles.qrCardBorder} />

                {/* Content */}
                <View style={styles.qrCardContent}>
                  {/* Header Badge */}
                  <View style={styles.qrBadge}>
                    <LinearGradient
                      colors={[COLORS.gold.light, COLORS.gold.base]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.qrBadgeGradient}
                    />
                    <Text style={styles.qrBadgeText}>FAMILY INVITE</Text>
                  </View>

                  <Text style={styles.qrTitle}>{household?.name}</Text>
                  <Text style={styles.qrSubtitle}>Scan to join your household</Text>

                  {/* QR Code Container with Inner Glow */}
                  <View style={styles.qrWrapper}>
                    <View style={styles.qrInnerGlow} />
                    <View style={styles.qrContainer}>
                      <LinearGradient
                        colors={['rgba(255, 255, 255, 0.95)', 'rgba(252, 252, 255, 1)']}
                        style={styles.qrContainerBg}
                      />
                      {household?.invite_code && (
                        <QRCode
                          value={`memoryaisle://join/${household.invite_code}`}
                          size={180}
                          color={COLORS.text.primary}
                          backgroundColor="transparent"
                        />
                      )}
                    </View>
                  </View>

                  {/* Invite Code */}
                  <View style={styles.qrCodeContainer}>
                    <Text style={styles.qrCodeLabel}>INVITE CODE</Text>
                    <Text style={styles.qrCode}>{household?.invite_code}</Text>
                  </View>

                  {/* Share Button */}
                  <Pressable style={styles.shareButton} onPress={handleShare}>
                    <LinearGradient
                      colors={[COLORS.gold.light, COLORS.gold.base, COLORS.gold.dark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.shareButtonGradient}
                    />
                    <LinearGradient
                      colors={['rgba(255, 240, 200, 0.6)', 'rgba(255, 220, 150, 0)']}
                      start={{ x: 0.2, y: 0 }}
                      end={{ x: 0.8, y: 0.7 }}
                      style={styles.shareButtonShine}
                    />
                    <View style={styles.shareButtonBorder} />
                    <Text style={styles.shareButtonText}>Share Invite Link</Text>
                  </Pressable>

                  {/* Close Button */}
                  <Pressable style={styles.closeButton} onPress={() => setShowQR(false)}>
                    <Text style={styles.closeButtonText}>Done</Text>
                  </Pressable>
                </View>
              </Pressable>
            </BlurView>
          </Pressable>
        </Modal>

        {/* Save Store Modal */}
        <Modal visible={showSaveStore} transparent animationType="fade" onRequestClose={() => setShowSaveStore(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowSaveStore(false)}>
            <BlurView intensity={90} tint="dark" style={styles.modalBlur}>
              <Pressable style={styles.qrCard} onPress={(e) => e.stopPropagation()}>
                <BlurView intensity={70} tint="light" style={styles.qrCardBlur} />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.4)', 'rgba(250, 252, 255, 0.3)', 'rgba(248, 250, 255, 0.2)']}
                  style={styles.qrCardGradient}
                />
                <View style={styles.qrCardBorder} />
                <View style={styles.qrCardContent}>
                  <Text style={styles.qrTitle}>Save Store</Text>
                  <Text style={styles.qrSubtitle}>Your list will auto-surface when you arrive here</Text>
                  <TextInput
                    style={styles.storeInput}
                    placeholder="Store name (e.g., Ralph's)"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    value={storeNameInput}
                    onChangeText={setStoreNameInput}
                    autoFocus
                  />
                  <Pressable
                    style={[styles.shareButton, !storeNameInput.trim() && styles.buttonDisabled]}
                    onPress={async () => {
                      if (!storeNameInput.trim() || !household?.id) return;
                      const store = await geofenceService.saveCurrentLocationAsStore(household.id, storeNameInput.trim());
                      if (store) {
                        setShowSaveStore(false);
                        setStoreNameInput('');
                        Alert.alert('Saved!', `${store.name} saved. Your list will pop up when you arrive.`);
                      } else {
                        Alert.alert('Error', 'Could not save location. Check location permissions.');
                      }
                    }}
                  >
                    <LinearGradient
                      colors={[COLORS.gold.light, COLORS.gold.base]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.shareButtonGradient}
                    />
                    <LinearGradient
                      colors={['rgba(255, 240, 200, 0.5)', 'rgba(255, 220, 150, 0)']}
                      start={{ x: 0.2, y: 0 }}
                      end={{ x: 0.8, y: 0.6 }}
                      style={styles.shareButtonShine}
                    />
                    <View style={styles.shareButtonBorder} />
                    <Text style={styles.shareButtonText}>Save Location</Text>
                  </Pressable>
                  <Pressable style={styles.closeButton} onPress={() => setShowSaveStore(false)}>
                    <Text style={styles.closeButtonText}>Cancel</Text>
                  </Pressable>
                </View>
              </Pressable>
            </BlurView>
          </Pressable>
        </Modal>

        {/* List Picker Modal */}
        <Modal visible={showListPicker} transparent animationType="fade" onRequestClose={() => setShowListPicker(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowListPicker(false)}>
            <BlurView intensity={90} tint="dark" style={styles.modalBlur}>
              <Pressable style={styles.qrCard} onPress={(e) => e.stopPropagation()}>
                <BlurView intensity={70} tint="light" style={styles.qrCardBlur} />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.4)', 'rgba(250, 252, 255, 0.3)', 'rgba(248, 250, 255, 0.2)']}
                  style={styles.qrCardGradient}
                />
                <View style={styles.qrCardBorder} />
                <View style={styles.qrCardContent}>
                  <Text style={styles.qrTitle}>Your Lists</Text>
                  <Text style={styles.qrSubtitle}>Switch between lists or create a new one</Text>

                  <ScrollView style={styles.listPickerScroll} showsVerticalScrollIndicator={false}>
                    {allLists.map((l) => (
                      <Pressable
                        key={l.id}
                        style={[styles.listPickerItem, l.id === list?.id && styles.listPickerItemActive]}
                        onPress={() => switchToList(l)}
                      >
                        <Text style={[styles.listPickerItemText, l.id === list?.id && styles.listPickerItemTextActive]}>
                          {l.name}
                        </Text>
                        {l.id === list?.id && (
                          <Text style={styles.listPickerCheck}>{'\u2713'}</Text>
                        )}
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Pressable style={styles.shareButton} onPress={handleCreateList}>
                    <LinearGradient
                      colors={[COLORS.gold.light, COLORS.gold.base]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.shareButtonGradient}
                    />
                    <LinearGradient
                      colors={['rgba(255, 240, 200, 0.5)', 'rgba(255, 220, 150, 0)']}
                      start={{ x: 0.2, y: 0 }}
                      end={{ x: 0.8, y: 0.6 }}
                      style={styles.shareButtonShine}
                    />
                    <View style={styles.shareButtonBorder} />
                    <Text style={styles.shareButtonText}>+ New List</Text>
                  </Pressable>

                  {allLists.length > 1 && list && (
                    <Pressable style={styles.closeButton} onPress={handleArchiveList}>
                      <Text style={[styles.closeButtonText, { color: COLORS.error }]}>Archive Current List</Text>
                    </Pressable>
                  )}

                  <Pressable style={styles.closeButton} onPress={() => setShowListPicker(false)}>
                    <Text style={styles.closeButtonText}>Done</Text>
                  </Pressable>
                </View>
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

        {/* List */}
        <View style={styles.listContainer}>
          {loading ? (
            <Text style={styles.loadingText}>Loading...</Text>
          ) : items.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>All done!</Text>
              <Text style={styles.emptySubtitle}>Your list is empty</Text>
            </View>
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              stickySectionHeadersEnabled={false}
              renderSectionHeader={({ section }) => {
                const CategoryIcon = CategoryIcons[section.categoryId as GroceryCategory] || CategoryIcons['other'];
                const isCollapsed = collapsedCategories.has(section.categoryId);
                if (!CategoryIcon) {
                  // Fallback if no icon found
                  return (
                    <View style={{ padding: SPACING.md }}>
                      <Text style={{ color: COLORS.text.secondary }}>{section.categoryInfo?.label || section.categoryId}</Text>
                    </View>
                  );
                }
                return (
                  <CategoryHeader
                    category={section.categoryInfo}
                    count={section.data.length}
                    IconComponent={CategoryIcon}
                    isCollapsed={isCollapsed}
                    onToggle={() => toggleCategory(section.categoryId)}
                  />
                );
              }}
              renderItem={({ item, section }) => {
                // Don't render items if category is collapsed
                if (collapsedCategories.has(section.categoryId)) {
                  return null;
                }
                return (
                  <ListItemCard
                    item={item}
                    onComplete={handleCompleteItem}
                    onDelete={handleDeleteItem}
                    categoryColor={section.categoryInfo.color}
                  />
                );
              }}
              ListFooterComponent={<View style={{ height: 200 }} />}
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={5}
            />
          )}
        </View>

        {/* Input Bar - Bottom Navigation */}
        <View style={[styles.inputArea, { bottom: insets.bottom + NAV_HEIGHT.bottom + 12 }]}>
          <View style={styles.inputBar}>
            <BlurView intensity={30} tint="light" style={styles.inputBarBlur} />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.4)', 'rgba(250, 252, 255, 0.3)', 'rgba(248, 250, 255, 0.22)']}
              style={styles.inputBarGradient}
            />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.08)', 'transparent']}
              style={styles.inputBarShine}
            />
            <View style={styles.inputBarBorder} />

            <View style={styles.inputBarContent}>
              {/* Mic Button */}
              <Pressable
                style={[styles.scanButton, isDictating && styles.micButtonActive, isProcessingDictation && { opacity: 0.6 }]}
                disabled={isProcessingDictation}
                onPress={async () => {
                  if (isGuest) {
                    requireAuth(() => {});
                    return;
                  }
                  if (!list) {
                    Alert.alert('Loading...', 'Please wait for your list to load.');
                    return;
                  }
                  if (isProcessingDictation) return; // Prevent double-tap

                  if (isDictating) {
                    // Stop dictating and process
                    setIsProcessingDictation(true);
                    setIsDictating(false);
                    setMiraStatus('Processing...');
                    try {
                      const result = await mira.quickDictate();
                      if (result.success && result.items.length > 0) {
                        for (const item of result.items) {
                          await addItem(list.id, item.name, undefined, item.quantity, 'voice');
                        }
                        setMiraStatus(result.message);
                        // Refresh items
                        const refreshed = await getListItems(list.id);
                        setItems(refreshed);
                      } else {
                        setMiraStatus(result.message || "Didn't catch that");
                      }
                    } catch (error) {
                      logger.error('Dictation error:', error);
                      setMiraStatus('Something went wrong. Try again.');
                    } finally {
                      setIsProcessingDictation(false);
                      setTimeout(() => setMiraStatus(null), 2500);
                    }
                  } else {
                    // Start dictating
                    setIsProcessingDictation(true);
                    try {
                      const started = await mira.startListening();
                      if (started) {
                        setIsDictating(true);
                        setMiraStatus('Listening... tap again when done');
                      } else {
                        Alert.alert('Microphone Access', 'Please allow microphone access to dictate items.');
                      }
                    } catch (error) {
                      logger.error('Failed to start dictation:', error);
                      Alert.alert('Error', 'Could not start recording. Please try again.');
                    } finally {
                      setIsProcessingDictation(false);
                    }
                  }
                }}
              >
                <BlurView intensity={20} tint="light" style={styles.scanButtonBlur} />
                <LinearGradient
                  colors={isDictating
                    ? ['rgba(212, 175, 55, 0.4)', 'rgba(212, 165, 71, 0.25)']
                    : ['rgba(255, 255, 255, 0.6)', 'rgba(245, 245, 250, 0.4)']}
                  style={styles.scanButtonGradient}
                />
                <View style={[styles.scanButtonBorder, isDictating && styles.micButtonBorderActive]} />
                <VoiceIcon size={24} color={isDictating ? COLORS.white : COLORS.gold.base} />
              </Pressable>

              {/* Text Input */}
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Add an item..."
                  placeholderTextColor={COLORS.platinum.mid}
                  value={newItemName}
                  onChangeText={setNewItemName}
                  onSubmitEditing={() => handleAddItem()}
                  returnKeyType="done"
                />
                {/* Send Button (replaces mic) */}
                <Pressable
                  style={[styles.micButton, newItemName.trim() && styles.sendButtonActive]}
                  onPress={() => handleAddItem()}
                  disabled={!newItemName.trim()}
                >
                  {newItemName.trim() ? (
                    <LinearGradient
                      colors={[COLORS.gold.light, COLORS.gold.base]}
                      style={styles.micButtonGradient}
                    />
                  ) : (
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0.5)', 'rgba(240, 240, 245, 0.3)']}
                      style={styles.micButtonGradient}
                    />
                  )}
                  <Text style={[styles.sendButtonIcon, newItemName.trim() && styles.sendButtonIconActive]}>{'\u2191'}</Text>
                </Pressable>
              </View>

            </View>
          </View>
        </View>

        {/* Dictation Status */}
        {miraStatus && (
          <View style={[styles.miraStatus, { bottom: insets.bottom + 92 }]}>
            <BlurView intensity={25} tint="light" style={styles.miraStatusBlur} />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.8)', 'rgba(250, 250, 255, 0.7)']}
              style={styles.miraStatusGradient}
            />
            <View style={styles.miraStatusBorder} />
            <View style={styles.miraStatusContent}>
              <Text style={styles.miraStatusText}>{miraStatus}</Text>
            </View>
          </View>
        )}

        {/* Onboarding Modal */}
        <Modal visible={showOnboarding} transparent animationType="fade" onRequestClose={() => {}}>
          <View style={styles.onboardingOverlay}>
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.onboardingCard}>
              <BlurView intensity={60} tint="light" style={styles.onboardingCardBlur} />
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.85)', 'rgba(250, 252, 255, 0.75)', 'rgba(248, 250, 255, 0.65)']}
                style={styles.onboardingCardGradient}
              />
              <View style={styles.onboardingCardBorder} />

              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onMomentumScrollEnd={(e) => {
                  const page = Math.round(e.nativeEvent.contentOffset.x / (Dimensions.get('window').width - 64));
                  setOnboardingPage(page);
                }}
                style={styles.onboardingScroll}
              >
                {/* Slide 1: Voice */}
                <View style={styles.onboardingSlide}>
                  <View style={styles.onboardingIconCircle}>
                    <VoiceIcon size={36} color={COLORS.gold.base} />
                  </View>
                  <Text style={styles.onboardingSlideTitle}>Add items by voice or text</Text>
                  <Text style={styles.onboardingSlideBody}>
                    Tap the mic button and say your items, or type them in. Mira will understand natural language like "2 pounds of chicken."
                  </Text>
                </View>

                {/* Slide 2: Mira */}
                <View style={styles.onboardingSlide}>
                  <View style={[styles.onboardingIconCircle, { backgroundColor: 'rgba(212, 175, 55, 0.2)' }]}>
                    <Text style={{ fontSize: 36 }}>{'\u2728'}</Text>
                  </View>
                  <Text style={styles.onboardingSlideTitle}>Ask Mira anything</Text>
                  <Text style={styles.onboardingSlideBody}>
                    Get recipe ideas, meal plans, and suggestions tailored to your family's dietary needs and preferences.
                  </Text>
                </View>

                {/* Slide 3: Family */}
                <View style={styles.onboardingSlide}>
                  <View style={[styles.onboardingIconCircle, { backgroundColor: 'rgba(76, 175, 80, 0.15)' }]}>
                    <FamilyIcon size={36} color="#4CAF50" />
                  </View>
                  <Text style={styles.onboardingSlideTitle}>Share with family</Text>
                  <Text style={styles.onboardingSlideBody}>
                    Invite your household with a code. Everyone sees the same list in real time, so nothing gets forgotten.
                  </Text>
                </View>
              </ScrollView>

              {/* Pagination Dots */}
              <View style={styles.onboardingDots}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={[styles.onboardingDot, i === onboardingPage && styles.onboardingDotActive]}
                  />
                ))}
              </View>

              {/* Get Started Button */}
              <Pressable
                style={styles.onboardingButton}
                onPress={() => {
                  setShowOnboarding(false);
                  AsyncStorage.setItem('hasSeenOnboarding', 'true');
                }}
              >
                <LinearGradient
                  colors={[COLORS.gold.light, COLORS.gold.base, COLORS.gold.dark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.onboardingButtonText}>
                  {onboardingPage === 2 ? 'Get Started' : 'Skip'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Missing Items Alert */}
        {missingItems.length > 0 && (
          <MissingItemsAlert
            items={missingItems}
            onDismiss={() => setMissingItems([])}
            colors={colors}
          />
        )}
      </ScreenWrapper>
    </KeyboardAvoidingView>
  );
}

// ==================== COMPONENTS ====================

interface CategoryHeaderProps {
  category: { id: string; label: string; color: string };
  count: number;
  IconComponent: React.FC<{ size?: number; color?: string }>;
  isCollapsed: boolean;
  onToggle: () => void;
}

const CategoryHeader = memo(function CategoryHeader({ category, count, IconComponent, isCollapsed, onToggle }: CategoryHeaderProps) {
  // Animated rotation for chevron
  const rotateAnim = useRef(new Animated.Value(isCollapsed ? 0 : 1)).current;

  useEffect(() => {
    Animated.spring(rotateAnim, {
      toValue: isCollapsed ? 0 : 1,
      useNativeDriver: true,
      tension: 120,
      friction: 14,
    }).start();
  }, [isCollapsed, rotateAnim]);

  const chevronRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-90deg', '0deg'],
  });

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.categoryHeader,
        pressed && styles.categoryHeaderPressed,
      ]}
    >
      <BlurView intensity={25} tint="light" style={styles.categoryHeaderBlur} />
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.28)', 'rgba(250, 252, 255, 0.18)', 'rgba(248, 250, 255, 0.12)']}
        style={styles.categoryHeaderGradient}
      />
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.06)', 'transparent']}
        style={styles.categoryHeaderShine}
      />
      <View style={styles.categoryHeaderBorder} />

      <View style={styles.categoryHeaderContent}>
        <View style={[styles.categoryIconWrapper, { backgroundColor: `${category.color}18` }]}>
          <IconComponent size={20} color={category.color} />
        </View>
        <Text style={styles.categoryTitle}>{category.label}</Text>
        <View style={styles.categoryCountBadge}>
          <Text style={styles.categoryCountText}>{count}</Text>
        </View>
        {/* Animated Chevron */}
        <Animated.View style={[styles.categoryChevron, { transform: [{ rotate: chevronRotation }] }]}>
          <Text style={styles.categoryChevronText}>{'\u25BC'}</Text>
        </Animated.View>
      </View>
    </Pressable>
  );
});

function StatCard({ value, label, isGold = false }: { value: number; label: string; isGold?: boolean }) {
  return (
    <View style={styles.statCard}>
      <BlurView intensity={40} tint="light" style={styles.statCardBlur} />
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.35)', 'rgba(250, 252, 255, 0.25)', 'rgba(248, 250, 255, 0.18)']}
        style={styles.statCardGradient}
      />
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.08)', 'transparent']}
        style={styles.statCardShine}
      />
      <View style={styles.statCardBorder} />
      <View style={styles.statCardContent}>
        <Text style={[styles.statValue, isGold && styles.statValueGold]}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

const ListItemCard = memo(function ListItemCard({ item, onComplete, onDelete, categoryColor }: { item: ListItem; onComplete: (id: string) => void; onDelete?: (item: ListItem) => void; categoryColor?: string }) {
  const hasAllergyRecord = item.allergy_record && item.allergy_record.allergens.length > 0;

  // Convert hex color to rgba for gradient
  const hexToRgba = (hexColor: string, alpha: number) => {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Category color on left half, fading into gold background
  const bgColors = hasAllergyRecord
    ? ['rgba(239, 83, 80, 0.5)', 'rgba(239, 83, 80, 0.2)', 'rgba(212, 165, 71, 0.15)']
    : categoryColor
      ? [hexToRgba(categoryColor, 0.55), hexToRgba(categoryColor, 0.2), 'rgba(212, 165, 71, 0.12)']
      : ['rgba(255, 255, 255, 0.4)', 'rgba(250, 252, 255, 0.3)', 'rgba(212, 165, 71, 0.1)'];

  return (
    <Pressable onPress={() => onComplete(item.id)} onLongPress={() => onDelete?.(item)} delayLongPress={500} style={styles.listItem}>
      <BlurView intensity={30} tint="light" style={styles.listItemBlur} />
      <LinearGradient
        colors={bgColors as any}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        locations={[0, 0.4, 1]}
        style={styles.listItemGradient}
      />
      {/* Reflective shine at top */}
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.1)', 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.5 }}
        style={styles.listItemShine}
      />
      <View style={[
        styles.listItemBorder,
        hasAllergyRecord && styles.listItemBorderAllergy,
        categoryColor && !hasAllergyRecord && { borderColor: hexToRgba(categoryColor, 0.25) }
      ]} />

      <View style={styles.listItemContent}>
        <View style={styles.checkbox}>
          <View style={styles.checkboxInner} />
        </View>
        <View style={styles.itemInfo}>
          <View style={styles.itemNameRow}>
            <Text style={styles.itemName}>{item.name}</Text>
            {hasAllergyRecord && (
              <View style={styles.allergyBadge}>
                <AllergyBadgeIcon size={14} />
              </View>
            )}
          </View>
          <View style={styles.itemMeta}>
            {item.added_by_name && (
              <View style={[
                styles.addedByBadge,
                hasAllergyRecord && styles.addedByBadgeAllergy
              ]}>
                <Text style={[
                  styles.addedByText,
                  hasAllergyRecord && styles.addedByTextAllergy
                ]}>
                  {item.added_by_name}
                  {hasAllergyRecord && ` • ${item.allergy_record!.allergens.map(a => ALLERGENS[a].shortLabel).join(', ')}`}
                </Text>
              </View>
            )}
            {item.source === 'ai_suggested' && (
              <Text style={styles.itemCategory}>Suggested</Text>
            )}
          </View>
        </View>
        {item.quantity > 1 && (
          <View style={styles.qtyBadge}>
            <Text style={styles.qtyText}>{item.quantity}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
});

// ==================== STYLES ====================

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  logoImage: {
    width: 28,
    height: 28,
  },
  title: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.xl,
    fontWeight: '500',
    color: COLORS.text.primary,
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.xs + 2,
  },
  // Store Location Slot
  storeSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  storeSlotBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  storeSlotGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  storeSlotBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 0.5,
    borderColor: 'rgba(212, 165, 71, 0.2)',
  },
  storeSlotText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '500',
    color: COLORS.gold.dark,
  },
  storeSlotArrow: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gold.base,
    marginLeft: 2,
  },
  iconButton: {
    width: HIG.minTouchTarget,      // Was 36 - HIG compliance
    height: HIG.minTouchTarget,     // Was 36 - HIG compliance
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconButtonBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  iconButtonGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  iconButtonBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  iconButtonActive: {
    shadowColor: COLORS.gold.base,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  iconButtonBorderActive: {
    borderColor: COLORS.gold.base,
    borderWidth: 1,
  },
  menuIcon: {
    fontSize: 18,
    color: COLORS.text.primary,
  },

  // Stats - Compact
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.xs + 2,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    ...SHADOWS.glass,
  },
  statCardBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  statCardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  statCardShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  statCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  statCardContent: {
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  statValueGold: {
    color: COLORS.gold.base,
  },
  statLabel: {
    fontSize: HIG.minFontSize,      // Was 9 - HIG minimum 11pt
    color: COLORS.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },

  // Category Section
  categorySection: {
    marginBottom: SPACING.md,
  },
  categoryHeader: {
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  categoryHeaderPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  categoryHeaderBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  categoryHeaderGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  categoryHeaderShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  categoryHeaderBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  categoryHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  categoryIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitle: {
    flex: 1,
    fontSize: FONT_SIZES.sm + 1,
    fontWeight: '600',
    color: COLORS.text.primary,
    letterSpacing: 0.3,
  },
  categoryCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  categoryCountText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  categoryChevron: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  categoryChevronText: {
    fontSize: 10,
    color: COLORS.text.secondary,
  },

  // List
  listContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  listContent: {
    paddingBottom: 20,
  },
  sectionLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.gold.base,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: SPACING.md,
    paddingLeft: 4,
  },
  loadingText: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: SPACING.xxl,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  emptyTitle: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.hero,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    fontStyle: 'italic',
  },

  // List Item - Compact
  listItem: {
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs + 2,
    overflow: 'hidden',
    ...SHADOWS.glass,
  },
  listItemBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  listItemGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  listItemShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  listItemBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm + 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(200, 205, 215, 0.5)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxInner: {
    width: 0,
    height: 0,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 3,
  },
  addedByBadge: {
    backgroundColor: 'rgba(212, 165, 71, 0.1)',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(212, 165, 71, 0.15)',
  },
  addedByText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.gold.dark,
  },
  itemCategory: {
    fontSize: FONT_SIZES.xs + 1,
    color: COLORS.text.secondary,
  },
  qtyBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingVertical: SPACING.sm,
    paddingHorizontal: 14,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  qtyText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },


  // Allergy styles
  listItemBorderAllergy: {
    borderWidth: 1,
    borderColor: 'rgba(239, 83, 80, 0.3)',
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  allergyBadge: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addedByBadgeAllergy: {
    backgroundColor: 'rgba(239, 83, 80, 0.1)',
    borderColor: 'rgba(239, 83, 80, 0.2)',
  },
  addedByTextAllergy: {
    color: '#C62828',
  },

  // Input Bar
  inputArea: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
  },
  inputBar: {
    borderRadius: BORDER_RADIUS.xxl,
    overflow: 'hidden',
    // Subtle gold glow
    shadowColor: COLORS.gold.base,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  inputBarBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  inputBarGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  inputBarShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  inputBarBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    borderColor: 'rgba(212, 165, 71, 0.25)', // Subtle gold border
  },
  inputBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm + 2,
    paddingLeft: SPACING.sm + 2,
    gap: SPACING.sm + 2,
  },
  scanButton: {
    width: 52,
    height: 52,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  scanButtonBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  scanButtonGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  scanButtonBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  micButtonActive: {
    shadowColor: COLORS.gold.base,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  micButtonBorderActive: {
    borderColor: COLORS.gold.base,
    borderWidth: 1,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 26,
    paddingLeft: SPACING.md,
    paddingRight: 4,
    height: 52,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text.primary,
    fontStyle: 'italic',
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  micButtonGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  sendButtonActive: {
    ...SHADOWS.goldGlow,
  },
  sendButtonIcon: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  sendButtonIconActive: {
    color: COLORS.white,
  },

  // Dictation Status
  miraStatus: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.glass,
  },
  miraStatusBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  miraStatusGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  miraStatusBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  miraStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  miraStatusText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text.primary,
    flex: 1,
  },

  // Modals
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
  menuModalContainer: {
    flex: 1,
  },
  menuAmbientLight: {
    ...StyleSheet.absoluteFillObject,
  },
  menuAmbientTopLeft: {
    position: 'absolute',
    top: '-20%',
    left: '-20%',
    width: '70%',
    height: '60%',
    borderRadius: 1000,
  },
  menuAmbientGold: {
    position: 'absolute',
    top: '10%',
    right: '-10%',
    width: '60%',
    height: '40%',
    borderRadius: 1000,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  menuCloseX: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  menuCloseXBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  menuCloseXText: {
    fontSize: 18,
    color: COLORS.text.secondary,
    fontWeight: '300',
  },
  menuScrollView: {
    flex: 1,
  },
  menuScrollContent: {
    paddingHorizontal: SPACING.lg,
  },
  menuTitle: {
    fontFamily: 'Georgia',
    fontSize: 28,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  menuItem: {
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.sm + 4,
    overflow: 'hidden',
    ...SHADOWS.glass,
  },
  menuItemBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  menuItemGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  menuItemBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: COLORS.gold.base,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  menuItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md + 2,
    paddingHorizontal: SPACING.md + 4,
    gap: SPACING.md,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  menuItemTextDanger: {
    color: COLORS.error,
  },
  menuItemSubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(200, 205, 215, 0.3)',
    marginVertical: SPACING.md,
    marginHorizontal: SPACING.md,
  },
  menuItemShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  qrCard: {
    borderRadius: 32,
    marginHorizontal: SPACING.lg,
    overflow: 'hidden',
    width: '90%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 20,
  },
  qrCardBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  qrCardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  qrCardShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  qrCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  qrCardContent: {
    padding: SPACING.xl + 4,
    alignItems: 'center',
  },
  qrBadge: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  qrBadgeGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  qrBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 2,
  },
  qrTitle: {
    fontFamily: 'Georgia',
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 4,
    textAlign: 'center',
  },
  qrSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xl,
    textAlign: 'center',
  },
  qrWrapper: {
    padding: 4,
    borderRadius: 24,
    backgroundColor: 'rgba(212, 165, 71, 0.1)',
    marginBottom: SPACING.lg,
  },
  qrInnerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(212, 165, 71, 0.2)',
  },
  qrContainer: {
    padding: SPACING.lg,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrContainerBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },
  qrCodeContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  qrCodeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.text.secondary,
    letterSpacing: 2,
    marginBottom: 6,
  },
  qrCode: {
    fontSize: 22,
    fontWeight: '600',
    color: COLORS.gold.dark,
    letterSpacing: 6,
    textTransform: 'uppercase',
  },
  shareButton: {
    width: '100%',
    paddingVertical: SPACING.md + 6,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.lg,
    alignItems: 'center',
    overflow: 'hidden',
    ...SHADOWS.goldGlow,
  },
  shareButtonGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  shareButtonShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
  },
  shareButtonBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 220, 180, 0.5)',
  },
  shareButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  closeButton: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  closeButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
  storeInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: '#FFFFFF',
    marginBottom: SPACING.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // List Picker
  listPickerScroll: {
    maxHeight: 250,
    width: '100%',
    marginBottom: SPACING.md,
  },
  listPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  listPickerItemActive: {
    backgroundColor: `${COLORS.gold.base}20`,
    borderWidth: 1,
    borderColor: COLORS.gold.base,
  },
  listPickerItemText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text.primary,
  },
  listPickerItemTextActive: {
    fontWeight: '700',
    color: COLORS.gold.dark,
  },
  listPickerCheck: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.gold.base,
  },
  // Onboarding
  onboardingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  onboardingCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    overflow: 'hidden',
    ...SHADOWS.glass,
  },
  onboardingCardBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  onboardingCardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  onboardingCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  onboardingScroll: {
    flexGrow: 0,
  },
  onboardingSlide: {
    width: Dimensions.get('window').width - 64,
    maxWidth: 360,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.md,
    alignItems: 'center',
  },
  onboardingIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  onboardingSlideTitle: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.title,
    fontWeight: '600',
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  onboardingSlideBody: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  onboardingDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: SPACING.md,
  },
  onboardingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(200, 205, 215, 0.4)',
  },
  onboardingDotActive: {
    backgroundColor: COLORS.gold.base,
    width: 20,
  },
  onboardingButton: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md + 2,
    alignItems: 'center',
    overflow: 'hidden',
  },
  onboardingButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
});