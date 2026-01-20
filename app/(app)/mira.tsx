import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { useThemeStore } from '../../src/stores/themeStore';
import { useAuthStore } from '../../src/stores/authStore';
import { mira, getRandomResponse } from '../../src/services/mira';
import type { ConversationTurn, MiraRecipe } from '../../src/services/mira';
import { getActiveList, getListItems } from '../../src/services/lists';
import { useFeatureQuota } from '../../src/hooks/useSubscription';
import { PaywallPrompt, PaywallBanner } from '../../src/components/PaywallPrompt';
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  NAV_HEIGHT,
} from '../../src/constants/theme';
import { MiraIcon, MiraListeningIcon, VoiceIcon } from '../../src/components/icons';

// Helper to create conversation turn with timestamp
const createTurn = (role: 'user' | 'assistant', content: string): ConversationTurn => ({
  role,
  content,
  timestamp: Date.now(),
});

export default function MiraScreen() {
  const { colors } = useThemeStore();
  const { household } = useAuthStore();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);

  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [recipes, setRecipes] = useState<Record<number, MiraRecipe>>({}); // Map message index to recipe
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  // Feature quota tracking
  const { canUse, remaining, limit, unlimited, increment, isPremium } = useFeatureQuota('miraQueriesPerDay');

  // Pulse animation for listening
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening]);

  // Auto-scroll to bottom
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [conversation.length]);

  // Initial greeting
  useEffect(() => {
    const greeting = getRandomResponse('greeting');
    setConversation([createTurn('assistant', greeting)]);
  }, []);

  const handleSend = useCallback(async () => {
    if (!inputText.trim()) return;

    // Check quota before sending
    if (!canUse) {
      setShowPaywall(true);
      return;
    }

    const message = inputText.trim();
    setInputText('');

    // Add user message
    setConversation(prev => [...prev, createTurn('user', message)]);
    setIsThinking(true);

    try {
      // Increment usage counter
      await increment();

      // Get current list items for context
      const activeList = household ? await getActiveList(household.id) : null;
      const items = activeList ? await getListItems(activeList.id) : [];

      const context = { currentListItems: items.map(i => i.name) };
      const result = await mira.processText(message, context);

      setConversation(prev => {
        const newConversation = [...prev, createTurn('assistant', result.response)];
        // If there's a recipe, save it mapped to this message index
        if (result.recipe) {
          setRecipes(prevRecipes => ({
            ...prevRecipes,
            [newConversation.length - 1]: result.recipe!,
          }));
        }
        return newConversation;
      });
    } catch (error) {
      setConversation(prev => [
        ...prev,
        createTurn('assistant', "I'm having trouble right now. Please try again."),
      ]);
    } finally {
      setIsThinking(false);
    }
  }, [inputText, household, canUse, increment]);

  const toggleListening = useCallback(async () => {
    if (isListening) {
      // Stop listening and process
      setIsListening(false);
      setIsThinking(true);
      try {
        const activeList = household ? await getActiveList(household.id) : null;
        const items = activeList ? await getListItems(activeList.id) : [];
        const context = { currentListItems: items.map(i => i.name) };

        const result = await mira.stopListening(context);
        if (result.success && result.response) {
          setConversation(prev => [...prev, createTurn('assistant', result.response)]);
        }
      } catch (error) {
        setConversation(prev => [
          ...prev,
          createTurn('assistant', "I didn't catch that. Please try again."),
        ]);
      } finally {
        setIsThinking(false);
      }
    } else {
      // Start listening
      setIsListening(true);
      try {
        const started = await mira.startListening();
        if (!started) {
          setIsListening(false);
        }
      } catch (error) {
        setIsListening(false);
      }
    }
  }, [isListening, household]);

  return (
    <ScreenWrapper withBottomPadding={false}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <View style={styles.headerContent}>
          <View style={styles.miraAvatar}>
            <LinearGradient
              colors={['rgba(212, 175, 55, 0.3)', 'rgba(212, 165, 71, 0.15)']}
              style={StyleSheet.absoluteFill}
            />
            <MiraIcon size={28} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Mira</Text>
            <Text style={styles.headerSubtitle}>Your Family Companion</Text>
          </View>
          {/* Query counter for free users */}
          {!unlimited && (
            <View style={styles.queryCounter}>
              <Text style={styles.queryCounterText}>
                {remaining}/{limit} left today
              </Text>
            </View>
          )}
        </View>

        {/* Show upgrade banner when running low */}
        {!unlimited && remaining <= 3 && remaining > 0 && (
          <PaywallBanner feature="miraQueriesPerDay" compact />
        )}
      </View>

      {/* Chat Messages */}
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {conversation.map((turn, index) => (
            <View key={index}>
              <View
                style={[
                  styles.messageBubble,
                  turn.role === 'user' ? styles.userMessage : styles.assistantMessage,
                ]}
              >
                {turn.role === 'assistant' && (
                  <View style={styles.messageAvatar}>
                    <MiraIcon size={16} />
                  </View>
                )}
                <View
                  style={[
                    styles.messageContent,
                    turn.role === 'user' ? styles.userMessageContent : styles.assistantMessageContent,
                  ]}
                >
                  <BlurView
                    intensity={turn.role === 'user' ? 15 : 20}
                    tint="light"
                    style={StyleSheet.absoluteFill}
                  />
                  <LinearGradient
                    colors={
                      turn.role === 'user'
                        ? (['rgba(212, 175, 55, 0.35)', 'rgba(212, 165, 71, 0.2)'] as const)
                        : (['rgba(255, 255, 255, 0.6)', 'rgba(250, 252, 255, 0.4)'] as const)
                    }
                    style={StyleSheet.absoluteFill}
                  />
                  <Text
                    style={[
                      styles.messageText,
                      turn.role === 'user' && styles.userMessageText,
                    ]}
                  >
                    {turn.content}
                  </Text>
                </View>
              </View>

              {/* Recipe Card */}
              {recipes[index] && (
                <View style={styles.recipeCard}>
                  <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.85)', 'rgba(250, 252, 255, 0.7)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.recipeHeader}>
                    <Text style={styles.recipeName}>{recipes[index].name}</Text>
                    {recipes[index].description && (
                      <Text style={styles.recipeDescription}>{recipes[index].description}</Text>
                    )}
                    <View style={styles.recipeMetaRow}>
                      {recipes[index].prepTime && (
                        <View style={styles.recipeMeta}>
                          <Text style={styles.recipeMetaLabel}>Prep</Text>
                          <Text style={styles.recipeMetaValue}>{recipes[index].prepTime}</Text>
                        </View>
                      )}
                      {recipes[index].cookTime && (
                        <View style={styles.recipeMeta}>
                          <Text style={styles.recipeMetaLabel}>Cook</Text>
                          <Text style={styles.recipeMetaValue}>{recipes[index].cookTime}</Text>
                        </View>
                      )}
                      {recipes[index].servings && (
                        <View style={styles.recipeMeta}>
                          <Text style={styles.recipeMetaLabel}>Serves</Text>
                          <Text style={styles.recipeMetaValue}>{recipes[index].servings}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.recipeSection}>
                    <Text style={styles.recipeSectionTitle}>Ingredients</Text>
                    {recipes[index].ingredients.map((ingredient, i) => (
                      <Text key={i} style={styles.recipeIngredient}>• {ingredient}</Text>
                    ))}
                  </View>

                  <View style={styles.recipeSection}>
                    <Text style={styles.recipeSectionTitle}>Instructions</Text>
                    {recipes[index].instructions.map((instruction, i) => (
                      <View key={i} style={styles.recipeStep}>
                        <Text style={styles.recipeStepNumber}>{i + 1}</Text>
                        <Text style={styles.recipeStepText}>{instruction}</Text>
                      </View>
                    ))}
                  </View>

                  {recipes[index].tips && recipes[index].tips!.length > 0 && (
                    <View style={styles.recipeSection}>
                      <Text style={styles.recipeSectionTitle}>Tips</Text>
                      {recipes[index].tips!.map((tip, i) => (
                        <Text key={i} style={styles.recipeTip}>💡 {tip}</Text>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          ))}

          {isThinking && (
            <View style={[styles.messageBubble, styles.assistantMessage]}>
              <View style={styles.messageAvatar}>
                <MiraIcon size={16} />
              </View>
              <View style={[styles.messageContent, styles.assistantMessageContent]}>
                <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.6)', 'rgba(250, 252, 255, 0.4)'] as const}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.thinkingText}>Thinking...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input Bar */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + NAV_HEIGHT.bottom + SPACING.sm }]}>
          <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.85)', 'rgba(250, 250, 255, 0.75)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.inputRow}>
            {/* Voice Button */}
            <Pressable
              onPress={toggleListening}
              style={[styles.voiceButton, isListening && styles.voiceButtonActive]}
            >
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <LinearGradient
                  colors={
                    isListening
                      ? (['rgba(212, 175, 55, 0.5)', 'rgba(212, 165, 71, 0.3)'] as const)
                      : (['rgba(255, 255, 255, 0.7)', 'rgba(245, 245, 250, 0.5)'] as const)
                  }
                  style={styles.voiceButtonGradient}
                />
                {isListening ? <MiraListeningIcon size={22} /> : <VoiceIcon size={22} />}
              </Animated.View>
            </Pressable>

            {/* Text Input */}
            <View style={styles.textInputWrapper}>
              <BlurView intensity={15} tint="light" style={StyleSheet.absoluteFill} />
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.5)', 'rgba(250, 252, 255, 0.3)']}
                style={StyleSheet.absoluteFill}
              />
              <TextInput
                style={styles.textInput}
                placeholder={isListening ? 'Listening...' : 'Ask Mira anything...'}
                placeholderTextColor={COLORS.text.secondary}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                editable={!isListening}
              />
            </View>

            {/* Send Button */}
            <Pressable
              onPress={handleSend}
              disabled={!inputText.trim() || isThinking}
              style={[styles.sendButton, (!inputText.trim() || isThinking) && styles.sendButtonDisabled]}
            >
              <LinearGradient
                colors={
                  inputText.trim() && !isThinking
                    ? ([COLORS.gold.light, COLORS.gold.base] as const)
                    : (['rgba(200, 200, 200, 0.3)', 'rgba(180, 180, 180, 0.2)'] as const)
                }
                style={styles.sendButtonGradient}
              />
              <Text style={styles.sendButtonText}>Send</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Paywall Modal */}
      <PaywallPrompt
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="miraQueriesPerDay"
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  miraAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: COLORS.gold.base,
    ...SHADOWS.goldGlow,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FONT_SIZES.title,
    fontWeight: '700',
    color: COLORS.text.primary,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  queryCounter: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.gold.light,
  },
  queryCounterText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.gold.dark,
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  messagesContent: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  messageBubble: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    maxWidth: '85%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  messageContent: {
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    overflow: 'hidden',
  },
  userMessageContent: {
    borderTopRightRadius: 4,
  },
  assistantMessageContent: {
    borderTopLeftRadius: 4,
  },
  messageText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
    lineHeight: 20,
  },
  userMessageText: {
    color: COLORS.text.primary,
  },
  thinkingText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    fontStyle: 'italic',
  },
  inputBar: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  voiceButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  voiceButtonActive: {
    shadowColor: COLORS.gold.base,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  voiceButtonGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
  },
  textInputWrapper: {
    flex: 1,
    height: 44,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  textInput: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
  },
  sendButton: {
    height: 44,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  sendButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
  },
  // Recipe Card Styles
  recipeCard: {
    marginLeft: 36, // Align with message content
    marginRight: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  recipeHeader: {
    marginBottom: SPACING.md,
  },
  recipeName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  recipeDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    lineHeight: 18,
    marginBottom: SPACING.sm,
  },
  recipeMetaRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginTop: SPACING.sm,
  },
  recipeMeta: {
    alignItems: 'center',
  },
  recipeMetaLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recipeMetaValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gold.base,
    marginTop: 2,
  },
  recipeSection: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  recipeSectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  recipeIngredient: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    lineHeight: 22,
    paddingLeft: SPACING.xs,
  },
  recipeStep: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },
  recipeStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.gold.base,
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: SPACING.sm,
    overflow: 'hidden',
  },
  recipeStepText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    lineHeight: 22,
  },
  recipeTip: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    lineHeight: 20,
    marginBottom: SPACING.xs,
    fontStyle: 'italic',
  },
});
