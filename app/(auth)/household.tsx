import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { createHousehold, joinHousehold } from '../../src/services/auth';
import { useAuthStore } from '../../src/stores/authStore';
import { COLORS, FONTS, FONT_SIZES, SPACING } from '../../src/constants/theme';

export default function HouseholdSetup() {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const { setHousehold } = useAuthStore();

  const handleCreate = async () => {
    if (!householdName.trim()) {
      Alert.alert('Error', 'Please enter a household name');
      return;
    }

    setLoading(true);
    const { household, error } = await createHousehold(householdName.trim());
    setLoading(false);

    if (error || !household) {
      Alert.alert('Error', error || 'Failed to create household');
      return;
    }

    setHousehold(household);
    router.replace('/');
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    setLoading(true);
    const { household, error } = await joinHousehold(inviteCode.trim());
    setLoading(false);

    if (error || !household) {
      Alert.alert('Error', error || 'Failed to join household');
      return;
    }

    setHousehold(household);
    router.replace('/');
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
        <View style={styles.form}>
          <Text style={styles.label}>Household Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., The Smith Family"
            placeholderTextColor={COLORS.inkFaded}
            value={householdName}
            onChangeText={setHouseholdName}
          />
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
        </View>
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
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: SPACING.md,
    alignItems: 'center',
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
