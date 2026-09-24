import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Platform } from 'react-native';
import { ToastProvider } from '../components/ui/ToastProvider';
import "../global.css";

export default function RootLayout() {
  return (
    <ToastProvider>
      <View style={Platform.OS === 'web' ? { flex: 1, alignItems: 'center', backgroundColor: '#f3f4f6' } : { flex: 1 }}>
        <View style={Platform.OS === 'web' ? { flex: 1, width: '100%', maxWidth: 480, backgroundColor: '#ffffff', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' } : { flex: 1 }}>
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
