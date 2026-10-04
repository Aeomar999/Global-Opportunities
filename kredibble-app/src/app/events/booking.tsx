import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Ticket, CreditCard, ShieldCheck } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, FontSize, FontWeight, Radius } from '../../constants/design';
import { bookEvent, getEventById, EventItem } from '../../lib/api';

export default function TicketBookingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);

  const [quantity, setQuantity] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  
  // Payment states (only for paid events)
  const [payMethod, setPayMethod] = useState<'card' | 'paypal' | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [expDate, setExpDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [savePayment, setSavePayment] = useState(false);

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

  const increment = () => setQuantity(prev => prev + 1);
  const decrement = () => setQuantity(prev => (prev > 1 ? prev - 1 : 1));

  const handleCheckout = async () => {
    if (!event) return;
    // Form Validation
    if (!fullName.trim()) {
      Alert.alert('Validation Error', 'Full name is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Validation Error', 'A valid email address is required.');
      return;
    }

    if (isPaid) {
      if (!payMethod) {
        Alert.alert('Validation Error', 'Please select a payment method.');
        return;
      }
      if (payMethod === 'card') {
        if (!cardNumber.trim() || !expDate.trim() || !cvv.trim() || !zipCode.trim()) {
          Alert.alert('Validation Error', 'Please fill in all credit card details.');
          return;
        }
      }
    }

    try {
      await bookEvent(event.id, {
        fullName,
        email,
        quantity,
        status: 'confirmed',
      });
      // Success! Route to order confirmation page.
      router.replace({
        pathname: '/events/confirmation',
        params: { id: event.id, quantity: String(quantity), total: isPaid ? `GHS ${totalPrice.toFixed(2)}` : 'Free' }
      });
    } catch (err: any) {
      Alert.alert('Booking Error', err.message || 'Failed to book event.');
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
        <View style={{ width: 32 }} />
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
          <View style={styles.priceBadge}>
            <Text style={styles.priceText} className="font-sans">
              {event.price}
            </Text>
          </View>
        </View>

        {/* Ticket Quantity selector */}
        <View style={styles.quantityCard}>
          <View style={styles.quantityLeft}>
            <Ticket size={22} color={Colors.primary} style={{ marginRight: 12 }} />
            <View>
              <Text style={styles.quantityLabel} className="font-sans">
                No. of tickets
              </Text>
              <Text style={styles.salesEndText} className="font-sans">
                Sales end in 7 hours
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

        {/* Guest Information Form */}
        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle} className="font-sans">
            Guest Information
          </Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel} className="font-sans">Full name*</Text>
            <TextInput
              placeholder="Enoch Mensah"
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
              placeholder="EnochMensah@gmail.com"
              placeholderTextColor={Colors.textPlaceholder}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              style={styles.textInput as any}
              className="font-sans"
            />
          </View>
        </View>

        {/* Payment Methods (Paid only) */}
        {isPaid && (
          <View style={styles.formContainer}>
            <Text style={styles.sectionTitle} className="font-sans">
              Pay with
            </Text>

            {/* Credit or Debit Card selector */}
            <TouchableOpacity
              onPress={() => setPayMethod('card')}
              style={[styles.payMethodHeader, payMethod === 'card' && styles.payMethodActive]}
            >
              <CreditCard size={18} color={payMethod === 'card' ? Colors.primary : Colors.textMuted} style={{ marginRight: 12 }} />
              <Text style={[styles.payMethodLabel, payMethod === 'card' && styles.payMethodLabelActive]} className="font-sans">
                Credit or debit card
              </Text>
              <View style={styles.radioOutter}>
                {payMethod === 'card' && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>

            {/* Expanded Card Form */}
            {payMethod === 'card' && (
              <View style={styles.cardExpandedContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel} className="font-sans">Card number*</Text>
                  <TextInput
                    placeholder="4242 4242 4242 4242"
                    placeholderTextColor={Colors.textPlaceholder}
                    keyboardType="numeric"
                    value={cardNumber}
                    onChangeText={setCardNumber}
                    style={styles.textInput as any}
                    className="font-sans"
                  />
                </View>

                <View style={styles.inlineRow}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
                    <Text style={styles.inputLabel} className="font-sans">Exp date*</Text>
                    <TextInput
                      placeholder="MM / YY"
                      placeholderTextColor={Colors.textPlaceholder}
                      value={expDate}
                      onChangeText={setExpDate}
                      style={styles.textInput as any}
                      className="font-sans"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel} className="font-sans">Cvv*</Text>
                    <TextInput
                      placeholder="123"
                      placeholderTextColor={Colors.textPlaceholder}
                      keyboardType="numeric"
                      secureTextEntry
                      value={cvv}
                      onChangeText={setCvv}
                      style={styles.textInput as any}
                      className="font-sans"
                    />
                  </View>
                </View>

                <View style={[styles.inputGroup, { marginTop: 12 }]}>
                  <Text style={styles.inputLabel} className="font-sans">Zip code*</Text>
                  <TextInput
                    placeholder="00233"
                    placeholderTextColor={Colors.textPlaceholder}
                    value={zipCode}
                    onChangeText={setZipCode}
                    style={styles.textInput as any}
                    className="font-sans"
                  />
                </View>

                {/* Save card checkbox */}
                <TouchableOpacity
                  onPress={() => setSavePayment(!savePayment)}
                  style={styles.checkboxRow}
                >
                  <View style={[styles.checkbox, savePayment && styles.checkboxChecked]}>
                    {savePayment && <View style={styles.checkboxInner} />}
                  </View>
                  <Text style={styles.checkboxText} className="font-sans">
                    Save payment details to your account (optional)
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Paypal Selector */}
            <TouchableOpacity
              onPress={() => setPayMethod('paypal')}
              style={[styles.payMethodHeader, { marginTop: 12 }, payMethod === 'paypal' && styles.payMethodActive]}
            >
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: payMethod === 'paypal' ? Colors.primary : Colors.textMuted, marginRight: 12, fontStyle: 'italic' }}>
                P
              </Text>
              <Text style={[styles.payMethodLabel, payMethod === 'paypal' && styles.payMethodLabelActive]} className="font-sans">
                Paypal
              </Text>
              <View style={styles.radioOutter}>
                {payMethod === 'paypal' && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Footer bar */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Text style={styles.totalLabel} className="font-sans">Total</Text>
          <Text style={styles.totalPrice} className="font-sans">
            {isPaid ? `GHC ${totalPrice.toFixed(2)}` : 'GHC 0.00'}
          </Text>
        </View>
        <TouchableOpacity onPress={handleCheckout} style={styles.checkoutBtn}>
          <Text style={styles.checkoutBtnText} className="font-sans">
            Get tickets
          </Text>
        </TouchableOpacity>
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
    backgroundColor: Colors.primaryChip,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  priceText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
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
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  counterBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  counterSymbol: {
    fontSize: 16,
    color: Colors.textBody,
    lineHeight: 18,
    textAlign: 'center',
  },
  counterNum: {
    fontSize: 15,
    fontWeight: FontWeight.bold,
    color: Colors.textHeading,
    marginHorizontal: 12,
  },
  formContainer: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: FontWeight.semibold,
    color: Colors.textHeading,
    marginBottom: 14,
  },
  inputGroup: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderColor: Colors.borderInput,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    fontSize: 13,
    color: Colors.textBody,
    backgroundColor: '#FAFAFA',
  },
  payMethodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    borderRadius: Radius.md,
  },
  payMethodActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryTransparent,
  },
  payMethodLabel: {
    flex: 1,
    fontSize: 13,
    color: Colors.textBody,
  },
  payMethodLabelActive: {
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  radioOutter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: Colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  cardExpandedContainer: {
    marginTop: 12,
    paddingHorizontal: 8,
  },
  inlineRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryTransparent,
  },
  checkboxInner: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  checkboxText: {
    flex: 1,
    fontSize: 11,
    color: Colors.textMuted,
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
    fontSize: 10,
    color: Colors.textMuted,
  },
  totalPrice: {
    fontSize: 17,
    fontWeight: FontWeight.bold,
    color: Colors.textHeading,
    marginTop: 2,
  },
  checkoutBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    height: 46,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkoutBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: FontWeight.bold,
  },
});
