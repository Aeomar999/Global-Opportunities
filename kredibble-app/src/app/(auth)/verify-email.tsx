import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Check, Mail } from 'lucide-react-native';
import { authStore } from '../../constants/authStore';
import { requestEmailVerification, verifyEmail, getMobileUser } from '../../lib/api';

const LogoImage = () => (
  <Image
    source={require('../../../assets/images/logo.png')}
    style={{ width: 56, height: 56, borderRadius: 28 }}
    resizeMode="contain"
  />
);

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; returnUrl?: string }>();

  const [email, setEmail] = useState<string>(params.email || authStore.user?.email || '');
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(RESEND_COOLDOWN_SECONDS);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Load user email if not in params
  useEffect(() => {
    if (!email) {
      getMobileUser().then((user) => {
        if (user?.email) {
          setEmail(user.email);
        }
      });
    }
  }, [email]);

  // Resend countdown timer
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const handleDigitChange = (value: string, index: number) => {
    setErrorMessage('');

    // Handle full code paste (e.g. user pasted 6 digits into any cell)
    const cleaned = value.replace(/[^0-9]/g, '');
    if (cleaned.length > 1) {
      const newDigits = [...digits];
      for (let i = 0; i < CODE_LENGTH; i++) {
        newDigits[i] = cleaned[i] || '';
      }
      setDigits(newDigits);
      const nextIndex = Math.min(cleaned.length, CODE_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const digit = cleaned.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      const newDigits = [...digits];
      newDigits[index - 1] = '';
      setDigits(newDigits);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const fullCode = digits.join('');
  const isComplete = fullCode.length === CODE_LENGTH && digits.every((d) => d !== '');

  const handleVerify = async () => {
    if (!isComplete || isVerifying) return;

    setErrorMessage('');
    setIsVerifying(true);

    try {
      await verifyEmail(fullCode, email);

      // Update authStore user emailVerified status
      if (authStore.user) {
        (authStore.user as any).emailVerified = true;
        authStore.notify();
      }

      setSuccessMessage('Email verified successfully!');

      setTimeout(() => {
        if (params.returnUrl) {
          router.replace(params.returnUrl as any);
        } else {
          router.replace('/(tabs)/opportunities');
        }
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid verification code';
      setErrorMessage(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCountdown > 0 || isResending) return;

    if (!email) {
      Alert.alert('Error', 'No email address found to send verification code to.');
      return;
    }

    setIsResending(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await requestEmailVerification(email);
      setResendCountdown(RESEND_COOLDOWN_SECONDS);
      setSuccessMessage('Verification code resent! Please check your inbox.');
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <ChevronLeft size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <LogoImage />
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Icon Badge */}
          <View style={styles.iconCircle}>
            <Mail size={32} color="#6671E4" strokeWidth={2} />
          </View>

          {/* Title & Subtitle */}
          <Text style={styles.title} className="font-sans">
            Verify Your Email
          </Text>
          <Text style={styles.subtitle} className="font-sans">
            We have sent a 6-digit verification code to{' '}
            <Text style={styles.emailHighlight}>{email || 'your email'}</Text>.
            Enter the code below to verify your account.
          </Text>

          {/* OTP Input Cells */}
          <View style={styles.otpContainer}>
            {digits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={[
                  styles.otpInput,
                  digit ? styles.otpInputFilled : null,
                  errorMessage ? styles.otpInputError : null,
                ]}
                value={digit}
                onChangeText={(val) => handleDigitChange(val, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={CODE_LENGTH}
                selectTextOnFocus
                testID={`otp-input-${index}`}
              />
            ))}
          </View>

          {/* Feedback messages */}
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText} className="font-sans">
                {errorMessage}
              </Text>
            </View>
          ) : null}

          {successMessage ? (
            <View style={styles.successBox}>
              <Check size={16} color="#16A34A" style={{ marginRight: 6 }} />
              <Text style={styles.successText} className="font-sans">
                {successMessage}
              </Text>
            </View>
          ) : null}

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.verifyButton,
              (!isComplete || isVerifying) && styles.disabledButton,
            ]}
            onPress={handleVerify}
            disabled={!isComplete || isVerifying}
            activeOpacity={0.85}
          >
            {isVerifying ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.verifyButtonText} className="font-sans">
                Verify & Continue
              </Text>
            )}
          </TouchableOpacity>

          {/* Resend Section */}
          <View style={styles.resendContainer}>
            <Text style={styles.resendText} className="font-sans">
              Didn&apos;t receive the code?{' '}
            </Text>
            {resendCountdown > 0 ? (
              <Text style={styles.timerText} className="font-sans">
                Resend in {resendCountdown}s
              </Text>
            ) : (
              <TouchableOpacity
                onPress={handleResendCode}
                disabled={isResending}
                activeOpacity={0.7}
              >
                <Text style={styles.resendActionText} className="font-sans">
                  {isResending ? 'Sending...' : 'Resend Code'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E6F2',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#8A8D9F',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  emailHighlight: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
    gap: 8,
  },
  otpInput: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E6F2',
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  otpInputFilled: {
    borderColor: '#6671E4',
    backgroundColor: '#F9FAFF',
  },
  otpInputError: {
    borderColor: '#EF4444',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 20,
    width: '100%',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    textAlign: 'center',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 20,
    width: '100%',
  },
  successText: {
    color: '#16A34A',
    fontSize: 13,
    fontWeight: '500',
  },
  verifyButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#6671E4',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  disabledButton: {
    backgroundColor: '#C5C9F0',
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendText: {
    fontSize: 13,
    color: '#8A8D9F',
  },
  timerText: {
    fontSize: 13,
    color: '#8A8D9F',
    fontWeight: '600',
  },
  resendActionText: {
    fontSize: 13,
    color: '#6671E4',
    fontWeight: '600',
  },
});
