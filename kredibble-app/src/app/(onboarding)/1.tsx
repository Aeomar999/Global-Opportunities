import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius, Size } from '../../constants/design';
import { BrushHighlight } from '../../components/ui/BrushHighlight';

import Svg, { Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';

export default function Onboarding1Screen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgOnboarding }}>
      <SafeAreaView className="flex-1">
        {/* Top Header: Pagination & Skip */}
        <View className="flex-row items-center justify-between px-6 pt-4">
          {/* Pagination */}
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <View className="bg-white rounded-full" style={{ width: 6, height: 6 }} />
            <View className="bg-white/40 rounded-full" style={{ width: 4, height: 4 }} />
            <View className="bg-white/40 rounded-full" style={{ width: 4, height: 4 }} />
          </View>
          
          {/* Skip Button */}
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
            <Text 
              className="text-white font-sans"
              style={{ fontSize: 15 }}
            >
              Skip
            </Text>
          </TouchableOpacity>
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
              width: 520, // glow behind the photo: much wider and taller than the original 301 x 539 (soft edges run past the screen sides) ...
              height: 760,
              bottom: -53, // ... and its centre sits ~57 px higher (was 269 from the bottom, now 327)
            }}
          >
            <Svg width="100%" height="100%" viewBox="0 0 301 539" preserveAspectRatio="none">
              <Defs>
                <RadialGradient
                  id="glowGrad"
                  cx="50%"
                  cy="50%"
                  rx="50%"
                  ry="50%"
                >
                  <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                  <Stop offset="35%" stopColor="#FFFFFF" stopOpacity="0.7" />
                  <Stop offset="70%" stopColor="#FFFFFF" stopOpacity="0.25" />
                  <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Ellipse cx="150.5" cy="269.5" rx="150.5" ry="269.5" fill="url(#glowGrad)" />
            </Svg>
          </View>
          <Image
            source={require('../../../assets/images/onboarding_1.png')}
            style={{ width: '100%', height: '100%', zIndex: 1 }}
            resizeMode="contain"
          />

          {/* Seamless fade to hide the horizontal line */}
          <LinearGradient
            colors={['rgba(121, 46, 164, 0)', Colors.bgOnboarding]}
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
            backgroundColor: Colors.bgOnboarding,
          } as any}
        >
          {/* Typography */}
          <View className="mb-4">
            <Text 
              className="text-white font-heading font-extrabold"
              style={{ fontSize: 36, lineHeight: 42 }}
            >
              Discover
            </Text>
            <BrushHighlight>
              <Text 
                className="text-white font-heading font-extrabold italic"
                style={{ fontSize: 36, lineHeight: 42 }}
              >
                Global
              </Text>
            </BrushHighlight>
            <Text 
              className="text-white font-heading font-extrabold"
              style={{ fontSize: 36, lineHeight: 42 }}
            >
              Opportunities
            </Text>
          </View>

          <Text 
            className="text-white/90 font-sans mb-10"
            style={{ fontSize: 13, lineHeight: 18 }}
          >
            Find scholarships, jobs, internships, fellowships, and grants from trusted organizations worldwide.
          </Text>

          {/* Call to Action */}
          <TouchableOpacity
            onPress={() => router.push('/(onboarding)/2')}
            className="bg-white w-full items-center"
            style={{ height: Size.controlHeight, borderRadius: Radius.control, justifyContent: 'center' }}
          >
            <Text 
              className="text-primary font-sans font-bold"
              style={{ fontSize: 15 }}
            >
              Next
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
