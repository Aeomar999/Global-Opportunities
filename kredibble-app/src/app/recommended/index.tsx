import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { JobCard, Job } from '../jobs/index';
import { InternshipCard, Internship } from '../internships/index';
import { getOpportunities } from '../../lib/api';

export default function RecommendedScreen() {
  const router = useRouter();
  const [recommendedJobs, setRecommendedJobs] = useState<Job[]>([]);
  const [recommendedInternships, setRecommendedInternships] = useState<Internship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      getOpportunities({ type: 'job', limit: 5 }).catch(() => []),
      getOpportunities({ type: 'internships', limit: 5 }).catch(() => [])
    ]).then(([jobs, internships]) => {
      if (!isMounted) return;
      const mappedJobs: Job[] = (Array.isArray(jobs) ? jobs : []).slice(0, 3).map(j => ({
        id: j.id,
        title: j.title,
        location: j.location || 'Remote',
        company: j.company || 'Company',
        logoColor: j.logoColor || '#6671E4',
        initial: (j.company || 'J').charAt(0).toUpperCase(),
        description: j.description || '',
        applied: `${j.applicantsCount || 0} applied`,
        match: '95% Match',
      }));
      const mappedInternships: Internship[] = (Array.isArray(internships) ? internships : []).slice(0, 3).map(i => ({
        id: i.id,
        title: i.title,
        location: i.location || 'Remote',
        company: i.company || 'Company',
        logoColor: i.logoColor || '#34D399',
        initial: (i.company || 'I').charAt(0).toUpperCase(),
        description: i.description || '',
        applied: `${i.applicantsCount || 0} applied`,
        match: '92% Match',
      }));
      setRecommendedJobs(mappedJobs);
      setRecommendedInternships(mappedInternships);
    }).finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

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
        <Text style={styles.headerTitle} className="font-sans">Recommended for you</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.infoBanner}>
        <Sparkles size={16} color="#16A34A" />
        <Text style={styles.infoText} className="font-sans">
          These opportunities strongly match your profile and CV data.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#6671E4" />
            <Text style={{ marginTop: 12, color: '#8A8D9F', fontSize: 13 }} className="font-sans">Finding tailored recommendations...</Text>
          </View>
        ) : (
          <>
            {recommendedJobs.length > 0 && (
              <>
                <Text style={styles.sectionTitle} className="font-sans">Jobs</Text>
                {recommendedJobs.map((job) => (
                  <JobCard 
                    key={job.id} 
                    job={job} 
                    onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: job.id } })} 
                  />
                ))}
              </>
            )}

            {recommendedInternships.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 16 }]} className="font-sans">Internships</Text>
                {recommendedInternships.map((internship) => (
                  <InternshipCard 
                    key={internship.id} 
                    item={internship} 
                    onPress={() => router.push({ pathname: '/internships/[id]', params: { id: internship.id } })} 
                  />
                ))}
              </>
            )}

            {recommendedJobs.length === 0 && recommendedInternships.length === 0 && (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <Text style={{ color: '#8A8D9F', fontSize: 14 }} className="font-sans">No recommendations available at the moment.</Text>
              </View>
            )}
          </>
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '500',
    lineHeight: 16,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  }
});
