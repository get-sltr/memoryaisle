import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { sendPhoneOTP } from '../../src/services/auth';
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../../src/constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Phone icon component
function PhoneIcon({ size = 24, color = COLORS.gold.base }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function PhoneSignIn() {
  const insets = useSafeAreaInsets();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);

  // Format phone number as user types
  const formatPhoneInput = (text: string) => {
    // Remove all non-digits
    const cleaned = text.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX for US numbers
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (text: string) => {
    setPhoneNumber(formatPhoneInput(text));
  };

  const handleSendCode = async () => {
    // Extract just digits
    const digits = phoneNumber.replace(/\D/g, '');

    if (digits.length < 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    const { success, error } = await sendPhoneOTP(digits);
    setLoading(false);

    if (!success) {
      Alert.alert('Error', error || 'Failed to send verification code');
      return;
    }

    // Navigate to OTP verification with phone number
    router.push({
      pathname: '/(auth)/verify-otp',
      params: { phone: digits },
    });
  };

  return (
    <View style={styles.container}>
      {/* Video Background */}
      <Video
        source={require('../../assets/landpagelogo.mp4')}
        style={styles.backgroundVideo}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
      />

      {/* Overlay gradient for readability */}
      <LinearGradient
        colors={['rgba(248, 249, 251, 0.85)', 'rgba(232, 236, 242, 0.95)']}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Button */}
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <PhoneIcon size={40} color={COLORS.gold.base} />
            </View>
            <Text style={styles.title}>Phone Sign In</Text>
            <Text style={styles.subtitle}>
              We'll send you a verification code
            </Text>
          </View>

          {/* Glass Card Form */}
          <View style={styles.formCard}>
            <BlurView intensity={25} tint="light" style={styles.cardBlur} />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.75)', 'rgba(248, 249, 251, 0.65)']}
              style={styles.cardGradient}
            />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.15)', 'transparent']}
              style={styles.cardShine}
            />
            <View style={styles.cardBorder} />

            <View style={styles.formContent}>
              <Text style={styles.formLabel}>Phone Number</Text>

              {/* Phone Input */}
              <View style={styles.phoneInputContainer}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryCodeText}>🇺🇸 +1</Text>
                </View>
                <View style={styles.inputContainer}>
                  <BlurView intensity={15} tint="light" style={styles.inputBlur} />
                  <View style={styles.inputBorder} />
                  <TextInput
                    style={styles.input}
                    placeholder="(555) 555-5555"
                    placeholderTextColor={COLORS.text.secondary}
                    value={phoneNumber}
                    onChangeText={handlePhoneChange}
                    keyboardType="phone-pad"
                    maxLength={14}
                    autoFocus
                  />
                </View>
              </View>

              <Text style={styles.helperText}>
                Standard message and data rates may apply
              </Text>

              {/* Send Code Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleSendCode}
                disabled={loading}
              >
                <LinearGradient
                  colors={[COLORS.gold.light, COLORS.gold.base]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryButtonGradient}
                />
                <View style={styles.primaryButtonBorder} />
                <Text style={styles.primaryButtonText}>
                  {loading ? 'Sending...' : 'Send Verification Code'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By continuing, you agree to our{' '}
              <Text style={styles.footerLink}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={styles.footerLink}>Privacy Policy</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.platinum.lightest,
  },
  backgroundVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
  },
  backButton: {
    marginBottom: SPACING.xl,
  },
  backButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gold.dark,
    fontWeight: '500',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212, 175, 95, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontFamily: 'Georgia',
    fontSize: 32,
    fontWeight: '500',
    color: COLORS.text.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  formCard: {
    borderRadius: BORDER_RADIUS.xxl,
    overflow: 'hidden',
    marginBottom: SPACING.xl,
    ...SHADOWS.glassElevated,
  },
  cardBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  cardShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
  },
  cardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    borderColor: COLORS.frost.border,
  },
  formContent: {
    padding: SPACING.xl,
  },
  formLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  countryCode: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.frost.border,
  },
  countryCodeText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  inputContainer: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  inputBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  inputBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.frost.border,
  },
  input: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md + 2,
    fontSize: FONT_SIZES.lg,
    color: COLORS.text.primary,
    letterSpacing: 1,
  },
  helperText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xl,
  },
  primaryButton: {
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md + 4,
    alignItems: 'center',
    overflow: 'hidden',
    ...SHADOWS.goldGlow,
  },
  primaryButtonGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  primaryButtonBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 220, 180, 0.5)',
  },
  primaryButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  footer: {
    paddingHorizontal: SPACING.lg,
  },
  footerText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  footerLink: {
    color: COLORS.gold.dark,
    fontWeight: '500',
  },
});
