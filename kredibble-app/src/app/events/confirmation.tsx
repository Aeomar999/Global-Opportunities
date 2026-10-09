import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, FontWeight, Radius } from '../../constants/design';

export default function OrderConfirmationScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen }} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        {/* Verification Checkmark Graphic */}
        <View style={styles.checkmarkCircle}>
          <ShieldCheck size={64} color={Colors.primary} fill="rgba(121, 46, 164, 0.15)" />
        </View>

        {/* Confirmation Messages */}
        <Text style={styles.titleText} className="font-sans">
          Your order is confirmed
        </Text>
        <Text style={styles.subtitleText} className="font-sans">
          See you there!
        </Text>

        {/* CTA Actions */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={() => router.replace('/events')}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText} className="font-sans">
              View your tickets
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.replace('/events')}
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryBtnText} className="font-sans">
              Go to events
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  checkmarkCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(121, 46, 164, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  titleText: {
    fontSize: FontSize.lg, // 22px
    fontWeight: FontWeight.bold,
    color: Colors.textHeading,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: FontSize.base, // 14px
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 40,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 12,
  },
  primaryBtn: {
    width: '100%',
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: FontWeight.bold,
  },
  secondaryBtn: {
    width: '100%',
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: FontWeight.medium,
  },
});
