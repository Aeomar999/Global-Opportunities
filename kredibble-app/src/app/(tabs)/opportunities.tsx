import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bookmark, Sparkles, Plus, X, ChevronLeft, MapPin, Briefcase, Award, Calendar, FileText, Download, Users } from 'lucide-react-native';
import Svg, { G, Rect, Defs, ClipPath, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import { useRouter, useLocalSearchParams, useNavigation, useFocusEffect } from 'expo-router';
import { authStore, PostedOpportunity, Applicant } from '../../constants/authStore';
import { getOpportunities } from '../../lib/api';

// ─── Logo ─────────────────────────────────────────────────────────────────────

const LogoSVG = () => (
  <Image 
    source={require('../../../assets/images/logo.png')} 
    style={{ width: 40, height: 40, borderRadius: 20 }} 
    resizeMode="contain" 
  />
);

// ─── Category cards ───────────────────────────────────────────────────────────

const CATEGORIES = [
  { title: 'Events',      count: 55, image: require('../../../assets/images/opp_events.png') },
  { title: 'Jobs',        count: 35, image: require('../../../assets/images/opp_jobs.png') },
  { title: 'Internships', count: 20, image: require('../../../assets/images/opp_internships.png') },
  { title: 'Grants',      count: 55, image: require('../../../assets/images/opp_grants.png') },
];

const CategoryCard = ({ title, count, image, onPress }: { title: string; count: number; image: any; onPress?: () => void }) => (
  <TouchableOpacity
    activeOpacity={0.85}
    onPress={onPress}
    style={{
      flex: 1,
      height: 121.7,
      borderRadius: 16,
      overflow: 'hidden',
    }}
  >
    <Image
      source={image}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
      }}
      resizeMode="cover"
    />

    <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
      <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '500' }} className="font-sans">
        {title}
      </Text>

      <Text
        style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' }}
        className="font-sans"
      >
        {count}
      </Text>
    </View>
  </TouchableOpacity>
);

// ─── Job cards ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#F87171', '#60A5FA', '#34D399'];

const AvatarStack = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    {AVATAR_COLORS.map((color, i) => (
      <View
        key={i}
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: color,
          borderWidth: 2,
          borderColor: '#F7F7F9',
          marginLeft: i === 0 ? 0 : -8,
          zIndex: AVATAR_COLORS.length - i,
        }}
      />
    ))}
  </View>
);

const JOBS = [
  {
    id: '2',
    title: 'Junior Product designer',
    location: 'Ghana (Remote)',
    company: 'Pinterest',
    logoColor: '#E60023',
    initial: 'P',
    description:
      'A curious and detail-oriented Junior Product Designer with strong visual design skills, user-centered...',
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
    description:
      'A curious and detail-oriented Junior Product Designer with strong visual design skills, user-centered...',
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
    description:
      'A curious and detail-oriented Junior Product Designer with strong visual design skills, user-centered...',
    applied: '100+ applied',
    match: '92% Match',
  },
];

type Job = (typeof JOBS)[number];

const JobCard = ({ job, onPress }: { job: Job; onPress: () => void }) => (
  <TouchableOpacity
    activeOpacity={0.8}
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
    {/* Logo + title + bookmark */}
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <View
        style={{
          width: 37,
          height: 37,
          borderRadius: 12,
          backgroundColor: job.logoColor,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 8,
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' }}>{job.initial}</Text>
      </View>

      <View style={{ flex: 1, marginRight: 8 }}>
        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '500', color: '#1A1A1A' }} className="font-sans">
          {job.title}
          <Text style={{ color: '#8A8D9F' }}> · {job.location}</Text>
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '500', color: '#8A8D9F', marginTop: 2 }} className="font-sans">
          {job.company}
        </Text>
      </View>

      <TouchableOpacity
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          borderWidth: 1,
          borderColor: '#E5E6F2',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Bookmark size={16} color="#8A8D9F" />
      </TouchableOpacity>
    </View>

    {/* Description */}
    <Text
      style={{ fontSize: 13, color: '#8A8D9F', marginTop: 10, lineHeight: 18 }}
      numberOfLines={2}
      className="font-sans"
    >
      {job.description}
    </Text>

    {/* Divider */}
    <View style={{ height: 1, backgroundColor: '#E5E6F2', marginTop: 10 }} />

    {/* Avatars + match badge */}
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <AvatarStack />
        <Text style={{ fontSize: 10, color: '#8A8D9F' }} className="font-sans">
          {job.applied}
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: '#DCFCE7',
          borderRadius: 9999,
          paddingHorizontal: 12,
          paddingVertical: 5,
        }}
      >
        <Sparkles size={13} color="#16A34A" />
        <Text style={{ fontSize: 10, color: '#16A34A', fontWeight: '500' }} className="font-sans">
          {job.match}
        </Text>
      </View>
    </View>
  </TouchableOpacity>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OpportunitiesScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const viewMode = params.view;
  const [role, setRole] = useState(authStore.role);
  const [opps, setOpps] = useState(authStore.opportunities);
  const [recruiterActiveTab, setRecruiterActiveTab] = useState<'Jobs' | 'Internships' | 'Grants' | 'Events'>('Jobs');

  useEffect(() => {
    setRole(authStore.role);
    setOpps([...authStore.opportunities]);

    const unsubscribe = authStore.subscribe(() => {
      setRole(authStore.role);
      setOpps([...authStore.opportunities]);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (role === 'hirer') {
        const fetchOpps = async () => {
          try {
            const data = await getOpportunities();
            const { getApplicants } = require('../../lib/api');
            const oppsWithApplicants = await Promise.all(
              data.map(async (opp: any) => {
                try {
                  const applicants = await getApplicants(opp.id);
                  return { ...opp, applicants, applicantsCount: applicants.length || opp.applicantsCount || 0 };
                } catch (e) {
                  return { ...opp, applicants: [], applicantsCount: 0 };
                }
              })
            );
            authStore.setOpportunities(oppsWithApplicants);
          } catch (e) {
            console.error(e);
          }
        };
        fetchOpps();
      }
    }, [role])
  );

  const handleStatusChange = (oppId: string, applicantId: string, status: Applicant['status']) => {
    authStore.updateApplicantStatus(oppId, applicantId, status);
  };
  if (role === 'hirer') {
    if (viewMode !== 'all') {
      const filteredOpps = opps.filter((opp) => opp.type.toLowerCase() === recruiterActiveTab.toLowerCase());

      // ─── ACTIVE LISTINGS FEED ─────────────────────────────────────────
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F9' }} edges={['top', 'left', 'right']}>
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingTop: 8,
              paddingBottom: 12,
            }}
          >
            <View style={{ width: 60, alignItems: 'flex-start' }}>
              <LogoSVG />
            </View>
            <Text
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 17,
                fontWeight: '600',
                color: '#1A1A1A',
              }}
              className="font-sans"
            >
              Active Posts
            </Text>
            <View style={{ width: 60, alignItems: 'flex-end' }}>
              <TouchableOpacity
                onPress={() => router.push('/opportunities/create')}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#6671E4', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4 }}
              >
                <Plus size={14} color="#FFFFFF" />
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#FFFFFF' }} className="font-sans">Post</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            {/* Category Tabs Selector */}
            <View style={{ 
              backgroundColor: '#FFFFFF', 
              borderRadius: 14, 
              padding: 4, 
              flexDirection: 'row', 
              justifyContent: 'space-between', 
              marginBottom: 20,
              borderWidth: 1,
              borderColor: '#E5E6F2'
            }}>
              {(['Jobs', 'Internships', 'Grants', 'Events'] as const).map((tab) => {
                const isActive = recruiterActiveTab === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setRecruiterActiveTab(tab)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      alignItems: 'center',
                      borderRadius: 10,
                      backgroundColor: isActive ? '#6671E4' : 'transparent',
                    }}
                  >
                    <Text style={{ 
                      fontSize: 13, 
                      fontWeight: isActive ? '600' : '500', 
                      color: isActive ? '#FFFFFF' : '#8A8D9F' 
                    }} className="font-sans">
                      {tab}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {filteredOpps.length === 0 ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}>
                <Briefcase size={64} color="#A1A1AA" style={{ marginBottom: 16 }} />
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1A1A1A' }} className="font-sans">No Listings Yet</Text>
                <Text style={{ fontSize: 12, color: '#8A8D9F', marginTop: 4, textAlign: 'center' }} className="font-sans">
                  Click the &quot;+ Post&quot; button above to publish your first {recruiterActiveTab.toLowerCase()}.
                </Text>
              </View>
            ) : (
              <View>
                {filteredOpps.map((opp) => (
                  <TouchableOpacity
                    key={opp.id}
                    onPress={() => router.push({ pathname: '/opportunities/[id]', params: { id: opp.id } })}
                    activeOpacity={0.85}
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
                    {/* Event Banner (only for events with a banner) */}
                    {opp.type === 'events' && opp.eventBannerUri && (
                      <Image
                        source={{ uri: opp.eventBannerUri }}
                        style={{
                          width: '100%',
                          height: 110,
                          borderRadius: 10,
                          marginBottom: 12,
                          backgroundColor: '#EEF2FF',
                        }}
                        resizeMode="cover"
                      />
                    )}
                    {/* Top Row: Logo, Title/Location, Type Badge */}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      {opp.type === 'grants' && opp.grantLogoUri ? (
                        <Image
                          source={{ uri: opp.grantLogoUri }}
                          style={{
                            width: 37, height: 37, borderRadius: 18,
                            marginRight: 8,
                            backgroundColor: '#EEF2FF',
                          }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={{
                          width: 37, height: 37, borderRadius: 12,
                          backgroundColor: opp.logoColor,
                          justifyContent: 'center', alignItems: 'center',
                          marginRight: 8,
                        }}>
                          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>{opp.initial}</Text>
                        </View>
                      )}

                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '500', color: '#1A1A1A' }} className="font-sans">
                          {opp.title}
                          <Text style={{ color: '#8A8D9F', fontWeight: '400' }}> · {opp.location}</Text>
                        </Text>
                        <Text style={{ fontSize: 13, fontWeight: '400', color: '#8A8D9F', marginTop: 2 }} className="font-sans">
                          {authStore.company?.name || 'Company'}
                        </Text>
                      </View>

                      <View style={{ backgroundColor: '#EEF2FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Text style={{ fontSize: 11, color: '#6671E4', fontWeight: '600', textTransform: 'capitalize' }} className="font-sans">{opp.type}</Text>
                      </View>
                    </View>

                    {/* Description */}
                    <Text
                      style={{ fontSize: 13, fontWeight: '400', color: '#8A8D9F', marginTop: 10, lineHeight: 18 }}
                      numberOfLines={2}
                      className="font-sans"
                    >
                      {opp.description}
                    </Text>

                    {/* Divider */}
                    <View style={{ height: 1, backgroundColor: '#E5E6F2', marginTop: 10 }} />

                    {/* Footer */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {['#F87171', '#60A5FA', '#34D399'].map((color, i) => (
                            <View
                              key={i}
                              style={{
                                width: 24, height: 24, borderRadius: 12,
                                backgroundColor: color,
                                borderWidth: 2, borderColor: '#F7F7F9',
                                marginLeft: i === 0 ? 0 : -8,
                                zIndex: 3 - i,
                              }}
                            />
                          ))}
                        </View>
                        <Text style={{ fontSize: 12, color: '#8A8D9F' }} className="font-sans">
                          {opp.applicants.length > 0 ? `${opp.applicants.length} applied` : '0 applied'}
                        </Text>
                      </View>

                      <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                        backgroundColor: '#EEF2FF', borderRadius: 9999,
                        paddingHorizontal: 12, paddingVertical: 5,
                      }}>
                        <Text style={{ fontSize: 12, color: '#6671E4', fontWeight: '500' }} className="font-sans">
                          Review Applicants →
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>


        </SafeAreaView>
      );
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F9' }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 12,
        }}
      >
        <View style={{ width: 60, alignItems: 'flex-start' }}>
          <LogoSVG />
        </View>
        <Text
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 17,
            fontWeight: '600',
            color: '#1A1A1A',
          }}
          className="font-sans"
        >
          Opportunities listing
        </Text>
        <View style={{ width: 60, alignItems: 'flex-end' }}>
          {role === 'hirer' ? (
            <TouchableOpacity
              onPress={() => router.push('/opportunities/create')}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#6671E4', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4 }}
            >
              <Plus size={14} color="#FFFFFF" />
              <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#FFFFFF' }} className="font-sans">Post</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 24 }} />
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Category grid */}
        <View style={{ flexDirection: 'row', gap: 20, marginBottom: 20 }}>
          <CategoryCard {...CATEGORIES[0]} onPress={() => router.push('/events' as any)} />
          <CategoryCard {...CATEGORIES[1]} onPress={() => router.push('/jobs' as any)} />
        </View>
        <View style={{ flexDirection: 'row', gap: 20, marginBottom: 24 }}>
          <CategoryCard {...CATEGORIES[2]} onPress={() => router.push('/internships' as any)} />
          <CategoryCard {...CATEGORIES[3]} onPress={() => router.push('/grants' as any)} />
        </View>

        {/* Recommended header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '500', color: '#1A1A1A', opacity: 0.6 }} className="font-sans">
            Recommended
          </Text>
          <TouchableOpacity onPress={() => router.push('/recommended' as any)}>
            <Text style={{ fontSize: 12, color: '#6671E4', fontWeight: '600' }} className="font-sans">
              See All
            </Text>
          </TouchableOpacity>
        </View>

        {/* Job listings */}
        {JOBS.map(job => (
          <JobCard
            key={job.id}
            job={job}
            onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: job.id } })}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
