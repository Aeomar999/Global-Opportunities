import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, SlidersHorizontal, Star, Check, Users, Sparkles, X, Filter } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, FontSize, FontWeight, Radius, Shadow } from '../../constants/design';
import { mockExperts, Expert } from '../../constants/mockExperts';
import { authStore } from '../../constants/authStore';
import { searchSeekers, searchCandidates } from '../../lib/api';

// ─── Logo ─────────────────────────────────────────────────────────────────────
const LogoSVG = () => (
  <Image
    source={require('../../../assets/images/logo.png')}
    style={{ width: 40, height: 40, borderRadius: 20 }}
    resizeMode="contain"
  />
);

// ─── Star Rating Component ────────────────────────────────────────────────────
const StarRating = ({ rating }: { rating: number }) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Star
        key={i}
        size={14}
        color={i <= rating ? '#F6B612' : '#C4C4C4'}
        fill={i <= rating ? '#F6B612' : 'transparent'}
        style={{ marginRight: 2 }}
      />
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ fontSize: 13, color: Colors.textMuted, marginRight: 6, fontWeight: '500' }} className="font-sans">
        {rating.toFixed(1)}
      </Text>
      {stars}
    </View>
  );
};

// ─── Expert Card Component ────────────────────────────────────────────────────
const ExpertCard = ({ expert, onPress }: { expert: Expert; onPress: () => void }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={{
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: 'row' }}>
        <Image
          source={{ uri: expert.image }}
          style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.bgAlt, marginRight: 12 }}
        />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 4 }}>
            <Text style={{ fontSize: 13, color: Colors.textHeading, fontWeight: FontWeight.medium, flexShrink: 1 }} className="font-sans">
              {expert.name}
              <Text style={{ color: Colors.textMuted, fontWeight: FontWeight.regular }}> · {expert.profession}</Text>
            </Text>
            {expert.verified && (
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#16A34A', justifyContent: 'center', alignItems: 'center', marginLeft: 6 }}>
                <Check size={10} color="#FFFFFF" strokeWidth={3} />
              </View>
            )}
          </View>
          <Text style={{ fontSize: 13, color: Colors.textMuted, marginTop: 2, fontWeight: '400' }} className="font-sans">
            {expert.education?.[0]?.institution || (expert as any).university || 'University of Ghana'}
          </Text>
          <Text numberOfLines={2} style={{ fontSize: 13, color: Colors.textMuted, marginTop: 8, lineHeight: 18, fontWeight: '400' }} className="font-sans">
            {expert.bio || expert.professionalSummary}
          </Text>
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: Colors.borderDefault, marginVertical: 12 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <StarRating rating={expert.rating || 5} />
        <Text style={{ fontSize: 12, color: Colors.textMuted }} className="font-sans">
          {expert.country || expert.location || 'Ghana'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default function CareerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    query?: string;
    city?: string;
    profession?: string;
    experience?: string;
    rating?: string;
    country?: string;
    skills?: string;
  }>();

  const [role, setRole] = useState(authStore.role);
  const [liveCandidates, setLiveCandidates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // State is initialised from authStore; the subscription keeps it in sync.
    const unsubscribe = authStore.subscribe(() => setRole(authStore.role));
    return unsubscribe;
  }, []);

  // Fetch candidates from API when hirer role is active and filters change
  useEffect(() => {
    if (role === 'hirer') {
      const fetchCandidates = async () => {
        setIsLoading(true);
        try {
          const data = await searchSeekers({
            q: params.query,
            country: params.country,
            skills: params.skills, // Custom multi-select skills for hirer
            university: params.city, // Reusing city for university search for simplicity
          });
          setLiveCandidates(data);
        } catch (error) {
          console.error("Failed to fetch candidates:", error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchCandidates();
    }
  }, [role, params.query, params.country, params.skills, params.city]);

  // Local filtering for mock experts (Seeker role)
  const filteredExperts = mockExperts.filter(expert => {
    if (params.query) {
      const q = params.query.toLowerCase();
      const matchesName = expert.name.toLowerCase().includes(q);
      const matchesProfession = expert.profession.toLowerCase().includes(q);
      const matchesBio = expert.bio.toLowerCase().includes(q);
      if (!matchesName && !matchesProfession && !matchesBio) return false;
    }
    if (params.city) {
      const c = params.city.toLowerCase();
      if (!expert.city.toLowerCase().includes(c) && !expert.location.toLowerCase().includes(c)) return false;
    }
    if (params.profession && !params.profession.split(',').includes(expert.profession)) return false;
    if (params.experience && !params.experience.split(',').includes(expert.experienceLevel)) return false;
    if (params.rating && !params.rating.split(',').map(Number).includes(Math.floor(expert.rating))) return false;
    if (params.country && !params.country.split(',').includes(expert.country)) return false;
    return true;
  });

  const getFilterCount = () => {
    let count = 0;
    if (params.city) count += 1;
    if (params.profession) count += params.profession.split(',').length;
    if (params.experience) count += params.experience.split(',').length;
    if (params.rating) count += params.rating.split(',').length;
    if (params.country) count += params.country.split(',').length;
    if (params.skills) count += params.skills.split(',').length;
    return count;
  };

  const filterCount = getFilterCount();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen }} edges={['top', 'left', 'right']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <LogoSVG />
        <Text style={{ flex: 1, textAlign: 'center', fontSize: FontSize.screenTitle, fontWeight: FontWeight.semibold, color: Colors.textHeading, marginRight: 40 }} className="font-sans">
          {role === 'hirer' ? 'Talent Directory' : 'Expert listing'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/experts/search')}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: Radius.searchBar, paddingHorizontal: 16, height: 50, ...Shadow.searchBar }}
          >
            <Search size={18} color={Colors.textPlaceholder} style={{ marginRight: 10 }} />
            <Text style={{ flex: 1, fontSize: 13, color: Colors.textPlaceholder }} className="font-sans">
              {params.query || (role === 'hirer' ? 'Search talent by skills, role...' : 'Search for experts')}
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push({ pathname: '/experts/filter', params })}
              style={{ width: 32, height: 32, justifyContent: 'center', alignItems: 'center' }}
            >
              <SlidersHorizontal size={18} color={Colors.primary} />
              {filterCount > 0 && (
                <View style={{ position: 'absolute', top: -2, right: -2, backgroundColor: Colors.primary, borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 }}>
                  <Text style={{ color: Colors.white, fontSize: 10, fontWeight: 'bold' }}>{filterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        {filterCount > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {params.query && <View style={{ backgroundColor: Colors.primaryChip, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full }}><Text style={{ fontSize: 12, color: Colors.primary, fontWeight: '500' }}>Search: {params.query}</Text></View>}
            {params.skills && <View style={{ backgroundColor: Colors.primaryChip, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full }}><Text style={{ fontSize: 12, color: Colors.primary, fontWeight: '500' }}>Skills ({params.skills.split(',').length})</Text></View>}
            {params.country && <View style={{ backgroundColor: Colors.primaryChip, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full }}><Text style={{ fontSize: 12, color: Colors.primary, fontWeight: '500' }}>Country ({params.country.split(',').length})</Text></View>}
            <TouchableOpacity onPress={() => router.replace('/career')} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ fontSize: 12, color: Colors.error, fontWeight: '600' }}>Clear All</Text>
            </TouchableOpacity>
          </View>
        )}

        {role === 'hirer' ? (
          isLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 40 }} />
          ) : liveCandidates.length > 0 ? (
            liveCandidates.map(seeker => (
              <ExpertCard
                key={seeker.id}
                expert={{
                  id: seeker.id,
                  name: seeker.name || 'Anonymous Seeker', // Fallback
                  profession: seeker.profession || '',
                  image: 'https://cdn-icons-png.flaticon.com/512/149/149071.png', // Fallback avatar
                  verified: seeker.verified || false,
                  email: '',
                  phone: '',
                  website: '',
                  city: seeker.city || '',
                  education: [{ institution: seeker.university || 'University of Ghana', degree: 'Bachelor', duration: '2020 - 2024' }],
                  bio: seeker.bio || seeker.professionalSummary || 'Active seeker looking for opportunities.',
                  professionalSummary: seeker.bio || seeker.professionalSummary || '',
                  rating: seeker.rating || 5,
                  country: seeker.country || 'Ghana',
                  location: seeker.country || '',
                  experienceLevel: seeker.experienceLevel || 'Entry Level',
                  technicalSkills: typeof seeker.technicalSkills === 'string' ? JSON.parse(seeker.technicalSkills || '[]') : (seeker.technicalSkills || []),
                  softSkills: [],
                  workExperience: [],
                  projects: [],
                  certifications: [],
                  tools: []
                }}
                onPress={() => {
                   // Open candidate profile modal/page
                   router.push(`/experts/${seeker.id}`);
                }}
              />
            ))
          ) : (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ fontSize: 14, color: Colors.textMuted }} className="font-sans">No candidates found matching your criteria.</Text>
            </View>
          )
        ) : (
          filteredExperts.length > 0 ? (
            filteredExperts.map(expert => (
              <ExpertCard key={expert.id} expert={expert} onPress={() => router.push(`/experts/${expert.id}`)} />
            ))
          ) : (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ fontSize: 14, color: Colors.textMuted }} className="font-sans">No experts match your filters.</Text>
            </View>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
