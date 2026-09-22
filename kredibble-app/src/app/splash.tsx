import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'react-native';

const LogoSVG = () => (
  <Image
    source={require('../../../assets/images/logo.png')}
    style={{ width: 100, height: 100, borderRadius: 50 }}
    resizeMode="contain"
  />
);

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const checkFirstLaunch = async () => {
      try {
        const hasSeenOnboarding = await SecureStore.getItemAsync('hasSeenOnboarding');
        if (hasSeenOnboarding === 'true') {
          router.replace('/(auth)/index');
        } else {
          router.replace('/(onboarding)/1');
        }
      } catch {
        // Fallback to auth if storage fails
        router.replace('/(auth)/index');
      }
    };

    checkFirstLaunch();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F7F9', justifyContent: 'center', alignItems: 'center' }}>
      <StatusBar style="dark" />
      <LogoSVG />
      <ActivityIndicator size="large" color="#6671E4" style={{ marginTop: 24 }} />
    </View>
  );
}