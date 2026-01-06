import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { FadingListItem } from './FadingListItem';
import { COLORS, FONTS, FONT_SIZES, SPACING } from '../constants/theme';
import type { ListItem } from '../types';

interface GroceryListProps {
  items: ListItem[];
  onItemComplete: (id: string) => void;
}

export function GroceryList({ items, onItemComplete }: GroceryListProps) {
  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>All done!</Text>
        <Text style={styles.emptySubtext}>Your list is empty</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {items.map((item) => (
        <FadingListItem
          key={item.id}
          id={item.id}
          name={item.name}
          quantity={item.quantity}
          addedBy={item.added_by_name}
          source={item.source}
          onComplete={onItemComplete}
        />
      ))}

      {/* Item count footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {items.length} {items.length === 1 ? 'item' : 'items'} remaining
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.xxl,
    color: COLORS.ink,
    marginBottom: SPACING.sm,
  },
  emptySubtext: {
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.md,
    color: COLORS.inkLight,
    fontStyle: 'italic',
  },
  footer: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.inkFaded,
    fontStyle: 'italic',
  },
});
