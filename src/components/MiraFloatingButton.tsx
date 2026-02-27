import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS, HIG } from '../constants/theme';
import { useAuthStore } from '../stores/authStore';
import { mira, MiraRecipe, MiraMealPlan } from '../services/mira';
import { getActiveList, addItem } from '../services/lists';
import { saveMiraMealPlan } from '../services/mealPlans';
import { SwipeButton } from './SwipeButton';
import { supabase } from '../services/supabase';
import { logger } from '../utils/logger';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BUTTON_SIZE = 72;
const EDGE_PADDING = 10;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  recipe?: MiraRecipe;
  mealPlan?: MiraMealPlan;
}


export function MiraFloatingButton() {
  const insets = useSafeAreaInsets();
  const { household, user } = useAuthStore();

  // Position state - starts at bottom right
  const position = useRef(new Animated.ValueXY({
    x: SCREEN_WIDTH - BUTTON_SIZE - EDGE_PADDING - 20,
    y: SCREEN_HEIGHT - BUTTON_SIZE - 120 - (insets.bottom || 34),
  })).current;

  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [familyDietaryInfo, setFamilyDietaryInfo] = useState<string | null>(null);

  // Fetch family dietary restrictions on mount (household-level + individual members)
  useEffect(() => {
    async function fetchFamilyDietary() {
      if (!household?.id) return;
      try {
        const restrictions: string[] = [];

        // 1. Household-level dietary preferences and cultural preferences
        const { data: householdData } = await supabase
          .from('households')
          .select('dietary_preferences, cultural_preferences, family_profile')
          .eq('id', household.id)
          .single();

        if (householdData && householdData.dietary_preferences?.length > 0) {
          restrictions.push(`Household dietary preferences: ${householdData.dietary_preferences.join(', ')}`);
        }
        if (householdData && householdData.cultural_preferences?.length > 0) {
          restrictions.push(`Household cultural/religious background: ${householdData.cultural_preferences.join(', ')}`);
        }

        // 2. Individual family member restrictions
        const { data: members } = await supabase
          .from('family_members')
          .select('name, allergies, dietary_preferences')
          .eq('household_id', household.id);

        if (members && members.length > 0) {
          members.forEach((m: any) => {
            if (m.allergies?.length > 0) {
              restrictions.push(`${m.name} has allergies: ${m.allergies.join(', ')}`);
            }
            if (m.dietary_preferences?.length > 0) {
              restrictions.push(`${m.name} follows: ${m.dietary_preferences.join(', ')}`);
            }
          });
        }

        if (restrictions.length > 0) {
          setFamilyDietaryInfo(restrictions.join('. '));
        }
      } catch (e) {
        logger.error('Could not fetch family dietary info', e);
      }
    }
    fetchFamilyDietary();
  }, [household?.id]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // Pulse animation for idle state
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Pan responder for dragging
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture movement if dragging more than 5px
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        position.setOffset({
          x: (position.x as any)._value,
          y: (position.y as any)._value,
        });
        position.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: position.x, dy: position.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gestureState) => {
        position.flattenOffset();

        // Snap to nearest edge
        const currentX = (position.x as any)._value;
        const currentY = (position.y as any)._value;

        const snapToLeft = currentX < SCREEN_WIDTH / 2;
        const targetX = snapToLeft ? EDGE_PADDING : SCREEN_WIDTH - BUTTON_SIZE - EDGE_PADDING;

        // Keep within vertical bounds
        const minY = insets.top + EDGE_PADDING;
        const maxY = SCREEN_HEIGHT - BUTTON_SIZE - 100 - (insets.bottom || 34);
        const targetY = Math.max(minY, Math.min(maxY, currentY));

        Animated.spring(position, {
          toValue: { x: targetX, y: targetY },
          useNativeDriver: false,
          friction: 7,
        }).start();

        // If barely moved, treat as tap
        if (Math.abs(gestureState.dx) < 10 && Math.abs(gestureState.dy) < 10) {
          handlePress();
        }
      },
    })
  ).current;

  const handlePress = useCallback(() => {
    setShowChat(true);
    // Add welcome message if first time
    if (messages.length === 0) {
      setMessages([{
        id: '1',
        role: 'assistant',
        content: "Hey! I'm Mira, your family companion. I can help with recipes, shopping lists, meal planning, parenting tips, and so much more. What can I help you with?",
      }]);
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await mira.processText(inputText.trim(), {
        familyDietaryRestrictions: familyDietaryInfo || undefined,
      });

      // Handle adding items to list
      if (response.intent === 'add_items' && response.items && response.items.length > 0 && household?.id) {
        const list = await getActiveList(household.id);
        if (list) {
          for (const item of response.items) {
            await addItem(list.id, item.name);
          }
        }
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        recipe: response.recipe,
        mealPlan: response.mealPlan,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry, I had trouble connecting. Please try again!",
      }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [inputText, isLoading, household?.id]);

  const handleAddRecipeToList = useCallback(async (recipe: MiraRecipe) => {
    if (!household?.id) return;

    const list = await getActiveList(household.id);
    if (!list) return;

    for (const ingredient of recipe.ingredients) {
      await addItem(list.id, ingredient);
    }

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: `Added ${recipe.ingredients.length} ingredients from "${recipe.name}" to your shopping list!`,
    }]);
  }, [household?.id]);

  const handleAddMealPlanToList = useCallback(async (mealPlan: MiraMealPlan) => {
    if (!household?.id) return;

    const list = await getActiveList(household.id);
    if (!list) return;

    // Add all items from the meal plan shopping list
    for (const item of mealPlan.shoppingList) {
      await addItem(list.id, item);
    }

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: `Added ${mealPlan.shoppingList.length} items from your ${mealPlan.duration}-day meal plan to your shopping list! ✓`,
    }]);
  }, [household?.id]);

  const handleSaveMealPlan = useCallback(async (mealPlan: MiraMealPlan) => {
    if (!household?.id) return;

    try {
      const saved = await saveMiraMealPlan(household.id, mealPlan, user?.id);
      const mealCount = saved.planned_meals?.length ?? 0;

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Saved "${mealPlan.name}" to your meal plan! ${mealCount} meals added across ${mealPlan.duration} days. Check the Plan tab to see it on your calendar.`,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Sorry, I couldn't save the meal plan. Please try again.`,
      }]);
    }
  }, [household?.id, user?.id]);

  return (
    <>
      {/* Floating Button */}
      <Animated.View
        style={[
          styles.floatingButton,
          {
            transform: [
              { translateX: position.x },
              { translateY: position.y },
              { scale: pulseAnim },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <Pressable onPress={handlePress} style={styles.buttonInner}>
          <View style={styles.buttonBackground} />
          <View style={styles.buttonBorder} />
          <Image
            source={require('../../assets/icons/mira_button.png')}
            style={styles.miraIcon}
            resizeMode="contain"
          />
        </Pressable>
        {/* Gold ring glow */}
        <View style={styles.glowRing} />
      </Animated.View>

      {/* Chat Modal */}
      <Modal
        visible={showChat}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChat(false)}
      >
        <View style={styles.modalContainer}>
          {/* Background */}
          <LinearGradient
            colors={[
              COLORS.background.start,
              COLORS.background.mid1,
              COLORS.background.mid2,
              COLORS.background.end,
            ]}
            locations={[0, 0.4, 0.7, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* Header */}
          <View style={[styles.chatHeader, { paddingTop: insets.top + SPACING.sm }]}>
            <View style={styles.headerLeft}>
              <View style={styles.miraAvatarSmall}>
                <LinearGradient
                  colors={[COLORS.gold.light, COLORS.gold.base]}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.miraAvatarText}>M</Text>
              </View>
              <View>
                <Text style={styles.headerTitle}>Mira</Text>
                <Text style={styles.headerSubtitle}>Your Family Companion</Text>
              </View>
            </View>
            <Pressable style={styles.closeButton} onPress={() => setShowChat(false)}>
              <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.7)', 'rgba(255, 255, 255, 0.4)']}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.closeButtonText}>Done</Text>
            </Pressable>
          </View>

          {/* Messages */}
          <KeyboardAvoidingView
            style={styles.chatContent}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
            >
              {messages.map(message => (
                <View
                  key={message.id}
                  style={[
                    styles.messageBubble,
                    message.role === 'user' ? styles.userBubble : styles.assistantBubble,
                  ]}
                >
                  {message.role === 'assistant' && (
                    <>
                      <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
                      <LinearGradient
                        colors={['rgba(255, 255, 255, 0.7)', 'rgba(250, 248, 245, 0.5)']}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={styles.bubbleBorder} />
                    </>
                  )}
                  {message.role === 'user' && (
                    <LinearGradient
                      colors={[COLORS.gold.light, COLORS.gold.base]}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <Text style={[
                    styles.messageText,
                    message.role === 'user' && styles.userMessageText,
                  ]}>
                    {message.content}
                  </Text>

                  {/* Recipe Card */}
                  {message.recipe && (
                    <View style={styles.recipeCard}>
                      <Text style={styles.recipeTitle}>{message.recipe.name}</Text>
                      {message.recipe.description && (
                        <Text style={styles.recipeDescription}>{message.recipe.description}</Text>
                      )}
                      <View style={styles.recipeMeta}>
                        {message.recipe.prepTime && <Text style={styles.recipeMetaText}>Prep: {message.recipe.prepTime}</Text>}
                        {message.recipe.cookTime && <Text style={styles.recipeMetaText}>Cook: {message.recipe.cookTime}</Text>}
                        {message.recipe.servings && <Text style={styles.recipeMetaText}>Serves: {message.recipe.servings}</Text>}
                      </View>

                      <Text style={styles.recipeSection}>Ingredients:</Text>
                      {message.recipe.ingredients.map((ing, i) => (
                        <Text key={i} style={styles.recipeItem}>• {ing}</Text>
                      ))}

                      <Text style={styles.recipeSection}>Instructions:</Text>
                      {message.recipe.instructions.map((step, i) => (
                        <Text key={i} style={styles.recipeStep}>{i + 1}. {step}</Text>
                      ))}

                      <SwipeButton
                        onSwipeComplete={() => handleAddRecipeToList(message.recipe!)}
                        label="Add Ingredients"
                        completedLabel="Added to List!"
                        icon="✓"
                      />
                    </View>
                  )}

                  {/* Meal Plan Card */}
                  {message.mealPlan && (
                    <View style={styles.mealPlanCard}>
                      <View style={styles.mealPlanHeader}>
                        <Text style={styles.mealPlanIcon}>📋</Text>
                        <View style={styles.mealPlanHeaderText}>
                          <Text style={styles.mealPlanTitle}>{message.mealPlan.name}</Text>
                          <Text style={styles.mealPlanSubtitle}>
                            {message.mealPlan.duration} days • {message.mealPlan.dailyTargets.calories} cal/day
                          </Text>
                        </View>
                      </View>

                      {message.mealPlan.description && (
                        <Text style={styles.mealPlanDescription}>{message.mealPlan.description}</Text>
                      )}

                      {/* Daily Targets */}
                      <View style={styles.mealPlanTargets}>
                        <View style={styles.targetItem}>
                          <Text style={styles.targetValue}>{message.mealPlan.dailyTargets.protein}</Text>
                          <Text style={styles.targetLabel}>Protein</Text>
                        </View>
                        <View style={styles.targetItem}>
                          <Text style={styles.targetValue}>{message.mealPlan.dailyTargets.carbs}</Text>
                          <Text style={styles.targetLabel}>Carbs</Text>
                        </View>
                        <View style={styles.targetItem}>
                          <Text style={styles.targetValue}>{message.mealPlan.dailyTargets.fat}</Text>
                          <Text style={styles.targetLabel}>Fat</Text>
                        </View>
                      </View>

                      {/* Days Preview (first 3 days) */}
                      <Text style={styles.mealPlanSection}>Meal Preview:</Text>
                      {message.mealPlan.days.slice(0, 3).map((day, idx) => (
                        <View key={idx} style={styles.dayPreview}>
                          <Text style={styles.dayName}>Day {day.day}{day.dayName ? ` - ${day.dayName}` : ''}</Text>
                          <Text style={styles.dayMeals}>
                            🍳 {day.meals.breakfast.name} • 🥗 {day.meals.lunch.name} • 🍽️ {day.meals.dinner.name}
                          </Text>
                        </View>
                      ))}
                      {message.mealPlan.days.length > 3 && (
                        <Text style={styles.moreText}>+ {message.mealPlan.days.length - 3} more days...</Text>
                      )}

                      {/* Shopping List Preview */}
                      <Text style={styles.mealPlanSection}>Shopping List ({message.mealPlan.shoppingList.length} items):</Text>
                      <Text style={styles.shoppingPreview}>
                        {message.mealPlan.shoppingList.slice(0, 5).join(', ')}
                        {message.mealPlan.shoppingList.length > 5 ? '...' : ''}
                      </Text>

                      {/* Add to List Button */}
                      <SwipeButton
                        onSwipeComplete={() => handleAddMealPlanToList(message.mealPlan!)}
                        label="Add Shopping List"
                        completedLabel="Added to List!"
                        icon="✓"
                      />

                      {/* Save to Plan Calendar */}
                      <SwipeButton
                        onSwipeComplete={() => handleSaveMealPlan(message.mealPlan!)}
                        label="Save to Plan"
                        completedLabel="Saved to Plan!"
                        icon="📅"
                      />

                      {/* Tips */}
                      {message.mealPlan.tips && message.mealPlan.tips.length > 0 && (
                        <>
                          <Text style={styles.mealPlanSection}>Tips:</Text>
                          {message.mealPlan.tips.slice(0, 2).map((tip, i) => (
                            <Text key={i} style={styles.tipText}>💡 {tip}</Text>
                          ))}
                        </>
                      )}
                    </View>
                  )}
                </View>
              ))}

              {isLoading && (
                <View style={[styles.messageBubble, styles.assistantBubble]}>
                  <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.7)', 'rgba(250, 248, 245, 0.5)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.bubbleBorder} />
                  <ActivityIndicator color={COLORS.gold.base} />
                </View>
              )}
            </ScrollView>

            {/* Input Area */}
            <View style={[styles.inputArea, { paddingBottom: insets.bottom + SPACING.sm }]}>
              <View style={styles.inputContainer}>
                <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.8)', 'rgba(255, 255, 255, 0.6)']}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.inputBorder} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Ask Mira anything..."
                  placeholderTextColor={COLORS.text.secondary}
                  value={inputText}
                  onChangeText={setInputText}
                  onSubmitEditing={handleSend}
                  returnKeyType="send"
                  multiline
                  maxLength={500}
                />
                <Pressable
                  style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                  onPress={handleSend}
                  disabled={!inputText.trim() || isLoading}
                >
                  <LinearGradient
                    colors={inputText.trim() ? [COLORS.gold.light, COLORS.gold.base] : ['#ccc', '#bbb']}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={styles.sendButtonText}>Send</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    zIndex: 9999,
  },
  buttonInner: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.glassElevated,
  },
  buttonShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
    borderTopLeftRadius: BUTTON_SIZE / 2,
    borderTopRightRadius: BUTTON_SIZE / 2,
  },
  buttonBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: '#FFFFFF',
  },
  buttonBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 2.5,
    borderColor: COLORS.gold.base,
  },
  miraIcon: {
    width: BUTTON_SIZE - 4,
    height: BUTTON_SIZE - 4,
  },
  glowRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: (BUTTON_SIZE + 8) / 2,
    borderWidth: 2,
    borderColor: 'rgba(212, 165, 71, 0.35)',
  },

  // Modal styles
  modalContainer: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(200, 205, 215, 0.3)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  miraAvatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  miraAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.white,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gold.dark,
    fontStyle: 'italic',
  },
  closeButton: {
    paddingHorizontal: SPACING.md + 4,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    minHeight: HIG.minTouchTarget,      // HIG compliance
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.gold.dark,
  },

  // Chat content
  chatContent: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  bubbleBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  messageText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
    lineHeight: 22,
  },
  userMessageText: {
    color: COLORS.white,
  },

  // Recipe card
  recipeCard: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: BORDER_RADIUS.lg,
  },
  recipeTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  recipeDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.sm,
  },
  recipeMeta: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  recipeMetaText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gold.dark,
    fontWeight: '600',
  },
  recipeSection: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  recipeItem: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginLeft: SPACING.sm,
    lineHeight: 20,
  },
  recipeStep: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginLeft: SPACING.sm,
    lineHeight: 20,
    marginBottom: SPACING.xs,
  },

  // Meal Plan card
  mealPlanCard: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.gold.light,
  },
  mealPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  mealPlanIcon: {
    fontSize: 28,
  },
  mealPlanHeaderText: {
    flex: 1,
  },
  mealPlanTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  mealPlanSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gold.dark,
    fontWeight: '500',
  },
  mealPlanDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  mealPlanTargets: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  targetItem: {
    alignItems: 'center',
  },
  targetValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.gold.dark,
  },
  targetLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
  },
  mealPlanSection: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  dayPreview: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  dayName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  dayMeals: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    lineHeight: 16,
  },
  moreText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gold.dark,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  shoppingPreview: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    lineHeight: 18,
  },
  tipText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
    lineHeight: 18,
  },

  // Input area
  inputArea: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(200, 205, 215, 0.3)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    minHeight: HIG.minTouchTarget + 8,  // HIG compliance with padding
  },
  inputBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  textInput: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
    maxHeight: 100,
  },
  sendButton: {
    paddingHorizontal: SPACING.md + 4,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.lg,
    margin: 4,
    overflow: 'hidden',
    minHeight: HIG.minTouchTarget - 8,  // Account for margin
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.white,
  },
});
