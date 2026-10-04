import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { getMyApplications } from '../../lib/api';

type ParentTab = 'jobs' | 'internships';
type SubFilter = 'All' | 'Interview' | 'Rejected' | 'In review';

interface ApplicationItem {
  id: string;
  title: string;
  company: string;
  description: string;
  type: 'jobs' | 'internships';
  status: 'In review' | 'Interview' | 'Rejected';
  appliedDate?: string;
}

const MOCK_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100'
];

export default function ApplicationsStatusScreen() {
  const router = useRouter();
  const [parentTab, setParentTab] = useState<ParentTab>('jobs');
  const [activeFilter, setActiveFilter] = useState<SubFilter>('All');
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mapRawApplications = (rawList: any[]): ApplicationItem[] => {
    return rawList.map((item: any) => {
      const opp = item.opportunity || {};
      let normalizedStatus: 'In review' | 'Interview' | 'Rejected' = 'In review';
      const rawStatus = String(item.status || '').toLowerCase();
      if (rawStatus === 'interviewing' || rawStatus === 'interview' || rawStatus === 'offered') {
        normalizedStatus = 'Interview';
      } else if (rawStatus === 'rejected') {
        normalizedStatus = 'Rejected';
      }

      const rawType = String(opp.type || '').toLowerCase();
      const normalizedType: 'jobs' | 'internships' = rawType.includes('intern') ? 'internships' : 'jobs';

      return {
        id: String(item.id || item._id),
        title: opp.title || 'Opportunity Application',
        company: opp.company || 'Company',
        description: opp.description || opp.location || (item.createdAt ? `Applied on ${new Date(item.createdAt).toLocaleDateString()}` : 'Applied'),
        type: normalizedType,
        status: normalizedStatus,
        appliedDate: item.createdAt,
      };
    });
  };

  const loadData = () => {
    getMyApplications()
      .then((res) => {
        const rawList = Array.isArray(res) ? res : ((res as any)?.data || []);
        setApplications(mapRawApplications(rawList));
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err?.message || 'Failed to load applications');
        setLoading(false);
      });
  };

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    loadData();
  };

  useEffect(() => {
    let isMounted = true;
    getMyApplications()
      .then((res) => {
        if (!isMounted) return;
        const rawList = Array.isArray(res) ? res : ((res as any)?.data || []);
        setApplications(mapRawApplications(rawList));
        setLoading(false);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setError(err?.message || 'Failed to load applications');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const getFilteredApps = () => {
    // 1. Filter by category (jobs vs internships)
    let filtered = applications.filter(app => app.type === parentTab);

    // 2. Filter by status if not 'All'
    if (activeFilter !== 'All') {
      filtered = filtered.filter(app => app.status === activeFilter);
    }

    return filtered;
  };

  const getStatusStyles = (status: 'In review' | 'Interview' | 'Rejected') => {
    if (status === 'Interview') {
      return {
        bg: '#DCFCE7',
        text: '#16A34A'
      };
    } else if (status === 'Rejected') {
      return {
        bg: '#FFEAEA',
        text: '#ED4C5C'
      };
    } else {
      // In review
      return {
        bg: '#FEF3C7',
        text: '#D97706'
      };
    }
  };

  const currentList = getFilteredApps();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} className="font-sans">Applications status</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Parent Tabs */}
      <View style={styles.parentTabs}>
        <TouchableOpacity 
          style={[styles.parentTab, parentTab === 'jobs' && styles.activeParentTab]}
          onPress={() => { setParentTab('jobs'); setActiveFilter('All'); }}
          activeOpacity={0.8}
        >
          <Text style={[styles.parentTabText, parentTab === 'jobs' && styles.activeParentTabText]} className="font-sans">Jobs</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.parentTab, parentTab === 'internships' && styles.activeParentTab]}
          onPress={() => { setParentTab('internships'); setActiveFilter('All'); }}
          activeOpacity={0.8}
        >
          <Text style={[styles.parentTabText, parentTab === 'internships' && styles.activeParentTabText]} className="font-sans">Internships</Text>
        </TouchableOpacity>
      </View>

      {/* Sub Filters Row */}
      <View style={styles.subFiltersContainer}>
        <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subFiltersScroll}>
          {(['All', 'Interview', 'Rejected', 'In review'] as SubFilter[]).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.subFilterPill, activeFilter === filter && styles.activeSubFilterPill]}
              onPress={() => setActiveFilter(filter)}
              activeOpacity={0.8}
            >
              <Text style={[styles.subFilterText, activeFilter === filter && styles.activeSubFilterText]} className="font-sans">
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Scrollable list */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color="#6671E4" />
            <Text style={[styles.emptyText, { marginTop: 12 }]} className="font-sans">Loading applications...</Text>
          </View>
        ) : error ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: '#ED4C5C', marginBottom: 12 }]} className="font-sans">{error}</Text>
            <TouchableOpacity onPress={handleRetry} style={[styles.subFilterPill, styles.activeSubFilterPill]}>
              <Text style={styles.activeSubFilterText} className="font-sans">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : currentList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText} className="font-sans">No applications match this filter</Text>
          </View>
        ) : (
          currentList.map((app) => {
            const statusStyle = getStatusStyles(app.status);
            // Deduce logo details based on company (mock setup matching other items)
            let logoColor = '#6671E4';
            if (app.company.toLowerCase() === 'wave mobile money') logoColor = '#00BCD4';
            if (app.company.toLowerCase() === 'pinterest') logoColor = '#E60023';
            if (app.company.toLowerCase() === 'openseea') logoColor = '#2081E2';
            
            return (
              <View key={app.id} style={styles.appCard}>
                <View style={styles.cardHeader}>
                  <View style={[styles.logoCircle, { backgroundColor: logoColor }]}>
                    <Text style={styles.logoText} className="font-sans">{app.company.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.headerInfo}>
                    <Text style={styles.cardTitle} className="font-sans">
                      {app.title} <Text style={{ color: '#8A8D9F', fontWeight: '400' }}>• Ghana (Remote)</Text>
                    </Text>
                    <Text style={styles.companyText} className="font-sans">{app.company}</Text>
                  </View>
                </View>

                <Text style={styles.descriptionText} className="font-sans" numberOfLines={2}>
                  {app.description}
                </Text>

                <View style={styles.cardDivider} />

                <View style={styles.cardFooter}>
                  <View style={styles.avatarStack}>
                    {MOCK_AVATARS.map((uri, idx) => (
                      <Image 
                        key={idx} 
                        source={{ uri }} 
                        style={[styles.stackedAvatar, { marginLeft: idx > 0 ? -8 : 0 }]} 
                      />
                    ))}
                    <Text style={styles.appliedCountText} className="font-sans">100+ applied</Text>
                  </View>
                  
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusStyle.text }]} className="font-sans">
                      {app.status}
                    </Text>
                  </View>
                </View>
              </View>
            );
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
  parentTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEE',
    paddingHorizontal: 20,
  },
  parentTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeParentTab: {
    borderBottomColor: '#6671E4',
  },
  parentTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8A8D9F',
  },
  activeParentTabText: {
    color: '#6671E4',
    fontWeight: '600',
  },
  subFiltersContainer: {
    paddingVertical: 14,
  },
  subFiltersScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  subFilterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E6F2',
  },
  activeSubFilterPill: {
    backgroundColor: '#6671E4',
    borderColor: '#6671E4',
  },
  subFilterText: {
    fontSize: 12,
    color: '#8A8D9F',
    fontWeight: '500',
  },
  activeSubFilterText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  appCard: {
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
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadgeText: {
    fontSize: 11,
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
