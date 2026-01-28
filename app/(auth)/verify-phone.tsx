// Phone Verification Screen - 2-Step Auth
// This screen is shown after sign-in to verify the user's phone number
// Different from phone-sign-in.tsx which creates new users

import { useState, useRef, useEffect } from 'react';
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
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { linkPhoneNumber, verifyPhoneForAccount, resendPhoneLinkOTP, signOut } from '../../src/services/auth';
import { useAuthStore } from '../../src/stores/authStore';
import { getCurrentUser } from '../../src/services/auth';
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../../src/constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const OTP_LENGTH = 6;

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

// Lock icon for verification step
function LockIcon({ size = 24, color = COLORS.gold.base }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

type Step = 'phone' | 'verify';

export default function VerifyPhone() {
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuthStore();
  const [step, setStep] = useState<Step>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState<string[]>(new Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Format phone number as user types
  const formatPhoneInput = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }
  };

  // Countdown timer for resend
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  // Focus first OTP input when entering verify step
  useEffect(() => {
    if (step === 'verify') {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 500);
    }
  }, [step]);

  const handlePhoneChange = (text: string) => {
    setPhoneNumber(formatPhoneInput(text));
  };

  const handleSendCode = async () => {
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length < 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    const { success, error } = await linkPhoneNumber(digits);
    setLoading(false);

    if (!success) {
      Alert.alert('Error', error || 'Failed to send verification code');
      return;
    }

    setResendCountdown(30);
    setStep('verify');
  };

  const handleOtpChange = (value: string, index: number) => {
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];

    // Handle paste
    if (value.length > 1) {
      const digits = value.slice(0, OTP_LENGTH - index).split('');
      digits.forEach((digit, i) => {
        if (index + i < OTP_LENGTH) {
          newOtp[index + i] = digit;
        }
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, OTP_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();
      if (newOtp.every(d => d !== '')) {
        handleVerify(newOtp.join(''));
      }
      return;
    }

    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every(d => d !== '')) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code?: string) => {
    const otpCode = code || otp.join('');
    if (otpCode.length !== OTP_LENGTH) {
      Alert.alert('Invalid Code', 'Please enter the complete 6-digit code');
      return;
    }

    const digits = phoneNumber.replace(/\D/g, '');
    setLoading(true);
    const { success, error } = await verifyPhoneForAccount(digits, otpCode);
    setLoading(false);

    if (!success) {
      Alert.alert('Verification Failed', error || 'Invalid code. Please try again.');
      setOtp(new Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      return;
    }

    // Refresh user data to get updated phone_verified status
    const updatedUser = await getCurrentUser();
    if (updatedUser) {
      setUser(updatedUser);
    }

    // Navigate to main app flow (will check household next)
    router.replace('/');
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;

    const digits = phoneNumber.replace(/\D/g, '');
    setLoading(true);
    const { success, error } = await resendPhoneLinkOTP(digits);
    setLoading(false);

    if (success) {
      setResendCountdown(30);
      Alert.alert('Code Sent', 'A new verification code has been sent to your phone');
    } else {
      Alert.alert('Error', error || 'Failed to resend code');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/landing');
  };

  const formattedPhone = phoneNumber
    ? `+1 ${phoneNumber}`
    : '';

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
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              {step === 'phone' ? (
                <PhoneIcon size={40} color={COLORS.gold.base} />
              ) : (
                <LockIcon size={40} color={COLORS.gold.base} />
              )}
            </View>
            <Text style={styles.title}>
              {step === 'phone' ? 'Verify Your Phone' : 'Enter Code'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'phone'
                ? 'One more step to secure your account'
                : `Enter the 6-digit code sent to ${formattedPhone}`}
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
              {step === 'phone' ? (
                <>
                  <Text style={styles.formLabel}>Phone Number</Text>
                  <View style={styles.phoneInputContainer}>
                    <View style={styles.countryCode}>
                      <Text style={styles.countryCodeText}>+1</Text>
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
                    We'll send you a verification code via SMS
                  </Text>

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
                </>
              ) : (
                <>
                  {/* OTP Input */}
                  <View style={styles.otpContainer}>
                    {otp.map((digit, index) => (
                      <View key={index} style={styles.otpInputWrapper}>
                        <BlurView intensity={15} tint="light" style={styles.otpInputBlur} />
                        <View style={[
                          styles.otpInputBorder,
                          digit && styles.otpInputFilled,
                        ]} />
                        <TextInput
                          ref={(ref) => { inputRefs.current[index] = ref; }}
                          style={styles.otpInput}
                          value={digit}
                          onChangeText={(value) => handleOtpChange(value, index)}
                          onKeyPress={(e) => handleKeyPress(e, index)}
                          keyboardType="number-pad"
                          maxLength={index === 0 ? OTP_LENGTH : 1}
                          selectTextOnFocus
                        />
                      </View>
                    ))}
                  </View>

                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.buttonPressed,
                      loading && styles.buttonDisabled,
                    ]}
                    onPress={() => handleVerify()}
                    disabled={loading || otp.some(d => d === '')}
                  >
                    <LinearGradient
                      colors={[COLORS.gold.light, COLORS.gold.base]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.primaryButtonGradient}
                    />
                    <View style={styles.primaryButtonBorder} />
                    <Text style={styles.primaryButtonText}>
                      {loading ? 'Verifying...' : 'Verify & Continue'}
                    </Text>
                  </Pressable>

                  {/* Resend / Change number */}
                  <View style={styles.resendContainer}>
                    <Pressable onPress={() => setStep('phone')}>
                      <Text style={styles.changeNumberText}>Change number</Text>
                    </Pressable>
                    <Text style={styles.resendDivider}>|</Text>
                    {resendCountdown > 0 ? (
                      <Text style={styles.resendCountdown}>
                        Resend in {resendCountdown}s
                      </Text>
                    ) : (
                      <Pressable onPress={handleResend} disabled={loading}>
                        <Text style={styles.resendLink}>Resend Code</Text>
                      </Pressable>
                    )}
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Sign out option */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Wrong account? </Text>
            <Pressable onPress={handleSignOut}>
              <Text style={styles.footerLink}>Sign out</Text>
            </Pressable>
          </View>

          {/* Info text */}
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              Phone verification helps keep your account secure and enables features like shared shopping lists with family members.
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
    fontSize: 28,
    fontWeight: '500',
    color: COLORS.text.primary,
    letterSpacing: -0.5,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text.secondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
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
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  otpInputWrapper: {
    width: 48,
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  otpInputBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  otpInputBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.frost.border,
  },
  otpInputFilled: {
    borderColor: COLORS.gold.base,
  },
  otpInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.xl,
    gap: SPACING.sm,
  },
  changeNumberText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gold.dark,
    fontWeight: '500',
  },
  resendDivider: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
  },
  resendCountdown: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
  },
  resendLink: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gold.dark,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  footerText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
  },
  footerLink: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.gold.dark,
    fontWeight: '600',
  },
  infoContainer: {
    paddingHorizontal: SPACING.lg,
  },
  infoText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
