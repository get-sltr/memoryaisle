import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import {
  FamilyHomeGlassIcon,
  FamilyGlassIcon,
  GlassIconWrapper,
  MomentGlassIcon,
} from '../../src/components/GlassIcons';
import { useAuthStore } from '../../src/stores/authStore';
import { mira } from '../../src/services/mira';
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../../src/constants/theme';
import type { CulturalPreference, WeeklyTradition, DietaryPreference, AllergenType } from '../../src/types';
import { saveDietaryPreferences } from '../../src/services/auth';
import { supabase } from '../../src/services/supabase';

// Member role options
const ROLE_OPTIONS = [
  { id: 'husband', label: 'Husband', icon: '👨' },
  { id: 'wife', label: 'Wife', icon: '👩' },
  { id: 'partner', label: 'Partner', icon: '💑' },
  { id: 'son', label: 'Son', icon: '👦' },
  { id: 'daughter', label: 'Daughter', icon: '👧' },
  { id: 'mom', label: 'Mom', icon: '👩‍👧' },
  { id: 'dad', label: 'Dad', icon: '👨‍👦' },
];

// Dietary preference options
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

// Allergen options
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

// Cultural/Religious options
const CULTURAL_OPTIONS: { id: CulturalPreference; label: string; icon: string }[] = [
  { id: 'secular', label: 'Secular/US Holidays', icon: '🇺🇸' },
  { id: 'christian', label: 'Christian', icon: '✝️' },
  { id: 'jewish', label: 'Jewish', icon: '✡️' },
  { id: 'muslim', label: 'Muslim', icon: '☪️' },
  { id: 'hindu', label: 'Hindu', icon: '🕉️' },
  { id: 'buddhist', label: 'Buddhist', icon: '☸️' },
  { id: 'chinese', label: 'Chinese', icon: '🧧' },
];

// Pre-built weekly tradition templates
const TRADITION_TEMPLATES: { id: string; name: string; dayOfWeek: number; icon: string; items: string[] }[] = [
  { id: 'taco_tuesday', name: 'Taco Tuesday', dayOfWeek: 2, icon: '🌮', items: ['taco shells', 'ground beef', 'cheese', 'lettuce', 'salsa', 'sour cream'] },
  { id: 'pizza_friday', name: 'Pizza Friday', dayOfWeek: 5, icon: '🍕', items: ['pizza dough', 'tomato sauce', 'mozzarella', 'pepperoni', 'vegetables'] },
  { id: 'sunday_pancakes', name: 'Sunday Pancakes', dayOfWeek: 0, icon: '🥞', items: ['pancake mix', 'eggs', 'milk', 'butter', 'maple syrup', 'bacon'] },
  { id: 'spaghetti_wednesday', name: 'Spaghetti Wednesday', dayOfWeek: 3, icon: '🍝', items: ['spaghetti', 'marinara sauce', 'ground beef', 'parmesan', 'garlic bread'] },
  { id: 'fish_friday', name: 'Fish Friday', dayOfWeek: 5, icon: '🐟', items: ['fish fillets', 'lemon', 'tartar sauce', 'coleslaw', 'french fries'] },
  { id: 'burger_saturday', name: 'Burger Saturday', dayOfWeek: 6, icon: '🍔', items: ['hamburger buns', 'ground beef', 'cheese', 'lettuce', 'tomato', 'onion', 'pickles'] },
  { id: 'soup_sunday', name: 'Soup Sunday', dayOfWeek: 0, icon: '🍲', items: ['chicken broth', 'vegetables', 'noodles', 'bread'] },
  { id: 'margarita_monday', name: 'Margarita Monday', dayOfWeek: 1, icon: '🍹', items: ['tequila', 'lime juice', 'triple sec', 'salt', 'limes'] },
];

// Days of the week
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function FamilyScreen() {
  const { household, setHousehold } = useAuthStore();
  const familyProfile = household?.familyProfile || {};

  // Form state
  const [familyName, setFamilyName] = useState(familyProfile.familyName || '');
  const [familyMotto, setFamilyMotto] = useState(familyProfile.familyMotto || '');

  // Dietary preferences (household-level)
  const [dietaryPreferences, setDietaryPreferences] = useState<DietaryPreference[]>(
    (household?.dietary_preferences as DietaryPreference[]) || []
  );
  const [householdAllergens, setHouseholdAllergens] = useState<AllergenType[]>(
    // Extract from familyProfile if stored there, otherwise empty
    (familyProfile as any)?.allergens || []
  );

  // Cultural & Calendar preferences
  const [culturalPreferences, setCulturalPreferences] = useState<CulturalPreference[]>(
    familyProfile.culturalPreferences || ['secular']
  );
  const [weeklyTraditions, setWeeklyTraditions] = useState<WeeklyTradition[]>(
    familyProfile.weeklyTraditions || []
  );
  const [shoppingDay, setShoppingDay] = useState<number | undefined>(
    familyProfile.usualShoppingDay
  );

  const [favoriteActivities, setFavoriteActivities] = useState(
    familyProfile.favoriteActivities?.join(', ') || ''
  );
  const [favoriteMeals, setFavoriteMeals] = useState(
    familyProfile.favoriteMealsTogether?.join(', ') || ''
  );
  const [traditions, setTraditions] = useState(
    familyProfile.familyTraditions?.join(', ') || ''
  );
  const [favoriteRestaurant, setFavoriteRestaurant] = useState(
    familyProfile.favoriteRestaurant || ''
  );
  const [favoriteTakeout, setFavoriteTakeout] = useState(
    familyProfile.favoriteTakeout || ''
  );
  const [movieNightSnacks, setMovieNightSnacks] = useState(
    familyProfile.movieNightSnacks?.join(', ') || ''
  );
  const [gameNightSnacks, setGameNightSnacks] = useState(
    familyProfile.gameNightSnacks?.join(', ') || ''
  );
  const [weeklyGoals, setWeeklyGoals] = useState(
    familyProfile.weeklyGoals?.join(', ') || ''
  );
  const [healthGoals, setHealthGoals] = useState(
    familyProfile.healthGoals?.join(', ') || ''
  );
  const [hasChanges, setHasChanges] = useState(false);

  // Family member management state
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('other');
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Spark Joy state
  const [sparkJoySuggestion, setSparkJoySuggestion] = useState<string | null>(null);
  const [isLoadingSparkJoy, setIsLoadingSparkJoy] = useState(false);

  // Track changes
  useEffect(() => {
    const original = household?.familyProfile || {};
    const changed =
      familyName !== (original.familyName || '') ||
      familyMotto !== (original.familyMotto || '') ||
      JSON.stringify(dietaryPreferences) !== JSON.stringify((household?.dietary_preferences as DietaryPreference[]) || []) ||
      JSON.stringify(householdAllergens) !== JSON.stringify((original as any)?.allergens || []) ||
      JSON.stringify(culturalPreferences) !== JSON.stringify(original.culturalPreferences || ['secular']) ||
      JSON.stringify(weeklyTraditions) !== JSON.stringify(original.weeklyTraditions || []) ||
      shoppingDay !== original.usualShoppingDay ||
      favoriteActivities !== (original.favoriteActivities?.join(', ') || '') ||
      favoriteMeals !== (original.favoriteMealsTogether?.join(', ') || '') ||
      traditions !== (original.familyTraditions?.join(', ') || '') ||
      favoriteRestaurant !== (original.favoriteRestaurant || '') ||
      favoriteTakeout !== (original.favoriteTakeout || '') ||
      movieNightSnacks !== (original.movieNightSnacks?.join(', ') || '') ||
      gameNightSnacks !== (original.gameNightSnacks?.join(', ') || '') ||
      weeklyGoals !== (original.weeklyGoals?.join(', ') || '') ||
      healthGoals !== (original.healthGoals?.join(', ') || '');
    setHasChanges(changed);
  }, [
    familyName, familyMotto, dietaryPreferences, householdAllergens,
    culturalPreferences, weeklyTraditions, shoppingDay,
    favoriteActivities, favoriteMeals, traditions,
    favoriteRestaurant, favoriteTakeout, movieNightSnacks, gameNightSnacks,
    weeklyGoals, healthGoals, household,
  ]);

  const parseList = (str: string) => str.split(',').map(s => s.trim()).filter(Boolean);

  // Add a family member
  const handleAddMember = async () => {
    if (!newMemberName.trim() || !household?.id) return;
    setIsAddingMember(true);
    try {
      const { data, error } = await supabase
        .from('family_members')
        .insert({
          household_id: household.id,
          name: newMemberName.trim(),
          role: newMemberRole,
        })
        .select()
        .single();

      if (error) throw error;

      // Update local store
      const updatedMembers = [...(household.members || []), {
        id: data.id,
        name: data.name,
        role: data.role,
      }];
      setHousehold({ ...household, members: updatedMembers });

      setNewMemberName('');
      setNewMemberRole('other');
      setShowAddMember(false);
      Alert.alert('Added!', `${data.name} has been added to your family.`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add family member');
    } finally {
      setIsAddingMember(false);
    }
  };

  // Remove a family member
  const handleRemoveMember = (member: { id: string; name: string }) => {
    Alert.alert(
      'Remove Member',
      `Remove ${member.name} from your family?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!household) return;
            try {
              const { error } = await supabase
                .from('family_members')
                .delete()
                .eq('id', member.id);

              if (error) throw error;

              const updatedMembers = (household.members || []).filter(m => m.id !== member.id);
              setHousehold({ ...household, members: updatedMembers });
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to remove family member');
            }
          },
        },
      ]
    );
  };

  // Generate Spark Joy suggestion
  const generateSparkJoy = useCallback(async () => {
    if (isLoadingSparkJoy) return;
    setIsLoadingSparkJoy(true);
    setSparkJoySuggestion(null);

    try {
      // Build context from family profile
      const context: string[] = [];
      if (favoriteMeals) context.push(`Favorite meals: ${favoriteMeals}`);
      if (weeklyTraditions.length > 0) {
        context.push(`Weekly traditions: ${weeklyTraditions.map(t => t.name).join(', ')}`);
      }
      if (healthGoals) context.push(`Health goals: ${healthGoals}`);
      if (movieNightSnacks) context.push(`Movie night snacks: ${movieNightSnacks}`);
      if (gameNightSnacks) context.push(`Game night snacks: ${gameNightSnacks}`);

      // Get family members with allergies from household
      const members = household?.members || [];
      const allergies = members
        .filter(m => m.allergies && m.allergies.length > 0)
        .map(m => `${m.name}: ${m.allergies?.join(', ')}`);
      if (allergies.length > 0) {
        context.push(`Allergies to consider: ${allergies.join('; ')}`);
      }

      const prompt = context.length > 0
        ? `Based on this family's preferences:\n${context.join('\n')}\n\nGive ONE short, personalized meal or activity suggestion. Be warm and specific. Max 2 sentences.`
        : `Give a fun family meal or activity suggestion. Be warm and friendly. Max 2 sentences.`;

      const result = await mira.processText(prompt, { currentListItems: [] });
      setSparkJoySuggestion(result.response);
    } catch (error) {
      setSparkJoySuggestion("Couldn't generate a suggestion right now. Try again later!");
    } finally {
      setIsLoadingSparkJoy(false);
    }
  }, [favoriteMeals, weeklyTraditions, healthGoals, movieNightSnacks, gameNightSnacks, household, isLoadingSparkJoy]);

  // Toggle dietary preference
  const toggleDietaryPref = (pref: DietaryPreference) => {
    setDietaryPreferences(prev =>
      prev.includes(pref)
        ? prev.filter(p => p !== pref)
        : [...prev, pref]
    );
  };

  // Toggle household allergen
  const toggleHouseholdAllergen = (allergen: AllergenType) => {
    setHouseholdAllergens(prev =>
      prev.includes(allergen)
        ? prev.filter(a => a !== allergen)
        : [...prev, allergen]
    );
  };

  // Toggle cultural preference
  const toggleCulturalPref = (pref: CulturalPreference) => {
    setCulturalPreferences(prev =>
      prev.includes(pref)
        ? prev.filter(p => p !== pref)
        : [...prev, pref]
    );
  };

  // Toggle weekly tradition
  const toggleTradition = (template: typeof TRADITION_TEMPLATES[0]) => {
    setWeeklyTraditions(prev => {
      const exists = prev.find(t => t.id === template.id);
      if (exists) {
        return prev.filter(t => t.id !== template.id);
      }
      return [...prev, {
        id: template.id,
        name: template.name,
        dayOfWeek: template.dayOfWeek,
        icon: template.icon,
        usualItems: template.items,
        isActive: true,
      }];
    });
  };

  // Check if tradition is active
  const isTraditionActive = (id: string) => weeklyTraditions.some(t => t.id === id);

  const handleSave = async () => {
    const updatedProfile = {
      familyName: familyName || undefined,
      familyMotto: familyMotto || undefined,
      culturalPreferences: culturalPreferences.length > 0 ? culturalPreferences : undefined,
      weeklyTraditions: weeklyTraditions.length > 0 ? weeklyTraditions : undefined,
      usualShoppingDay: shoppingDay,
      favoriteActivities: parseList(favoriteActivities).length > 0 ? parseList(favoriteActivities) : undefined,
      favoriteMealsTogether: parseList(favoriteMeals).length > 0 ? parseList(favoriteMeals) : undefined,
      familyTraditions: parseList(traditions).length > 0 ? parseList(traditions) : undefined,
      favoriteRestaurant: favoriteRestaurant || undefined,
      favoriteTakeout: favoriteTakeout || undefined,
      movieNightSnacks: parseList(movieNightSnacks).length > 0 ? parseList(movieNightSnacks) : undefined,
      gameNightSnacks: parseList(gameNightSnacks).length > 0 ? parseList(gameNightSnacks) : undefined,
      weeklyGoals: parseList(weeklyGoals).length > 0 ? parseList(weeklyGoals) : undefined,
      healthGoals: parseList(healthGoals).length > 0 ? parseList(healthGoals) : undefined,
      // Preserve existing data
      specialDates: familyProfile.specialDates,
      upcomingBirthdays: familyProfile.upcomingBirthdays,
      anniversaries: familyProfile.anniversaries,
    };

    if (household) {
      // Save dietary preferences and family profile to Supabase
      const profileWithAllergens = {
        ...updatedProfile,
        allergens: householdAllergens.length > 0 ? householdAllergens : undefined,
      };

      const { success, error } = await saveDietaryPreferences(
        household.id,
        dietaryPreferences,
        culturalPreferences,
        profileWithAllergens,
      );

      if (!success) {
        Alert.alert('Error', error || 'Failed to save preferences');
        return;
      }

      // Update local store
      setHousehold({
        ...household,
        dietary_preferences: dietaryPreferences,
        cultural_preferences: culturalPreferences,
        familyProfile: profileWithAllergens,
      });
    }

    Alert.alert(
      familyName ? `${familyName} Updated!` : 'Family Profile Saved!',
      familyMotto ? `"${familyMotto}" - Your moments are saved.` : 'Your shared memories are saved.',
      [{ text: 'OK' }]
    );
    setHasChanges(false);
  };

  const members = household?.members || [];

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0.3)']}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.backText}>{'\u2039'} Back</Text>
        </Pressable>
        <View style={styles.titleContainer}>
          <GlassIconWrapper size={44} variant="gold">
            <FamilyHomeGlassIcon size={24} />
          </GlassIconWrapper>
          <View>
            <Text style={styles.title}>Our Family</Text>
            <Text style={styles.subtitle}>Shared Moments & Memories</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Family Identity Section */}
        <SectionCard title="Family Identity" icon="🏠">
          <InputField
            label="Family Name"
            placeholder="The Johnsons, Team Smith..."
            value={familyName}
            onChangeText={setFamilyName}
          />
          <InputField
            label="Family Motto"
            placeholder="Always Hungry, Always Happy!"
            value={familyMotto}
            onChangeText={setFamilyMotto}
          />
        </SectionCard>

        {/* Calendar & Holidays Section */}
        <SectionCard
          title="Calendar & Holidays"
          icon="📅"
          subtitle="Mira will remember your celebrations"
        >
          <Text style={styles.chipSectionLabel}>Which holidays does your family celebrate?</Text>
          <View style={styles.chipGrid}>
            {CULTURAL_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                style={[
                  styles.cultureChip,
                  culturalPreferences.includes(option.id) && styles.cultureChipSelected,
                ]}
                onPress={() => toggleCulturalPref(option.id)}
              >
                <BlurView intensity={15} tint="light" style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={culturalPreferences.includes(option.id)
                    ? [`${COLORS.gold.light}40`, `${COLORS.gold.base}20`]
                    : ['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.3)']
                  }
                  style={StyleSheet.absoluteFill}
                />
                <View style={[
                  styles.chipBorder,
                  culturalPreferences.includes(option.id) && styles.chipBorderSelected
                ]} />
                <View style={styles.cultureChipContent}>
                  <Text style={styles.cultureChipIcon}>{option.icon}</Text>
                  <Text style={[
                    styles.cultureChipLabel,
                    culturalPreferences.includes(option.id) && styles.cultureChipLabelSelected
                  ]}>
                    {option.label}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </SectionCard>

        {/* Dietary Preferences Section */}
        <SectionCard
          title="Dietary Preferences"
          icon="🥗"
          subtitle="Mira will respect these in all suggestions"
        >
          <Text style={styles.chipSectionLabel}>Household dietary requirements</Text>
          <View style={styles.chipGrid}>
            {DIETARY_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                style={[
                  styles.cultureChip,
                  dietaryPreferences.includes(option.id) && styles.cultureChipSelected,
                ]}
                onPress={() => toggleDietaryPref(option.id)}
              >
                <BlurView intensity={15} tint="light" style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={dietaryPreferences.includes(option.id)
                    ? [`${COLORS.gold.light}40`, `${COLORS.gold.base}20`]
                    : ['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.3)']
                  }
                  style={StyleSheet.absoluteFill}
                />
                <View style={[
                  styles.chipBorder,
                  dietaryPreferences.includes(option.id) && styles.chipBorderSelected
                ]} />
                <View style={styles.cultureChipContent}>
                  <Text style={styles.cultureChipIcon}>{option.icon}</Text>
                  <Text style={[
                    styles.cultureChipLabel,
                    dietaryPreferences.includes(option.id) && styles.cultureChipLabelSelected
                  ]}>
                    {option.label}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.chipSectionLabel, { marginTop: SPACING.md }]}>Household allergies</Text>
          <View style={styles.chipGrid}>
            {ALLERGEN_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                style={[
                  styles.cultureChip,
                  householdAllergens.includes(option.id) && styles.cultureChipSelected,
                ]}
                onPress={() => toggleHouseholdAllergen(option.id)}
              >
                <BlurView intensity={15} tint="light" style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={householdAllergens.includes(option.id)
                    ? ['rgba(239, 83, 80, 0.2)', 'rgba(239, 83, 80, 0.1)']
                    : ['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.3)']
                  }
                  style={StyleSheet.absoluteFill}
                />
                <View style={[
                  styles.chipBorder,
                  householdAllergens.includes(option.id) && { borderColor: '#EF5350', borderWidth: 1 }
                ]} />
                <View style={styles.cultureChipContent}>
                  <Text style={styles.cultureChipIcon}>{option.icon}</Text>
                  <Text style={[
                    styles.cultureChipLabel,
                    householdAllergens.includes(option.id) && { color: '#C62828', fontWeight: '600' as const }
                  ]}>
                    {option.label}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </SectionCard>

        {/* Weekly Traditions Section */}
        <SectionCard
          title="Weekly Traditions"
          icon="🎉"
          subtitle="Tap to enable - Mira will remind you!"
        >
          <View style={styles.traditionsGrid}>
            {TRADITION_TEMPLATES.map((template) => (
              <Pressable
                key={template.id}
                style={[
                  styles.traditionCard,
                  isTraditionActive(template.id) && styles.traditionCardActive,
                ]}
                onPress={() => toggleTradition(template)}
              >
                <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={isTraditionActive(template.id)
                    ? [`${COLORS.gold.light}50`, `${COLORS.gold.base}25`]
                    : ['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.3)']
                  }
                  style={StyleSheet.absoluteFill}
                />
                <View style={[
                  styles.traditionBorder,
                  isTraditionActive(template.id) && styles.traditionBorderActive
                ]} />
                <View style={styles.traditionContent}>
                  <Text style={styles.traditionIcon}>{template.icon}</Text>
                  <Text style={[
                    styles.traditionName,
                    isTraditionActive(template.id) && styles.traditionNameActive
                  ]}>
                    {template.name}
                  </Text>
                  <Text style={styles.traditionDay}>
                    {DAYS_OF_WEEK[template.dayOfWeek]}
                  </Text>
                  {isTraditionActive(template.id) && (
                    <Text style={styles.traditionCheck}>{'\u2713'}</Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        </SectionCard>

        {/* Shopping Day Section */}
        <SectionCard
          title="Shopping Day"
          icon="🗓️"
          subtitle="When do you usually shop?"
        >
          <View style={styles.daysGrid}>
            {DAYS_OF_WEEK.map((day, index) => (
              <Pressable
                key={day}
                style={[
                  styles.dayChip,
                  shoppingDay === index && styles.dayChipSelected,
                ]}
                onPress={() => setShoppingDay(shoppingDay === index ? undefined : index)}
              >
                <BlurView intensity={15} tint="light" style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={shoppingDay === index
                    ? [`${COLORS.gold.light}50`, `${COLORS.gold.base}25`]
                    : ['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.3)']
                  }
                  style={StyleSheet.absoluteFill}
                />
                <View style={[
                  styles.dayBorder,
                  shoppingDay === index && styles.dayBorderSelected
                ]} />
                <Text style={[
                  styles.dayLabel,
                  shoppingDay === index && styles.dayLabelSelected
                ]}>
                  {day.slice(0, 3)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.shoppingHint}>
            {shoppingDay !== undefined
              ? `Mira will prepare your lists for ${DAYS_OF_WEEK[shoppingDay]}!`
              : 'Select your usual shopping day for smart reminders'}
          </Text>
        </SectionCard>

        {/* Family Members Card */}
        <SectionCard title="Family Members" icon="👪">
          <View style={styles.membersGrid}>
            {members.length > 0 ? (
              members.map((member) => (
                <Pressable
                  key={member.id}
                  onLongPress={() => handleRemoveMember(member)}
                  delayLongPress={500}
                >
                  <MemberCard member={member} />
                </Pressable>
              ))
            ) : (
              <View style={styles.emptyMembers}>
                <Text style={styles.emptyText}>
                  Add family members to personalize Mira's suggestions
                </Text>
              </View>
            )}
          </View>

          {/* Add Member Form */}
          {showAddMember ? (
            <View style={styles.addMemberForm}>
              <InputField
                label="Name"
                placeholder="Family member's name"
                value={newMemberName}
                onChangeText={setNewMemberName}
              />
              <Text style={styles.chipSectionLabel}>Role</Text>
              <View style={styles.chipGrid}>
                {ROLE_OPTIONS.map((option) => (
                  <Pressable
                    key={option.id}
                    style={[
                      styles.cultureChip,
                      newMemberRole === option.id && styles.cultureChipSelected,
                    ]}
                    onPress={() => setNewMemberRole(option.id)}
                  >
                    <BlurView intensity={15} tint="light" style={StyleSheet.absoluteFill} />
                    <LinearGradient
                      colors={newMemberRole === option.id
                        ? [`${COLORS.gold.light}40`, `${COLORS.gold.base}20`]
                        : ['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.3)']
                      }
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={[
                      styles.chipBorder,
                      newMemberRole === option.id && styles.chipBorderSelected
                    ]} />
                    <View style={styles.cultureChipContent}>
                      <Text style={styles.cultureChipIcon}>{option.icon}</Text>
                      <Text style={[
                        styles.cultureChipLabel,
                        newMemberRole === option.id && styles.cultureChipLabelSelected
                      ]}>
                        {option.label}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
              <View style={styles.addMemberActions}>
                <Pressable
                  style={styles.addMemberCancel}
                  onPress={() => { setShowAddMember(false); setNewMemberName(''); }}
                >
                  <Text style={styles.addMemberCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.addMemberSave, (!newMemberName.trim() || isAddingMember) && { opacity: 0.5 }]}
                  onPress={handleAddMember}
                  disabled={!newMemberName.trim() || isAddingMember}
                >
                  <LinearGradient
                    colors={[COLORS.gold.light, COLORS.gold.base]}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={styles.addMemberSaveText}>
                    {isAddingMember ? 'Adding...' : 'Add Member'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              style={styles.addMemberButton}
              onPress={() => setShowAddMember(true)}
            >
              <Text style={styles.addMemberButtonText}>+ Add Family Member</Text>
            </Pressable>
          )}

          {members.length > 0 && (
            <Text style={styles.memberHint}>Long-press a member to remove</Text>
          )}
        </SectionCard>

        {/* Together Time Section */}
        <SectionCard
          title="Together Time"
          icon="❤️"
          subtitle="What makes your family special"
        >
          <InputField
            label="Favorite Activities Together"
            placeholder="Board games, hiking, cooking..."
            value={favoriteActivities}
            onChangeText={setFavoriteActivities}
            multiline
          />
          <InputField
            label="Favorite Meals Together"
            placeholder="Sunday Pancakes, Taco Tuesday..."
            value={favoriteMeals}
            onChangeText={setFavoriteMeals}
            multiline
          />
          <InputField
            label="Family Traditions"
            placeholder="Pizza Fridays, Morning walks..."
            value={traditions}
            onChangeText={setTraditions}
            multiline
          />
        </SectionCard>

        {/* Special Nights Section */}
        <SectionCard title="Special Nights" icon="🍿">
          <InputField
            label="Movie Night Snacks"
            placeholder="Popcorn, candy, ice cream..."
            value={movieNightSnacks}
            onChangeText={setMovieNightSnacks}
          />
          <InputField
            label="Game Night Snacks"
            placeholder="Chips, dip, pizza rolls..."
            value={gameNightSnacks}
            onChangeText={setGameNightSnacks}
          />
        </SectionCard>

        {/* Favorite Spots Section */}
        <SectionCard title="Favorite Spots" icon="⭐">
          <InputField
            label="Favorite Restaurant"
            placeholder="Where you love to go together"
            value={favoriteRestaurant}
            onChangeText={setFavoriteRestaurant}
          />
          <InputField
            label="Favorite Takeout"
            placeholder="Go-to delivery order"
            value={favoriteTakeout}
            onChangeText={setFavoriteTakeout}
          />
        </SectionCard>

        {/* Family Goals Section */}
        <SectionCard
          title="Family Goals"
          icon="🎯"
          subtitle="Growing together"
        >
          <InputField
            label="Weekly Goals"
            placeholder="Cook 3 meals together, family walk..."
            value={weeklyGoals}
            onChangeText={setWeeklyGoals}
            multiline
          />
          <InputField
            label="Health Goals"
            placeholder="More veggies, less sugar, exercise..."
            value={healthGoals}
            onChangeText={setHealthGoals}
            multiline
          />
        </SectionCard>

        {/* Moments Card - Joy Feature */}
        <View style={styles.momentCard}>
          <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={[`${COLORS.gold.light}30`, `${COLORS.gold.base}15`]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.4)', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.4 }}
            style={styles.momentShine}
          />
          <View style={styles.momentBorder} />

          <View style={styles.momentContent}>
            <GlassIconWrapper size={50} variant="gold">
              <MomentGlassIcon size={28} />
            </GlassIconWrapper>
            <Text style={styles.momentTitle}>Spark Joy!</Text>
            {sparkJoySuggestion ? (
              <Text style={styles.momentText}>{sparkJoySuggestion}</Text>
            ) : (
              <Text style={styles.momentText}>
                Tap below to get personalized meal and activity ideas based on your family's preferences!
              </Text>
            )}
            <Pressable
              style={styles.sparkJoyButton}
              onPress={generateSparkJoy}
              disabled={isLoadingSparkJoy}
            >
              {isLoadingSparkJoy ? (
                <ActivityIndicator size="small" color={COLORS.gold.base} />
              ) : (
                <Text style={styles.sparkJoyButtonText}>
                  {sparkJoySuggestion ? '✨ Get Another Idea' : '✨ Spark Joy'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Save Button */}
        {hasChanges && (
          <Pressable style={styles.saveButton} onPress={handleSave}>
            <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={[COLORS.gold.light, COLORS.gold.base]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.saveButtonBorder} />
            <Text style={styles.saveButtonText}>Save Family Profile</Text>
          </Pressable>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </ScreenWrapper>
  );
}

// Section Card Component
interface SectionCardProps {
  title: string;
  icon: string;
  subtitle?: string;
  children: React.ReactNode;
}

function SectionCard({ title, icon, subtitle, children }: SectionCardProps) {
  return (
    <View style={styles.sectionCard}>
      <BlurView intensity={25} tint="light" style={styles.sectionBlur} />
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.55)', 'rgba(250, 252, 255, 0.4)']}
        style={styles.sectionGradient}
      />
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.4)', 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.3 }}
        style={styles.sectionShine}
      />
      <View style={styles.sectionBorder} />

      <View style={styles.sectionContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>{icon}</Text>
          <View>
            <Text style={styles.sectionTitle}>{title}</Text>
            {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
          </View>
        </View>
        {children}
      </View>
    </View>
  );
}

// Input Field Component
interface InputFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  multiline?: boolean;
}

function InputField({ label, placeholder, value, onChangeText, multiline }: InputFieldProps) {
  return (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputWrapper}>
        <BlurView intensity={15} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.3)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.inputBorder} />
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          placeholder={placeholder}
          placeholderTextColor={COLORS.text.secondary}
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          numberOfLines={multiline ? 2 : 1}
        />
      </View>
    </View>
  );
}

// Member Card Component
interface MemberCardProps {
  member: { id: string; name: string; role?: string; profile?: any };
}

function MemberCard({ member }: MemberCardProps) {
  const roleInfo = ROLE_OPTIONS.find(r => r.id === member.role) || ROLE_OPTIONS[3];
  const hasAllergies = member.profile?.allergies?.length > 0;

  return (
    <View style={styles.memberCard}>
      <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.3)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.memberBorder} />

      <View style={styles.memberContent}>
        <Text style={styles.memberIcon}>{roleInfo.icon}</Text>
        <Text style={styles.memberName}>{member.name}</Text>
        <Text style={styles.memberRole}>{roleInfo.label}</Text>
        {hasAllergies && (
          <View style={styles.allergyBadge}>
            <Text style={styles.allergyBadgeText}>
              {member.profile.allergies.length} allergies
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  backText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 4,
  },
  title: {
    fontFamily: 'Georgia',
    fontSize: FONT_SIZES.title,
    fontWeight: '500',
    color: COLORS.text.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gold.dark,
    fontStyle: 'italic',
    marginTop: 2,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  sectionCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    ...SHADOWS.glass,
  },
  sectionBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  sectionGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  sectionShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
  },
  sectionBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  sectionContent: {
    padding: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sectionIcon: {
    fontSize: 24,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  inputContainer: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
    paddingLeft: 2,
  },
  inputWrapper: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  inputBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(200, 200, 210, 0.4)',
  },
  input: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
  },
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  membersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  memberCard: {
    width: '47%',
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  memberBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(200, 200, 210, 0.4)',
  },
  memberContent: {
    padding: SPACING.md,
    alignItems: 'center',
  },
  memberIcon: {
    fontSize: 28,
    marginBottom: SPACING.xs,
  },
  memberName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  memberRole: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  allergyBadge: {
    backgroundColor: 'rgba(239, 83, 80, 0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.xs,
  },
  allergyBadgeText: {
    fontSize: FONT_SIZES.xs - 1,
    color: '#EF5350',
    fontWeight: '500',
  },
  emptyMembers: {
    flex: 1,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  addMemberButton: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.gold.light,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addMemberButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gold.dark,
  },
  addMemberForm: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  addMemberActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  addMemberCancel: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
  },
  addMemberCancelText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  addMemberSave: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    overflow: 'hidden',
  },
  addMemberSaveText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.white,
  },
  memberHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    fontStyle: 'italic',
    opacity: 0.6,
  },
  momentCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    ...SHADOWS.glass,
  },
  momentShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
  },
  momentBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.gold.base,
  },
  momentContent: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  momentTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.gold.dark,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  momentText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  momentHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gold.base,
    fontStyle: 'italic',
    marginTop: SPACING.md,
  },
  sparkJoyButton: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.gold.base + '40',
    alignSelf: 'center',
  },
  sparkJoyButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.gold.dark,
  },
  saveButton: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    marginTop: SPACING.md,
    ...SHADOWS.glass,
  },
  saveButtonBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  saveButtonText: {
    textAlign: 'center',
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: '#FFF',
    paddingVertical: SPACING.md + 2,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Cultural & Calendar styles
  chipSectionLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.sm,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  cultureChip: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    minWidth: 100,
  },
  cultureChipSelected: {
    // Active state handled by gradient
  },
  chipBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(200, 200, 210, 0.4)',
  },
  chipBorderSelected: {
    borderColor: COLORS.gold.base,
  },
  cultureChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  cultureChipIcon: {
    fontSize: 16,
  },
  cultureChipLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  cultureChipLabelSelected: {
    color: COLORS.gold.dark,
    fontWeight: '600',
  },
  // Weekly Traditions styles
  traditionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  traditionCard: {
    width: '47%',
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  traditionCardActive: {
    // Active state handled by gradient
  },
  traditionBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(200, 200, 210, 0.4)',
  },
  traditionBorderActive: {
    borderColor: COLORS.gold.base,
    borderWidth: 1,
  },
  traditionContent: {
    padding: SPACING.md,
    alignItems: 'center',
    position: 'relative',
  },
  traditionIcon: {
    fontSize: 32,
    marginBottom: SPACING.xs,
  },
  traditionName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  traditionNameActive: {
    color: COLORS.gold.dark,
  },
  traditionDay: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  traditionCheck: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    fontSize: 14,
    color: COLORS.gold.dark,
    fontWeight: '700',
  },
  // Shopping Day styles
  daysGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.xs,
  },
  dayChip: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    alignItems: 'center',
  },
  dayChipSelected: {
    // Active state handled by gradient
  },
  dayBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 0.5,
    borderColor: 'rgba(200, 200, 210, 0.4)',
  },
  dayBorderSelected: {
    borderColor: COLORS.gold.base,
    borderWidth: 1,
  },
  dayLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.text.secondary,
    paddingVertical: SPACING.sm,
    textAlign: 'center',
  },
  dayLabelSelected: {
    color: COLORS.gold.dark,
  },
  shoppingHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: SPACING.md,
    fontStyle: 'italic',
  },
  bottomPadding: {
    height: 100,
  },
});
