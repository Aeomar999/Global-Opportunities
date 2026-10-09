import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Bookmark, Calendar, Coins, Globe, Briefcase, Award, MapPin, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, FontSize, FontWeight, Radius } from '../../constants/design';
import { getGrantById, Grant } from '../../lib/api';

export default function GrantDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [grant, setGrant] = useState<Grant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bookmarked, setBookmarked] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showAllDetails, setShowAllDetails] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!id) return;
    getGrantById(id)
      .then((data) => {
        if (!isMounted) return;
        setGrant(data);
        setError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Failed to load grant details');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleApply = () => {
    if (grant) {
      router.push({ pathname: '/grants/apply', params: { id: grant.id } });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen, justifyContent: 'center', alignItems: 'center' }} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ marginTop: 12, color: Colors.textMuted, fontSize: 14 }} className="font-sans">Loading grant details...</Text>
      </SafeAreaView>
    );
  }

  if (error || !grant) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }} edges={['top', 'left', 'right']}>
        <Text style={{ fontSize: 16, color: Colors.textHeading, fontWeight: '600', marginBottom: 8 }} className="font-sans">
          {error || 'Grant not found'}
        </Text>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/grants')}
          style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.primary, borderRadius: 8 }}
        >
          <Text style={{ color: Colors.white, fontWeight: '600' }} className="font-sans">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

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
        {/* Organization Logo & Info Header Section */}
        <View style={styles.logoHeaderContainer}>
          <View
            style={[styles.logoCircle, { backgroundColor: grant.logoColor }]}
          >
            <Text style={styles.logoText}>{grant.initial}</Text>
          </View>
          <Text style={styles.companyName} className="font-sans">
            {grant.org}
          </Text>
          <Text style={styles.grantTitle} className="font-sans">
            {grant.title}
          </Text>
          <Text style={styles.grantLocation} className="font-sans">
            {grant.location}
          </Text>
        </View>

        {/* Title Meta Card */}
        <View style={styles.metaCard}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.metaLabel} className="font-sans">Funding Capacity</Text>
            <Text style={styles.metaValue} className="font-sans">{grant.budget}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText} className="font-sans">
              {grant.openStatus || 'Active'}
            </Text>
          </View>
        </View>

        {/* Panel 1: Collapsible Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} className="font-sans">
            Overview
          </Text>
          <Text
            style={styles.bodyText}
            numberOfLines={expanded ? undefined : 3}
            className="font-sans"
          >
            {grant.description || 'No description provided.'}
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

        {/* Panel 2: Good to know (Key Specs) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} className="font-sans">
            Good to know
          </Text>
          <View style={styles.infoRow}>
            <Coins size={16} color={Colors.success} style={{ marginRight: 8 }} />
            <Text style={styles.infoText} className="font-sans">
              Budget: {grant.budget}
            </Text>
          </View>
          <View style={[styles.infoRow, { marginTop: 10 }]}>
            <Calendar size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
            <Text style={styles.infoText} className="font-sans">
              Deadline: {grant.deadline || 'N/A'}
            </Text>
          </View>
          <View style={[styles.infoRow, { marginTop: 10 }]}>
            <Briefcase size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
            <Text style={styles.infoText} className="font-sans">
              Sector: {grant.sector || 'Community Project'}
            </Text>
          </View>
          <View style={[styles.infoRow, { marginTop: 10 }]}>
            <Globe size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
            <Text style={styles.infoText} className="font-sans">
              Languages: {grant.languages || 'English'}
            </Text>
          </View>
        </View>

        {/* Panel 3: Detailed Specifications (Collapsible) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} className="font-sans">
            Detailed Specifications
          </Text>
          
          <DetailInfoRow icon={MapPin} label="Eligible Countries" value={grant.location} />
          <DetailInfoRow icon={Award} label="Funding Agency" value={grant.fundingAgency} />
          
          {showAllDetails && (
            <View style={{ marginTop: 12 }}>
              <DetailInfoRow icon={Coins} label="Award Ceiling" value={grant.awardCeiling} />
              <DetailInfoRow icon={Coins} label="Award Floor" value={grant.awardFloor} />
              <DetailInfoRow icon={Globe} label="Eligible Applicants" value={grant.eligibleApplicants} />
              <DetailInfoRow icon={Calendar} label="Date Posted" value={grant.datePosted} />
            </View>
          )}

          <TouchableOpacity
            style={[styles.readMoreButton, { marginTop: 12 }]}
            onPress={() => setShowAllDetails(!showAllDetails)}
          >
            <Text style={styles.readMoreText} className="font-sans">
              {showAllDetails ? 'See Less' : 'See All Details'}
            </Text>
            {showAllDetails ? <ChevronUp size={14} color={Colors.primary} /> : <ChevronDown size={14} color={Colors.primary} />}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Sticky Footer Apply CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleApply}
          style={styles.applyButton}
        >
          <Text style={styles.applyButtonText} className="font-sans">
            Apply for Grant
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const DetailInfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) => (
  <View style={styles.detailInfoRow}>
    <Icon size={16} color={Colors.textMuted} style={{ marginRight: 10, marginTop: 1 }} />
    <View style={{ flex: 1 }}>
      <Text style={styles.detailInfoLabel} className="font-sans">{label}</Text>
      <Text style={styles.detailInfoValue} className="font-sans">{value || 'N/A'}</Text>
    </View>
  </View>
);

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
    width: 80,
    height: 80,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  companyName: {
    fontSize: 12,
    fontWeight: FontWeight.medium,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  grantTitle: {
    fontSize: 17,
    fontWeight: FontWeight.bold,
    color: Colors.textHeading,
    textAlign: 'center',
    marginBottom: 6,
    paddingHorizontal: 12,
    lineHeight: 22,
  },
  grantLocation: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
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
    marginBottom: 12,
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
  detailInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  detailInfoLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 1,
  },
  detailInfoValue: {
    fontSize: 13,
    color: Colors.textBody,
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
});
