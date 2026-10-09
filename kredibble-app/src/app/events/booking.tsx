import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Ticket, ShieldCheck, ExternalLink, Info } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, FontSize, FontWeight, Radius } from '../../constants/design';
import { bookEvent, getEventById, EventItem } from '../../lib/api';

export default function TicketBookingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [quantity, setQuantity] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    let isMounted = true;
    if (!id) return;
    getEventById(id)
      .then((data) => {
        if (!isMounted) return;
        setEvent(data);
      })
      .catch((err) => {
        console.warn('Failed to load event for booking:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [id]);

  const priceNum = Number(event?.priceNum) || 0;
  const isPaid = priceNum > 0;
  const totalPrice = priceNum * quantity;

  const increment = () => setQuantity(prev => Math.min(prev + 1, 10));
  const decrement = () => setQuantity(prev => (prev > 1 ? prev - 1 : 1));

  const handleFreeBooking = async () => {
    if (!event || submitting) return;

    if (!fullName.trim()) {
      Alert.alert('Validation Error', 'Full name is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Validation Error', 'A valid email address is required.');
      return;
    }

    setSubmitting(true);
    try {
      await bookEvent(event.id, {
        fullName: fullName.trim(),
        email: email.trim(),
        quantity,
        status: 'confirmed',
      });

      router.replace({
        pathname: '/events/confirmation',
        params: { id: event.id, quantity: String(quantity), total: 'Free' },
      });
    } catch (err: any) {
      Alert.alert('Booking Error', err.message || 'Failed to book free ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPaidCheckout = async () => {
    if (!event) return;
    const checkoutUrl =
      event.ticketUrl ||
      event.virtualUrl ||
      `https://kredibble.com/events/${encodeURIComponent(event.id)}/tickets?qty=${quantity}`;

    try {
      await WebBrowser.openBrowserAsync(checkoutUrl);
    } catch (err) {
      console.error('Failed to open external ticket portal:', err);
      Alert.alert('Checkout Notice', 'Unable to open ticketing portal. Please visit the event organizer website directly.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen, justifyContent: 'center', alignItems: 'center' }} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ marginTop: 12, color: Colors.textMuted, fontSize: 14 }} className="font-sans">Loading event details...</Text>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }} edges={['top', 'left', 'right']}>
        <Text style={{ fontSize: 16, color: Colors.textHeading, fontWeight: '600', marginBottom: 8 }} className="font-sans">Event not found</Text>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/events')}
          style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.primary, borderRadius: 8 }}
        >
          <Text style={{ color: Colors.white, fontWeight: '600' }} className="font-sans">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace(`/events/${event.id}`)}
          style={styles.backButton}
        >
          <ChevronLeft size={20} color={Colors.textHeading} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} className="font-sans" numberOfLines={1}>
          {event.title}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Event Info Brief Block */}
        <View style={styles.briefCard}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.briefLocation} className="font-sans" numberOfLines={1}>
              {event.location}
            </Text>
            <Text style={styles.briefDate} className="font-sans" numberOfLines={1}>
              {event.date}
            </Text>
          </View>
          <View style={[styles.priceBadge, isPaid ? styles.paidBadge : styles.freeBadge]}>
            <Text style={[styles.priceText, isPaid ? styles.paidBadgeText : styles.freeBadgeText]} className="font-sans">
              {isPaid ? (event.price || `GHS ${priceNum.toFixed(2)}`) : 'Free'}
            </Text>
          </View>
        </View>

        {/* Ticket Quantity selector */}
        <View style={styles.quantityCard}>
          <View style={styles.quantityLeft}>
            <Ticket size={22} color={Colors.primary} style={{ marginRight: 12 }} />
            <View>
              <Text style={styles.quantityLabel} className="font-sans">
                Number of tickets
              </Text>
              <Text style={styles.salesEndText} className="font-sans">
                {isPaid ? 'Select quantity for checkout' : 'Max 10 tickets per registration'}
              </Text>
            </View>
          </View>
          <View style={styles.counterRow}>
            <TouchableOpacity onPress={decrement} style={styles.counterBtn}>
              <Text style={styles.counterSymbol}>-</Text>
            </TouchableOpacity>
            <Text style={styles.counterNum} className="font-sans">
              {quantity}
            </Text>
            <TouchableOpacity onPress={increment} style={styles.counterBtn}>
              <Text style={styles.counterSymbol}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Free Event Registration Form */}
        {!isPaid ? (
          <View style={styles.formContainer}>
            <Text style={styles.sectionTitle} className="font-sans">
              Guest Information
            </Text>

            <View style={styles.infoBanner}>
              <Info size={18} color={Colors.primary} style={{ marginRight: 10 }} />
              <Text style={styles.infoBannerText} className="font-sans">
                This event is free to attend. Enter your attendee details below to reserve your tickets and receive confirmation.
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel} className="font-sans">Full name*</Text>
              <TextInput
                placeholder="e.g. Enoch Mensah"
                placeholderTextColor={Colors.textPlaceholder}
                value={fullName}
                onChangeText={setFullName}
                style={styles.textInput as any}
                className="font-sans"
              />
            </View>

            <View style={[styles.inputGroup, { marginTop: 16 }]}>
              <Text style={styles.inputLabel} className="font-sans">Email address*</Text>
              <TextInput
                placeholder="e.g. enoch@example.com"
                placeholderTextColor={Colors.textPlaceholder}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                style={styles.textInput as any}
                className="font-sans"
              />
            </View>
          </View>
        ) : (
          /* Paid Event External Gating Card (SEC-123: No plaintext card collection) */
          <View style={styles.formContainer}>
            <View style={styles.paidHeaderRow}>
              <View style={styles.shieldBadge}>
                <ShieldCheck size={20} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.paidHeaderTitle} className="font-sans">
                  Official Ticketing Portal
                </Text>
                <Text style={styles.paidHeaderSubtitle} className="font-sans">
                  Verified Organizer Checkout
                </Text>
              </View>
            </View>

            <Text style={styles.paidDescription} className="font-sans">
              Admission for this paid event is fulfilled securely through the {"organizer's"} verified ticketing portal. Payment details are encrypted and never handled in plaintext.
            </Text>

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel} className="font-sans">Price per ticket</Text>
                <Text style={styles.summaryValue} className="font-sans">
                  {event.price || `GHS ${priceNum.toFixed(2)}`}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel} className="font-sans">Quantity</Text>
                <Text style={styles.summaryValue} className="font-sans">{quantity}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { fontWeight: FontWeight.bold, color: Colors.textHeading }]} className="font-sans">
                  Estimated Total
                </Text>
                <Text style={[styles.summaryValue, { fontWeight: FontWeight.bold, color: Colors.primary }]} className="font-sans">
                  GHS {totalPrice.toFixed(2)}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleOpenPaidCheckout}
              activeOpacity={0.8}
              style={styles.externalCheckoutCardButton}
            >
              <Text style={styles.externalCheckoutCardButtonText} className="font-sans">
                Proceed to Secure Ticket Checkout
              </Text>
              <ExternalLink size={18} color={Colors.white} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Footer bar */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Text style={styles.totalLabel} className="font-sans">Total</Text>
          <Text style={styles.totalPrice} className="font-sans">
            {isPaid ? `GHS ${totalPrice.toFixed(2)}` : 'Free'}
          </Text>
        </View>

        {!isPaid ? (
          <TouchableOpacity
            onPress={handleFreeBooking}
            disabled={submitting}
            style={[styles.checkoutBtn, submitting && { opacity: 0.7 }]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.checkoutBtnText} className="font-sans">
                Confirm Registration
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleOpenPaidCheckout}
            style={[styles.checkoutBtn, styles.externalBtn]}
          >
            <Text style={styles.checkoutBtnText} className="font-sans">
              Open Checkout
            </Text>
            <ExternalLink size={16} color={Colors.white} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#E5E6F2',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: FontWeight.medium,
    color: Colors.textHeading,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  briefCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  briefLocation: {
    fontSize: 13,
    color: Colors.textHeading,
    fontWeight: FontWeight.medium,
  },
  briefDate: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  priceBadge: {
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  freeBadge: {
    backgroundColor: 'rgba(22, 163, 74, 0.1)',
  },
  freeBadgeText: {
    color: '#16A34A',
    fontWeight: FontWeight.bold,
  },
  paidBadge: {
    backgroundColor: Colors.primaryChip,
  },
  paidBadgeText: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  priceText: {
    fontSize: FontSize.xs,
  },
  quantityCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  quantityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityLabel: {
    fontSize: 13,
    fontWeight: FontWeight.semibold,
    color: Colors.textHeading,
  },
  salesEndText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  counterSymbol: {
    fontSize: 18,
    color: Colors.textBody,
    lineHeight: 20,
    textAlign: 'center',
  },
  counterNum: {
    fontSize: 15,
    fontWeight: FontWeight.bold,
    color: Colors.textHeading,
    marginHorizontal: 14,
  },
  formContainer: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: FontWeight.semibold,
    color: Colors.textHeading,
    marginBottom: 14,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: Colors.primary,
    lineHeight: 18,
  },
  inputGroup: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 6,
    fontWeight: '500',
  },
  textInput: {
    height: 46,
    borderWidth: 1,
    borderColor: Colors.borderInput,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    fontSize: 14,
    color: Colors.textBody,
    backgroundColor: '#FAFAFA',
  },
  paidHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  shieldBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paidHeaderTitle: {
    fontSize: 15,
    fontWeight: FontWeight.bold,
    color: Colors.textHeading,
  },
  paidHeaderSubtitle: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
    marginTop: 2,
  },
  paidDescription: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 20,
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  summaryValue: {
    fontSize: 13,
    color: Colors.textHeading,
    fontWeight: '500',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  externalCheckoutCardButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  externalCheckoutCardButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: FontWeight.semibold,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
  },
  footerLeft: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: FontWeight.bold,
    color: Colors.textHeading,
    marginTop: 2,
  },
  checkoutBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    height: 46,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 160,
  },
  externalBtn: {
    flexDirection: 'row',
    backgroundColor: '#374151',
  },
  checkoutBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: FontWeight.bold,
  },
});
