// GLP-1 Setup Flow — 6-screen wizard for medication profile
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { useAuthStore } from '../../src/stores/authStore';
import { useGLP1Store } from '../../src/stores/glp1Store';
import { saveGLP1Profile } from '../../src/services/glp1';
import { MEDICATIONS, type GLP1Medication, type Duration } from '../../src/services/glp1Engine';
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  HIG,
} from '../../src/constants/theme';

const TOTAL_STEPS = 6;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DURATION_OPTIONS: { id: Duration; label: string }[] = [
  { id: 'less_than_1_month', label: 'Less than 1 month' },
  { id: '1_3_months', label: '1–3 months' },
  { id: '3_6_months', label: '3–6 months' },
  { id: '6_12_months', label: '6–12 months' },
  { id: '1_year_plus', label: '1 year+' },
];

const FOOD_TRIGGERS = [
  'Greasy food',
  'Dairy',
  'Spicy',
  'Carbonated drinks',
  'High sugar',
  'Red meat',
  'Fried food',
  'Caffeine',
  'Alcohol',
  'Raw vegetables',
  'Heavy sauces',
  'Citrus',
];

// Glass section card (matches profile.tsx pattern)
function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.75)', 'rgba(250, 248, 245, 0.6)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.sectionCardBorder} />
      {children}
    </View>
  );
}

// Chip component (matches profile.tsx chip pattern)
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

export default function GLP1SetupScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const glp1Store = useGLP1Store();

  const [step, setStep] = useState(1);
  const [isOnGLP1, setIsOnGLP1] = useState<boolean | null>(null);
  const [medication, setMedication] = useState<GLP1Medication | null>(null);
  const [injectionDay, setInjectionDay] = useState<number | null>(null);
  const [duration, setDuration] = useState<Duration | null>(null);
  const [dose, setDose] = useState<string | null>(null);
  const [foodTriggers, setFoodTriggers] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const canAdvance = useCallback(() => {
    switch (step) {
      case 1: return isOnGLP1 !== null;
      case 2: return medication !== null;
      case 3: return true; // injection day is optional for daily meds
      case 4: return duration !== null;
      case 5: return true; // dose is optional
      case 6: return true; // triggers are optional
      default: return false;
    }
  }, [step, isOnGLP1, medication, injectionDay, duration, dose]);

  const handleNext = useCallback(async () => {
    // Step 1: if user said No, exit
    if (step === 1 && isOnGLP1 === false) {
      router.back();
      return;
    }

    // Step 3: skip for daily medications
    if (step === 2 && medication) {
      const medInfo = MEDICATIONS[medication];
      if (medInfo.type === 'daily') {
        setStep(4); // skip injection day for daily meds
        return;
      }
    }

    // Last step: save and finish
    if (step === TOTAL_STEPS) {
      if (!user?.id || !medication || !duration) return;

      setIsSaving(true);
      try {
        const result = await saveGLP1Profile(user.id, {
          medication,
          dose,
          injection_day: injectionDay,
          duration,
          food_triggers: foodTriggers,
        });

        if (!result.success) {
          Alert.alert('Error', 'Could not save your profile. Please try again.');
          return;
        }

        // Refresh the store
        await glp1Store.initialize(user.id);

        Alert.alert(
          'All Set!',
          'Mira will now adapt meal suggestions to your medication cycle.',
          [{ text: 'Done', onPress: () => router.back() }],
        );
      } catch {
        Alert.alert('Error', 'Something went wrong. Please try again.');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }, [step, isOnGLP1, medication, duration, dose, injectionDay, foodTriggers, user?.id]);

  const handleBack = useCallback(() => {
    if (step === 1) {
      router.back();
      return;
    }
    // Skip back over injection day for daily meds
    if (step === 4 && medication) {
      const medInfo = MEDICATIONS[medication];
      if (medInfo.type === 'daily') {
        setStep(2);
        return;
      }
    }
    setStep((s) => Math.max(s - 1, 1));
  }, [step, medication]);

  const toggleTrigger = (trigger: string) => {
    setFoodTriggers((prev) =>
      prev.includes(trigger) ? prev.filter((t) => t !== trigger) : [...prev, trigger],
    );
  };

  // Progress dots
  const renderProgress = () => (
    <View style={styles.progressContainer}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <View
          key={i}
          style={[
            styles.progressDot,
            i + 1 === step && styles.progressDotActive,
            i + 1 < step && styles.progressDotCompleted,
          ]}
        />
      ))}
    </View>
  );

  // ─── Screen 1: Are you on GLP-1? ────────────────────────────
  const renderStep1 = () => (
    <SectionCard>
      <Text style={styles.stepTitle}>GLP-1 Adaptive Meal Planning</Text>
      <Text style={styles.stepDescription}>
        If you're taking a GLP-1 medication, Mira can adapt your meal suggestions, portions, and
        timing to where you are in your injection cycle.
      </Text>

      <View style={styles.disclaimerBox}>
        <Text style={styles.disclaimerText}>
          This feature provides general nutritional guidance only. It does not replace medical advice.
          Always follow your healthcare provider's instructions regarding your medication.
        </Text>
      </View>

      <Text style={styles.questionText}>Are you currently on a GLP-1 medication?</Text>

      <View style={styles.choiceRow}>
        <Pressable
          style={[styles.choiceButton, isOnGLP1 === true && styles.choiceButtonSelected]}
          onPress={() => setIsOnGLP1(true)}
        >
          {isOnGLP1 === true && (
            <LinearGradient colors={[COLORS.gold.light, COLORS.gold.base]} style={StyleSheet.absoluteFill} />
          )}
          <Text style={[styles.choiceText, isOnGLP1 === true && styles.choiceTextSelected]}>Yes</Text>
        </Pressable>
        <Pressable
          style={[styles.choiceButton, isOnGLP1 === false && styles.choiceButtonSelected]}
          onPress={() => setIsOnGLP1(false)}
        >
          {isOnGLP1 === false && (
            <LinearGradient colors={['rgba(150,150,150,0.3)', 'rgba(150,150,150,0.2)']} style={StyleSheet.absoluteFill} />
          )}
          <Text style={[styles.choiceText, isOnGLP1 === false && { color: COLORS.text.primary }]}>No</Text>
        </Pressable>
      </View>
    </SectionCard>
  );

  // ─── Screen 2: Which medication? ────────────────────────────
  const renderStep2 = () => (
    <SectionCard>
      <Text style={styles.stepTitle}>Which medication are you on?</Text>
      <Text style={styles.stepDescription}>
        Different medications have different cycle patterns. This helps Mira give you more accurate guidance.
      </Text>

      <View style={styles.chipGrid}>
        {(Object.keys(MEDICATIONS) as GLP1Medication[]).map((med) => {
          const info = MEDICATIONS[med];
          return (
            <Chip
              key={med}
              label={`${info.brand} (${info.type})`}
              selected={medication === med}
              onPress={() => setMedication(med)}
            />
          );
        })}
      </View>
    </SectionCard>
  );

  // ─── Screen 3: Injection day ────────────────────────────────
  const renderStep3 = () => (
    <SectionCard>
      <Text style={styles.stepTitle}>What day do you inject?</Text>
      <Text style={styles.stepDescription}>
        Your cycle phase is calculated from your injection day. This helps Mira know when
        to suggest smaller portions vs. when your appetite returns.
      </Text>

      <View style={styles.chipGrid}>
        {DAY_NAMES.map((day, index) => (
          <Chip
            key={day}
            label={day}
            selected={injectionDay === index}
            onPress={() => setInjectionDay(index)}
          />
        ))}
      </View>
    </SectionCard>
  );

  // ─── Screen 4: Duration on medication ───────────────────────
  const renderStep4 = () => (
    <SectionCard>
      <Text style={styles.stepTitle}>How long have you been on this medication?</Text>
      <Text style={styles.stepDescription}>
        Your body adapts over time. Mira adjusts its recommendations based on where you are in your journey.
      </Text>

      <View style={styles.chipGrid}>
        {DURATION_OPTIONS.map((opt) => (
          <Chip
            key={opt.id}
            label={opt.label}
            selected={duration === opt.id}
            onPress={() => setDuration(opt.id)}
          />
        ))}
      </View>
    </SectionCard>
  );

  // ─── Screen 5: Current dose ─────────────────────────────────
  const renderStep5 = () => {
    const doseOptions = medication ? MEDICATIONS[medication].doses : [];
    return (
      <SectionCard>
        <Text style={styles.stepTitle}>What's your current dose?</Text>
        <Text style={styles.stepDescription}>
          Starter doses have milder appetite suppression. This helps Mira calibrate portion suggestions.
        </Text>

        <View style={styles.chipGrid}>
          {doseOptions.map((d) => (
            <Chip
              key={d}
              label={d}
              selected={dose === d}
              onPress={() => setDose(d)}
            />
          ))}
          <Chip
            label="Not sure"
            selected={dose === null && doseOptions.length > 0}
            onPress={() => setDose(null)}
          />
        </View>
      </SectionCard>
    );
  };

  // ─── Screen 6: Food triggers ────────────────────────────────
  const renderStep6 = () => (
    <SectionCard>
      <Text style={styles.stepTitle}>Any foods that trigger nausea?</Text>
      <Text style={styles.stepDescription}>
        Many GLP-1 users find certain foods harder to tolerate. Mira will warn you when adding
        these to your grocery list. Select all that apply, or skip if none.
      </Text>

      <View style={styles.chipGrid}>
        {FOOD_TRIGGERS.map((trigger) => (
          <Chip
            key={trigger}
            label={trigger}
            selected={foodTriggers.includes(trigger)}
            onPress={() => toggleTrigger(trigger)}
          />
        ))}
      </View>
    </SectionCard>
  );

  const renderStep = () => {
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      default: return null;
    }
  };

  return (
    <ScreenWrapper>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backText}>{step === 1 ? 'Cancel' : '\u2190 Back'}</Text>
          </Pressable>
          <Text style={styles.stepIndicator}>Step {step} of {TOTAL_STEPS}</Text>
        </View>

        {renderProgress()}
        {renderStep()}
      </ScrollView>

      {/* Bottom Action Button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + SPACING.md }]}>
        <Pressable
          style={[styles.nextButton, !canAdvance() && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!canAdvance() || isSaving}
        >
          <LinearGradient
            colors={canAdvance() ? [COLORS.gold.light, COLORS.gold.base] : ['#ccc', '#bbb']}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.nextButtonText}>
            {isSaving
              ? 'Saving...'
              : step === 1 && isOnGLP1 === false
                ? 'Not For Me'
                : step === TOTAL_STEPS
                  ? 'Complete Setup'
                  : 'Continue'}
          </Text>
        </Pressable>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  backButton: {
    minHeight: HIG.minTouchTarget,
    justifyContent: 'center',
  },
  backText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gold.dark,
    fontWeight: '600',
  },
  stepIndicator: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
  },

  // Progress dots
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: SPACING.lg,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  progressDotActive: {
    backgroundColor: COLORS.gold.base,
    width: 24,
  },
  progressDotCompleted: {
    backgroundColor: COLORS.gold.light,
  },

  // Section card
  sectionCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    padding: SPACING.lg,
    ...SHADOWS.glass,
  },
  sectionCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },

  // Step content
  stepTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  stepDescription: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  questionText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },

  // Disclaimer
  disclaimerBox: {
    backgroundColor: 'rgba(212, 165, 71, 0.08)',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 165, 71, 0.2)',
  },
  disclaimerText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    lineHeight: 20,
    fontStyle: 'italic',
  },

  // Choice buttons (Yes/No)
  choiceRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  choiceButton: {
    flex: 1,
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  choiceButtonSelected: {
    borderColor: COLORS.gold.base,
  },
  choiceText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  choiceTextSelected: {
    color: COLORS.white,
  },

  // Chip grid
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

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    backgroundColor: 'rgba(250, 248, 245, 0.9)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  nextButton: {
    height: 52,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...SHADOWS.goldGlow,
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.white,
  },
});
