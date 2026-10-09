import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { BadgeCheck, MessageCircle } from 'lucide-react-native';
import { Colors, Radius } from '../../constants/design';
import { Button } from './Button';
import { useToast } from './ToastProvider';
import { getMyAmbassadorStatus, type MyAmbassadorStatus } from '../../lib/api';

// The last decision the person has already been told about, so a change is announced once per app session.
let announcedStatus: string | null = null;

/** Called by the apply page after a request was sent, so the later approval or decline is announced. */
export const markAmbassadorRequestPending = () => {
  announcedStatus = 'pending';
};

const APPROVED = 'Congratulations! Your ambassador request has been approved. Welcome to the Kredibble ambassador community.';
const REJECTED = 'Thank you for your interest in becoming an ambassador. We are unable to approve your request right now, and you are welcome to apply again soon.';

/**
 * The "Become an ambassador" call to action on the Profile tab (seekers and hirers).
 *
 * States: not applied (or declined) shows the button; pending shows a disabled "Request pending"; approved shows
 * "You are an ambassador" with a shortcut to the ambassador group chat. The state is read from the server whenever the
 * Profile tab comes into focus, and a change to approved or declined is announced with a top message.
 */
export function AmbassadorCta() {
  const router = useRouter();
  const { showToast } = useToast();
  const [status, setStatus] = useState<MyAmbassadorStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await getMyAmbassadorStatus();
      setStatus(next);
      const state = next.isAmbassador ? 'approved' : next.request?.status ?? 'none';
      if (announcedStatus === 'pending' && state === 'approved') showToast(APPROVED, 'success', { duration: 6000, multiline: true });
      if (announcedStatus === 'approved' && state === 'rejected') showToast('Your ambassador status has ended. Thank you for your contribution to Kredibble.', 'info', { duration: 6000, multiline: true });
      if (announcedStatus === 'pending' && state === 'rejected') showToast(REJECTED, 'info', { duration: 6000, multiline: true });
      announcedStatus = state;
    } catch {
      // The button still works without a status; the server answers again on submit.
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const apply = () => router.push('/ambassador' as any);

  if (status?.isAmbassador) {
    const channelId = status.request?.channelId;
    return (
      <View style={{ backgroundColor: Colors.successTint, borderRadius: Radius.card, padding: 16, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <BadgeCheck size={20} color={Colors.successDot} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.success }} className="font-sans">You are a Kredibble ambassador</Text>
        </View>
        {channelId && (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/community/chat', params: { id: channelId, name: 'Ambassadors' } } as any)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}
            accessibilityRole="button"
          >
            <MessageCircle size={18} color={Colors.primary} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.primary }} className="font-sans">Open the ambassador group chat</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (status?.request?.status === 'pending') {
    return (
      <View style={{ marginBottom: 16 }}>
        <Button label="Request pending" variant="outline" fullWidth disabled />
        <Text style={{ fontSize: 12, color: Colors.textBody, fontWeight: '300', textAlign: 'center', marginTop: 8 }} className="font-sans">
          Our team is reviewing your request. We will notify you once it is decided.
        </Text>
      </View>
    );
  }

  const declined = status?.request?.status === 'rejected';
  return (
    <View style={{ marginBottom: 16 }}>
      <Button label={declined ? 'Apply to become an ambassador again' : 'Become an ambassador'} variant="accent" fullWidth onPress={apply} />
    </View>
  );
}
