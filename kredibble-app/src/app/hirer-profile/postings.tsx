import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Users, Briefcase, GraduationCap, Calendar, Award } from 'lucide-react-native';
import { authStore, PostedOpportunity } from '../../constants/authStore';

const TYPE_META: Record<PostedOpportunity['type'], { label: string; Icon: any; color: string }> = {
  jobs: { label: 'Job', Icon: Briefcase, color: '#6671E4' },
  internships: { label: 'Internship', Icon: GraduationCap, color: '#F59E0B' },
  events: { label: 'Event', Icon: Calendar, color: '#10B981' },
  grants: { label: 'Grant', Icon: Award, color: '#EF4444' },
};

export default function MyPostingsScreen() {
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<PostedOpportunity[]>(authStore.opportunities);

  useEffect(() => {
    const unsubscribe = authStore.subscribe(() => setOpportunities([...authStore.opportunities]));
    return unsubscribe;
  }, []);

  const goToOpportunity = (opp: PostedOpportunity) => {
    // Applicant review currently lives inline in the Opportunities tab's "all listings" view.
    router.push({ pathname: '/(tabs)/opportunities', params: { view: 'all' } });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <ChevronLeft size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} className="font-sans">My Postings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionHeader} className="font-sans">
          {opportunities.length} active posting{opportunities.length === 1 ? '' : 's'}
        </Text>

        {opportunities.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText} className="font-sans">You haven&apos;t posted any opportunities yet.</Text>
          </View>
        ) : (
          opportunities.map(opp => {
            const meta = TYPE_META[opp.type];
            return (
              <TouchableOpacity
                key={opp.id}
                onPress={() => goToOpportunity(opp)}
                activeOpacity={0.8}
                style={styles.card}
              >
                <View style={[styles.typeIconWrap, { backgroundColor: meta.color }]}>
                  <meta.Icon size={18} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} className="font-sans">{opp.title}</Text>
                  <Text style={styles.cardSubtitle} className="font-sans">{meta.label} • {opp.location}</Text>
                  <View style={styles.applicantsRow}>
                    <Users size={12} color="#8A8D9F" style={{ marginRight: 4 }} />
                    <Text style={styles.applicantsText} className="font-sans">
                      {opp.applicantsCount} applicant{opp.applicantsCount === 1 ? '' : 's'} • Posted {opp.date}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={18} color="#A1A1AA" />
              </TouchableOpacity>
            );
          })
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
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A1A' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  sectionHeader: { fontSize: 13, color: '#8A8D9F', fontWeight: '500', marginBottom: 12 },
  emptyState: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#8A8D9F' },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#E5E6F2', marginBottom: 12,
  },
  typeIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#1A1A1A' },
  cardSubtitle: { fontSize: 12, color: '#8A8D9F', marginTop: 2 },
  applicantsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  applicantsText: { fontSize: 11, color: '#8A8D9F' },
});
