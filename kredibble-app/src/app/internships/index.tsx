import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, SlidersHorizontal, Search, Bookmark, Sparkles } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { profileStore } from '../../constants/mockProfile';
import { useToast } from '../../components/ui/ToastProvider';

// ─── Shared internship data ───────────────────────────────────────────────────

export const INTERNSHIPS_DATA = [
  {
    id: '1',
    title: 'Senior Product designer',
    location: 'Ghana (Remote)',
    company: 'Wave mobile money',
    logoColor: '#00BCD4',
    initial: 'W',
    description: "In 2017, over half the population in Sub-Saharan Africa had no bank account. That's for good reason....",
    applied: '100+ applied',
    match: '92% Match',
  },
  {
    id: '2',
    title: 'Junior Product designer',
    location: 'Ghana (Remote)',
    company: 'Pinterest',
    logoColor: '#E60023',
    initial: 'P',
    description: 'A curious and detail-oriented Junior Product Designer with strong visual design skills, user-centered...',
    applied: '100+ applied',
    match: '92% Match',
  },
  {
    id: '3',
    title: 'Junior Product designer',
    location: 'Ghana (Remote)',
    company: 'OpenSea',
    logoColor: '#2081E2',
    initial: 'O',
    description: 'A curious and detail-oriented Junior Product Designer with strong visual design skills, user-centered...',
    applied: '100+ applied',
    match: '92% Match',
  },
  {
    id: '4',
    title: 'Junior Product designer',
    location: 'Ghana (Remote)',
    company: 'Product Hunt',
    logoColor: '#DA552F',
    initial: 'P',
    description: 'A curious and detail-oriented Junior Product Designer with strong visual design skills, user-centered...',
    applied: '100+ applied',
    match: '92% Match',
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

type Internship = (typeof INTERNSHIPS_DATA)[number];

export const InternshipCard = ({ item, onPress }: { item: Internship; onPress: () => void }) => {
  const { showToast } = useToast();
  const [isSaved, setIsSaved] = useState(profileStore.isSaved(item.id, 'internships'));

  useEffect(() => {
    const unsubscribe = profileStore.subscribe(() => {
      setIsSaved(profileStore.isSaved(item.id, 'internships'));
    });
    return unsubscribe;
  }, [item.id]);

  const handleToggleSave = () => {
    profileStore.toggleSaved(item.id, 'internships');
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
          backgroundColor: item.logoColor,
          justifyContent: 'center', alignItems: 'center',
          marginRight: 8,
        }}>
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>{item.initial}</Text>
        </View>

        <View style={{ flex: 1, marginRight: 8 }}>
          <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '500', color: '#1A1A1A' }} className="font-sans">
            {item.title}
            <Text style={{ color: '#8A8D9F' }}> · {item.location}</Text>
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '500', color: '#8A8D9F', marginTop: 2 }} className="font-sans">
            {item.company}
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
      {item.description}
    </Text>

    <View style={{ height: 1, backgroundColor: '#E5E6F2', marginTop: 10 }} />

    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <AvatarStack />
        <Text style={{ fontSize: 10, color: '#8A8D9F' }} className="font-sans">{item.applied}</Text>
      </View>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#DCFCE7', borderRadius: 9999,
        paddingHorizontal: 12, paddingVertical: 5,
      }}>
        <Sparkles size={13} color="#16A34A" />
        <Text style={{ fontSize: 10, color: '#16A34A', fontWeight: '500' }} className="font-sans">
          {item.match}
        </Text>
      </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

import { getOpportunities } from '../../lib/api';

export default function InternshipsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filterCount?: string; query?: string }>();
  const filterCount = parseInt(params.filterCount ?? '0', 10);
  
  const [liveInternships, setLiveInternships] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchInternships = async () => {
      setIsLoading(true);
      try {
        const data = await getOpportunities({
          type: 'internships',
          q: params.query
        });
        setLiveInternships(data);
      } catch (err) {
        console.error("Failed to fetch internships:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInternships();
  }, [params.query]);

  // Merge live internships with mock internships so the screen isn't empty if the backend has no internships
  const displayInternships = liveInternships.length > 0 ? liveInternships.map(j => ({
    id: j.id,
    title: j.title,
    location: j.location || 'Remote',
    company: j.company || 'Company',
    logoColor: j.logoColor || '#34D399',
    initial: j.initial || 'I',
    description: j.description || '',
    applied: `${j.applicantsCount || 0} applied`,
    match: '92% Match',
  })) : INTERNSHIPS_DATA;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F9' }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/opportunities')} style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#E5E6F2', backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
          <ChevronLeft size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: '#1A1A1A' }} className="font-sans">
          Internships
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
            onPress={() => router.push('/internships/search' as any)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
          >
            <Search size={18} color="#A1A1AA" style={{ marginRight: 10 }} />
            <Text style={{ fontSize: 14, color: params.query ? '#1A1A1A' : '#A1A1AA' }} className="font-sans">
              {params.query || 'Browse for internships'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/internships/filter' as any)}>
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

        {/* Internship cards */}
        {displayInternships.map(item => (
          <InternshipCard
            key={item.id}
            item={item}
            onPress={() => router.push({ pathname: '/internships/[id]', params: { id: item.id } })}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
