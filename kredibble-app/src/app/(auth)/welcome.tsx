import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Home } from 'lucide-react-native';

export default function AuthEntryScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-[#F7F7F9] px-6 items-center justify-center">
      <Image
        source={require('../../../assets/images/logo_light.png')}
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

    </View>
  );
}
