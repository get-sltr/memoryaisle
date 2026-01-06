import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { signIn } from '../../src/services/auth';
import { COLORS, FONTS, FONT_SIZES, SPACING } from '../../src/constants/theme';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    const { success, error } = await signIn(email, password);
    setLoading(false);

    if (!success) {
      Alert.alert('Error', error || 'Failed to sign in');
      return;
    }

    router.replace('/');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Memoryaisle</Text>
        <Text style={styles.tagline}>Never Forget. Never Overbuy.</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.formTitle}>Sign In</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={COLORS.inkFaded}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={COLORS.inkFaded}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Text>
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/sign-up" asChild>
            <Pressable>
              <Text style={styles.footerLink}>Sign Up</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paper,
    paddingHorizontal: SPACING.lg,
  },
  header: {
    paddingTop: 80,
    paddingBottom: SPACING.xxl,
  },
  title: {
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.title,
    color: COLORS.ink,
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.sm,
    color: COLORS.inkLight,
    fontStyle: 'italic',
    marginTop: SPACING.xs,
  },
  form: {
    flex: 1,
  },
  formTitle: {
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.xl,
    color: COLORS.ink,
    marginBottom: SPACING.lg,
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
    marginBottom: SPACING.md,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: FONTS.sans.bold,
    fontSize: FONT_SIZES.md,
    color: COLORS.white,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.xl,
  },
  footerText: {
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.md,
    color: COLORS.inkLight,
  },
  footerLink: {
    fontFamily: FONTS.serif.regular,
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
  },
});
