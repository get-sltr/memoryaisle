import React, { useRef } from 'react';
import { StyleSheet, Text, View, Pressable, Animated } from 'react-native';
import { COLORS, FONTS, FONT_SIZES, SPACING, ANIMATION } from '../constants/theme';

interface FadingListItemProps {
  id: string;
  name: string;
  quantity: number;
  addedBy?: string;
  source?: 'manual' | 'ai_suggested' | 'voice';
  onComplete: (id: string) => void;
}

export function FadingListItem({
  id,
  name,
  quantity,
  addedBy,
  source,
  onComplete,
}: FadingListItemProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const height = useRef(new Animated.Value(60)).current;

  const handlePress = () => {
    // Fade out and scale down
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: ANIMATION.fadeOut,
        useNativeDriver: false,
      }),
      Animated.timing(scale, {
        toValue: 0.95,
        duration: ANIMATION.fadeOut / 2,
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.delay(ANIMATION.fadeOut / 2),
        Animated.timing(height, {
          toValue: 0,
          duration: ANIMATION.fadeOut / 2,
          useNativeDriver: false,
        }),
      ]),
    ]).start(() => {
      onComplete(id);
    });
  };

  // Show source indicator for AI suggestions
  const showAiBadge = source === 'ai_suggested';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          height,
          transform: [{ scale }],
        },
      ]}
    >
      <Pressable onPress={handlePress} style={styles.pressable}>
        <View style={styles.content}>
          <View style={styles.leftSection}>
            {/* Quantity bubble */}
            {quantity > 1 && (
              <View style={styles.quantityBubble}>
                <Text style={styles.quantityText}>{quantity}</Text>
              </View>
            )}

            {/* Item name */}
            <Text style={styles.itemName}>{name}</Text>

            {/* AI badge */}
            {showAiBadge && (
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>AI</Text>
              </View>
            )}
          </View>

          {/* Added by attribution */}
          {addedBy && (
            <Text style={styles.addedBy}>{addedBy}</Text>
          )}
        </View>

        {/* Subtle bottom border */}
        <View style={styles.border} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  pressable: {
    flex: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  quantityBubble: {
    backgroundColor: COLORS.paperDark,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  quantityText: {
    fontFamily: FONTS.sans.medium,
    fontSize: FONT_SIZES.xs,
    color: COLORS.ink,
  },
  itemName: {
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.lg,
    color: COLORS.ink,
    flex: 1,
  },
  aiBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: SPACING.sm,
  },
  aiBadgeText: {
    fontFamily: FONTS.sans.medium,
    fontSize: FONT_SIZES.xs,
    color: COLORS.white,
  },
  addedBy: {
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.inkLight,
    fontStyle: 'italic',
  },
  border: {
    height: 1,
    backgroundColor: COLORS.paperDark,
    marginLeft: SPACING.xs,
  },
});
