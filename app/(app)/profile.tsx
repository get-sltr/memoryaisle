import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Image,
  Alert,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import {
  ProfileGlassIcon,
  FavoritesGlassIcon,
  AllergyBadgeIcon,
  GlassIconWrapper,
} from '../../src/components/GlassIcons';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/services/supabase';
import { ALLERGENS, type AllergenType } from '../../src/utils/allergenDetection';
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../../src/constants/theme';

// Custom Icons
const PROFILE_ICONS = {
  aboutYou: require('../../assets/icons/profile/about_you.png'),
  foodFavorites: require('../../assets/icons/profile/food_favorites.png'),
  allergies: require('../../assets/icons/profile/allergies.png'),
  dietaryPreferences: require('../../assets/icons/profile/dietary_preferences.png'),
  shoppingHabits: require('../../assets/icons/profile/shopping_habbit.png'),
};

const DIETARY_OPTIONS = [
  { id: 'vegetarian', label: 'Vegetarian', icon: require('../../assets/icons/dietary/vegetarian.png') },
  { id: 'vegan', label: 'Vegan', icon: require('../../assets/icons/dietary/vegan.png') },
  { id: 'keto', label: 'Keto', icon: require('../../assets/icons/dietary/keto.png') },
  { id: 'gluten-free', label: 'Gluten-Free', icon: require('../../assets/icons/dietary/gluten_free.png') },
  { id: 'halal', label: 'Halal', icon: require('../../assets/icons/dietary/halal.png') },
  { id: 'kosher', label: 'Kosher', icon: require('../../assets/icons/dietary/kosher.png') },
];

const ALLERGY_OPTIONS = Object.entries(ALLERGENS).map(([id, info]) => ({
  id: id as AllergenType,
  label: info.label,
  icon: info.icon,
  color: info.color,
}));

export default function ProfileScreen() {
  const { user, setUser } = useAuthStore();
  const profile = user?.profile || {};

  // Form state
  const [nickname, setNickname] = useState(profile.nickname || '');
  const [birthday, setBirthday] = useState(profile.birthday || '');
  const [favoriteFoods, setFavoriteFoods] = useState(profile.favoriteFoods?.join(', ') || '');
  const [dislikedFoods, setDislikedFoods] = useState(profile.dislikedFoods?.join(', ') || '');
  const [favoriteSnack, setFavoriteSnack] = useState(profile.favoriteSnack || '');
  const [comfortFood, setComfortFood] = useState(profile.comfortFood || '');
  const [favoriteColor, setFavoriteColor] = useState(profile.favoriteColor || '');
  const [favoriteStore, setFavoriteStore] = useState(profile.favoriteStore || '');
  const [selectedAllergies, setSelectedAllergies] = useState<AllergenType[]>(
    profile.allergies || user?.allergies || []
  );
  const [selectedDietary, setSelectedDietary] = useState<string[]>(
    profile.dietaryPreferences || []
  );
  const [hasChanges, setHasChanges] = useState(false);

  // Track changes
  useEffect(() => {
    const originalProfile = user?.profile || {};
    const changed =
      nickname !== (originalProfile.nickname || '') ||
      birthday !== (originalProfile.birthday || '') ||
      favoriteFoods !== (originalProfile.favoriteFoods?.join(', ') || '') ||
      dislikedFoods !== (originalProfile.dislikedFoods?.join(', ') || '') ||
      favoriteSnack !== (originalProfile.favoriteSnack || '') ||
      comfortFood !== (originalProfile.comfortFood || '') ||
      favoriteColor !== (originalProfile.favoriteColor || '') ||
      favoriteStore !== (originalProfile.favoriteStore || '') ||
      JSON.stringify(selectedAllergies) !== JSON.stringify(originalProfile.allergies || user?.allergies || []) ||
      JSON.stringify(selectedDietary) !== JSON.stringify(originalProfile.dietaryPreferences || []);
    setHasChanges(changed);
  }, [nickname, birthday, favoriteFoods, dislikedFoods, favoriteSnack, comfortFood, favoriteColor, favoriteStore, selectedAllergies, selectedDietary, user]);

  const toggleAllergy = (id: AllergenType) => {
    setSelectedAllergies(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const toggleDietary = (id: string) => {
    setSelectedDietary(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    // Parse comma-separated lists
    const favoriteFoodsArray = favoriteFoods.split(',').map(s => s.trim()).filter(Boolean);
    const dislikedFoodsArray = dislikedFoods.split(',').map(s => s.trim()).filter(Boolean);

    const updatedProfile = {
      nickname: nickname || undefined,
      birthday: birthday || undefined,
      favoriteFoods: favoriteFoodsArray.length > 0 ? favoriteFoodsArray : undefined,
      dislikedFoods: dislikedFoodsArray.length > 0 ? dislikedFoodsArray : undefined,
      favoriteSnack: favoriteSnack || undefined,
      comfortFood: comfortFood || undefined,
      favoriteColor: favoriteColor || undefined,
      favoriteStore: favoriteStore || undefined,
      allergies: selectedAllergies.length > 0 ? selectedAllergies : undefined,
      dietaryPreferences: selectedDietary.length > 0 ? selectedDietary as any : undefined,
    };

    if (user) {
      // Persist to Supabase
      const { error } = await supabase
        .from('users')
        .update({
          allergies: selectedAllergies,
          dietary_preferences: selectedDietary,
          profile: updatedProfile,
        })
        .eq('id', user.id);

      if (error) {
        Alert.alert('Error', 'Could not save profile. Please try again.');
        return;
      }

      // Update local state
      setUser({
        ...user,
        allergies: selectedAllergies,
        profile: updatedProfile,
      });
    }

    Alert.alert(
      'Profile Saved!',
      nickname ? `Looking good, ${nickname}! Your preferences are saved.` : 'Your preferences are saved.',
      [{ text: 'OK' }]
    );
    setHasChanges(false);
  };

  return (
    <ScreenWrapper>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
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
            <ProfileGlassIcon size={24} />
          </GlassIconWrapper>
          <View>
            <Text style={styles.title}>My Profile</Text>
            <Text style={styles.subtitle}>Your Personal Touch</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Personal Info Section */}
        <SectionCard title="About You" icon={PROFILE_ICONS.aboutYou}>
          <InputField
            label="Nickname"
            placeholder="What should we call you?"
            value={nickname}
            onChangeText={setNickname}
          />
          <InputField
            label="Birthday"
            placeholder="MM/DD (we'll remember!)"
            value={birthday}
            onChangeText={setBirthday}
          />
          <InputField
            label="Favorite Color"
            placeholder="Makes things personal"
            value={favoriteColor}
            onChangeText={setFavoriteColor}
          />
        </SectionCard>

        {/* Food Preferences Section */}
        <SectionCard title="Food Favorites" icon={PROFILE_ICONS.foodFavorites}>
          <InputField
            label="Favorite Foods"
            placeholder="Pizza, Sushi, Tacos... (comma separated)"
            value={favoriteFoods}
            onChangeText={setFavoriteFoods}
            multiline
          />
          <InputField
            label="Foods You Don't Like"
            placeholder="We'll remember to avoid these"
            value={dislikedFoods}
            onChangeText={setDislikedFoods}
            multiline
          />
          <InputField
            label="Favorite Snack"
            placeholder="Your go-to treat"
            value={favoriteSnack}
            onChangeText={setFavoriteSnack}
          />
          <InputField
            label="Comfort Food"
            placeholder="What makes you feel better?"
            value={comfortFood}
            onChangeText={setComfortFood}
          />
        </SectionCard>

        {/* Allergies Section */}
        <SectionCard
          title="Allergies"
          icon={PROFILE_ICONS.allergies}
          subtitle="We'll alert you when adding items with these"
        >
          <View style={styles.chipGrid}>
            {ALLERGY_OPTIONS.map((allergy) => (
              <AllergyChip
                key={allergy.id}
                label={allergy.label}
                color={allergy.color}
                selected={selectedAllergies.includes(allergy.id)}
                onPress={() => toggleAllergy(allergy.id)}
              />
            ))}
          </View>
        </SectionCard>

        {/* Dietary Preferences Section */}
        <SectionCard title="Dietary Preferences" icon={PROFILE_ICONS.dietaryPreferences}>
          <View style={styles.chipGrid}>
            {DIETARY_OPTIONS.map((diet) => (
              <DietaryChip
                key={diet.id}
                label={diet.label}
                icon={diet.icon}
                selected={selectedDietary.includes(diet.id)}
                onPress={() => toggleDietary(diet.id)}
              />
            ))}
          </View>
        </SectionCard>

        {/* Shopping Habits Section */}
        <SectionCard title="Shopping Habits" icon={PROFILE_ICONS.shoppingHabits}>
          <InputField
            label="Favorite Store"
            placeholder="Where do you usually shop?"
            value={favoriteStore}
            onChangeText={setFavoriteStore}
          />
        </SectionCard>

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
            <Text style={styles.saveButtonText}>Save Profile</Text>
          </Pressable>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

// Section Card Component
interface SectionCardProps {
  title: string;
  icon: ImageSourcePropType;
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
          <View style={styles.iconGlassWrapper}>
            <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.7)', 'rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.1)']}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.9)', 'transparent']}
              start={{ x: 0.3, y: 0 }}
              end={{ x: 0.7, y: 0.5 }}
              style={styles.iconShine}
            />
            <View style={styles.iconGlassBorder} />
            <Image source={icon} style={styles.sectionIcon} />
          </View>
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

// Allergy Chip Component
interface AllergyChipProps {
  label: string;
  color: string;
  selected: boolean;
  onPress: () => void;
}

function AllergyChip({ label, color, selected, onPress }: AllergyChipProps) {
  return (
    <Pressable
      style={[
        styles.chip,
        selected && { backgroundColor: `${color}20`, borderColor: color },
      ]}
      onPress={onPress}
    >
      <BlurView intensity={15} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={selected
          ? [`${color}30`, `${color}15`]
          : ['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.3)']
        }
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.chipBorder, selected && { borderColor: color }]} />
      <View style={styles.chipContent}>
        {selected && <Text style={[styles.chipCheck, { color }]}>{'\u2713'}</Text>}
        <Text style={[styles.chipLabel, selected && { color }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

// Dietary Chip Component
interface DietaryChipProps {
  label: string;
  icon: ImageSourcePropType;
  selected: boolean;
  onPress: () => void;
}

function DietaryChip({ label, icon, selected, onPress }: DietaryChipProps) {
  return (
    <Pressable
      style={[
        styles.chip,
        selected && styles.chipSelected,
      ]}
      onPress={onPress}
    >
      <BlurView intensity={15} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={selected
          ? [`${COLORS.gold.light}40`, `${COLORS.gold.base}20`]
          : ['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.3)']
        }
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.chipBorder, selected && styles.chipBorderSelected]} />
      <View style={styles.chipContent}>
        <View style={styles.chipIconGlass}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0.2)']}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.8)', 'transparent']}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 0.7, y: 0.6 }}
            style={styles.chipIconShine}
          />
          <Image source={icon} style={styles.chipIcon} />
        </View>
        <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
      </View>
    </Pressable>
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
  iconGlassWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: COLORS.gold.base,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  iconShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  iconGlassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  sectionIcon: {
    width: 26,
    height: 26,
    resizeMode: 'contain',
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
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  chip: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    minWidth: 90,
  },
  chipSelected: {
    backgroundColor: `${COLORS.gold.light}20`,
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
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  chipIconGlass: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  chipIconShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  chipIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  chipCheck: {
    fontSize: 12,
    fontWeight: '700',
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
  bottomPadding: {
    height: 100,
  },
});
