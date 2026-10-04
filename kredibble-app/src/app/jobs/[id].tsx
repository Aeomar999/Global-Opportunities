import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Bookmark, Sparkles, Users, MapPin, ChevronDown, ChevronUp, Clock } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getOpportunityById, applyForOpportunity } from '../../lib/api';
import { Colors, FontSize, FontWeight, Radius } from '../../constants/design';
import { useToast } from '../../components/ui/ToastProvider';

const ABOUT = `Our mission\nWe're making Africa the first cashless continent.\n\nIn 2017, over half the population in Sub-Saharan Africa had no bank account. That's for good reason—the fees are too high, the closest branch can be miles away, and nobody takes cards. Without access to financial institutions, people are forced to keep their savings under the mattress. Small business owners rely on lenders who charge extortionate rates. Parents spend hours waiting in line to pay school fees in cash.\n\nWe're solving this by building financial services that just work: no account fees, instantly available, and accepted everywhere. In places where electricity, water and roads don't always work, you can still send money with Wave. In 2017, we launched a mobile app in Senegal for cash deposit, withdrawal, and peer-to-peer and business payments. Now, we have millions of users across 9 countries and are growing fast.\n\nOur goal is to make Africa the first cashless continent and that's where you come in...\n\nHow you'll help us achieve it\n\nWave is now the largest financial institution in Senegal and Côte d'Ivoire, with millions of users, growing rapidly year-on-year. And, we're still in the early days of our product roadmap and potential impact on people's everyday lives.`;

const RESPONSIBILITIES = [
  "Partner with product managers and engineers to define and align on product goals and requirements.",
  "Develop high-fidelity mockups, user flows, and interactive prototypes for mobile platforms.",
  "Conduct user research and translate insights into clean, intuitive design iterations.",
  "Maintain and expand the company's shared design system libraries."
];

export default function JobDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bookmarked, setBookmarked] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applying, setApplying] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    let isMounted = true;
    if (!id) return;
    getOpportunityById(id)
      .then((data) => {
        if (!isMounted) return;
        setJob(data);
        setError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Failed to load job details');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleApply = async () => {
    if (applied || applying || !id) return;
    setApplying(true);
    try {
      await applyForOpportunity(id, { coverLetter: 'Applied via Kredibble Mobile' });
      setApplied(true);
      showToast(`You have successfully applied for the ${job?.title || 'role'} at ${job?.company || 'Company'}!`);
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('already applied')) {
        setApplied(true);
        showToast('You have already applied for this opportunity.');
      } else {
        showToast(err.message || 'Application failed. Please try again.');
      }
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen, justifyContent: 'center', alignItems: 'center' }} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ marginTop: 12, color: Colors.textMuted, fontSize: 14 }} className="font-sans">Loading job details...</Text>
      </SafeAreaView>
    );
  }

  if (error || !job) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' }} edges={['top', 'left', 'right']}>
        <Text style={{ color: Colors.textHeading, fontSize: 16, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }} className="font-sans">
          {error || 'Job not found'}
        </Text>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/opportunities')}
          style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.primary, borderRadius: 8, marginTop: 12 }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }} className="font-sans">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const fullDescription = job.description ? `${job.description}\n\n${ABOUT}` : ABOUT;
  const initial = (job.company || 'J').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen }} edges={['top', 'left', 'right']}>
      {/* Navigation Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/opportunities')}
          style={styles.circleHeaderButton}
        >
          <ChevronLeft size={20} color={Colors.textHeading} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => setBookmarked(!bookmarked)}
          style={[styles.circleHeaderButton, bookmarked && styles.bookmarkActive]}
        >
          <Bookmark
            size={20}
            color={bookmarked ? Colors.white : Colors.textMuted}
            fill={bookmarked ? Colors.white : 'transparent'}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Company Logo Header Section (Centered) */}
        <View style={styles.logoHeaderContainer}>
          <View
            style={[styles.logoCircle, { backgroundColor: job.logoColor || Colors.primary }]}
          >
            <Text style={styles.logoText}>{initial}</Text>
          </View>
          <Text style={styles.companyName} className="font-sans">
            {job.company}
          </Text>
          <Text style={styles.jobTitle} className="font-sans">
            {job.title}
          </Text>
          <Text style={styles.jobLocation} className="font-sans">
            {job.location}
          </Text>
        </View>

        {/* Title Meta Card */}
        <View style={styles.metaCard}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.metaLabel} className="font-sans">Employment Type</Text>
            <Text style={styles.metaValue} className="font-sans">Full-time</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText} className="font-sans">
              Full-time
            </Text>
          </View>
        </View>

        {/* Panel 1: Overview (Collapsible) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} className="font-sans">
            Overview
          </Text>
          <Text
            style={styles.bodyText}
            numberOfLines={expanded ? undefined : 3}
            className="font-sans"
          >
            {fullDescription}
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

        {/* Panel 2: Good to know */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} className="font-sans">
            Good to know
          </Text>
          <View style={styles.infoRow}>
            <Sparkles size={16} color={Colors.success} style={{ marginRight: 8 }} />
            <Text style={styles.infoText} className="font-sans">
              {job.match}
            </Text>
          </View>
          <View style={[styles.infoRow, { marginTop: 10 }]}>
            <Users size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
            <Text style={styles.infoText} className="font-sans">
              {job.applied}
            </Text>
          </View>
          <View style={[styles.infoRow, { marginTop: 10 }]}>
            <MapPin size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
            <Text style={styles.infoText} className="font-sans">
              {job.location}
            </Text>
          </View>
        </View>

        {/* Panel 3: Key Responsibilities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} className="font-sans">
            Role & Responsibilities
          </Text>
          {RESPONSIBILITIES.map((resp, idx) => (
            <View key={idx} style={styles.bulletRow}>
              <Text style={styles.bulletSymbol}>•</Text>
              <Text style={styles.bulletText} className="font-sans">
                {resp}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Sticky Footer Apply CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleApply}
          style={[styles.applyButton, applied && styles.applyButtonInactive]}
          disabled={applied}
          activeOpacity={0.7}
        >
          <Text style={[styles.applyButtonText, applied && styles.applyButtonTextInactive]} className="font-sans">
            {applied ? 'Applied' : 'Apply now'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgScreen,
  },
  circleHeaderButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookmarkActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  logoHeaderContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  logoCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  companyName: {
    fontSize: 12,
    fontWeight: FontWeight.medium,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  jobTitle: {
    fontSize: 18,
    fontWeight: FontWeight.bold,
    color: Colors.textHeading,
    textAlign: 'center',
    marginBottom: 6,
    paddingHorizontal: 16,
  },
  jobLocation: {
    fontSize: 12,
    color: Colors.textMuted,
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
  metaLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: FontWeight.medium,
    color: Colors.textHeading,
  },
  badge: {
    backgroundColor: Colors.primaryChip,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
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
    fontSize: 13,
    fontWeight: FontWeight.semibold,
    color: Colors.textHeading,
    marginBottom: 8,
  },
  bodyText: {
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
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bulletSymbol: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginRight: 8,
    marginTop: -2,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
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
  applyButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: 'bold',
  },
  applyButtonInactive: {
    backgroundColor: Colors.borderDefault,
  },
  applyButtonTextInactive: {
    color: Colors.textMuted,
  },
});
