import { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, ScrollView } from 'react-native';
import { FONTS, FONT_SIZES, SPACING } from '../constants/theme';

interface MissingItemsAlertProps {
  items: string[];
  onDismiss: () => void;
  colors: {
    paper: string;
    ink: string;
    inkLight: string;
  };
}

export function MissingItemsAlert({ items, onDismiss, colors }: MissingItemsAlertProps) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss());
  };

  return (
    <Animated.View
      style={[
        styles.overlay,
        { opacity: opacityAnim },
      ]}
    >
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: colors.paper,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={[styles.title, { color: colors.ink }]}>
            Wait! You forgot {items.length} {items.length === 1 ? 'item' : 'items'}
          </Text>
        </View>

        <ScrollView style={styles.itemsList} showsVerticalScrollIndicator={false}>
          {items.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={[styles.itemText, { color: colors.ink }]}>{item}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.buttons}>
          <Pressable style={styles.goBackButton} onPress={handleDismiss}>
            <Text style={styles.goBackText}>Got it, I'll go back</Text>
          </Pressable>
          <Pressable style={styles.dismissButton} onPress={handleDismiss}>
            <Text style={[styles.dismissText, { color: colors.inkLight }]}>Leave anyway</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    width: '85%',
    maxHeight: '60%',
    borderRadius: 20,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  icon: {
    fontSize: 28,
    marginRight: SPACING.sm,
  },
  title: {
    flex: 1,
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.lg,
  },
  itemsList: {
    maxHeight: 200,
    marginBottom: SPACING.lg,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  bullet: {
    fontSize: 20,
    marginRight: SPACING.sm,
    color: '#FF6B6B',
  },
  itemText: {
    fontFamily: FONTS.sans.medium,
    fontSize: FONT_SIZES.md,
  },
  buttons: {
    gap: SPACING.sm,
  },
  goBackButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  goBackText: {
    fontFamily: FONTS.sans.medium,
    fontSize: FONT_SIZES.md,
    color: '#FFFFFF',
  },
  dismissButton: {
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  dismissText: {
    fontFamily: FONTS.sans.regular,
    fontSize: FONT_SIZES.sm,
  },
});
