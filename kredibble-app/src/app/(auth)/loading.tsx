import { useEffect, useState } from 'react';
import { View, Animated, Image } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { G, Rect, Defs, ClipPath } from 'react-native-svg';
import * as SecureStore from 'expo-secure-store';

const LogoSVG = () => (
  <Image 
    source={require('../../../assets/images/logo.png')} 
    style={{ width: 100, height: 100, borderRadius: 50 }} 
    resizeMode="contain" 
  />
);

export default function LoadingScreen() {
  const router = useRouter();
  const [spinValue] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();

    const checkOnboarding = async () => {
      try {
        const hasSeenOnboarding = await SecureStore.getItemAsync('hasSeenOnboarding');
        console.log('[LoadingScreen] hasSeenOnboarding:', hasSeenOnboarding);
        if (hasSeenOnboarding === 'true') {
          console.log('[LoadingScreen] Redirecting to /(tabs)');
          router.replace('/(tabs)');
        } else {
          console.log('[LoadingScreen] Redirecting to /(onboarding)/1');
          router.replace('/(onboarding)/1');
        }
      } catch (error) {
        console.log('[LoadingScreen] Error reading storage, fallback to tabs:', error);
        // Fallback to tabs if storage fails
        router.replace('/(tabs)');
      }
    };

    // Small delay for animation, then check onboarding
    const timer = setTimeout(() => {
      checkOnboarding();
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const rotate = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F7F9', justifyContent: 'center', alignItems: 'center' }}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <LogoSVG />
      </Animated.View>
    </View>
  );
}
