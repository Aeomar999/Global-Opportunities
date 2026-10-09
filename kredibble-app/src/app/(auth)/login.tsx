import { useRef, useState, useEffect } from 'react';
import { Colors, Radius, Size } from '../../constants/design';
import { GoogleLogo } from '../../components/ui/GoogleLogo';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Check, X, Eye, EyeOff } from 'lucide-react-native';
import Svg, { G, Rect, Defs, ClipPath, Path } from 'react-native-svg';
import { authStore } from '../../constants/authStore';
import { loginMobile, requestForgotPassword, resetPassword } from '../../lib/api';

const LogoSVG = () => (
  <Image 
    source={require('../../../assets/images/logo.png')} 
    style={{ width: 64, height: 64, borderRadius: 32 }} 
    resizeMode="contain" 
  />
);

// paddingTop(16) + logo(64) + 10px gap
const LOGO_CLEARANCE = 90;

const SuccessBadge = () => (
  <Svg width="70" height="70" viewBox="0 0 70 70" fill="none">
    <G clipPath="url(#clip_badge)">
      <Path
        d="M44.0435 3.80619C42.8659 2.60105 41.4593 1.64345 39.9063 0.989664C38.3533 0.335875 36.6854 -0.000915527 35.0004 -0.000915527C33.3154 -0.000915527 31.6474 0.335875 30.0945 0.989664C28.5415 1.64345 27.1349 2.60105 25.9573 3.80619L23.236 6.59744L19.3423 6.54931C17.6568 6.52937 15.9843 6.84663 14.4233 7.48245C12.8622 8.11827 11.444 9.05981 10.2521 10.2517C9.06026 11.4436 8.11872 12.8618 7.4829 14.4228C6.84708 15.9839 6.52981 17.6563 6.54976 19.3418L6.59351 23.2356L3.81101 25.9568C2.60587 27.1344 1.64828 28.5411 0.994486 30.094C0.340697 31.647 0.00390625 33.315 0.00390625 34.9999C0.00390625 36.6849 0.340697 38.3529 0.994486 39.9059C1.64828 41.4588 2.60587 42.8654 3.81101 44.0431L6.59789 46.7643L6.54976 50.6581C6.52981 52.3435 6.84708 54.016 7.4829 55.577C8.11872 57.1381 9.06026 58.5563 10.2521 59.7482C11.444 60.9401 12.8622 61.8816 14.4233 62.5174C15.9843 63.1532 17.6568 63.4705 19.3423 63.4506L23.236 63.4068L25.9573 66.1893C27.1349 67.3944 28.5415 68.3521 30.0945 69.0058C31.6474 69.6596 33.3154 69.9964 35.0004 69.9964C36.6854 69.9964 38.3533 69.6596 39.9063 69.0058C41.4593 68.3521 42.8659 67.3944 44.0435 66.1893L46.7648 63.4024L50.6585 63.4506C52.344 63.4705 54.0164 63.1532 55.5775 62.5174C57.1386 61.8816 58.5567 60.9401 59.7486 59.7482C60.9405 58.5563 61.8821 57.1381 62.5179 55.577C63.1537 54.016 63.471 52.3435 63.451 50.6581L63.4073 46.7643L66.1898 44.0431C67.3949 42.8654 68.3525 41.4588 69.0063 39.9059C69.6601 38.3529 69.9969 36.6849 69.9969 34.9999C69.9969 33.315 69.6601 31.647 69.0063 30.094C68.3525 28.5411 67.3949 27.1344 66.1898 25.9568L63.4029 23.2356L63.451 19.3418C63.471 17.6563 63.1537 15.9839 62.5179 14.4228C61.8821 12.8618 60.9405 11.4436 59.7486 10.2517C58.5567 9.05981 57.1386 8.11827 55.5775 7.48245C54.0164 6.84663 52.344 6.52937 50.6585 6.54931L46.7648 6.59306L44.0435 3.80619ZM45.2991 29.9862L32.1741 43.1112C31.9709 43.3149 31.7295 43.4765 31.4638 43.5868C31.198 43.6971 30.9131 43.7538 30.6254 43.7538C30.3377 43.7538 30.0527 43.6971 29.787 43.5868C29.5212 43.4765 29.2798 43.3149 29.0766 43.1112L22.5141 36.5487C22.3107 36.3453 22.1494 36.1039 22.0393 35.8381C21.9293 35.5724 21.8726 35.2876 21.8726 34.9999C21.8726 34.7123 21.9293 34.4275 22.0393 34.1618C22.1494 33.896 22.3107 33.6546 22.5141 33.4512C22.7175 33.2478 22.959 33.0865 23.2247 32.9764C23.4904 32.8663 23.7753 32.8097 24.0629 32.8097C24.3505 32.8097 24.6353 32.8663 24.9011 32.9764C25.1668 33.0865 25.4083 33.2478 25.6116 33.4512L30.6254 38.4693L42.2016 26.8887C42.6124 26.4779 43.1695 26.2472 43.7504 26.2472C44.3313 26.2472 44.8884 26.4779 45.2991 26.8887C45.7099 27.2994 45.9406 27.8565 45.9406 28.4374C45.9406 29.0183 45.7099 29.5754 45.2991 29.9862Z"
        fill={Colors.primary}
      />
    </G>
    <Defs>
      <ClipPath id="clip_badge">
        <Rect width="70" height="70" fill="white" />
      </ClipPath>
    </Defs>
  </Svg>
);

export default function LoginScreen() {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = windowHeight - LOGO_CLEARANCE;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [role, setRole] = useState<'seeker' | 'hirer'>('seeker');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showForgotSheet, setShowForgotSheet] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'verify' | 'reset' | 'success'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(60);
  const [resendKey, setResendKey] = useState(0);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);
  const otpRefs = useRef<(TextInput | null)[]>([null, null, null, null, null, null]);
  const [slideAnim] = useState(() => new Animated.Value(windowHeight));

  useEffect(() => {
    // The countdown is reset to 60 by the Send/Resend handlers that start it.
    if (forgotStep !== 'verify') return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [forgotStep, resendKey]);

  const openForgotSheet = () => {
    setForgotError('');
    setShowForgotSheet(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const closeForgotSheet = () => {
    Animated.timing(slideAnim, {
      toValue: sheetHeight,
      duration: 240,
      useNativeDriver: true,
    }).start(() => {
      setShowForgotSheet(false);
      setForgotEmail('');
      setForgotStep('email');
      setOtpValues(['', '', '', '', '', '']);
      setTimeLeft(60);
      setResendKey(0);
      setNewPassword('');
      setConfirmPassword('');
      setForgotError('');
      setIsForgotSubmitting(false);
    });
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const next = [...otpValues];
    next[index] = digit;
    setOtpValues(next);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !otpValues[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const isForgotValid = forgotEmail.trim().length > 0 && !isForgotSubmitting;
  const isVerifyActive = otpValues.every(v => v.length > 0) && !isForgotSubmitting;
  const countdownLabel = `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`;

  const passwordRules = [
    { label: '10+ characters',   met: newPassword.length >= 10 },
    { label: 'lowercase letter', met: /[a-z]/.test(newPassword) },
    { label: 'uppercase letter', met: /[A-Z]/.test(newPassword) },
    { label: 'number',           met: /[0-9]/.test(newPassword) },
  ];
  const isResetActive = passwordRules.every(r => r.met) && newPassword === confirmPassword && !isForgotSubmitting;
  const isLoginActive = email.trim().length > 0 && password.trim().length > 0 && !isSubmitting;

  const handleSendCode = async () => {
    if (!isForgotValid || isForgotSubmitting) return;
    setForgotError('');
    setIsForgotSubmitting(true);
    try {
      await requestForgotPassword(forgotEmail.trim());
      setTimeLeft(60);
      setForgotStep('verify');
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Failed to send reset code');
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (timeLeft > 0 || isForgotSubmitting) return;
    setForgotError('');
    setIsForgotSubmitting(true);
    try {
      await requestForgotPassword(forgotEmail.trim());
      setTimeLeft(60);
      setResendKey(k => k + 1);
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!isResetActive || isForgotSubmitting) return;
    setForgotError('');
    setIsForgotSubmitting(true);
    try {
      await resetPassword({
        email: forgotEmail.trim(),
        code: otpValues.join(''),
        newPassword,
      });
      setForgotStep('success');
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  const handleLogin = async () => {
    if (!isLoginActive) return;

    setAuthError('');
    setIsSubmitting(true);
    try {
      const session = await loginMobile(email.trim(), password);
      const backendRole = session.user.role === 'hirer' ? 'hirer' : 'seeker';
      authStore.setSession(session.token, session.user);
      authStore.setRole(backendRole);
      router.replace('/(auth)/loading');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to sign in');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F9' }}>

      {/* ── Login form ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!showForgotSheet}
        >
          {/* Logo */}
          <View style={{ marginBottom: 14 }}>
            <LogoSVG />
          </View>

          <Text
            style={{ fontSize: 24, color: Colors.primary, fontWeight: 'bold', fontStyle: 'italic', marginBottom: 4 }}
            className="font-sans"
          >
            Welcome Back
          </Text>
          <Text
            style={{ fontSize: 14, color: '#8A8D9F', marginBottom: 14 }}
            className="font-sans"
          >
            Continue exploring global opportunities.
          </Text>

          {/* Role selector toggle */}
          <View style={{ flexDirection: 'row', backgroundColor: '#EBEBEE', borderRadius: 10, padding: 4, marginBottom: 16 }}>
            <TouchableOpacity
              onPress={() => setRole('seeker')}
              style={{
                flex: 1,
                paddingVertical: 10,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: role === 'seeker' ? '#FFFFFF' : 'transparent',
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: role === 'seeker' ? Colors.primary : '#8A8D9F',
                }}
                className="font-sans"
              >
                Find Opportunities
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setRole('hirer')}
              style={{
                flex: 1,
                paddingVertical: 10,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: role === 'hirer' ? '#FFFFFF' : 'transparent',
                borderRadius: 8,


              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: role === 'hirer' ? Colors.primary : '#8A8D9F',
                }}
                className="font-sans"
              >
                Hiring Talent
              </Text>
            </TouchableOpacity>
          </View>

          {/* Email Input */}
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 13, color: '#1A1A1A', marginBottom: 8, fontWeight: '500' }} className="font-sans">
              Email
            </Text>
            <View style={{ height: 48, borderWidth: 1, borderColor: '#EBEBEE', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={role === 'hirer' ? 'Enter company email address' : 'Enter your email address'}
                placeholderTextColor="#A1A1AA"
                keyboardType="email-address"
                autoCapitalize="none"
                style={{ flex: 1, fontSize: 14, color: '#1A1A1A', outline: 'none' } as any}
                className="font-sans"
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: '#1A1A1A', marginBottom: 8, fontWeight: '500' }} className="font-sans">
              Password
            </Text>
            <View style={{ height: 48, borderWidth: 1, borderColor: '#EBEBEE', borderRadius: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#A1A1AA"
                secureTextEntry={!showPassword}
                style={{ flex: 1, fontSize: 14, color: '#1A1A1A', outline: 'none' } as any}
                className="font-sans"
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={{ padding: 4 }}>
                {showPassword ? <EyeOff size={18} color="#A1A1AA" /> : <Eye size={18} color="#A1A1AA" />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Remember Me & Forgot Password */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setRememberMe(!rememberMe)}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <View style={{
                width: 16, height: 16, borderWidth: 1,
                borderColor: rememberMe ? Colors.primary : '#C4C4C4',
                borderRadius: 4,
                backgroundColor: rememberMe ? Colors.primary : 'transparent',
                justifyContent: 'center', alignItems: 'center', marginRight: 8,
              }}>
                {rememberMe && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
              </View>
              <Text style={{ fontSize: 13, color: '#8A8D9F' }} className="font-sans">
                Remember me
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={openForgotSheet}>
              <Text style={{ fontSize: 13, color: Colors.primary, textDecorationLine: 'underline' }} className="font-sans">
                Forgot password?
              </Text>
            </TouchableOpacity>
          </View>

          {authError ? (
            <Text style={{ fontSize: 13, color: '#ED4C5C', marginBottom: 12 }} className="font-sans">
              {authError}
            </Text>
          ) : null}

          {/* Login Button */}
          <TouchableOpacity
            disabled={!isLoginActive}
            onPress={handleLogin}
            style={{
              height: Size.controlHeight, backgroundColor: isLoginActive ? Colors.primary : Colors.primary10, borderRadius: Radius.control,
              justifyContent: 'center', alignItems: 'center', marginBottom: 18,

            }}
          >
            <Text style={{ fontSize: 15, color: '#FFFFFF', fontWeight: 'bold' }} className="font-sans">
              {isSubmitting ? 'Logging in...' : 'Login'}
            </Text>
          </TouchableOpacity>

          {/* OR Divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: Colors.divider }} />
            <Text style={{ marginHorizontal: 16, fontSize: 13, color: Colors.textBody, fontWeight: 'bold', fontStyle: 'italic' }} className="font-sans">
              OR
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: Colors.divider }} />
          </View>

          {/* Google Login */}
          <TouchableOpacity style={{ height: Size.controlHeight, backgroundColor: Colors.primary10, borderRadius: Radius.control, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ marginRight: 12 }}>
              <GoogleLogo size={20} />
            </View>
            <Text style={{ fontSize: 14, color: Colors.primary, fontWeight: 'bold' }} className="font-sans">
              Login with google
            </Text>
          </TouchableOpacity>

          {/* Apple Login */}
          <TouchableOpacity style={{ height: Size.controlHeight, backgroundColor: Colors.primary10, borderRadius: Radius.control, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 14 }}>
            <Image
              source={{ uri: 'https://cdn-icons-png.flaticon.com/512/0/747.png' }}
              style={{ width: 18, height: 18, marginRight: 12, tintColor: Colors.black }}
            />
            <Text style={{ fontSize: 14, color: Colors.primary, fontWeight: 'bold' }} className="font-sans">
              Login with Apple
            </Text>
          </TouchableOpacity>

          {/* Sign Up Footer */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 4 }}>
            <Text style={{ fontSize: 13, color: Colors.textMuted }} className="font-sans">
              Don&apos;t have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
              <Text style={{ fontSize: 13, color: Colors.primary, fontWeight: 'bold' }} className="font-sans">
                Sign up
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Forgot Password flow ── */}

      {/* Full-screen success state */}
      {showForgotSheet && forgotStep === 'success' && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F7F7F9', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <View style={{ marginBottom: 20 }}>
            <SuccessBadge />
          </View>

          <Text style={{ fontSize: 18, fontWeight: 'bold', color: Colors.primary, textAlign: 'center', marginBottom: 10 }} className="font-sans">
            Password Reset Successful
          </Text>
          <Text style={{ fontSize: 14, color: '#8A8D9F', textAlign: 'center', lineHeight: 22, marginBottom: 40 }} className="font-sans">
            Your password has been updated successfully.
          </Text>

          <TouchableOpacity
            onPress={closeForgotSheet}
            style={{ width: '100%', height: 52, borderRadius: 12, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' }}
          >
            <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#FFFFFF' }} className="font-sans">Continue to Login</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Sliding bottom sheet (email / verify / reset steps) */}
      {showForgotSheet && forgotStep !== 'success' && (
        <>
          {/* Transparent backdrop — tap to dismiss */}
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={closeForgotSheet}
          />

          {/* Sliding sheet */}
          <Animated.View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: sheetHeight,
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingTop: 12,
              overflow: 'hidden',
              transform: [{ translateY: slideAnim }],
            }}
          >
            {/* Drag handle */}
            <View style={{ width: 36, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, alignSelf: 'center', marginBottom: 28 }} />

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
            >

            {forgotStep === 'email' ? (
              <>
                <Text style={{ fontSize: 15, fontWeight: 'bold', fontStyle: 'italic', color: Colors.primary, marginBottom: 8 }} className="font-sans">
                  Forgot Password?
                </Text>

                <Text style={{ fontSize: 12, color: '#8A8D9F', lineHeight: 18, marginBottom: 28 }} className="font-sans">
                  Enter your email address and we&apos;ll send you a link to reset your password.
                </Text>

                <Text style={{ fontSize: 13, color: '#1A1A1A', fontWeight: '500', marginBottom: 8 }} className="font-sans">
                  Email
                </Text>

                <View style={{ height: 48, borderWidth: 1, borderColor: '#EBEBEE', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: '#FFFFFF', marginBottom: 16 }}>
                  <TextInput
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    placeholder="Enter your email address"
                    placeholderTextColor="#A1A1AA"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={{ flex: 1, fontSize: 14, color: '#1A1A1A', outline: 'none' } as any}
                    className="font-sans"
                  />
                </View>

                {forgotError ? (
                  <Text style={{ fontSize: 13, color: '#ED4C5C', marginBottom: 16 }} className="font-sans">
                    {forgotError}
                  </Text>
                ) : null}

                <TouchableOpacity
                  disabled={!isForgotValid}
                  onPress={handleSendCode}
                  style={{ height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: isForgotValid ? Colors.primary : Colors.primary10 }}
                >
                  <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#FFFFFF' }} className="font-sans">
                    {isForgotSubmitting ? 'Sending...' : 'Send'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : forgotStep === 'verify' ? (
              <>
                <Text style={{ fontSize: 15, fontWeight: 'bold', fontStyle: 'italic', color: Colors.primary, marginBottom: 8 }} className="font-sans">
                  Enter Verification code
                </Text>

                <Text style={{ fontSize: 12, color: '#8A8D9F', lineHeight: 18, marginBottom: 32 }} className="font-sans">
                  We have sent a code to{' '}
                  <Text style={{ color: '#1A1A1A', fontWeight: 'bold' }}>{forgotEmail}</Text>
                </Text>

                {/* OTP boxes */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                  {otpValues.map((val, i) => (
                    <TextInput
                      key={i}
                      ref={el => { otpRefs.current[i] = el; }}
                      value={val}
                      onChangeText={text => handleOtpChange(i, text)}
                      onKeyPress={({ nativeEvent }) => handleOtpKeyPress(i, nativeEvent.key)}
                      keyboardType="number-pad"
                      maxLength={1}
                      style={{
                        width: 44,
                        height: 52,
                        borderWidth: 1,
                        borderColor: val ? Colors.primary : '#EBEBEE',
                        borderRadius: 10,
                        textAlign: 'center',
                        fontSize: 20,
                        fontWeight: 'bold',
                        color: '#1A1A1A',
                        backgroundColor: '#FFFFFF',
                        outline: 'none',
                      } as any}
                    />
                  ))}
                </View>

                {forgotError ? (
                  <Text style={{ fontSize: 13, color: '#ED4C5C', marginBottom: 16 }} className="font-sans">
                    {forgotError}
                  </Text>
                ) : null}

                {/* Resend countdown */}
                <View style={{ flexDirection: 'row', marginBottom: 32 }}>
                  <Text style={{ fontSize: 13, color: '#8A8D9F' }} className="font-sans">Resend code </Text>
                  <TouchableOpacity
                    disabled={timeLeft > 0 || isForgotSubmitting}
                    onPress={handleResendCode}
                  >
                    <Text style={{ fontSize: 13, color: timeLeft > 0 || isForgotSubmitting ? '#8A8D9F' : Colors.primary, fontWeight: 'bold' }} className="font-sans">
                      {timeLeft > 0 ? `(${countdownLabel})` : isForgotSubmitting ? '(Sending...)' : 'Resend'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  disabled={!isVerifyActive}
                  onPress={() => {
                    setForgotError('');
                    setForgotStep('reset');
                  }}
                  style={{ height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: isVerifyActive ? Colors.primary : Colors.primary10 }}
                >
                  <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#FFFFFF' }} className="font-sans">Verify</Text>
                </TouchableOpacity>
              </>
            ) : forgotStep === 'reset' ? (
              <>
                <Text style={{ fontSize: 15, fontWeight: 'bold', fontStyle: 'italic', color: Colors.primary, marginBottom: 8 }} className="font-sans">
                  Create New Password
                </Text>

                <Text style={{ fontSize: 12, color: '#8A8D9F', lineHeight: 18, marginBottom: 24 }} className="font-sans">
                  Your new password must be different from your previous password.
                </Text>

                {/* New Password */}
                <Text style={{ fontSize: 13, color: '#1A1A1A', fontWeight: '500', marginBottom: 8 }} className="font-sans">New Password</Text>
                <View style={{ height: 48, borderWidth: 1, borderColor: '#EBEBEE', borderRadius: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginBottom: 16 }}>
                  <TextInput
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter your password"
                    placeholderTextColor="#A1A1AA"
                    secureTextEntry={!showNewPassword}
                    style={{ flex: 1, fontSize: 14, color: '#1A1A1A', outline: 'none' } as any}
                    className="font-sans"
                  />
                  <TouchableOpacity onPress={() => setShowNewPassword(v => !v)} style={{ padding: 4 }}>
                    {showNewPassword ? <EyeOff size={18} color="#A1A1AA" /> : <Eye size={18} color="#A1A1AA" />}
                  </TouchableOpacity>
                </View>

                {/* Confirm Password */}
                <Text style={{ fontSize: 13, color: '#1A1A1A', fontWeight: '500', marginBottom: 8 }} className="font-sans">Confirm Password</Text>
                <View style={{ height: 48, borderWidth: 1, borderColor: '#EBEBEE', borderRadius: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginBottom: 16 }}>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm your password"
                    placeholderTextColor="#A1A1AA"
                    secureTextEntry={!showConfirmPassword}
                    style={{ flex: 1, fontSize: 14, color: '#1A1A1A', outline: 'none' } as any}
                    className="font-sans"
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(v => !v)} style={{ padding: 4 }}>
                    {showConfirmPassword ? <EyeOff size={18} color="#A1A1AA" /> : <Eye size={18} color="#A1A1AA" />}
                  </TouchableOpacity>
                </View>

                {/* Password requirements */}
                <View style={{ gap: 8, marginBottom: 20 }}>
                  {passwordRules.map((rule) => {
                    const hasInput = newPassword.length > 0;
                    const bg   = rule.met ? 'rgba(22,163,74,0.2)'  : hasInput ? 'rgba(237,76,92,0.2)' : '#F5F6FA';
                    const fg   = rule.met ? '#16A34A'               : hasInput ? '#ED4C5C'             : '#8A8D9F';
                    return (
                      <View key={rule.label} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: bg, borderRadius: 8, paddingHorizontal: 14, height: 40 }}>
                        <Text style={{ fontSize: 13, color: fg }} className="font-sans">{rule.label}</Text>
                        {rule.met
                          ? <Check size={14} color="#16A34A" strokeWidth={2.5} />
                          : <X size={14} color={hasInput ? '#ED4C5C' : '#A1A1AA'} strokeWidth={2.5} />
                        }
                      </View>
                    );
                  })}
                </View>

                {forgotError ? (
                  <Text style={{ fontSize: 13, color: '#ED4C5C', marginBottom: 16 }} className="font-sans">
                    {forgotError}
                  </Text>
                ) : null}

                <TouchableOpacity
                  disabled={!isResetActive}
                  onPress={handleResetPassword}
                  style={{ height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: isResetActive ? Colors.primary : Colors.primary10 }}
                >
                  <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#FFFFFF' }} className="font-sans">
                    {isForgotSubmitting ? 'Resetting...' : 'Reset password'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
            </ScrollView>
          </Animated.View>
        </>
      )}
    </SafeAreaView>
  );
}
