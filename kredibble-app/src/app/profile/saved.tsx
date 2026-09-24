import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Bookmark, Sparkles } from 'lucide-react-native';
import { profileStore } from '../../constants/mockProfile';

// Import datasets and components
import { JOBS_DATA, JobCard } from '../jobs/index';
import { INTERNSHIPS_DATA, InternshipCard } from '../internships/index';
import { EVENTS_DATA, EventCard } from '../events/index';
import { GRANTS_DATA, GrantCard } from '../grants/index';

type CategoryType = 'jobs' | 'internships' | 'events' | 'grants';

const MOCK_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100'
];

export default function SavedOpportunitiesScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CategoryType>('jobs');
  const [savedItems, setSavedItems] = useState(profileStore.saved);

  useEffect(() => {
    const fetchSaved = async () => {
      try {
        const { authStore } = require('../../constants/authStore');
        const { getSavedItems } = require('../../lib/api');
        const userId = authStore.user?.id;
        
        if (userId) {
          const apiItems = await getSavedItems(userId);
          
          // Map backend itemType to frontend type
          const mappedItems = apiItems.map((item: any) => {
            let mappedType = item.itemType;
            if (mappedType === 'opportunities') mappedType = 'jobs'; // Simple mock heuristic
            return { id: item.itemId, type: mappedType };
          });
          
          // Hydrate the store so everything stays in sync
          profileStore.saved = mappedItems;
          setSavedItems(mappedItems);
          profileStore.notify();
        }
      } catch (err) {
        console.warn('Failed to fetch saved items from server', err);
      }
    };
    
    fetchSaved();

    const unsubscribe = profileStore.subscribe(() => {
      setSavedItems([...profileStore.saved]);
    });
    return unsubscribe;
  }, []);

  const handleToggleSave = (id: string, type: CategoryType) => {
    profileStore.toggleSaved(id, type);
  };

  // Resolve matching details
  const getFilteredData = () => {
    const ids = savedItems.filter(item => item.type === activeTab).map(item => item.id);
    
    if (activeTab === 'jobs') {
      return JOBS_DATA.filter(item => ids.includes(item.id));
    } else if (activeTab === 'internships') {
      return INTERNSHIPS_DATA.filter(item => ids.includes(item.id));
    } else if (activeTab === 'events') {
      return EVENTS_DATA.filter(item => ids.includes(item.id));
    } else {
      return GRANTS_DATA.filter(item => ids.includes(item.id));
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
        {currentList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Bookmark size={48} color="#8A8D9F" style={{ opacity: 0.3, marginBottom: 12 }} />
            <Text style={styles.emptyText} className="font-sans">No saved opportunities here</Text>
          </View>
        ) : (
          currentList.map((item: any) => {
            if (activeTab === 'jobs') {
              return <JobCard key={item.id} job={item} onPress={() => {}} />;
            } else if (activeTab === 'internships') {
              return <InternshipCard key={item.id} item={item} onPress={() => {}} />;
            } else if (activeTab === 'events') {
              return <EventCard key={item.id} event={item} onPress={() => {}} />;
            } else {
              return <GrantCard key={item.id} grant={item} onPress={() => {}} />;
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
