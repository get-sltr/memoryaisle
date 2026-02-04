import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../src/stores/authStore';
import { saveDietaryPreferences } from '../../src/services/auth';
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../../src/constants/theme';
import type { DietaryPreference, AllergenType, CulturalPreference } from '../../src/types';

const DIETARY_OPTIONS: { id: DietaryPreference; label: string; icon: string }[] = [
  { id: 'halal', label: 'Halal', icon: '\u262A\uFE0F' },
  { id: 'kosher', label: 'Kosher', icon: '\u2721\uFE0F' },
  { id: 'vegetarian', label: 'Vegetarian', icon: '\uD83E\uDD66' },
  { id: 'vegan', label: 'Vegan', icon: '\uD83C\uDF3F' },
  { id: 'keto', label: 'Keto', icon: '\uD83E\uDD51' },
  { id: 'gluten-free', label: 'Gluten-Free', icon: '\uD83C\uDF3E' },
  { id: 'dairy-free', label: 'Dairy-Free', icon: '\uD83E\uDD5B' },
  { id: 'nut-free', label: 'Nut-Free', icon: '\uD83E\uDD5C' },
];

const ALLERGEN_OPTIONS: { id: AllergenType; label: string; icon: string }[] = [
  { id: 'dairy', label: 'Dairy', icon: '\uD83E\uDDC0' },
  { id: 'eggs', label: 'Eggs', icon: '\uD83E\uDD5A' },
  { id: 'tree_nuts', label: 'Tree Nuts', icon: '\uD83C\uDF30' },
  { id: 'peanuts', label: 'Peanuts', icon: '\uD83E\uDD5C' },
  { id: 'shellfish', label: 'Shellfish', icon: '\uD83E\uDD90' },
  { id: 'fish', label: 'Fish', icon: '\uD83D\uDC1F' },
  { id: 'wheat', label: 'Wheat/Gluten', icon: '\uD83C\uDF3E' },
  { id: 'soy', label: 'Soy', icon: '\uD83C\uDF31' },
  { id: 'sesame', label: 'Sesame', icon: '\uD83C\uDF6A' },
];

const CULTURAL_OPTIONS: { id: CulturalPreference; label: string; icon: string }[] = [
  { id: 'secular', label: 'Secular/US Holidays', icon: '\uD83C\uDDFA\uD83C\uDDF8' },
  { id: 'christian', label: 'Christian', icon: '\u271D\uFE0F' },
  { id: 'jewish', label: 'Jewish', icon: '\u2721\uFE0F' },
  { id: 'muslim', label: 'Muslim', icon: '\u262A\uFE0F' },
  { id: 'hindu', label: 'Hindu', icon: '\uD83D\uDD49\uFE0F' },
  { id: 'buddhist', label: 'Buddhist', icon: '\u2638\uFE0F' },
  { id: 'chinese', label: 'Chinese', icon: '\uD83E\uDDE7' },
];

export default function DietarySetup() {
  const { household, setHousehold } = useAuthStore();

  const [selectedDietary, setSelectedDietary] = useState<DietaryPreference[]>([]);
  const [selectedAllergens, setSelectedAllergens] = useState<AllergenType[]>([]);
  const [selectedCultural, setSelectedCultural] = useState<CulturalPreference[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleDietary = (id: DietaryPreference) => {
    setSelectedDietary(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const toggleAllergen = (id: AllergenType) => {
    setSelectedAllergens(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const toggleCultural = (id: CulturalPreference) => {
    setSelectedCultural(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleContinue = async () => {
    if (!household) {
      router.replace('/(app)');
      return;
    }

    setLoading(true);

    const existingProfile = household.familyProfile || {};
    const updatedProfile = {
      ...existingProfile,
      dietarySetupCompleted: true,
      culturalPreferences: selectedCultural.length > 0 ? selectedCultural : existingProfile.culturalPreferences,
    };

    const { success, error } = await saveDietaryPreferences(
      household.id,
      selectedDietary,
      selectedCultural,
      updatedProfile,
    );

    setLoading(false);

    if (!success) {
      Alert.alert('Error', error || 'Failed to save preferences');
      return;
    }

    // Update local store
    setHousehold({
      ...household,
      dietary_preferences: selectedDietary,
      cultural_preferences: selectedCultural,
      familyProfile: updatedProfile,
    });

    router.replace('/(app)');
  };

  const handleSkip = async () => {
    if (!household) {
      router.replace('/(app)');
      return;
    }

    // Mark setup as done so we don't show again
    const existingProfile = household.familyProfile || {};
    const updatedProfile = {
      ...existingProfile,
      dietarySetupCompleted: true,
    };

    const { success } = await saveDietaryPreferences(
      household.id,
      [],
      [],
      updatedProfile,
    );

    if (success) {
      setHousehold({
        ...household,
        familyProfile: updatedProfile,
      });
    }

    router.replace('/(app)');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[
          COLORS.background.start,
          COLORS.background.mid1,
          COLORS.background.mid2,
          COLORS.background.end,
        ]}
        locations={[0, 0.4, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>What does your family eat?</Text>
          <Text style={styles.subtitle}>
            Help Mira keep your kitchen safe & smart
          </Text>
        </View>

        {/* Section 1: Dietary Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dietary Preferences</Text>
          <View style={styles.chipGrid}>
            {DIETARY_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                style={[
                  styles.chip,
                  selectedDietary.includes(option.id) && styles.chipSelected,
                ]}
                onPress={() => toggleDietary(option.id)}
              >
                <BlurView intensity={15} tint="light" style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={selectedDietary.includes(option.id)
                    ? [`${COLORS.gold.light}40`, `${COLORS.gold.base}20`]
                    : ['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.3)']
                  }
                  style={StyleSheet.absoluteFill}
                />
                <View style={[
                  styles.chipBorder,
                  selectedDietary.includes(option.id) && styles.chipBorderSelected,
                ]} />
                <View style={styles.chipContent}>
                  <Text style={styles.chipIcon}>{option.icon}</Text>
                  <Text style={[
                    styles.chipLabel,
                    selectedDietary.includes(option.id) && styles.chipLabelSelected,
                  ]}>
                    {option.label}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Section 2: Allergies */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Allergies</Text>
          <Text style={styles.sectionHint}>Select any allergies in your household</Text>
          <View style={styles.chipGrid}>
            {ALLERGEN_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                style={[
                  styles.chip,
                  selectedAllergens.includes(option.id) && styles.chipSelected,
                ]}
                onPress={() => toggleAllergen(option.id)}
              >
                <BlurView intensity={15} tint="light" style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={selectedAllergens.includes(option.id)
                    ? ['rgba(239, 83, 80, 0.2)', 'rgba(239, 83, 80, 0.1)']
                    : ['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.3)']
                  }
                  style={StyleSheet.absoluteFill}
                />
                <View style={[
                  styles.chipBorder,
                  selectedAllergens.includes(option.id) && styles.chipBorderAllergen,
                ]} />
                <View style={styles.chipContent}>
                  <Text style={styles.chipIcon}>{option.icon}</Text>
                  <Text style={[
                    styles.chipLabel,
                    selectedAllergens.includes(option.id) && styles.chipLabelAllergen,
                  ]}>
                    {option.label}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Section 3: Cultural/Religious Calendar */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cultural & Religious Calendar</Text>
          <Text style={styles.sectionHint}>Mira will remember your celebrations</Text>
          <View style={styles.chipGrid}>
            {CULTURAL_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                style={[
                  styles.chip,
                  selectedCultural.includes(option.id) && styles.chipSelected,
                ]}
                onPress={() => toggleCultural(option.id)}
              >
                <BlurView intensity={15} tint="light" style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={selectedCultural.includes(option.id)
                    ? [`${COLORS.gold.light}40`, `${COLORS.gold.base}20`]
                    : ['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.3)']
                  }
                  style={StyleSheet.absoluteFill}
                />
                <View style={[
                  styles.chipBorder,
                  selectedCultural.includes(option.id) && styles.chipBorderSelected,
                ]} />
                <View style={styles.chipContent}>
                  <Text style={styles.chipIcon}>{option.icon}</Text>
                  <Text style={[
                    styles.chipLabel,
                    selectedCultural.includes(option.id) && styles.chipLabelSelected,
                  ]}>
                    {option.label}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Continue Button */}
        <Pressable
          style={[styles.continueButton, loading && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={loading}
        >
          <LinearGradient
            colors={[COLORS.gold.light, COLORS.gold.base]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.continueButtonBorder} />
          <Text style={styles.continueButtonText}>
            {loading ? 'Saving...' : 'Continue'}
          </Text>
        </Pressable>

        {/* Skip Link */}
        <Pressable style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 80,
    paddingBottom: SPACING.xxl,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  title: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.title,
    fontWeight: '500',
    color: COLORS.text.primary,
    letterSpacing: -0.5,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    lineHeight: 22,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  sectionHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.sm,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    minWidth: 100,
  },
  chipSelected: {},
  chipBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(200, 200, 210, 0.4)',
  },
  chipBorderSelected: {
    borderColor: COLORS.gold.base,
    borderWidth: 1.5,
  },
  chipBorderAllergen: {
    borderColor: '#EF5350',
    borderWidth: 1.5,
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    gap: SPACING.xs,
  },
  chipIcon: {
    fontSize: 16,
  },
  chipLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  chipLabelSelected: {
    color: COLORS.gold.dark,
    fontWeight: '600',
  },
  chipLabelAllergen: {
    color: '#C62828',
    fontWeight: '600',
  },
  continueButton: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    marginTop: SPACING.md,
    ...SHADOWS.goldGlow,
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  continueButtonText: {
    textAlign: 'center',
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: '#FFF',
    paddingVertical: SPACING.md + 2,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  skipButton: {
    alignSelf: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  skipText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    fontStyle: 'italic',
  },
  bottomPadding: {
    height: 40,
  },
});
