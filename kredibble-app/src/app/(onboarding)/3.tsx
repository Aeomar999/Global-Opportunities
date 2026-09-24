import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';

import Svg, { Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';

export default function Onboarding3Screen() {
  const router = useRouter();

  const handleGetStarted = async () => {
    try {
      await SecureStore.setItemAsync('hasSeenOnboarding', 'true');
    } catch {
      // Ignore storage errors
    }
    router.replace('/(auth)/welcome' as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#6671E4' }}>
      <SafeAreaView className="flex-1">
        {/* Top Header: Pagination & Skip */}
        <View className="flex-row items-center justify-between px-6 pt-4 h-[42px]">
          {/* Pagination (Screen 3 active) */}
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <View className="bg-white/40 rounded-full" style={{ width: 4, height: 4 }} />
            <View className="bg-white/40 rounded-full" style={{ width: 4, height: 4 }} />
            <View className="bg-white rounded-full" style={{ width: 6, height: 6 }} />
          </View>
          
          {/* Empty View to maintain flex-between alignment since no Skip is needed on last screen */}
          <View style={{ width: 40 }} />
        </View>

        {/* Hero Image */}
        <View 
          className="flex-1 items-center" 
          style={{ justifyContent: 'flex-end', marginBottom: -80, position: 'relative' }}
        >
          {/* White Ellipse Background with Radial Gradient (Cross-platform Glow) */}
          <View 
            style={{
              position: 'absolute',
              width: 301,
              height: 539,
              bottom: 0,
            }}
          >
            <Svg width="100%" height="100%" viewBox="0 0 301 539">
              <Defs>
                <RadialGradient
                  id="glowGrad"
                  cx="50%"
                  cy="50%"
                  rx="50%"
                  ry="50%"
                >
                  <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
                  <Stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.5" />
                  <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Ellipse cx="150.5" cy="269.5" rx="150.5" ry="269.5" fill="url(#glowGrad)" />
            </Svg>
          </View>
          <Image
            source={require('../../../assets/images/onboarding_3.png')}
            style={{ 
              width: '100%', 
              height: '100%', 
              zIndex: 1,
              transform: [{ scale: 1.1 }]
            }}
            resizeMode="contain"
          />

          {/* Seamless fade to hide the horizontal line */}
          <LinearGradient
            colors={['rgba(102, 113, 228, 0)', '#6671E4']}
            style={{
              position: 'absolute',
              bottom: 78, // Sits exactly on the edge of the bottom container
              left: 0,
              right: 0,
              height: 120, // Huge smooth fade upwards
              zIndex: 5,
            }}
          />
        </View>

        {/* Bottom Content Area */}
        <View 
          className="px-6 pb-12 pt-8" 
          style={{ 
            zIndex: 10,
            backgroundColor: '#6671E4',
          } as any}
        >
          {/* Typography */}
          <View className="mb-4">
            <Text 
              className="text-white font-sans font-bold"
              style={{ fontSize: 36, lineHeight: 42 }}
            >
              Get AI-Powered
            </Text>
            <Text 
              className="text-white font-sans font-bold italic"
              style={{ fontSize: 36, lineHeight: 42 }}
            >
              Opportunity
            </Text>
            <Text 
              className="text-white font-sans font-bold"
              style={{ fontSize: 36, lineHeight: 42 }}
            >
              Matches
            </Text>
          </View>

          <Text 
            className="text-white/90 font-sans mb-10"
            style={{ fontSize: 13, lineHeight: 18 }}
          >
            Receive personalized recommendations, eligibility matching, and career guidance tailored to your goals.
          </Text>

          {/* Call to Action */}
          <TouchableOpacity
            onPress={handleGetStarted}
            className="bg-white w-full items-center shadow-sm"
            style={{ height: 47, borderRadius: 8, justifyContent: 'center' }}
          >
            <Text 
              className="text-[#6671E4] font-sans font-bold"
              style={{ fontSize: 15 }}
            >
              Get Started
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
