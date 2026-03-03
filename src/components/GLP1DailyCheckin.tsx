// GLP-1 Daily Check-in — Bottom sheet modal (10-second interaction)
// Tracks appetite, nausea, energy, protein, water

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../stores/authStore';
import { useGLP1Store } from '../stores/glp1Store';
import { logDailyCheckin } from '../services/glp1';
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  HIG,
} from '../constants/theme';

interface GLP1DailyCheckinProps {
  visible: boolean;
  onClose: () => void;
}

function RatingRow({
  label,
  value,
  onChange,
  max,
  emoji,
  lowLabel,
  highLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max: number;
  emoji: string;
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <View style={styles.ratingRow}>
      <Text style={styles.ratingLabel}>{emoji} {label}</Text>
      <View style={styles.ratingButtons}>
        {Array.from({ length: max }, (_, i) => i + (max === 6 ? 0 : 1)).map((n) => (
          <Pressable
            key={n}
            style={[styles.ratingDot, value === n && styles.ratingDotActive]}
            onPress={() => onChange(n)}
          >
            {value === n && (
              <LinearGradient
                colors={[COLORS.gold.light, COLORS.gold.base]}
                style={StyleSheet.absoluteFill}
              />
            )}
            <Text style={[styles.ratingDotText, value === n && styles.ratingDotTextActive]}>
              {n}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.ratingLabels}>
        <Text style={styles.ratingEndLabel}>{lowLabel}</Text>
        <Text style={styles.ratingEndLabel}>{highLabel}</Text>
      </View>
    </View>
  );
}

function CounterRow({
  label,
  value,
  onChange,
  emoji,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  emoji: string;
  unit: string;
}) {
  return (
    <View style={styles.counterRow}>
      <Text style={styles.counterLabel}>{emoji} {label}</Text>
      <View style={styles.counterControls}>
        <Pressable
          style={styles.counterButton}
          onPress={() => onChange(Math.max(0, value - 1))}
        >
          <Text style={styles.counterButtonText}>-</Text>
        </Pressable>
        <Text style={styles.counterValue}>{value} {unit}</Text>
        <Pressable
          style={styles.counterButton}
          onPress={() => onChange(value + 1)}
        >
          <Text style={styles.counterButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function GLP1DailyCheckin({ visible, onClose }: GLP1DailyCheckinProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { todaysLog, refresh } = useGLP1Store();

  const [appetite, setAppetite] = useState(3);
  const [nausea, setNausea] = useState(0);
  const [energy, setEnergy] = useState(3);
  const [protein, setProtein] = useState(0);
  const [water, setWater] = useState(0);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Pre-fill from today's existing log
  useEffect(() => {
    if (todaysLog) {
      setAppetite(todaysLog.appetite ?? 3);
      setNausea(todaysLog.nausea ?? 0);
      setEnergy(todaysLog.energy ?? 3);
      setProtein(todaysLog.protein_servings ?? 0);
      setWater(todaysLog.water_glasses ?? 0);
      setNotes(todaysLog.notes ?? '');
    }
  }, [todaysLog]);

  const handleSave = async () => {
    if (!user?.id) return;

    setIsSaving(true);
    try {
      const result = await logDailyCheckin(user.id, {
        appetite,
        nausea,
        energy,
        protein_servings: protein,
        water_glasses: water,
        notes: notes.trim() || null,
      });

      if (!result.success) {
        Alert.alert('Error', 'Could not save check-in. Please try again.');
        return;
      }

      await refresh(user.id);
      onClose();
    } catch {
      Alert.alert('Error', 'Something went wrong.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + SPACING.md }]}>
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.95)', 'rgba(250, 248, 245, 0.9)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.sheetBorder} />

          {/* Handle */}
          <View style={styles.handle} />

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Daily Check-in</Text>
            <Text style={styles.subtitle}>Quick snapshot of how you're feeling today</Text>

            <RatingRow
              label="Appetite"
              value={appetite}
              onChange={setAppetite}
              max={5}
              emoji="\u{1F37D}\u{FE0F}"
              lowLabel="None"
              highLabel="Very hungry"
            />

            <RatingRow
              label="Nausea"
              value={nausea}
              onChange={setNausea}
              max={6}
              emoji="\u{1F922}"
              lowLabel="None"
              highLabel="Severe"
            />

            <RatingRow
              label="Energy"
              value={energy}
              onChange={setEnergy}
              max={5}
              emoji="\u{26A1}"
              lowLabel="Exhausted"
              highLabel="Energized"
            />

            <CounterRow
              label="Protein Servings"
              value={protein}
              onChange={setProtein}
              emoji="\u{1F969}"
              unit="servings"
            />

            <CounterRow
              label="Water"
              value={water}
              onChange={setWater}
              emoji="\u{1F4A7}"
              unit="glasses"
            />

            {/* Notes */}
            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>Notes (optional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="How are you feeling?"
                placeholderTextColor={COLORS.text.secondary}
                value={notes}
                onChangeText={setNotes}
                multiline
                maxLength={200}
              />
            </View>
          </ScrollView>

          {/* Save Button */}
          <Pressable
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <LinearGradient
              colors={[COLORS.gold.light, COLORS.gold.base]}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Check-in'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  sheetBorder: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderBottomWidth: 0,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.lg,
  },

  // Rating row
  ratingRow: {
    marginBottom: SPACING.lg,
  },
  ratingLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  ratingButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  ratingDot: {
    flex: 1,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    overflow: 'hidden',
  },
  ratingDotActive: {
    borderColor: COLORS.gold.base,
  },
  ratingDotText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
  ratingDotTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  ratingLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  ratingEndLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
  },

  // Counter row
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  counterLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  counterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: HIG.minTouchTarget,
    minHeight: HIG.minTouchTarget,
  },
  counterButtonText: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  counterValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
    minWidth: 80,
    textAlign: 'center',
  },

  // Notes
  notesContainer: {
    marginBottom: SPACING.lg,
  },
  notesLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.sm,
  },
  notesInput: {
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
    minHeight: 60,
    textAlignVertical: 'top',
  },

  // Save
  saveButton: {
    height: 52,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: SPACING.sm,
    ...SHADOWS.goldGlow,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.white,
  },
});
