import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  Animated,
  Easing,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';

// Custom Recipe Icon
const RECIPE_ICON = require('../../assets/icons/Recipe.png');
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../constants/theme';
import { MiraIcon, MiraListeningIcon } from './icons';
import type { ConversationTurn } from '../services/mira';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MiraChatProps {
  conversation: ConversationTurn[];
  isListening: boolean;
  isThinking: boolean;
  isSpeaking?: boolean;
  visible?: boolean;
  onClose?: () => void;
  onSend?: (message: string) => void;
  colors: {
    paper: string;
    paperDark: string;
    ink: string;
    inkLight: string;
    primary: string;
  };
}

export function MiraChat({
  conversation,
  isListening,
  isThinking,
  isSpeaking = false,
  visible = true,
  onClose,
  onSend,
  colors,
}: MiraChatProps) {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [inputText, setInputText] = useState('');

  // Slide animation
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 25,
        stiffness: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  // Auto-scroll to bottom
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [conversation.length]);

  const handleSend = () => {
    if (inputText.trim() && onSend) {
      onSend(inputText.trim());
      setInputText('');
    }
  };

  if (!visible && conversation.length === 0 && !isListening && !isThinking && !isSpeaking) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill} />
      </Pressable>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Glass background */}
          <LinearGradient
            colors={['rgba(255,255,255,0.95)', 'rgba(248,249,251,0.98)']}
            style={styles.sheetGradient}
          />
          <View style={styles.sheetBorder} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.avatar}>
              <LinearGradient
                colors={[COLORS.gold.light, COLORS.gold.base]}
                style={styles.avatarGradient}
              />
              <Text style={styles.avatarIcon}>{'\u2726'}</Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>Mira</Text>
              <Text style={styles.headerSubtitle}>Your Family Companion</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>{'\u2715'}</Text>
            </Pressable>
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {conversation.map((turn, index) => (
              <View
                key={`${turn.timestamp}-${index}`}
                style={[
                  styles.message,
                  turn.role === 'user' ? styles.userMessage : styles.miraMessage,
                ]}
              >
                {turn.role === 'user' ? (
                  <LinearGradient
                    colors={[COLORS.gold.light, COLORS.gold.base]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.userMessageGradient}
                  />
                ) : (
                  <View style={styles.miraMessageBg} />
                )}
                <Text
                  style={[
                    styles.messageText,
                    turn.role === 'user' ? styles.userMessageText : styles.miraMessageText,
                  ]}
                >
                  {turn.content}
                </Text>
              </View>
            ))}

            {/* Listening indicator */}
            {isListening && (
              <View style={[styles.message, styles.miraMessage]}>
                <View style={styles.miraMessageBg} />
                <View style={styles.listeningIndicator}>
                  <MiraListeningIcon size={20} animated />
                  <Text style={styles.miraMessageText}>Listening...</Text>
                </View>
              </View>
            )}

            {/* Thinking indicator */}
            {isThinking && (
              <View style={[styles.message, styles.miraMessage]}>
                <View style={styles.miraMessageBg} />
                <ThinkingDots />
              </View>
            )}

            {/* Example recipe card */}
            {conversation.length > 0 && conversation[conversation.length - 1]?.role === 'assistant' && (
              <View style={styles.recipeCard}>
                <View style={styles.recipeTitleRow}>
                  <Image source={RECIPE_ICON} style={styles.recipeIcon} />
                  <Text style={styles.recipeTitle}>Honey Garlic Chicken</Text>
                </View>
                <Text style={styles.recipeMeta}>35 min • 4 servings</Text>
                <View style={styles.ingredients}>
                  {['2 lbs chicken thighs', '4 cloves garlic, minced', '1/3 cup honey', '1/4 cup soy sauce'].map((ing, i) => (
                    <View key={i} style={styles.ingredientRow}>
                      <Text style={styles.ingredientCheck}>{'\u2713'}</Text>
                      <Text style={styles.ingredientText}>{ing}</Text>
                    </View>
                  ))}
                </View>
                <Pressable style={styles.addAllButton}>
                  <LinearGradient
                    colors={[COLORS.gold.light, COLORS.gold.base]}
                    style={styles.addAllButtonGradient}
                  />
                  <Text style={styles.addAllButtonText}>Add All Ingredients to List</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>

          {/* Input Area */}
          <View style={[styles.inputArea, { paddingBottom: insets.bottom + SPACING.md }]}>
            <View style={styles.inputBar}>
              <BlurView intensity={15} tint="light" style={styles.inputBarBlur} />
              <View style={styles.inputBarBorder} />
              <TextInput
                style={styles.input}
                placeholder="Ask Mira anything..."
                placeholderTextColor={COLORS.text.secondary}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleSend}
                returnKeyType="send"
              />
              <Pressable style={styles.sendButton} onPress={handleSend}>
                <LinearGradient
                  colors={[COLORS.gold.light, COLORS.gold.base]}
                  style={styles.sendButtonGradient}
                />
                <Text style={styles.sendButtonText}>{'\u2191'}</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Animated thinking dots
function ThinkingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      );
    };

    Animated.parallel([
      animateDot(dot1, 0),
      animateDot(dot2, 150),
      animateDot(dot3, 300),
    ]).start();
  }, []);

  const dotStyle = (anim: Animated.Value) => ({
    opacity: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 1],
    }),
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -4],
        }),
      },
    ],
  });

  return (
    <View style={styles.dotsContainer}>
      <Animated.View style={[styles.dot, dotStyle(dot1)]} />
      <Animated.View style={[styles.dot, dotStyle(dot2)]} />
      <Animated.View style={[styles.dot, dotStyle(dot3)]} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
  },
  keyboardView: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    maxHeight: SCREEN_HEIGHT * 0.85,
    backgroundColor: 'transparent',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    ...SHADOWS.glassElevated,
  },
  sheetGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetBorder: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: COLORS.frost.border,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...SHADOWS.goldGlow,
  },
  avatarGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  avatarIcon: {
    fontSize: 24,
    color: COLORS.white,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.xl,
    color: COLORS.text.primary,
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gold.dark,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: COLORS.text.secondary,
  },

  // Messages
  messages: {
    flex: 1,
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  messagesContent: {
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  message: {
    maxWidth: '85%',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md - 4,
    borderRadius: 18,
    overflow: 'hidden',
  },
  userMessage: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
    marginLeft: 40,
  },
  userMessageGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  miraMessage: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  miraMessageBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.frost.bg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.frost.border,
  },
  messageText: {
    fontSize: FONT_SIZES.md,
    lineHeight: 22,
  },
  userMessageText: {
    color: COLORS.white,
  },
  miraMessageText: {
    color: COLORS.text.primary,
  },
  listeningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  // Recipe Card
  recipeCard: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.frost.border,
  },
  recipeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  recipeIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  recipeTitle: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.lg,
    color: COLORS.text.primary,
  },
  recipeMeta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.md,
  },
  ingredients: {
    marginBottom: SPACING.md,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  ingredientCheck: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gold.base,
  },
  ingredientText: {
    fontSize: FONT_SIZES.sm + 1,
    color: COLORS.text.primary,
  },
  addAllButton: {
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    overflow: 'hidden',
  },
  addAllButtonGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  addAllButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
  },

  // Input Area
  inputArea: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  inputBarBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  inputBarBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.frost.border,
  },
  input: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
    paddingVertical: SPACING.sm,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sendButtonGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  sendButtonText: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: '600',
  },

  // Thinking dots
  dotsContainer: {
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.text.secondary,
  },
});
