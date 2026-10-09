import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Clipboard, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Bookmark, Clock, MapPin, Copy, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSaved } from '../../lib/useSaved';
import { Colors, FontSize, FontWeight, Radius } from '../../constants/design';
import { getEventById, EventItem } from '../../lib/api';

export default function EventDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bookmarked, toggleBookmark] = useSaved(id, 'events');
  const [expanded, setExpanded] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let isMounted = true;
    if (!id) return;
    getEventById(id)
      .then((data) => {
        if (!isMounted) return;
        setEvent(data);
        setError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Failed to load event details');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [id]);

  const copyAddressToClipboard = () => {
    if (event?.venueAddress || event?.location) {
      Clipboard.setString(event.venueAddress || event.location);
      Alert.alert('Success', 'Address copied to clipboard!');
    }
  };

  const handleContactOrganizer = () => {
    Alert.alert('Contact Organizer', `Connecting to ${event?.organizer || 'organizer'}...`);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen, justifyContent: 'center', alignItems: 'center' }} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ marginTop: 12, color: Colors.textMuted, fontSize: 14 }} className="font-sans">Loading event details...</Text>
      </SafeAreaView>
    );
  }

  if (error || !event) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }} edges={['top', 'left', 'right']}>
        <Text style={{ fontSize: 16, color: Colors.textHeading, fontWeight: '600', marginBottom: 8 }} className="font-sans">
          {error || 'Event not found'}
        </Text>
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
      {/* Floating Header */}
      <View style={[styles.header, { top: insets.top > 0 ? insets.top + 8 : 16 }]}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/events')}
          style={styles.circleHeaderButton}
        >
          <ChevronLeft size={20} color={Colors.textHeading} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={toggleBookmark}
          style={[styles.circleHeaderButton, bookmarked && styles.bookmarkActive]}
        >
          <Bookmark size={20} color={bookmarked ? Colors.white : Colors.textMuted} fill={bookmarked ? Colors.white : 'transparent'} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Main Banner Image Placeholder */}
        <View style={[styles.banner, { backgroundColor: event.logoColor }]}>
          <View style={styles.bannerOverlay} />
          <Text style={styles.bannerTheme} className="font-sans">
            {event.theme}
          </Text>
        </View>

        {/* Title & Metadata Card */}
        <View style={styles.metaCard}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.eventTitle} className="font-sans">
              {event.title}
            </Text>
            <Text style={styles.eventMetaText} className="font-sans">
              {event.location}
            </Text>
            <Text style={styles.eventMetaText} className="font-sans">
              {event.date}
            </Text>
          </View>
          <View style={styles.priceBadge}>
            <Text style={styles.priceText} className="font-sans">
              {event.price}
            </Text>
          </View>
        </View>

        {/* Overview Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} className="font-sans">
            Overview
          </Text>
          <Text
            style={styles.descriptionText}
            numberOfLines={expanded ? undefined : 3}
            className="font-sans"
          >
            {event.description}
          </Text>
          <TouchableOpacity
            style={styles.readMoreButton}
            onPress={() => setExpanded(!expanded)}
          >
            <Text style={styles.readMoreText} className="font-sans">
              {expanded ? 'Read less' : 'Read more'}
            </Text>
            {expanded ? <ChevronUp size={14} color={Colors.primary} /> : <ChevronDown size={14} color={Colors.primary} />}
          </TouchableOpacity>
        </View>

        {/* Good to know Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} className="font-sans">
            Good to know
          </Text>
          <View style={styles.infoRow}>
            <Clock size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
            <Text style={styles.infoText} className="font-sans">
              {event.duration}
            </Text>
          </View>
          <View style={[styles.infoRow, { marginTop: 10 }]}>
            <MapPin size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
            <Text style={styles.infoText} className="font-sans">
              {event.type}
            </Text>
          </View>
        </View>

        {/* Location Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} className="font-sans">
            Location
          </Text>
          <View style={styles.locationContainer}>
            <View style={{ flex: 1 }}>
              <Text style={styles.venueName} className="font-sans">
                {event.venueName}
              </Text>
              <Text style={styles.venueAddress} className="font-sans">
                {event.venueAddress}
              </Text>
            </View>
            <TouchableOpacity onPress={copyAddressToClipboard} style={styles.copyButton}>
              <Copy size={16} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Organized by Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} className="font-sans">
            Organized by
          </Text>
          <View style={styles.organizerRow}>
            <Text style={styles.organizerName} className="font-sans">
              {event.organizer}
            </Text>
            <TouchableOpacity onPress={handleContactOrganizer} style={styles.contactButton}>
              <Text style={styles.contactButtonText} className="font-sans">
                Contact
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Pinned Get Tickets Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={() => router.push({
            pathname: '/events/booking',
            params: { id: event.id }
          })}
          style={styles.getTicketsButton}
        >
          <Text style={styles.getTicketsButtonText} className="font-sans">
            Get tickets
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 16,
    left: 20,
    right: 20,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  circleHeaderButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookmarkActive: {
    backgroundColor: Colors.primary,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  banner: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 64,
    position: 'relative',
  },
  bannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  bannerTheme: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: FontWeight.semibold,
    lineHeight: 22,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  metaCard: {
    backgroundColor: Colors.white,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: FontWeight.medium,
    color: Colors.textHeading,
    marginBottom: 6,
    lineHeight: 20,
  },
  eventMetaText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  priceBadge: {
    backgroundColor: Colors.primaryChip,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  priceText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  section: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
  sectionTitle: {
    fontSize: FontSize.sm, // 13px
    fontWeight: FontWeight.semibold,
    color: Colors.textHeading,
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  readMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  readMoreText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
    marginRight: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 13,
    color: Colors.textBody,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  venueName: {
    fontSize: 13,
    fontWeight: FontWeight.medium,
    color: Colors.textBody,
  },
  venueAddress: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  copyButton: {
    padding: 8,
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  organizerName: {
    fontSize: FontSize.base,
    color: Colors.textBody,
  },
  contactButton: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  contactButtonText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: FontWeight.medium,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
  },
  getTicketsButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  getTicketsButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: FontWeight.bold,
  },
});
