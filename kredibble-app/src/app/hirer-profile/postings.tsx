import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Users, Briefcase, GraduationCap, Calendar, Award, Trash2, Plus } from 'lucide-react-native';
import { authStore, PostedOpportunity } from '../../constants/authStore';
import { getOpportunities, deleteOpportunity } from '../../lib/api';
import { useToast } from '../../components/ui/ToastProvider';

const TYPE_META: Record<PostedOpportunity['type'], { label: string; Icon: any; color: string }> = {
  jobs: { label: 'Job', Icon: Briefcase, color: '#6671E4' },
  internships: { label: 'Internship', Icon: GraduationCap, color: '#F59E0B' },
  events: { label: 'Event', Icon: Calendar, color: '#10B981' },
  grants: { label: 'Grant', Icon: Award, color: '#EF4444' },
};

export default function MyPostingsScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [opportunities, setOpportunities] = useState<PostedOpportunity[]>(authStore.opportunities);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchMyPostings = async () => {
    setLoading(true);
    try {
      const data = await getOpportunities();
      const userId = authStore.user?.id;
      const companyId = authStore.company?.id;

      const myOpps = (Array.isArray(data) ? data : []).filter((o: any) => {
        if (!userId && !companyId) return true;
        const createdByMatch = o.createdBy === userId || o.createdBy?._id === userId;
        const hirerMatch =
          o.hirerId === userId ||
          o.hirerId === companyId ||
          o.hirerId?._id === companyId ||
          o.hirerId?.userId === userId;
        return createdByMatch || hirerMatch;
      });

      const mapped: PostedOpportunity[] = myOpps.map((opp: any) => ({
        id: String(opp.id || opp._id),
        title: opp.title || 'Untitled Opportunity',
        type: (opp.type && ['jobs', 'internships', 'events', 'grants'].includes(String(opp.type).toLowerCase()))
          ? (String(opp.type).toLowerCase() as PostedOpportunity['type'])
          : 'jobs',
        company: opp.company || authStore.company?.name || 'Company',
        location: opp.location || 'Remote',
        logoColor: opp.logoColor || '#6671E4',
        initial: (opp.company || 'O').charAt(0).toUpperCase(),
        description: opp.description || '',
        applicantsCount: opp.applicantsCount || 0,
        applicants: [],
        date: opp.createdAt ? new Date(opp.createdAt).toLocaleDateString() : 'Recent',
      }));

      setOpportunities(mapped);
      authStore.setOpportunities(mapped);
    } catch (err: any) {
      console.warn('Failed to load hirer postings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyPostings();
    const unsubscribe = authStore.subscribe(() => setOpportunities([...authStore.opportunities]));
    return unsubscribe;
  }, []);

  const goToOpportunity = (_opp: PostedOpportunity) => {
    router.push({ pathname: '/(tabs)/opportunities', params: { view: 'all' } });
  };

  const handleDelete = (opp: PostedOpportunity) => {
    Alert.alert(
      'Delete Posting',
      `Are you sure you want to delete "${opp.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(opp.id);
              await deleteOpportunity(opp.id);
              const next = opportunities.filter((o) => o.id !== opp.id);
              setOpportunities(next);
              authStore.setOpportunities(next);
              showToast('Posting deleted successfully', 'success');
            } catch (err: any) {
              showToast(err.message || 'Failed to delete posting', 'info');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <ChevronLeft size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} className="font-sans">My Postings</Text>
        <TouchableOpacity
          onPress={() => router.push('/opportunities/create')}
          style={styles.addButton}
          activeOpacity={0.7}
        >
          <Plus size={20} color="#6671E4" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#6671E4" />
            <Text style={{ marginTop: 12, color: '#8A8D9F', fontSize: 13 }} className="font-sans">
              Loading your postings...
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader} className="font-sans">
                {opportunities.length} active posting{opportunities.length === 1 ? '' : 's'}
              </Text>
            </View>

            {opportunities.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle} className="font-sans">No postings yet</Text>
                <Text style={styles.emptyText} className="font-sans">
                  You haven&apos;t posted any opportunities yet.
                </Text>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={() => router.push('/opportunities/create')}
                  activeOpacity={0.8}
                >
                  <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.createButtonText} className="font-sans">Post an Opportunity</Text>
                </TouchableOpacity>
              </View>
            ) : (
              opportunities.map((opp) => {
                const meta = TYPE_META[opp.type] || TYPE_META.jobs;
                const isDeleting = deletingId === opp.id;
                return (
                  <View key={opp.id} style={styles.card}>
                    <TouchableOpacity
                      onPress={() => goToOpportunity(opp)}
                      activeOpacity={0.8}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                    >
                      <View style={[styles.typeIconWrap, { backgroundColor: meta.color }]}>
                        <meta.Icon size={18} color="#FFFFFF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle} numberOfLines={1} className="font-sans">
                          {opp.title}
                        </Text>
                        <Text style={styles.cardSubtitle} className="font-sans">
                          {meta.label} • {opp.location}
                        </Text>
                        <View style={styles.applicantsRow}>
                          <Users size={12} color="#8A8D9F" style={{ marginRight: 4 }} />
                          <Text style={styles.applicantsText} className="font-sans">
                            {opp.applicantsCount} applicant{opp.applicantsCount === 1 ? '' : 's'} • Posted {opp.date}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.cardActions}>
                      {isDeleting ? (
                        <ActivityIndicator size="small" color="#EF4444" style={{ marginHorizontal: 8 }} />
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleDelete(opp)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          style={styles.deleteButton}
                        >
                          <Trash2 size={16} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                      <ChevronRight size={18} color="#A1A1AA" />
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F9' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  backButton: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#E5E6F2',
    backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center',
  },
  addButton: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#E5E6F2',
    backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A1A' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  sectionHeaderRow: { marginBottom: 12 },
  sectionHeader: { fontSize: 13, color: '#8A8D9F', fontWeight: '500' },
  emptyState: { paddingVertical: 48, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#8A8D9F', textAlign: 'center', marginBottom: 20 },
  createButton: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#6671E4', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
  },
  createButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#E5E6F2', marginBottom: 12,
  },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deleteButton: { padding: 4 },
  typeIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#1A1A1A' },
  cardSubtitle: { fontSize: 12, color: '#8A8D9F', marginTop: 2 },
  applicantsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  applicantsText: { fontSize: 11, color: '#8A8D9F' },
});
