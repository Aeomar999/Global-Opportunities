import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, SlidersHorizontal, Search, Bookmark } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { profileStore } from '../../constants/mockProfile';
import { useToast } from '../../components/ui/ToastProvider';

// ─── Shared grant data ────────────────────────────────────────────────────────

export const GRANTS_DATA = [
  {
    id: '64a1b2c3d4e5f60011223344',
    title: 'Small Grants for Community WASH Projects in Sub-Saharan Africa and the Middle East & North Africa',
    org: 'Luena Foundation',
    logoColor: '#3D2A6B',
    initial: 'L',
    description: 'Luena Foundation invites small, locally led organizations across Sub-Saharan Africa and...',
    applied: '100+ applied',
    status: 'deadline' as const,
    deadline: 'May 31, 2026',
    location: 'Algeria, Angola, Benin, Botswana, Burkina Faso, Burundi, Cameroon, Cape Verde',
    fundingAgency: 'Other',
    openStatus: 'Open',
    budget: 'N/A',
    awardCeiling: 'USD 1,500',
    awardFloor: 'USD 1,000',
    sector: 'Civil Engineering, Water, Sanitation & Hygiene',
    languages: 'Arabic, English, French, Portuguese',
    eligibleApplicants: 'NGOs / Nonprofit Organisations',
    datePosted: 'Apr 22, 2026',
  },
  {
    id: '64a1b2c3d4e5f60011223345',
    title: 'Social & Criminal Justice',
    org: 'Charles Hayward Foundation',
    logoColor: '#1B4332',
    initial: 'C',
    description: 'We fund projects which help to prevent people entering the criminal justice system, and...',
    applied: '100+ applied',
    status: 'deadline' as const,
    deadline: 'May 31, 2026',
    location: 'United Kingdom',
    fundingAgency: 'Other',
    openStatus: 'Open',
    budget: 'N/A',
    awardCeiling: 'GBP 30,000',
    awardFloor: 'GBP 5,000',
    sector: 'Social & Criminal Justice',
    languages: 'English',
    eligibleApplicants: 'NGOs / Nonprofit Organisations',
    datePosted: 'Apr 18, 2026',
  },
  {
    id: '64a1b2c3d4e5f60011223346',
    title: 'Business Partnership Support',
    org: 'Ministry for Foreign Affairs of Finland',
    logoColor: '#1E3A8A',
    initial: 'M',
    description: 'Business Partnership Support funds Finnish operators to plan, pilot and develop commercial, long-te...',
    applied: '100+ applied',
    status: 'ended' as const,
    deadline: undefined,
    location: 'Finland',
    fundingAgency: 'Government / public bodies',
    openStatus: 'Closed',
    budget: 'N/A',
    awardCeiling: 'EUR 100,000',
    awardFloor: 'EUR 20,000',
    sector: 'Business Partnership',
    languages: 'Finnish, English',
    eligibleApplicants: 'Private sector',
    datePosted: 'Mar 10, 2026',
  },
];

// ─── Components ───────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#F87171', '#60A5FA', '#34D399'];

const AvatarStack = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    {AVATAR_COLORS.map((color, i) => (
      <View
        key={i}
        style={{
          width: 24, height: 24, borderRadius: 12,
          backgroundColor: color,
          borderWidth: 2, borderColor: '#F7F7F9',
          marginLeft: i === 0 ? 0 : -8,
          zIndex: AVATAR_COLORS.length - i,
        }}
      />
    ))}
  </View>
);

type Grant = (typeof GRANTS_DATA)[number];

/** The fields the card renders; satisfied by both the mock catalogue and live API rows. */
type GrantCardData = Pick<Grant, 'id' | 'title' | 'org' | 'logoColor' | 'initial' | 'description' | 'applied'>
  & { status?: Grant['status']; deadline?: string };

const StatusBadge = ({ grant }: { grant: GrantCardData }) => {
  if (grant.status === 'ended') {
    return (
      <View style={{
        backgroundColor: '#FEE2E2', borderRadius: 8,
        paddingHorizontal: 14, paddingVertical: 8,
      }}>
        <Text style={{ fontSize: 10, color: '#DC2626', fontWeight: '500' }} className="font-sans">
          Ended
        </Text>
      </View>
    );
  }
  // Live grants without a deadline show no badge rather than "Deadline: undefined".
  if (!grant.deadline) return null;
  return (
    <View style={{
      backgroundColor: '#DCFCE7', borderRadius: 8,
      paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center',
    }}>
      <Text style={{ fontSize: 9, color: '#16A34A' }} className="font-sans">Deadline:</Text>
      <Text style={{ fontSize: 10, color: '#16A34A', fontWeight: '500' }} className="font-sans">
        {grant.deadline}
      </Text>
    </View>
  );
};

export const GrantCard = ({ grant, onPress }: { grant: GrantCardData; onPress: () => void }) => {
  const { showToast } = useToast();
  const [isSaved, setIsSaved] = useState(profileStore.isSaved(grant.id, 'grants'));

  useEffect(() => {
    const unsubscribe = profileStore.subscribe(() => {
      setIsSaved(profileStore.isSaved(grant.id, 'grants'));
    });
    return unsubscribe;
  }, [grant.id]);

  const handleToggleSave = () => {
    profileStore.toggleSaved(grant.id, 'grants');
    if (!isSaved) {
      showToast('Opportunity saved to your profile', 'success');
    } else {
      showToast('Removed from saved opportunities', 'info');
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{
          width: 37, height: 37, borderRadius: 12,
          backgroundColor: grant.logoColor,
          justifyContent: 'center', alignItems: 'center',
          marginRight: 8,
        }}>
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>{grant.initial}</Text>
        </View>

        <View style={{ flex: 1, marginRight: 8 }}>
          <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '500', color: '#1A1A1A' }} className="font-sans">
            {grant.title}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '500', color: '#8A8D9F', marginTop: 2 }} className="font-sans">
            {grant.org}
          </Text>
        </View>

        <TouchableOpacity 
          onPress={handleToggleSave}
          style={{
            width: 34, height: 34, borderRadius: 17,
            borderWidth: 1, borderColor: isSaved ? '#6671E4' : '#E5E6F2',
            backgroundColor: isSaved ? '#6671E4' : 'transparent',
            justifyContent: 'center', alignItems: 'center',
          }}
        >
          <Bookmark size={16} color={isSaved ? "#FFFFFF" : "#8A8D9F"} fill={isSaved ? "#FFFFFF" : "transparent"} />
        </TouchableOpacity>
      </View>

    <Text
      style={{ fontSize: 10, color: '#8A8D9F', marginTop: 10, lineHeight: 16 }}
      numberOfLines={2}
      className="font-sans"
    >
      {grant.description}
    </Text>

    <View style={{ height: 1, backgroundColor: '#E5E6F2', marginTop: 10 }} />

    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <AvatarStack />
        <Text style={{ fontSize: 10, color: '#8A8D9F' }} className="font-sans">{grant.applied}</Text>
      </View>
      <StatusBadge grant={grant} />
      </View>
    </TouchableOpacity>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

import { getGrants } from '../../lib/api';

export default function GrantsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filterCount?: string; query?: string }>();
  const filterCount = parseInt(params.filterCount ?? '0', 10);
  
  const [liveGrants, setLiveGrants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchGrants = async () => {
      setIsLoading(true);
      try {
        const data = await getGrants({
          q: params.query
        });
        setLiveGrants(data);
      } catch (err) {
        console.error("Failed to fetch grants:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGrants();
  }, [params.query]);

  // Merge live grants with mock grants so the screen isn't empty if the backend has no grants
  const displayGrants = liveGrants.length > 0 ? liveGrants.map(j => ({
    id: j.id,
    title: j.title,
    org: j.company || 'Company',
    logoColor: j.logoColor || '#FBBF24',
    initial: j.initial || 'G',
    description: j.description || '',
    applied: `${j.applicantsCount || 0} applied`,
    status: j.status && j.status !== 'open' ? 'ended' as const : 'deadline' as const,
    deadline: j.deadline,
    match: '92% Match',
  })) : GRANTS_DATA;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F9' }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/opportunities')} style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#E5E6F2', backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
          <ChevronLeft size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: '#1A1A1A' }} className="font-sans">
          Grants
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* Search bar */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#FFFFFF', borderRadius: 15,
            paddingHorizontal: 16, height: 50, marginBottom: 20,
            shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/grants/search' as any)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
          >
            <Search size={18} color="#A1A1AA" style={{ marginRight: 10 }} />
            <Text style={{ fontSize: 14, color: params.query ? '#1A1A1A' : '#A1A1AA' }} className="font-sans">
              {params.query || 'Browse for grants'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/grants/filter' as any)}>
            <View>
              <SlidersHorizontal size={18} color="#6671E4" />
              {filterCount > 0 && (
                <View style={{
                  position: 'absolute', top: -5, right: -5,
                  backgroundColor: '#6671E4', borderRadius: 9999,
                  width: 14, height: 14, justifyContent: 'center', alignItems: 'center',
                }}>
                  <Text style={{ color: '#FFF', fontSize: 8, fontWeight: 'bold' }}>{filterCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Grant cards */}
        {displayGrants.map(grant => (
          <GrantCard
            key={grant.id}
            grant={grant}
            onPress={() => router.push({ pathname: '/grants/[id]', params: { id: grant.id } })}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
