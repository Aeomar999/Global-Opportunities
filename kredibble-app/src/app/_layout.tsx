import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  PlusJakartaSans_600SemiBold_Italic,
  PlusJakartaSans_700Bold_Italic,
  PlusJakartaSans_800ExtraBold_Italic,
} from '@expo-google-fonts/plus-jakarta-sans';
import { ToastProvider } from '../components/ui/ToastProvider';
import { Colors } from '../constants/design';
import { installTypography } from '../lib/typography';
import { initMobileErrorTracking, Sentry } from '../lib/sentry';
import "../global.css";

initMobileErrorTracking();

// Keep the splash screen visible until the fonts are ready (or failed).
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    PlusJakartaSans_600SemiBold_Italic,
    PlusJakartaSans_700Bold_Italic,
    PlusJakartaSans_800ExtraBold_Italic,
  });

  // Fail safe: if loading errors, the app still opens and keeps the system font (installTypography is not called).
  const fontsSettled = fontsLoaded || !!fontError;

  if (fontsLoaded) installTypography();

  useEffect(() => {
    if (fontsSettled) SplashScreen.hideAsync().catch(() => {});
  }, [fontsSettled]);

  if (!fontsSettled) return null;

  return (
    <ToastProvider>
      <View style={Platform.OS === 'web' ? { flex: 1, alignItems: 'center', backgroundColor: Colors.bgScreen } : { flex: 1 }}>
        <View style={Platform.OS === 'web' ? { flex: 1, width: '100%', maxWidth: 480, backgroundColor: Colors.bgCard, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' } : { flex: 1 }}>
        <StatusBar style="dark" />
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
