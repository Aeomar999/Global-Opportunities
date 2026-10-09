import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, SlidersHorizontal, Search, Bookmark } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, FontSize, FontWeight, Radius, Shadow } from '../../constants/design';
import { profileStore } from '../../constants/mockProfile';
import { useToast } from '../../components/ui/ToastProvider';
import { getEvents } from '../../lib/api';

// ─── Shared events data ────────────────────────────────────────────────────────

export type EventItem = {
  id: string;
  title: string;
  location: string;
  venueName?: string;
  venueAddress?: string;
  date: string;
  price: string;
  priceNum: number;
  theme: string;
  duration?: string;
  type?: string;
  organizer?: string;
  category?: string;
  dateLabel?: string;
  region?: string;
  ticketType?: string;
  eventType?: string;
  logoColor?: string;
  description: string;
};

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
    searchQuery?: string;
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

  const filteredEvents: EventItem[] = liveEvents.map((j): EventItem => ({
    id: j.id,
    title: j.title,
    location: j.eventRegion || j.location || 'Remote',
    venueName: j.venueName || j.location || '',
    venueAddress: j.venueAddress || j.location || '',
    date: j.eventDateTime || 'Upcoming',
    price: j.eventTicketType === 'Paid' ? 'Paid' : 'Free',
    priceNum: Number(j.priceNum) || 0,
    theme: j.theme || j.title,
    duration: j.duration || '',
    type: j.eventStyle || 'In-person event',
    organizer: j.organizer || j.company || '',
    category: j.eventCategory || 'Technology',
    dateLabel: j.eventDateTime || 'Upcoming',
    region: j.eventRegion || 'Ghana',
    ticketType: j.eventTicketType || 'Free',
    eventType: j.eventStyle || 'In-Person',
    logoColor: Colors.primary,
    description: j.description || '',
  })).filter(event => {
    if (params.date) {
      const dates = params.date.split(',');
      if (!dates.includes(event.dateLabel || '')) return false;
    }
    if (params.region) {
      const regions = params.region.split(',');
      if (!regions.includes(event.region || '')) return false;
    }
    if (params.category) {
      const categories = params.category.split(',');
      if (!categories.includes(event.category || '')) return false;
    }
    if (params.ticketType) {
      const ticketTypes = params.ticketType.split(',');
      if (!ticketTypes.includes(event.ticketType || '')) return false;
    }
    if (params.eventType) {
      const eventTypes = params.eventType.split(',');
      if (!eventTypes.includes(event.eventType || '')) return false;
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
        {isLoading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Text style={{ color: '#8A8D9F', fontSize: 14 }} className="font-sans">Loading events...</Text>
          </View>
        ) : filteredEvents.length > 0 ? (
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
