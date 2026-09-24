import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, SlidersHorizontal, Search, Bookmark } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, FontSize, FontWeight, Radius, Shadow } from '../../constants/design';
import { profileStore } from '../../constants/mockProfile';
import { useToast } from '../../components/ui/ToastProvider';

// ─── Shared events data ────────────────────────────────────────────────────────

export const EVENTS_DATA = [
  {
    id: '64a1b2c3d4e5f60011223347',
    title: 'Climate Champion Competition Ghana',
    location: 'British Council Accra, Greater Accra Region',
    venueName: 'British Council',
    venueAddress: 'Liberia road, accra, greater accra region',
    date: 'Friday, May 22 • 10 AM - 2 PM',
    price: 'Free',
    priceNum: 0,
    theme: "Empowering Africa's Climate Innovators for a Better Future",
    duration: '4 hrs',
    type: 'In-person event',
    organizer: 'Startup Discovery',
    category: 'Tech',
    dateLabel: 'Today',
    region: 'Greater Accra Region',
    ticketType: 'Free',
    eventType: 'In-person',
    logoColor: '#4CAF50',
    description: 'This competition aims to surface the most promising climate tech and green business solutions in Ghana. Finalists will pitch to a panel of international impact investors and climate action advocates, securing grants, mentorship, and commercialization pathways to scale their innovations.'
  },
  {
    id: '64a1b2c3d4e5f60011223348',
    title: 'Tech Leadership Summit Accra',
    location: 'Accra International Conference Center',
    venueName: 'AICC',
    venueAddress: 'Castle Road, Accra, Greater Accra Region',
    date: 'Saturday, May 23 • 9 AM - 5 PM',
    price: 'GHS 100',
    priceNum: 100,
    theme: 'Shaping the Future of Fintech & AI in Ghana',
    duration: '8 hrs',
    type: 'In-person event',
    organizer: 'Tech & Co.',
    category: 'Tech',
    dateLabel: 'Tomorrow',
    region: 'Greater Accra Region',
    ticketType: 'Paid',
    eventType: 'In-person',
    logoColor: '#6671E4',
    description: 'Join industry pioneers, policy makers, and leading software developers for a day of panels, workshops, and high-impact networking covering artificial intelligence, mobile finance frameworks, blockchain scaling, and cloud architecture across Sub-Saharan Africa.'
  },
  {
    id: '64a1b2c3d4e5f60011223349',
    title: 'Fretwork & Jazz Night',
    location: 'Alliance Française, Greater Accra Region',
    venueName: 'Alliance Française d\'Accra',
    venueAddress: 'Casely Hayford Rd, Accra, Greater Accra Region',
    date: 'Friday, May 22 • 7 PM - 10 PM',
    price: 'GHS 150',
    priceNum: 150,
    theme: 'A Live Evening of Classic Afro-Jazz and Acoustic Fusions',
    duration: '3 hrs',
    type: 'In-person event',
    organizer: 'Accra Jazz Club',
    category: 'Music',
    dateLabel: 'Today',
    region: 'Greater Accra Region',
    ticketType: 'Paid',
    eventType: 'In-person',
    logoColor: '#9C27B0',
    description: 'Experience an unforgettable evening of live jazz music featuring Accra\'s finest contemporary afro-jazz instrumentalists. This in-person concert celebrates local guitar techniques merged with classic brass arrangements, creating a soul-stirring auditory journey.'
  },
  {
    id: '64a1b2c3d4e5f60011223350',
    title: 'Startup Growth Accelerator Workshop',
    location: 'Online Webinar',
    venueName: 'Zoom Webinar',
    venueAddress: 'Online / Zoom Invite Sent to Registered Attendees',
    date: 'Saturday, May 23 • 2 PM - 4 PM',
    price: 'Free',
    priceNum: 0,
    theme: 'Scaling Customer Acquisition and Unit Economics',
    duration: '2 hrs',
    type: 'Online event',
    organizer: 'Kumasi Hive',
    category: 'Business',
    dateLabel: 'Tomorrow',
    region: 'Ashanti Region',
    ticketType: 'Free',
    eventType: 'Online',
    logoColor: '#FF9800',
    description: 'Learn how to optimize your growth funnel, run highly targeted and low-cost ad experiments, and master startup metrics such as CAC, LTV, and cohort retention. Recommended for early-stage founders and growth marketing professionals.'
  }
];

export type EventItem = (typeof EVENTS_DATA)[number];

// ─── Event Card Component ──────────────────────────────────────────────────────

export const EventCard = ({ event, onPress }: { event: EventItem; onPress: () => void }) => {
  const { showToast } = useToast();
  const [bookmarked, setBookmarked] = useState(profileStore.isSaved(event.id, 'events'));

  useEffect(() => {
    const unsubscribe = profileStore.subscribe(() => {
      setBookmarked(profileStore.isSaved(event.id, 'events'));
    });
    return unsubscribe;
  }, [event.id]);

  const handleToggleSave = () => {
    profileStore.toggleSaved(event.id, 'events');
    if (!bookmarked) {
      showToast('Event saved to your profile', 'success');
    } else {
      showToast('Removed from saved events', 'info');
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.cardContainer}
    >
      {/* Banner design - beautiful styled abstract gradient block */}
      <View style={[styles.banner, { backgroundColor: event.logoColor }]}>
        <View style={styles.bannerOverlay} />
        <Text style={styles.bannerTheme} className="font-sans" numberOfLines={2}>
          {event.theme}
        </Text>
      </View>

      {/* Details block */}
      <View style={styles.cardDetails}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.cardTitle} className="font-sans" numberOfLines={2}>
              {event.title}
            </Text>
            <Text style={styles.cardMetaText} className="font-sans" numberOfLines={1}>
              {event.location}
            </Text>
            <Text style={styles.cardMetaText} className="font-sans" numberOfLines={1}>
              {event.date}
            </Text>
          </View>

          {/* Bookmark Button */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={(e) => {
              e.stopPropagation();
              handleToggleSave();
            }}
            style={[styles.bookmarkButton, bookmarked && styles.bookmarkActive]}
          >
            <Bookmark size={16} color={bookmarked ? '#FFFFFF' : '#8A8D9F'} fill={bookmarked ? '#FFFFFF' : 'transparent'} />
          </TouchableOpacity>
        </View>

        {/* Footer row containing cost badge */}
        <View style={styles.cardFooter}>
          <View style={styles.priceBadge}>
            <Text style={styles.priceText} className="font-sans">
              {event.price}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EventsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    date?: string;
    region?: string;
    category?: string;
    ticketType?: string;
    eventType?: string;
  }>();

  // Determine active filters count by splitting comma-separated strings
  const filterCount =
    (params.date ? params.date.split(',').length : 0) +
    (params.region ? params.region.split(',').length : 0) +
    (params.category ? params.category.split(',').length : 0) +
    (params.ticketType ? params.ticketType.split(',').length : 0) +
    (params.eventType ? params.eventType.split(',').length : 0);

  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoading(true);
      try {
        const { getEvents } = require('../../lib/api');
        const data = await getEvents({
          q: params.searchQuery,
          date: params.date,
          region: params.region,
          category: params.category,
          ticketType: params.ticketType,
          eventType: params.eventType
        });
        setLiveEvents(data);
      } catch (err) {
        console.error("Failed to fetch events:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchEvents();
  }, [params]);

  // Merge live events with mock events so the screen isn't empty if the backend has no events
  const filteredEvents = liveEvents.length > 0 ? liveEvents.map(j => ({
    id: j.id,
    title: j.title,
    location: j.eventRegion || j.location || 'Remote',
    dateLabel: j.eventDateTime || 'Upcoming',
    region: j.eventRegion || 'Ghana',
    category: j.eventCategory || 'Technology',
    ticketType: j.eventTicketType || 'Free',
    eventType: j.eventStyle || 'In-Person',
    price: j.eventTicketType === 'Paid' ? 'Paid' : 'Free',
    image: j.eventBannerUri || 'https://via.placeholder.com/300x120',
  })) : EVENTS_DATA.filter(event => {
    if (params.date) {
      const dates = params.date.split(',');
      if (!dates.includes(event.dateLabel)) return false;
    }
    if (params.region) {
      const regions = params.region.split(',');
      if (!regions.includes(event.region)) return false;
    }
    if (params.category) {
      const categories = params.category.split(',');
      if (!categories.includes(event.category)) return false;
    }
    if (params.ticketType) {
      const ticketTypes = params.ticketType.split(',');
      if (!ticketTypes.includes(event.ticketType)) return false;
    }
    if (params.eventType) {
      const eventTypes = params.eventType.split(',');
      if (!eventTypes.includes(event.eventType)) return false;
    }
    return true;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/opportunities')}
          style={styles.backButton}
        >
          <ChevronLeft size={20} color={Colors.textHeading} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} className="font-sans">
          Events
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Search bar */}
        <View style={styles.searchBar}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/events/search' as any)}
            style={styles.searchPrompt}
          >
            <Search size={18} color={Colors.textPlaceholder} style={{ marginRight: 10 }} />
            <Text style={[styles.searchPlaceholder, { color: params.searchQuery ? Colors.textHeading : Colors.textPlaceholder }]} className="font-sans">
              {params.searchQuery || 'Browse for events or location'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push({
              pathname: '/events/filter',
              params: params
            })}
            style={styles.filterIconButton}
          >
            <View>
              <SlidersHorizontal size={18} color={Colors.primary} />
              {filterCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText} className="font-sans">
                    {filterCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Listings */}
        {filteredEvents.length > 0 ? (
          filteredEvents.map(event => (
            <EventCard
              key={event.id}
              event={event}
              onPress={() => router.push({
                pathname: '/events/[id]',
                params: { id: event.id }
              })}
            />
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText} className="font-sans">
              No events found matching your criteria.
            </Text>
          </View>
        )}
      </ScrollView>
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
    fontSize: FontSize.screenTitle,
    fontWeight: FontWeight.semibold,
    color: Colors.textHeading,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.searchBar,
    paddingHorizontal: 16,
    height: 50,
    marginBottom: 20,
    ...Shadow.searchBar,
  },
  searchPrompt: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  searchPlaceholder: {
    fontSize: FontSize.sm,
    color: Colors.textPlaceholder,
  },
  filterIconButton: {
    paddingLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    width: 15,
    height: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: Colors.white,
    fontSize: 8,
    fontWeight: 'bold',
  },
  cardContainer: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  banner: {
    height: 120,
    justifyContent: 'center',
    paddingHorizontal: 16,
    position: 'relative',
  },
  bannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  bannerTheme: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: FontWeight.medium,
    lineHeight: 20,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cardDetails: {
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: FontSize.sm, // 13px
    fontWeight: FontWeight.medium,
    color: Colors.textBody,
    marginBottom: 6,
    lineHeight: 18,
  },
  cardMetaText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  bookmarkButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  bookmarkActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  cardFooter: {
    marginTop: 12,
    flexDirection: 'row',
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.base,
    textAlign: 'center',
  },
});
