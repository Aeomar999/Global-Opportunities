import React from 'react';
import { View, Text, Image, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Home, Trash2 } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';

export default function AuthEntryScreen() {
  const router = useRouter();

  const clearOnboarding = async () => {
    try {
      await SecureStore.deleteItemAsync('hasSeenOnboarding');
      Alert.alert('Cleared', 'Onboarding flag cleared. Next app launch will show onboarding.');
    } catch (e) {
      Alert.alert('Error', 'Failed to clear onboarding flag');
    }
  };

  return (
    <View className="flex-1 bg-[#F7F7F9] px-6 items-center justify-center">
      <Image
        source={require('../../assets/images/logo_light.png')}
        style={{ width: 78, height: 78, marginBottom: 24 }}
        resizeMode="contain"
      />

      <Text
        className="font-sans font-bold text-center text-[#1A1A1A]"
        style={{ fontSize: 28, lineHeight: 34, marginBottom: 8 }}
      >
        Welcome to Kredibble
      </Text>
      <Text
        className="font-sans text-center text-[#8A8D9F]"
        style={{ fontSize: 14, lineHeight: 20, marginBottom: 32 }}
      >
        Sign in or create an account to explore global opportunities.
      </Text>

      <TouchableOpacity
        onPress={() => router.push('/(auth)/login')}
        style={{
          width: '100%',
          height: 52,
          borderRadius: 12,
          backgroundColor: '#6671E4',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Text className="font-sans font-bold text-white" style={{ fontSize: 15 }}>
          Login
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/(auth)/signup')}
        style={{
          width: '100%',
          height: 52,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: '#6671E4',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
        }}
      >
        <Text className="font-sans font-bold text-[#6671E4]" style={{ fontSize: 15 }}>
          Sign Up
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/(tabs)')}
        style={{
          marginTop: 24,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Home size={18} color="#8A8D9F" />
        <Text className="font-sans text-[#8A8D9F]" style={{ fontSize: 14 }}>
          Browse as Guest
        </Text>
      </TouchableOpacity>

      {/* Debug: Clear onboarding flag */}
      <TouchableOpacity
        onPress={clearOnboarding}
        style={{
          marginTop: 40,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: 12,
          backgroundColor: 'rgba(237, 76, 92, 0.1)',
          borderRadius: 8,
        }}
      >
        <Trash2 size={16} color="#ED4C5C" />
        <Text className="font-sans text-[#ED4C5C]" style={{ fontSize: 12 }}>
          Clear Onboarding Flag (Debug)
        </Text>
      </TouchableOpacity>
    </View>
  );
}
