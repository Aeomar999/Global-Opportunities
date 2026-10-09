import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import LogoIntro, { LOGO_INTRO_DURATION } from '../components/ui/LogoIntro';

// Let the finished logo rest for a moment before moving on.
const HOLD_MS = 400;

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const checkFirstLaunch = async () => {
      const minimumShown = new Promise<void>(resolve => setTimeout(resolve, LOGO_INTRO_DURATION + HOLD_MS));
      let target = '/(auth)/login';
      try {
        const hasSeenOnboarding = await SecureStore.getItemAsync('hasSeenOnboarding');
        if (hasSeenOnboarding !== 'true') target = '/(onboarding)/1';
      } catch {
        // Fallback to auth if storage fails
      }
      await minimumShown;
      router.replace(target as any);
    };

    checkFirstLaunch();
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F7F9', justifyContent: 'center', alignItems: 'center' }}>
      <StatusBar style="dark" />
      <LogoIntro />
    </View>
  );
}
