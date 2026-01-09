import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { FONTS, FONT_SIZES, SPACING } from '../constants/theme';
import { MiraAvatar } from './MiraAvatar';
import type { ConversationTurn } from '../services/mira';

interface MiraChatProps {
  conversation: ConversationTurn[];
  isListening: boolean;
  isThinking: boolean;
  isSpeaking?: boolean;
  colors: {
    paper: string;
    paperDark: string;
    ink: string;
    inkLight: string;
    primary: string;
  };
}

export function MiraChat({ conversation, isListening, isThinking, isSpeaking = false, colors }: MiraChatProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Determine Mira's current state for avatar
  const getMiraState = (): 'idle' | 'listening' | 'thinking' | 'speaking' => {
    if (isListening) return 'listening';
    if (isThinking) return 'thinking';
    if (isSpeaking) return 'speaking';
    return 'idle';
  };

  // Pulse animation for listening/thinking states
  useEffect(() => {
    if (isListening || isThinking) {
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
  }, [isListening, isThinking]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [conversation.length]);

  if (conversation.length === 0 && !isListening && !isThinking && !isSpeaking) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.paperDark }]}>
      {/* Mira Avatar */}
      <View style={styles.avatarContainer}>
        <MiraAvatar state={getMiraState()} size="medium" colors={colors} />
        <Text style={[styles.stateLabel, { color: colors.inkLight }]}>
          {isListening ? 'Listening...' : isThinking ? 'Thinking...' : isSpeaking ? 'Speaking...' : 'Mira'}
        </Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {conversation.slice(-6).map((turn, index) => (
          <View
            key={`${turn.timestamp}-${index}`}
            style={[
              styles.bubble,
              turn.role === 'user' ? styles.userBubble : styles.miraBubble,
              turn.role === 'user'
                ? { backgroundColor: colors.primary }
                : { backgroundColor: colors.paper },
            ]}
          >
            {turn.role === 'assistant' && (
              <Text style={[styles.miraLabel, { color: colors.inkLight }]}>Mira</Text>
            )}
            <Text
              style={[
                styles.bubbleText,
                turn.role === 'user'
                  ? { color: '#FFFFFF' }
                  : { color: colors.ink },
              ]}
            >
              {turn.content}
            </Text>
          </View>
        ))}

        {/* Listening indicator */}
        {isListening && (
          <View style={[styles.bubble, styles.miraBubble, { backgroundColor: colors.paper }]}>
            <Text style={[styles.miraLabel, { color: colors.inkLight }]}>Mira</Text>
            <View style={styles.listeningContainer}>
              <Animated.View
                style={[
                  styles.listeningDot,
                  { backgroundColor: colors.primary, transform: [{ scale: pulseAnim }] },
                ]}
              />
              <Text style={[styles.bubbleText, { color: colors.ink }]}>Listening...</Text>
            </View>
          </View>
        )}

        {/* Thinking indicator */}
        {isThinking && (
          <View style={[styles.bubble, styles.miraBubble, { backgroundColor: colors.paper }]}>
            <Text style={[styles.miraLabel, { color: colors.inkLight }]}>Mira</Text>
            <View style={styles.thinkingContainer}>
              <ThinkingDots color={colors.inkLight} />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// Animated thinking dots
function ThinkingDots({ color }: { color: string }) {
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
      <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle(dot1)]} />
      <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle(dot2)]} />
      <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle(dot3)]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 280,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    borderRadius: 16,
    overflow: 'hidden',
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  stateLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: FONT_SIZES.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 16,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  miraBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  miraLabel: {
    fontFamily: FONTS.sans.medium,
    fontSize: FONT_SIZES.xs,
    marginBottom: 2,
  },
  bubbleText: {
    fontFamily: FONTS.sans.regular,
    fontSize: FONT_SIZES.md,
    lineHeight: 20,
  },
  listeningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  listeningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  thinkingContainer: {
    paddingVertical: 4,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
