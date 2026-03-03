// GLP-1 Injection Logger — modal to log injection events
// Records: date/time, dose, site, side effects, appetite, notes

import React, { useState } from 'react';
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
import { logInjection } from '../services/glp1';
import { MEDICATIONS } from '../services/glp1Engine';
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../constants/theme';

interface GLP1InjectionLoggerProps {
  visible: boolean;
  onClose: () => void;
}

const INJECTION_SITES = [
  { id: 'left_abdomen', label: 'Left Abdomen' },
  { id: 'right_abdomen', label: 'Right Abdomen' },
  { id: 'left_thigh', label: 'Left Thigh' },
  { id: 'right_thigh', label: 'Right Thigh' },
  { id: 'upper_arm', label: 'Upper Arm' },
];

const SIDE_EFFECTS = [
  'Nausea',
  'Headache',
  'Fatigue',
  'Injection site pain',
  'Diarrhea',
  'Constipation',
  'Dizziness',
  'Bloating',
];

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      {selected && (
        <LinearGradient
          colors={[COLORS.gold.light, COLORS.gold.base]}
          style={StyleSheet.absoluteFill}
        />
      )}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {selected ? '\u2713 ' : ''}{label}
      </Text>
    </Pressable>
  );
}

export function GLP1InjectionLogger({ visible, onClose }: GLP1InjectionLoggerProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { profile, refresh } = useGLP1Store();

  const [dose, setDose] = useState<string | null>(profile?.dose ?? null);
  const [site, setSite] = useState<string | null>(null);
  const [sideEffects, setSideEffects] = useState<string[]>([]);
  const [appetite, setAppetite] = useState(3);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const medInfo = profile?.medication ? MEDICATIONS[profile.medication] : null;
  const doseOptions = medInfo?.doses ?? [];

  const toggleSideEffect = (effect: string) => {
    setSideEffects((prev) =>
      prev.includes(effect) ? prev.filter((e) => e !== effect) : [...prev, effect],
    );
  };

  const handleSave = async () => {
    if (!user?.id) return;

    setIsSaving(true);
    try {
      const result = await logInjection(user.id, {
        dose,
        injection_site: site,
        side_effects: sideEffects,
        appetite_level: appetite,
        notes: notes.trim() || null,
      });

      if (!result.success) {
        Alert.alert('Error', 'Could not log injection. Please try again.');
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
            <Text style={styles.title}>Log Injection</Text>
            <Text style={styles.subtitle}>
              {medInfo ? `${medInfo.brand} injection` : 'Record your injection'}
            </Text>

            {/* Dose */}
            {doseOptions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Dose</Text>
                <View style={styles.chipGrid}>
                  {doseOptions.map((d) => (
                    <Chip key={d} label={d} selected={dose === d} onPress={() => setDose(d)} />
                  ))}
                </View>
              </View>
            )}

            {/* Injection Site */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Injection Site</Text>
              <View style={styles.chipGrid}>
                {INJECTION_SITES.map((s) => (
                  <Chip
                    key={s.id}
                    label={s.label}
                    selected={site === s.id}
                    onPress={() => setSite(s.id)}
                  />
                ))}
              </View>
            </View>

            {/* Side Effects */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Side Effects (if any)</Text>
              <View style={styles.chipGrid}>
                {SIDE_EFFECTS.map((effect) => (
                  <Chip
                    key={effect}
                    label={effect}
                    selected={sideEffects.includes(effect)}
                    onPress={() => toggleSideEffect(effect)}
                  />
                ))}
              </View>
            </View>

            {/* Appetite */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Current Appetite</Text>
              <View style={styles.appetiteRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    style={[styles.appetiteDot, appetite === n && styles.appetiteDotActive]}
                    onPress={() => setAppetite(n)}
                  >
                    {appetite === n && (
                      <LinearGradient
                        colors={[COLORS.gold.light, COLORS.gold.base]}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <Text
                      style={[
                        styles.appetiteDotText,
                        appetite === n && styles.appetiteDotTextActive,
                      ]}
                    >
                      {n}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.appetiteLabels}>
                <Text style={styles.appetiteEndLabel}>No appetite</Text>
                <Text style={styles.appetiteEndLabel}>Very hungry</Text>
              </View>
            </View>

            {/* Notes */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Notes (optional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Any observations?"
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
            <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Log Injection'}</Text>
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
    maxHeight: '90%',
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

  // Sections
  section: {
    marginBottom: SPACING.lg,
  },
  sectionLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },

  // Chips
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    overflow: 'hidden',
  },
  chipSelected: {
    borderColor: COLORS.gold.base,
  },
  chipText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
  chipTextSelected: {
    color: COLORS.white,
    fontWeight: '600',
  },

  // Appetite
  appetiteRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  appetiteDot: {
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
  appetiteDotActive: {
    borderColor: COLORS.gold.base,
  },
  appetiteDotText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
  appetiteDotTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  appetiteLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  appetiteEndLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
  },

  // Notes
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
