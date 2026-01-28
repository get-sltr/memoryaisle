import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { createHousehold, joinHousehold, getCurrentUser } from '../../src/services/auth';
import { useAuthStore } from '../../src/stores/authStore';
import { PaywallPrompt } from '../../src/components/PaywallPrompt';
import { COLORS, FONTS, FONT_SIZES, SPACING } from '../../src/constants/theme';

const HOUSEHOLD_SIZE_OPTIONS = [
  { value: 1, label: '1', description: 'Just me' },
  { value: 2, label: '2', description: 'Couple' },
  { value: 3, label: '3', description: 'Small family' },
  { value: 4, label: '4', description: 'Family' },
  { value: 5, label: '5', description: 'Large family' },
  { value: 6, label: '6+', description: 'Extended' },
];

export default function HouseholdSetup() {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [householdName, setHouseholdName] = useState('');
  const [householdSize, setHouseholdSize] = useState<number | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const { setHousehold, setUser } = useAuthStore();

  const handleCreate = async () => {
    if (!householdName.trim()) {
      Alert.alert('Error', 'Please enter a household name');
      return;
    }

    if (!householdSize) {
      Alert.alert('Error', 'Please select your household size');
      return;
    }

    setLoading(true);
    const { household, error } = await createHousehold(householdName.trim(), householdSize);
    setLoading(false);

    if (error || !household) {
      Alert.alert('Error', error || 'Failed to create household');
      return;
    }

    // Refresh user to get updated household_id
    const updatedUser = await getCurrentUser();
    if (updatedUser) {
      setUser(updatedUser);
    }

    console.log("DEBUG: Setting household:", household?.id);
    setHousehold(household);
    // Navigate directly to app to bypass root router check
    router.replace('/(app)');
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    setLoading(true);
    const { household, error, needsPremium } = await joinHousehold(inviteCode.trim());
    setLoading(false);

    if (error || !household) {
      if (needsPremium) {
        // Show paywall for the household owner to upgrade
        Alert.alert(
          'Premium Required',
          error || 'The household owner needs to upgrade to Premium to add more members.',
          [
            { text: 'OK', style: 'cancel' },
            {
              text: 'Learn More',
              onPress: () => setShowPaywall(true),
            },
          ]
        );
        return;
      }
      Alert.alert('Error', error || 'Failed to join household');
      return;
    }

    // Refresh user to get updated household_id
    const updatedUser = await getCurrentUser();
    if (updatedUser) {
      setUser(updatedUser);
    }

    console.log("DEBUG: Setting household:", household?.id);
    setHousehold(household);
    // Navigate directly to app to bypass root router check
    router.replace('/(app)');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Set Up Your Household</Text>
        <Text style={styles.subtitle}>
          Create a new household or join an existing one with an invite code
        </Text>
      </View>

      {/* Mode Toggle */}
      <View style={styles.toggle}>
        <Pressable
          style={[styles.toggleButton, mode === 'create' && styles.toggleActive]}
          onPress={() => setMode('create')}
        >
          <Text style={[styles.toggleText, mode === 'create' && styles.toggleTextActive]}>
            Create New
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleButton, mode === 'join' && styles.toggleActive]}
          onPress={() => setMode('join')}
        >
          <Text style={[styles.toggleText, mode === 'join' && styles.toggleTextActive]}>
            Join Existing
          </Text>
        </Pressable>
      </View>

      {/* Create Household */}
      {mode === 'create' && (
        <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
          <Text style={styles.label}>Household Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., The Smith Family"
            placeholderTextColor={COLORS.inkFaded}
            value={householdName}
            onChangeText={setHouseholdName}
          />

          <Text style={styles.label}>How many people in your household?</Text>
          <View style={styles.sizeGrid}>
            {HOUSEHOLD_SIZE_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.sizeOption,
                  householdSize === option.value && styles.sizeOptionSelected,
                ]}
                onPress={() => setHouseholdSize(option.value)}
              >
                <Text
                  style={[
                    styles.sizeNumber,
                    householdSize === option.value && styles.sizeNumberSelected,
                  ]}
                >
                  {option.label}
                </Text>
                <Text
                  style={[
                    styles.sizeDescription,
                    householdSize === option.value && styles.sizeDescriptionSelected,
                  ]}
                >
                  {option.description}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.hint}>
            You'll get an invite code to share with family members
          </Text>

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Creating...' : 'Create Household'}
            </Text>
          </Pressable>
        </ScrollView>
      )}

      {/* Join Household */}
      {mode === 'join' && (
        <View style={styles.form}>
          <Text style={styles.label}>Invite Code</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter 8-character code"
            placeholderTextColor={COLORS.inkFaded}
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="none"
            maxLength={8}
          />
          <Text style={styles.hint}>
            Ask a household member for their invite code
          </Text>

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleJoin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Joining...' : 'Join Household'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Paywall for premium family limit */}
      <PaywallPrompt
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        feature="familyMembers"
        title="Need More Family Members?"
        description="The household owner needs to upgrade to Premium to add more than 2 family members."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paper,
    paddingHorizontal: SPACING.lg,
    paddingTop: 80,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  title: {
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.xxl,
    color: COLORS.ink,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.md,
    color: COLORS.inkLight,
    lineHeight: 24,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.paperDark,
    borderRadius: 8,
    padding: 4,
    marginBottom: SPACING.xl,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleActive: {
    backgroundColor: COLORS.white,
  },
  toggleText: {
    fontFamily: FONTS.sans.medium,
    fontSize: FONT_SIZES.md,
    color: COLORS.inkLight,
  },
  toggleTextActive: {
    color: COLORS.ink,
  },
  form: {
    flex: 1,
  },
  label: {
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.md,
    color: COLORS.ink,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.paperDark,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.md,
    fontFamily: FONTS.serif.regular,
    color: COLORS.ink,
    marginBottom: SPACING.sm,
  },
  hint: {
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.inkFaded,
    fontStyle: 'italic',
    marginBottom: SPACING.lg,
  },
  sizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  sizeOption: {
    width: '30%',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.paperDark,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
  },
  sizeOptionSelected: {
    backgroundColor: COLORS.primary + '15',
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  sizeNumber: {
    fontFamily: FONTS.sans.bold,
    fontSize: FONT_SIZES.xl,
    color: COLORS.ink,
    marginBottom: 2,
  },
  sizeNumberSelected: {
    color: COLORS.primary,
  },
  sizeDescription: {
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.xs,
    color: COLORS.inkLight,
    textAlign: 'center',
  },
  sizeDescriptionSelected: {
    color: COLORS.primary,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: FONTS.sans.bold,
    fontSize: FONT_SIZES.md,
    color: COLORS.white,
  },
});
