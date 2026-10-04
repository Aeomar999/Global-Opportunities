import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Bookmark } from 'lucide-react-native';
import { profileStore } from '../../constants/mockProfile';
import { getSavedItems, getOpportunities, getEvents, getGrants } from '../../lib/api';

// Import components and types
import { JobCard, Job } from '../jobs/index';
import { InternshipCard, Internship } from '../internships/index';
import { EventCard, EventItem } from '../events/index';
import { GrantCard } from '../grants/index';

type CategoryType = 'jobs' | 'internships' | 'events' | 'grants';

export default function SavedOpportunitiesScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CategoryType>('jobs');
  const [savedItems, setSavedItems] = useState(profileStore.saved);
  const [loading, setLoading] = useState(true);

  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [allInternships, setAllInternships] = useState<Internship[]>([]);
  const [allEvents, setAllEvents] = useState<EventItem[]>([]);
  const [allGrants, setAllGrants] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchSavedAndCatalog = async () => {
      setLoading(true);
      try {
        const [apiSaved, oppsData, eventsData, grantsData] = await Promise.all([
          getSavedItems().catch(() => []),
          getOpportunities().catch(() => []),
          getEvents().catch(() => []),
          getGrants().catch(() => []),
        ]);

        if (!isMounted) return;

        // Map backend itemType to frontend type
        const mappedSaved = (Array.isArray(apiSaved) ? apiSaved : []).map((item: any) => {
          let mappedType: CategoryType = 'jobs';
          if (item.itemType === 'internships') mappedType = 'internships';
          else if (item.itemType === 'events') mappedType = 'events';
          else if (item.itemType === 'grants') mappedType = 'grants';
          return { id: String(item.itemId || item._id), type: mappedType };
        });

        if (mappedSaved.length > 0) {
          profileStore.saved = mappedSaved;
          setSavedItems(mappedSaved);
          profileStore.notify();
        }

        // Map opportunities to jobs and internships
        const jobsList: Job[] = [];
        const internshipsList: Internship[] = [];

        (Array.isArray(oppsData) ? oppsData : []).forEach((o: any) => {
          const isIntern = String(o.type || '').toLowerCase().includes('intern');
          const mapped = {
            id: String(o.id || o._id),
            title: o.title,
            location: o.location || 'Remote',
            company: o.company || 'Company',
            logoColor: o.logoColor || (isIntern ? '#34D399' : '#6671E4'),
            initial: (o.company || 'C').charAt(0).toUpperCase(),
            description: o.description || '',
            applied: `${o.applicantsCount || 0} applied`,
            match: '92% Match',
          };
          if (isIntern) {
            internshipsList.push(mapped);
          } else {
            jobsList.push(mapped);
          }
        });

        setAllJobs(jobsList);
        setAllInternships(internshipsList);

        // Map events
        const mappedEvents: EventItem[] = (Array.isArray(eventsData) ? eventsData : []).map((e: any) => ({
          id: String(e.id || e._id),
          title: e.title,
          description: e.description || '',
          date: e.eventDateTime || e.date || 'Upcoming',
          location: e.eventRegion || e.location || 'Remote',
          venueName: e.venueName || e.location || '',
          venueAddress: e.venueAddress || e.location || '',
          theme: e.theme || e.title,
          duration: e.duration || '',
          type: e.eventStyle || 'In-person event',
          organizer: e.organizer || e.company || '',
          price: e.eventTicketType === 'Paid' ? 'Paid' : 'Free',
          priceNum: Number(e.priceNum) || 0,
          logoColor: '#6671E4',
        }));
        setAllEvents(mappedEvents);

        // Map grants
        const mappedGrants = (Array.isArray(grantsData) ? grantsData : []).map((g: any) => ({
          id: String(g.id || g._id),
          title: g.title,
          org: g.org || g.funder || 'Foundation',
          logoColor: g.logoColor || '#3D2A6B',
          initial: (g.org || g.funder || 'G').charAt(0).toUpperCase(),
          description: g.description || '',
          applied: `${g.applicantsCount || 0} applied`,
          status: g.status,
          deadline: g.deadline,
        }));
        setAllGrants(mappedGrants);

      } catch (err) {
        console.warn('Failed to fetch saved items or catalogue:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSavedAndCatalog();

    const unsubscribe = profileStore.subscribe(() => {
      setSavedItems([...profileStore.saved]);
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Filter items matching active tab and saved item IDs
  const getFilteredData = () => {
    const savedIds = new Set(savedItems.filter(item => item.type === activeTab).map(item => String(item.id)));
    if (activeTab === 'jobs') {
      return allJobs.filter(job => savedIds.has(String(job.id)));
    } else if (activeTab === 'internships') {
      return allInternships.filter(intern => savedIds.has(String(intern.id)));
    } else if (activeTab === 'events') {
      return allEvents.filter(ev => savedIds.has(String(ev.id)));
    } else {
      return allGrants.filter(gr => savedIds.has(String(gr.id)));
    }
  };

  const currentList = getFilteredData();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <ChevronLeft size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} className="font-sans">Saved opportunities</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {(['jobs', 'internships', 'events', 'grants'] as CategoryType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabButtonText, activeTab === tab && styles.activeTabButtonText]} className="font-sans">
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#6671E4" />
            <Text style={{ marginTop: 12, color: '#8A8D9F', fontSize: 13 }} className="font-sans">Loading saved opportunities...</Text>
          </View>
        ) : currentList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Bookmark size={48} color="#8A8D9F" style={{ opacity: 0.3, marginBottom: 12 }} />
            <Text style={styles.emptyText} className="font-sans">No saved {activeTab} yet</Text>
          </View>
        ) : (
          currentList.map((item: any) => {
            if (activeTab === 'jobs') {
              return (
                <JobCard 
                  key={item.id} 
                  job={item} 
                  onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: item.id } })} 
                />
              );
            } else if (activeTab === 'internships') {
              return (
                <InternshipCard 
                  key={item.id} 
                  item={item} 
                  onPress={() => router.push({ pathname: '/internships/[id]', params: { id: item.id } })} 
                />
              );
            } else if (activeTab === 'events') {
              return (
                <EventCard 
                  key={item.id} 
                  event={item} 
                  onPress={() => router.push({ pathname: '/events/[id]', params: { id: item.id } })} 
                />
              );
            } else {
              return (
                <GrantCard 
                  key={item.id} 
                  grant={item} 
                  onPress={() => router.push({ pathname: '/grants/[id]', params: { id: item.id } })} 
                />
              );
            }
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E6F2',
  },
  activeTabButton: {
    backgroundColor: '#6671E4',
    borderColor: '#6671E4',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8A8D9F',
  },
  activeTabButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  opportunityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    lineHeight: 18,
  },
  companyText: {
    fontSize: 12,
    color: '#8A8D9F',
    marginTop: 2,
  },
  bookmarkButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EBEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  descriptionText: {
    fontSize: 12,
    color: '#8A8D9F',
    lineHeight: 18,
    marginTop: 12,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F7F7F9',
    marginVertical: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackedAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  appliedCountText: {
    fontSize: 11,
    color: '#8A8D9F',
    marginLeft: 8,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  matchBadgeText: {
    fontSize: 10,
    color: '#16A34A',
    fontWeight: '600',
  },
  deadlineBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deadlineBadgeText: {
    fontSize: 9,
    color: '#2E7D32',
    fontWeight: '600',
    textAlign: 'center',
  },
  endedBadge: {
    backgroundColor: '#FFEAEA',
  },
  endedBadgeText: {
    color: '#FF4D4D',
  },
  eventBanner: {
    height: 120,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
  },
  eventBannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#16A34A',
    lineHeight: 22,
  },
  eventBannerSub: {
    fontSize: 9,
    color: '#2E7D32',
    marginTop: 6,
  },
  eventDateText: {
    fontSize: 11,
    color: '#8A8D9F',
    marginTop: 4,
  },
  eventFooter: {
    marginTop: 12,
    flexDirection: 'row',
  },
  freeBadge: {
    backgroundColor: '#EBEBEE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  freeBadgeText: {
    fontSize: 11,
    color: '#6671E4',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 13,
    color: '#8A8D9F',
  },
});
