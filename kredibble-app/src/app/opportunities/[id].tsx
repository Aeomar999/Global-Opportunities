import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Sparkles, Check, FileText } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { authStore, PostedOpportunity, Applicant } from '../../constants/authStore';
import { deleteOpportunity, updateApplicantStatus as apiUpdateApplicantStatus } from '../../lib/api';
import { useToast } from '../../components/ui/ToastProvider';
import { mockExperts } from '../../constants/mockExperts';

const VerifiedBadge = () => (
  <View style={{
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center'
  }}>
    <Check size={10} color="#FFFFFF" strokeWidth={4} />
  </View>
);

const findOpportunity = (id: string | undefined): PostedOpportunity | null => {
  const found = authStore.opportunities.find(o => o.id === id);
  return found ? { ...found } : null;
};

export default function OpportunityDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [opp, setOpp] = useState<PostedOpportunity | null>(() => findOpportunity(id));
  const [oppId, setOppId] = useState(id);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  // Same screen, new route param: re-read the listing during render instead of in an effect.
  if (oppId !== id) {
    setOppId(id);
    setOpp(findOpportunity(id));
  }

  useEffect(() => {
    const unsubscribe = authStore.subscribe(() => {
      const updatedFound = authStore.opportunities.find(o => o.id === id);
      if (updatedFound) {
        setOpp({ ...updatedFound });
      }
    });

    return unsubscribe;
  }, [id]);

  const { showToast } = useToast();

  const handleStatusChange = async (applicantId: string, status: Applicant['status']) => {
    if (!opp) return;
    try {
      await apiUpdateApplicantStatus(applicantId, status);
      // Fallback: update local store so UI instantly reflects
      authStore.updateApplicantStatus(opp.id, applicantId, status);
      showToast(`Applicant status changed to ${status}`, 'success');
    } catch {
      showToast('Failed to update status', 'info');
    }
  };

  const handleDelete = () => {
    if (!opp) return;

    const performDelete = async () => {
      try {
        await deleteOpportunity(opp.id);
        authStore.deleteOpportunity(opp.id);
        showToast('Opportunity deleted successfully', 'info');
        router.back();
      } catch {
        showToast('Failed to delete opportunity', 'info');
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to delete this listing permanently? This cannot be undone.');
      if (confirmed) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Delete Listing',
        'Are you sure you want to delete this listing permanently? This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: performDelete
          }
        ]
      );
    }
  };

  if (!opp) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F9', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 16, color: '#8A8D9F' }} className="font-sans">Loading Opportunity details...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F9' }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 16,
        backgroundColor: 'transparent',
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: '#FFFFFF',
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#E5E6F2',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 6,
            elevation: 1,
          }}
        >
          <ChevronLeft size={20} color="#8A8D9F" />
        </TouchableOpacity>
        
        <View style={{ flex: 1, marginRight: 40 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', textAlign: 'center' }} className="font-sans">{opp.title}</Text>
          <Text style={{ fontSize: 12, color: '#8A8D9F', textAlign: 'center', marginTop: 4 }} className="font-sans">{opp.location}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* Opportunity Brief Card */}
        <View style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          padding: 20,
          marginBottom: 20,
          borderWidth: 1,
          borderColor: '#F0F0F3',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.03,
          shadowRadius: 10,
          elevation: 2,
        }}>
          {/* Title Row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1A1A1A', textTransform: 'capitalize' }} className="font-sans">
              {opp.type === 'jobs' ? 'Jobs details' : `${opp.type} details`}
            </Text>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <TouchableOpacity onPress={() => router.push({ pathname: '/opportunities/create', params: { editId: opp.id } })}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#6671E4' }} className="font-sans">Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#EF4444' }} className="font-sans">Delete</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Description */}
          <Text style={{ fontSize: 13, color: '#5E6175', lineHeight: 18 }} className="font-sans">
            {isDescriptionExpanded ? opp.description : `${opp.description.slice(0, 150)}...`}
            {!isDescriptionExpanded && opp.description.length > 150 && (
              <Text onPress={() => setIsDescriptionExpanded(true)} style={{ color: '#6671E4', fontWeight: '500' }}>
                See More
              </Text>
            )}
          </Text>

          {(opp.type === 'jobs' || opp.type === 'internships') && (opp.workType || opp.salary || opp.experienceLevels || opp.organizationType) && (
            <>
              <View style={{ height: 1, backgroundColor: '#F0F0F2', marginVertical: 16 }} />
              <View style={{ gap: 12 }}>
                {opp.organizationType && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#8A8D9F' }} className="font-sans">Organization Type</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A1A' }} className="font-sans">{opp.organizationType}</Text>
                  </View>
                )}
                {opp.workType && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#8A8D9F' }} className="font-sans">Work Type</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A1A' }} className="font-sans">{opp.workType}</Text>
                  </View>
                )}
                {opp.salary && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#8A8D9F' }} className="font-sans">Salary</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A1A' }} className="font-sans">{opp.salary}</Text>
                  </View>
                )}
                {opp.experienceLevels && opp.experienceLevels.length > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: '#8A8D9F' }} className="font-sans">Experience Level</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {opp.experienceLevels.map((lvl) => (
                        <View key={lvl} style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                          <Text style={{ fontSize: 11, color: '#6671E4', fontWeight: '600' }} className="font-sans">{lvl}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </>
          )}

          {opp.type === 'grants' && (opp.grantLogoUri || opp.grantSector || opp.grantApplicantType || opp.grantFundingAgency || opp.grantCountry || opp.grantPurpose || opp.grantAppMethod || opp.grantBudgetRange) && (
            <>
              <View style={{ height: 1, backgroundColor: '#F0F0F2', marginVertical: 16 }} />
              {/* Grant Logo */}
              {opp.grantLogoUri && (
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  <Image
                    source={{ uri: opp.grantLogoUri }}
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 36,
                      backgroundColor: '#EEF2FF',
                      borderWidth: 2,
                      borderColor: '#E5E6F2',
                    }}
                    resizeMode="cover"
                  />
                  <Text style={{ fontSize: 11, color: '#8A8D9F', marginTop: 6 }} className="font-sans">
                    Organisation Logo
                  </Text>
                </View>
              )}
              <View style={{ gap: 12 }}>
                {opp.grantSector && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#8A8D9F' }} className="font-sans">Sector</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A1A' }} className="font-sans">{opp.grantSector}</Text>
                  </View>
                )}
                {opp.grantApplicantType && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#8A8D9F' }} className="font-sans">Eligible Applicant Types</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A1A' }} className="font-sans">{opp.grantApplicantType}</Text>
                  </View>
                )}
                {opp.grantFundingAgency && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#8A8D9F' }} className="font-sans">Funding Agency</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A1A' }} className="font-sans">{opp.grantFundingAgency}</Text>
                  </View>
                )}
                {opp.grantCountry && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#8A8D9F' }} className="font-sans">Eligible Country</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A1A' }} className="font-sans">{opp.grantCountry}</Text>
                  </View>
                )}
                {opp.grantPurpose && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#8A8D9F' }} className="font-sans">Grant Purpose</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A1A' }} className="font-sans">{opp.grantPurpose}</Text>
                  </View>
                )}
                {opp.grantAppMethod && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#8A8D9F' }} className="font-sans">Application Method</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A1A' }} className="font-sans">{opp.grantAppMethod}</Text>
                  </View>
                )}
                {opp.grantBudgetRange && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#8A8D9F' }} className="font-sans">Budget Range</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A1A' }} className="font-sans">{opp.grantBudgetRange}</Text>
                  </View>
                )}
              </View>
            </>
          )}

          {opp.type === 'events' && (opp.eventBannerUri || opp.eventDateTime || opp.eventRegion || opp.eventCategory || opp.eventTicketType || opp.eventStyle) && (
            <>
              <View style={{ height: 1, backgroundColor: '#F0F0F2', marginVertical: 16 }} />
              {/* Event Banner */}
              {opp.eventBannerUri && (
                <Image
                  source={{ uri: opp.eventBannerUri }}
                  style={{
                    width: '100%',
                    height: 160,
                    borderRadius: 14,
                    marginBottom: 16,
                    backgroundColor: '#EEF2FF',
                  }}
                  resizeMode="cover"
                />
              )}
              <View style={{ gap: 12 }}>
                {opp.eventDateTime && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#8A8D9F' }} className="font-sans">Date & Time</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A1A' }} className="font-sans">{opp.eventDateTime}</Text>
                  </View>
                )}
                {opp.eventRegion && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#8A8D9F' }} className="font-sans">Region</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A1A' }} className="font-sans">{opp.eventRegion}</Text>
                  </View>
                )}
                {opp.eventCategory && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#8A8D9F' }} className="font-sans">Category</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A1A' }} className="font-sans">{opp.eventCategory}</Text>
                  </View>
                )}
                {opp.eventTicketType && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#8A8D9F' }} className="font-sans">Ticket Type</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A1A' }} className="font-sans">{opp.eventTicketType}</Text>
                  </View>
                )}
                {opp.eventStyle && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: '#8A8D9F' }} className="font-sans">Event Type</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1A1A' }} className="font-sans">{opp.eventStyle}</Text>
                  </View>
                )}
              </View>
            </>
          )}

          <View style={{ height: 1, backgroundColor: '#F0F0F2', marginVertical: 16 }} />

          {/* Footer details */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: '#8A8D9F' }} className="font-sans">Posted on {opp.date.toLowerCase()}</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#1A1A1A' }} className="font-sans">{opp.applicants.length} Applicants</Text>
          </View>
        </View>

        {/* Section Heading */}
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 16 }} className="font-sans">Review candidates</Text>

        {opp.applicants.length === 0 ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
            <FileText size={48} color="#A1A1AA" style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 14, color: '#8A8D9F', textAlign: 'center' }} className="font-sans">No applications received yet for this posting.</Text>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            {opp.applicants.map((applicant) => {
              const candidate = authStore.candidates.find(c => c.name === applicant.name);
              const bio = candidate?.bio || `i am a curious and detail-oriented Junior ${applicant.profession} with strong visual design skills, user-centered...`;
              
              const handleCardPress = () => {
                const expert = mockExperts.find(e => e.name.toLowerCase() === applicant.name.toLowerCase()) || mockExperts[0];
                if (expert) {
                  router.push(`/experts/${expert.id}`);
                }
              };
              
              return (
                <View key={applicant.id} style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 20,
                  padding: 20,
                  borderWidth: 1,
                  borderColor: '#F0F0F3',
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.03,
                  shadowRadius: 10,
                  elevation: 2,
                }}>
                  <TouchableOpacity onPress={handleCardPress} activeOpacity={0.7}>
                    {/* Top info block */}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                      <Image source={{ uri: applicant.image }} style={{ width: 44, height: 44, borderRadius: 10 }} />
                      
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1A1A1A' }} className="font-sans" numberOfLines={1}>
                          {applicant.name}
                          <Text style={{ fontWeight: 'normal', color: '#8C8F9F' }}> · {applicant.profession}</Text>
                        </Text>
                        <Text style={{ fontSize: 13, color: '#8A8D9F', marginTop: 2 }} className="font-sans">{applicant.university}</Text>
                      </View>

                      <VerifiedBadge />
                    </View>

                    {/* Bio */}
                    <Text style={{ fontSize: 12, color: '#7F8295', marginTop: 8, lineHeight: 16 }} className="font-sans">
                      {bio}
                    </Text>
                  </TouchableOpacity>

                  <View style={{ height: 1, backgroundColor: '#F0F0F2', marginVertical: 12 }} />

                  {/* Status pills + Match badge */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {(['Shortlisted', 'Interviewing', 'Offered'] as const).map((st) => {
                        const displayLabel = st === 'Interviewing' ? 'Interview' : st;
                        const isActive = applicant.status === st;
                        return (
                          <TouchableOpacity
                            key={st}
                            onPress={() => handleStatusChange(applicant.id, st)}
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 6,
                              backgroundColor: isActive ? '#6671E4' : '#F3F4F6',
                            }}
                          >
                            <Text style={{
                              fontSize: 11,
                              fontWeight: '500',
                              color: isActive ? '#FFFFFF' : '#8A8D9F'
                            }} className="font-sans">
                              {displayLabel}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      backgroundColor: '#E8FDF0',
                      borderRadius: 8,
                      paddingHorizontal: 8,
                      paddingVertical: 5
                    }}>
                      <Sparkles size={11} color="#16A34A" />
                      <Text style={{ fontSize: 11, color: '#16A34A', fontWeight: 'bold' }} className="font-sans">
                        {applicant.matchScore}% Match
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
