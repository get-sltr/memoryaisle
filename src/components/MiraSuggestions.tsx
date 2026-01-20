import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  Animated,
} from 'react-native';
import { COLORS, FONTS, FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '../constants/theme';
import { MiraIcon } from './icons';
import type { MiraSuggestion } from '../types';

interface MiraSuggestionsProps {
  suggestions: MiraSuggestion[];
  onAddItem: (itemName: string) => void;
  onDismiss: (itemName: string) => void;
  onRefresh: () => void;
  isLoading?: boolean;
  colors?: ThemeColors;
}

interface SuggestionCardProps {
  suggestion: MiraSuggestion;
  onAdd: () => void;
  onDismiss: () => void;
  colors: ThemeColors;
}

function SuggestionCard({ suggestion, onAdd, onDismiss, colors }: SuggestionCardProps) {
  const fadeAnim = React.useRef(new Animated.Value(1)).current;

  const handleDismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onDismiss());
  };

  const handleAdd = () => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.5,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => onAdd());
  };

  // Confidence indicator color
  const confidenceColor =
    suggestion.confidence > 0.7
      ? colors.success
      : suggestion.confidence > 0.4
      ? colors.warning
      : colors.inkLight;

  return (
    <Animated.View style={[styles.card, { backgroundColor: colors.paperDark, opacity: fadeAnim }]}>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={[styles.itemName, { color: colors.ink }]}>{suggestion.itemName}</Text>
          <View style={[styles.confidenceDot, { backgroundColor: confidenceColor }]} />
        </View>
        <Text style={[styles.reason, { color: colors.inkLight }]}>{suggestion.reason}</Text>
      </View>
      <View style={styles.cardActions}>
        <Pressable
          onPress={handleDismiss}
          style={({ pressed }) => [
            styles.dismissButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={[styles.dismissText, { color: colors.inkFaded }]}>Not now</Text>
        </Pressable>
        <Pressable
          onPress={handleAdd}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: colors.primary },
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export function MiraSuggestions({
  suggestions,
  onAddItem,
  onDismiss,
  onRefresh,
  isLoading = false,
  colors = COLORS,
}: MiraSuggestionsProps) {
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <MiraIcon size={20} color={colors.primary} animated />
          <Text style={[styles.title, { color: colors.ink }]}>Mira suggests</Text>
        </View>
        <View style={[styles.loadingCard, { backgroundColor: colors.paperDark }]}>
          <Text style={[styles.loadingText, { color: colors.inkLight }]}>Checking your patterns...</Text>
        </View>
      </View>
    );
  }

  if (suggestions.length === 0) {
    return null; // Don't show section if no suggestions
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MiraIcon size={20} color={colors.primary} />
        <Text style={[styles.title, { color: colors.ink }]}>Mira suggests</Text>
        <Pressable onPress={onRefresh} style={styles.refreshButton}>
          <Text style={[styles.refreshText, { color: colors.inkLight }]}>Refresh</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {suggestions.map((suggestion) => (
          <SuggestionCard
            key={suggestion.itemName}
            suggestion={suggestion}
            onAdd={() => onAddItem(suggestion.itemName)}
            onDismiss={() => onDismiss(suggestion.itemName)}
            colors={colors}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  title: {
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.md,
    fontStyle: 'italic',
    flex: 1,
  },
  refreshButton: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  refreshText: {
    fontFamily: FONTS.sans.regular,
    fontSize: FONT_SIZES.sm,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  card: {
    width: 180,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  cardContent: {
    flex: 1,
    marginBottom: SPACING.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  itemName: {
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.md,
    flex: 1,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: SPACING.xs,
  },
  reason: {
    fontFamily: FONTS.sans.regular,
    fontSize: FONT_SIZES.xs,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dismissButton: {
    paddingVertical: SPACING.xs,
  },
  dismissText: {
    fontFamily: FONTS.sans.regular,
    fontSize: FONT_SIZES.sm,
  },
  addButton: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  addText: {
    fontFamily: FONTS.sans.medium,
    fontSize: FONT_SIZES.sm,
    color: '#FFFFFF',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  loadingCard: {
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.sm,
    fontStyle: 'italic',
  },
});
