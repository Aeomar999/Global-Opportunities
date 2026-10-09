import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Radius } from '../../constants/design';
import { Header } from '../../components/ui/Header';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/ToastProvider';
import { markAmbassadorRequestPending } from '../../components/ui/AmbassadorCta';
import { authStore } from '../../constants/authStore';
import { createAmbassadorRequest } from '../../lib/api';

const MIN_LENGTH = 20;
const MAX_LENGTH = 1000;

const THANK_YOU =
  'Thank you for applying to become a Kredibble ambassador. We have received your request and our team will review it shortly. You will receive a notification here as soon as a decision has been made.';

/** Asks the person why they want to be an ambassador; the answer is what the admin reads when reviewing the request. */
export default function BecomeAmbassadorScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const length = reason.trim().length;
  const tooShort = length < MIN_LENGTH;

  const submit = async () => {
    setTouched(true);
    if (tooShort) return;
    setSubmitting(true);
    try {
      await createAmbassadorRequest({ motivation: reason.trim() });
      markAmbassadorRequestPending();
      router.back();
      showToast(THANK_YOU, 'success', { duration: 7000, multiline: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (/token is required|session expired|invalid or expired|no longer active/i.test(message)) {
        showToast('Your session has expired. Please log in again to continue.', 'error', { duration: 4000 });
        authStore.clearSession();
        router.replace('/(auth)/login' as any);
      } else {
        showToast(message || 'We could not send your request. Please try again.', 'error', { duration: 4000 });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }} edges={['top', 'left', 'right']}>
      <Header title="Become an ambassador" showBack />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.bgScreen }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={{ fontSize: 20, color: Colors.textBody }} className="font-heading font-bold">
            Why do you want to be an ambassador?
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 21, color: Colors.textBody, fontWeight: '300', marginTop: 8 }} className="font-sans">
            Tell our team a little about yourself and what you would bring to the Kredibble community. Your answer is shared with the team reviewing your request.
          </Text>

          <TextInput
            value={reason}
            onChangeText={setReason}
            onBlur={() => setTouched(true)}
            placeholder="Share your motivation, experience and how you would help others find opportunities…"
            placeholderTextColor={Colors.textMuted}
            multiline
            textAlignVertical="top"
            maxLength={MAX_LENGTH}
            accessibilityLabel="Why do you want to be an ambassador"
            style={{
              marginTop: 20, minHeight: 180, borderRadius: Radius.control, borderWidth: 1,
              borderColor: touched && tooShort ? Colors.errorDot : Colors.borderInput,
              backgroundColor: Colors.bgCard, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, lineHeight: 22, color: Colors.textBody,
            }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ fontSize: 12, color: touched && tooShort ? Colors.error : Colors.textMuted }} className="font-sans">
              {touched && tooShort ? `Please write at least ${MIN_LENGTH} characters.` : `At least ${MIN_LENGTH} characters`}
            </Text>
            <Text style={{ fontSize: 12, color: Colors.textMuted }} className="font-sans">{length}/{MAX_LENGTH}</Text>
          </View>

          <View style={{ marginTop: 24 }}>
            <Button label="Send request" variant="accent" fullWidth loading={submitting} onPress={submit} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
