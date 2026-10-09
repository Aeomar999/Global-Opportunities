import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Platform } from 'react-native';
import { ToastProvider } from '../components/ui/ToastProvider';
import { initMobileErrorTracking, Sentry } from '../lib/sentry';
import { setEmailVerificationHandler } from '../lib/api';
import { OfflineBanner } from '../lib/network';
import { registerForPushNotificationsAsync } from '../lib/notifications';
import "../global.css";

initMobileErrorTracking();

function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    setEmailVerificationHandler(() => {
      router.push('/(auth)/verify-email' as any);
    });
    registerForPushNotificationsAsync().catch(() => {
      // Non-blocking in dev/simulators
    });
    return () => {
      setEmailVerificationHandler(null);
    };
  }, [router]);

  return (
    <ToastProvider>
      <View style={Platform.OS === 'web' ? { flex: 1, alignItems: 'center', backgroundColor: '#f3f4f6' } : { flex: 1 }}>
        <View style={Platform.OS === 'web' ? { flex: 1, width: '100%', maxWidth: 480, backgroundColor: '#ffffff', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' } : { flex: 1 }}>
        <StatusBar style="dark" />
        <OfflineBanner />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </View>
    </View>
    </ToastProvider>
  );
}

export default Sentry.wrap(RootLayout);
