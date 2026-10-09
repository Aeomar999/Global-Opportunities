import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, useWindowDimensions, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Users, TrendingUp, Bell } from 'lucide-react-native';
import Svg, { Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { authStore } from '../../constants/authStore';
import { notificationStore } from '../../constants/mockNotifications';
import { getOpportunities, getApplicants } from '../../lib/api';

// ─── Logo ─────────────────────────────────────────────────────────────────────

const LogoSVG = () => (
  <Image 
    source={require('../../../assets/images/logo.png')} 
    style={{ width: 40, height: 40, borderRadius: 20 }} 
    resizeMode="contain" 
  />
);

// ─── Feature card ─────────────────────────────────────────────────────────────

const CARDS = [
  { title: 'Opportunities\nlisting',       emoji: '📋' },
  { title: 'Expert listing',               emoji: '⭐' },
  { title: 'Community &\nnetworking',      emoji: '🌐' },
  { title: 'Career\nresources\ncenter',    emoji: '📚' },
  { title: 'AI Smart\nassistant',          emoji: '🤖' },
];

const BlurEllipse = ({ position }: { position: 'topLeft' | 'bottomRight' }) => (
  <View
    style={{
      position: 'absolute',
      ...(position === 'topLeft'
        ? { left: -(37.93 / 2), top: -(45.32 / 2) }
        : { right: -(37.93 / 2), bottom: -(45.32 / 2) }),
      width: 37.93,
      height: 45.32,
    }}
  >
    <Svg width="100%" height="100%" viewBox="0 0 37.93 45.32">
      <Defs>
        <RadialGradient
          id="smallGlow"
          cx="50%"
          cy="50%"
          rx="50%"
          ry="50%"
        >
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.4" />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="18.965" cy="22.66" rx="18.965" ry="22.66" fill="url(#smallGlow)" />
    </Svg>
  </View>
);

const FeatureCard = ({ title, emoji, backgroundImage, blurCircle, onPress }: { title: string; emoji?: string; backgroundImage?: any; blurCircle?: boolean; onPress?: () => void }) => (
  <TouchableOpacity
    activeOpacity={0.85}
    onPress={onPress}
    style={{
      flex: 1,
      height: 121.7,
      backgroundColor: backgroundImage ? 'transparent' : '#6671E4',
      borderRadius: 16,
      overflow: 'hidden',
    }}
  >
    {backgroundImage && (
      <Image
        source={backgroundImage}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
        }}
        resizeMode="cover"
      />
    )}
    <View style={{ flex: 1, padding: 16 }}>
      {blurCircle && !backgroundImage && (
        <>
          <BlurEllipse position="topLeft" />
          <BlurEllipse position="bottomRight" />
        </>
      )}
      <Text
        style={{
          color: '#FFFFFF', fontSize: 15, fontWeight: '500',
          lineHeight: 22, width: '80%',
        }}
        className="font-sans"
      >
        {title}
      </Text>
      {emoji && !backgroundImage && (
        <Text
          style={{
            position: 'absolute', bottom: -8, right: -36,
            fontSize: 80, lineHeight: 90,
          }}
        >
          {emoji}
        </Text>
      )}
    </View>
  </TouchableOpacity>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  // 20px padding each side + 20px gap between columns
  const cardWidth = (width - 40 - 20) / 2;

  const [role, setRole] = useState(authStore.role);
  const [company, setCompany] = useState(authStore.company);
  const [opps, setOpps] = useState(authStore.opportunities);
  const [unreadNotifications, setUnreadNotifications] = useState(notificationStore.unreadCount);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (authStore.role === 'seeker') {
          const data = await getOpportunities();
          authStore.setOpportunities(data);
        } else {
          // Hirer needs their opportunities and the applicants for pipeline math
          const data = await getOpportunities();
          
          // Fetch applicants for each opportunity to calculate pipeline stats
          const oppsWithApplicants = await Promise.all(
            data.map(async (opp: any) => {
              try {
                const applicants = await getApplicants(opp.id);
                return { ...opp, applicants, applicantsCount: applicants.length || opp.applicantsCount || 0 };
              } catch {
                return { ...opp, applicants: [], applicantsCount: 0 };
              }
            })
          );
          authStore.setOpportunities(oppsWithApplicants);
        }
      } catch (err) {
        console.error('Failed to fetch home data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // State is initialised from authStore; the subscription keeps it in sync.
    const unsubscribe = authStore.subscribe(() => {
      setRole(authStore.role);
      setCompany(authStore.company ? { ...authStore.company } : null);
      setOpps([...authStore.opportunities]);
    });
    const unsubscribeNotifications = notificationStore.subscribe(() => {
      setUnreadNotifications(notificationStore.unreadCount);
    });
    return () => {
      unsubscribe();
      unsubscribeNotifications();
    };
  }, []);

  if (role === 'hirer') {
    // Calculate totals
    const totalPosts = opps.length;
    const totalApplicants = opps.reduce((acc, o) => acc + o.applicantsCount, 0);
    
    // Calculate stages
    let countApplied = 0;
    let countShortlisted = 0;
    let countInterviewing = 0;
    let countOffered = 0;
    opps.forEach(opp => {
      opp.applicants.forEach(app => {
        if (app.status === 'Applied') countApplied++;
        if (app.status === 'Shortlisted') countShortlisted++;
        if (app.status === 'Interviewing') countInterviewing++;
        if (app.status === 'Offered') countOffered++;
      });
    });

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
          <View style={{ width: 40, alignItems: 'flex-start' }}>
            <LogoSVG />
          </View>
          <Text
            style={{
              fontSize: 17,
              fontWeight: '600',
              color: '#1A1A1A',
            }}
            className="font-sans"
          >
            Home
          </Text>
          <TouchableOpacity
            style={{ width: 40, alignItems: 'flex-end' }}
            onPress={() => router.push('/notifications' as any)}
            activeOpacity={0.7}
          >
            <View>
              <Bell size={24} color="#1A1A1A" />
              {unreadNotifications > 0 && (
                <View
                  style={{
                    position: 'absolute', top: -2, right: -2,
                    width: 9, height: 9, borderRadius: 4.5,
                    backgroundColor: '#ED4C5C', borderWidth: 1.5, borderColor: '#F7F7F9',
                  }}
                />
              )}
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {isLoading && (
            <ActivityIndicator size="small" color="#6671E4" style={{ marginTop: 20 }} />
          )}

          {/* Analytics Section */}
          <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 12, marginTop: 8 }} className="font-sans">
            {company?.name || 'Dashboard'} Analytics
          </Text>

          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
            {/* Card 1 — Active Posts */}
            <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#EBEBEE' }}>
              <TrendingUp size={24} color="#6671E4" />
              <Text style={{ fontSize: 28, fontWeight: '700', color: '#1A1A1A', marginTop: 16 }} className="font-sans">{totalPosts}</Text>
              <Text style={{ fontSize: 13, color: '#8A8D9F', marginTop: 4 }} className="font-sans">Active Posts</Text>
            </View>
            {/* Card 2 — Total Applicants */}
            <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#EBEBEE' }}>
              <Users size={24} color="#6671E4" />
              <Text style={{ fontSize: 28, fontWeight: '700', color: '#1A1A1A', marginTop: 16 }} className="font-sans">{totalApplicants}</Text>
              <Text style={{ fontSize: 13, color: '#8A8D9F', marginTop: 4 }} className="font-sans">Total Applicants</Text>
            </View>
          </View>

          {/* Pipeline Stage Tracker */}
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#EBEBEE' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A1A1A', marginBottom: 16 }} className="font-sans">Applicant Pipeline</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: countApplied > 0 ? '#6671E4' : '#8A8D9F' }} className="font-sans">{countApplied}</Text>
                <Text style={{ fontSize: 11, color: '#8A8D9F', marginTop: 4 }} className="font-sans">Applied</Text>
              </View>
              <View style={{ width: 1, height: 24, backgroundColor: '#EBEBEE' }} />
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: countShortlisted > 0 ? '#6671E4' : '#8A8D9F' }} className="font-sans">{countShortlisted}</Text>
                <Text style={{ fontSize: 11, color: '#8A8D9F', marginTop: 4 }} className="font-sans">Shortlisted</Text>
              </View>
              <View style={{ width: 1, height: 24, backgroundColor: '#EBEBEE' }} />
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: countInterviewing > 0 ? '#6671E4' : '#8A8D9F' }} className="font-sans">{countInterviewing}</Text>
                <Text style={{ fontSize: 11, color: '#8A8D9F', marginTop: 4 }} className="font-sans">Interviews</Text>
              </View>
              <View style={{ width: 1, height: 24, backgroundColor: '#EBEBEE' }} />
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: countOffered > 0 ? '#16A34A' : '#8A8D9F' }} className="font-sans">{countOffered}</Text>
                <Text style={{ fontSize: 11, color: '#8A8D9F', marginTop: 4 }} className="font-sans">Offered</Text>
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 12 }} className="font-sans">Quick Actions</Text>
          
          {/* Feature grid — row 1 */}
          <View style={{ flexDirection: 'row', gap: 20, marginBottom: 20 }}>
            <FeatureCard
              title={CARDS[0].title}
              backgroundImage={require('../../../assets/images/opportunities_listing.png')}
              onPress={() => router.push('/opportunities?view=all')}
            />
            <FeatureCard
              title={CARDS[1].title}
              backgroundImage={require('../../../assets/images/expert_listing.png')}
              onPress={() => router.push('/career')}
            />
          </View>

          {/* Feature grid — row 2 */}
          <View style={{ flexDirection: 'row', gap: 20, marginBottom: 20 }}>
            <FeatureCard
              title={CARDS[2].title}
              backgroundImage={require('../../../assets/images/community_networking.png')}
              onPress={() => router.push('/community')}
            />
            <FeatureCard
              title={CARDS[3].title}
              backgroundImage={require('../../../assets/images/career_resources.png')}
              onPress={() => router.push('/career-resources' as any)}
            />
          </View>

          {/* Feature grid — row 3 (half width) */}
          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: cardWidth, height: 121.7 }}>
              <FeatureCard
                title={CARDS[4].title}
                backgroundImage={require('../../../assets/images/ai_assistant.png')}
                onPress={() => router.push('/assistant' as any)}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F9' }} edges={['top', 'left', 'right']}>

      {/* Header */}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
        }}
      >
        <LogoSVG />
        <Text
          style={{
            flex: 1, textAlign: 'center', fontSize: 17,
            fontWeight: '600', color: '#1A1A1A',
            marginRight: 40,
          }}
          className="font-sans"
        >
          Home
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Search bar */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#FFFFFF', borderRadius: 15,
            paddingHorizontal: 16, height: 50,
            marginBottom: 16,
            shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
          }}
        >
          <Search size={18} color="#A1A1AA" style={{ marginRight: 10 }} />
          <TextInput
            placeholder="Find global opportunities..."
            placeholderTextColor="#A1A1AA"
            style={{ flex: 1, fontSize: 14, color: '#1A1A1A', outline: 'none' } as any}
            className="font-sans"
          />
        </View>

        {/* Ads banner */}
        <View
          style={{
            backgroundColor: '#EBEBEE', borderRadius: 12,
            height: 59, marginBottom: 20,
            justifyContent: 'center', alignItems: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Faint background decoration */}
          <View
            style={{
              position: 'absolute', top: 8, left: 12, right: 12, bottom: 8,
              borderRadius: 8, backgroundColor: '#E0E0E6', opacity: 0.5,
            }}
          />
          <Text style={{ fontSize: 13, color: '#B0B0BC', letterSpacing: 0.5 }} className="font-sans">
            Ads
          </Text>
        </View>

        {/* Feature grid — row 1 */}
        <View style={{ flexDirection: 'row', gap: 20, marginBottom: 20 }}>
          <FeatureCard
            title={CARDS[0].title}
            backgroundImage={require('../../../assets/images/opportunities_listing.png')}
            onPress={() => router.push('/opportunities')}
          />
          <FeatureCard
            title={CARDS[1].title}
            backgroundImage={require('../../../assets/images/expert_listing.png')}
            onPress={() => router.push('/career')}
          />
        </View>

        {/* Feature grid — row 2 */}
        <View style={{ flexDirection: 'row', gap: 20, marginBottom: 20 }}>
          <FeatureCard
            title={CARDS[2].title}
            backgroundImage={require('../../../assets/images/community_networking.png')}
            onPress={() => router.push('/community')}
          />
          <FeatureCard
            title={CARDS[3].title}
            backgroundImage={require('../../../assets/images/career_resources.png')}
            onPress={() => router.push('/career-resources' as any)}
          />
        </View>

        {/* Feature grid — row 3 (half width) */}
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: cardWidth, height: 121.7 }}>
            <FeatureCard
              title={CARDS[4].title}
              backgroundImage={require('../../../assets/images/ai_assistant.png')}
              onPress={() => router.push('/assistant' as any)}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
