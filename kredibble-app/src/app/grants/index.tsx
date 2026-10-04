import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, SlidersHorizontal, Search, Bookmark } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { profileStore } from '../../constants/mockProfile';
import { useToast } from '../../components/ui/ToastProvider';

// ─── Shared grant data ────────────────────────────────────────────────────────

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

export type GrantCardData = {
  id: string;
  title: string;
  org: string;
  logoColor?: string;
  initial?: string;
  description: string;
  applied?: string;
  status?: 'ended' | 'deadline';
  deadline?: string;
};

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

  const displayGrants: GrantCardData[] = liveGrants.map(j => ({
    id: j.id,
    title: j.title,
    org: j.org || j.company || j.funder || 'Organization',
    logoColor: j.logoColor || '#3D2A6B',
    initial: (j.org || j.company || j.funder || 'G').charAt(0).toUpperCase(),
    description: j.description || '',
    applied: `${j.applicantsCount || 0} applied`,
    status: j.status && j.status !== 'open' ? 'ended' : 'deadline',
    deadline: j.deadline,
  }));

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
        {isLoading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Text style={{ color: '#8A8D9F', fontSize: 14 }} className="font-sans">Loading grants...</Text>
          </View>
        ) : displayGrants.length > 0 ? (
          displayGrants.map(grant => (
            <GrantCard
              key={grant.id}
              grant={grant}
              onPress={() => router.push({ pathname: '/grants/[id]', params: { id: grant.id } })}
            />
          ))
        ) : (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Text style={{ color: '#8A8D9F', fontSize: 14 }} className="font-sans">No grants available at the moment.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
