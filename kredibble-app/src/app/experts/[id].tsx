import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Modal, Clipboard, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Star, Check, Copy, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, FontSize, FontWeight, Radius } from '../../constants/design';
import { mockExperts } from '../../constants/mockExperts';
import { authStore } from '../../constants/authStore';

export default function ExpertProfileDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Fetch expert by ID
  const expert = mockExperts.find(e => e.id === id);

  // States for rating modal and toast banner
  const [isRateModalVisible, setIsRateModalVisible] = useState(false);
  const [selectedStars, setSelectedStars] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<'email' | 'phone' | null>(null);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [role, setRole] = useState(authStore.role);

  useEffect(() => {
    // State is initialised from authStore; the subscription keeps it in sync.
    const unsubscribe = authStore.subscribe(() => {
      setRole(authStore.role);
    });
    return unsubscribe;
  }, []);

  // Auto-hide toast banner
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  // Auto-hide copy feedback
  useEffect(() => {
    if (copyFeedback) {
      const timer = setTimeout(() => {
        setCopyFeedback(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copyFeedback]);

  if (!expert) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen, justifyContent: 'center', alignItems: 'center' }}>
        <AlertCircle size={32} color={Colors.error} />
        <Text style={{ marginTop: 12, fontSize: 15, color: Colors.textMuted }} className="font-sans">
          Expert not found
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: Colors.primary, fontWeight: '600' }} className="font-sans">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const handleCopy = (text: string, type: 'email' | 'phone') => {
    Clipboard.setString(text);
    setCopyFeedback(type);
    Alert.alert('Copied', `${type === 'email' ? 'Email' : 'Phone number'} copied to clipboard!`);
  };

  const handleRatingSubmit = () => {
    setIsRateModalVisible(false);
    setShowToast(true);
  };

  // Render stars inside rating modal
  const renderInteractiveStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity key={i} onPress={() => setSelectedStars(i)} style={{ marginHorizontal: 6 }}>
          <Star
            size={32}
            color={i <= selectedStars ? '#F6B612' : '#C4C4C4'}
            fill={i <= selectedStars ? '#F6B612' : 'transparent'}
          />
        </TouchableOpacity>
      );
    }
    return <View style={{ flexDirection: 'row', justifyContent: 'center', marginVertical: 20 }}>{stars}</View>;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen }} edges={['top', 'left', 'right']}>
      {/* Toast Feedback Banner */}
      {showToast && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText} className="font-sans">
            Thank you for your feedback!
          </Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.circleHeaderButton}
        >
          <ChevronLeft size={20} color={Colors.textHeading} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setIsRateModalVisible(true)}
          style={styles.rateButton}
        >
          <Text style={styles.rateButtonText} className="font-sans">
            Rate
          </Text>
          <Star size={14} color="#F6B612" fill="#F6B612" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, role === 'hirer' && { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card Header Info */}
        <View style={styles.profileHeaderContainer}>
          <Image
            source={{ uri: expert.image }}
            style={styles.avatarImage}
          />

          {expert.verified && (
            <View style={styles.verifiedBadge}>
              <View style={styles.verifiedCheckWrapper}>
                <Check size={8} color="#FFFFFF" strokeWidth={3} />
              </View>
              <Text style={styles.verifiedText} className="font-sans">
                Verified Expert
              </Text>
            </View>
          )}

          <Text style={styles.expertName} className="font-sans">
            {expert.name}
          </Text>
          
          <Text style={styles.expertProfession} className="font-sans">
            {expert.profession}
          </Text>

          <TouchableOpacity onPress={() => {}} style={{ marginTop: 4 }}>
            <Text style={styles.websiteLink} className="font-sans">
              {expert.website}
            </Text>
          </TouchableOpacity>

          <Text style={styles.expertLocation} className="font-sans">
            {expert.location}
          </Text>
        </View>

        {/* Statistics container */}
        <View style={styles.statsCard}>
          {/* Email Col */}
          <TouchableOpacity 
            onPress={() => handleCopy(expert.email, 'email')} 
            style={styles.statsCol}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.statsLabel} className="font-sans">Email</Text>
              <Copy size={11} color={copyFeedback === 'email' ? '#16A34A' : Colors.textPlaceholder} />
            </View>
            <Text numberOfLines={1} style={styles.statsValue} className="font-sans">
              {copyFeedback === 'email' ? 'Copied!' : expert.email}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.statsDivider} />

          {/* Rating Col */}
          <View style={styles.statsCol}>
            <Text style={styles.statsLabel} className="font-sans">Rating</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 2 }}>
              <Text style={styles.ratingNumber} className="font-sans">
                {expert.rating.toFixed(1)}
              </Text>
              <Star size={10} color="#F6B612" fill="#F6B612" />
            </View>
          </View>

          {/* Divider */}
          <View style={styles.statsDivider} />

          {/* Phone Number Col */}
          <TouchableOpacity 
            onPress={() => handleCopy(expert.phone, 'phone')} 
            style={styles.statsCol}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.statsLabel} className="font-sans">Phone</Text>
              <Copy size={11} color={copyFeedback === 'phone' ? '#16A34A' : Colors.textPlaceholder} />
            </View>
            <Text numberOfLines={1} style={styles.statsValue} className="font-sans">
              {copyFeedback === 'phone' ? 'Copied!' : expert.phone}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Panel 1: Professional Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} className="font-sans">Professional Summary</Text>
          <Text
            style={styles.bodyText}
            numberOfLines={summaryExpanded ? undefined : 3}
            className="font-sans"
          >
            {expert.professionalSummary}
          </Text>
          <TouchableOpacity
            style={styles.readMoreButton}
            onPress={() => setSummaryExpanded(!summaryExpanded)}
          >
            <Text style={styles.readMoreText} className="font-sans">
              {summaryExpanded ? 'Read less' : 'Read more'}
            </Text>
            {summaryExpanded ? <ChevronUp size={14} color={Colors.primary} /> : <ChevronDown size={14} color={Colors.primary} />}
          </TouchableOpacity>
        </View>

        {/* Panel 2: Skills & Tools */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} className="font-sans">Skills & Tools</Text>
          
          <Text style={styles.subSectionTitle} className="font-sans">Technical Skills</Text>
          <View style={styles.pillContainer}>
            {expert.technicalSkills.map(skill => (
              <View key={skill} style={styles.pillBadge}>
                <Text style={styles.pillText} className="font-sans">{skill}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.subSectionTitle, { marginTop: 16 }]} className="font-sans">Soft Skills</Text>
          <View style={styles.pillContainer}>
            {expert.softSkills.map(skill => (
              <View key={skill} style={styles.pillBadge}>
                <Text style={styles.pillText} className="font-sans">{skill}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.subSectionTitle, { marginTop: 16 }]} className="font-sans">Tools & Technologies</Text>
          <View style={styles.pillContainer}>
            {expert.tools.map(tool => (
              <View key={tool} style={styles.pillBadge}>
                <Text style={styles.pillText} className="font-sans">{tool}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Panel 3: Work Experience */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} className="font-sans">Work Experience</Text>
          {expert.workExperience.map((exp, idx) => (
            <View key={idx} style={{ marginBottom: idx === expert.workExperience.length - 1 ? 0 : 20 }}>
              <Text style={styles.experienceTitle} className="font-sans">
                {exp.role}
              </Text>
              <Text style={styles.experienceSub} className="font-sans">
                {exp.company} • {exp.location}
              </Text>
              <Text style={styles.experienceDuration} className="font-sans">
                {exp.duration}
              </Text>
              <View style={{ marginTop: 8 }}>
                {exp.bullets.map((bullet, bulletIdx) => (
                  <View key={bulletIdx} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText} className="font-sans">
                      {bullet}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Panel 4: Education & Certifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} className="font-sans">Education & Certifications</Text>
          
          <Text style={styles.subSectionTitle} className="font-sans">Education</Text>
          {expert.education.map((edu, idx) => (
            <View key={idx} style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: FontWeight.semibold, color: Colors.textHeading }} className="font-sans">
                {edu.degree}
              </Text>
              <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 2 }} className="font-sans">
                {edu.institution} • {edu.duration}
              </Text>
            </View>
          ))}

          {expert.certifications && expert.certifications.length > 0 && (
            <>
              <Text style={[styles.subSectionTitle, { marginTop: 16 }]} className="font-sans">Certifications</Text>
              {expert.certifications.map((cert, idx) => (
                <View key={idx} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText} className="font-sans">
                    {cert}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Panel 5: Projects */}
        <View style={[styles.section, { borderBottomWidth: 0 }]}>
          <Text style={styles.sectionTitle} className="font-sans">Projects</Text>
          {expert.projects.map((proj, idx) => (
            <View key={idx} style={{ marginBottom: idx === expert.projects.length - 1 ? 0 : 16 }}>
              <Text style={{ fontSize: 13, fontWeight: FontWeight.semibold, color: Colors.textHeading, marginBottom: 6 }} className="font-sans">
                {proj.name}
              </Text>
              {proj.bullets.map((bullet, bulletIdx) => (
                <View key={bulletIdx} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText} className="font-sans">
                    {bullet}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      {role === 'hirer' && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.connectButton}
            onPress={() => Alert.alert('Success', `Downloading CV/Resume for ${expert.name}...`)}
          >
            <Text style={styles.connectButtonText} className="font-sans">
              Download Resume
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Rating Modal */}
      <Modal
        visible={isRateModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsRateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle} className="font-sans">
              How would you rate this professional?
            </Text>
            <Text style={styles.modalSubtitle} className="font-sans">
              Your feedback will help us evaluate this professional.
            </Text>

            {renderInteractiveStars()}

            <View style={{ flexDirection: 'row', gap: 12, width: '100%', marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => setIsRateModalVisible(false)}
                style={[styles.modalButton, { backgroundColor: Colors.white, borderWidth: 1.5, borderColor: '#F6B612' }]}
              >
                <Text style={[styles.modalButtonText, { color: '#F6B612' }]} className="font-sans">Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={handleRatingSubmit}
                style={[styles.modalButton, { backgroundColor: '#F6B612', flex: 2 }]}
              >
                <Text style={[styles.modalButtonText, { color: Colors.white, fontWeight: '600' }]} className="font-sans">Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
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
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 19,
  },
  rateButtonText: {
    fontSize: 13,
    color: '#F6B612',
    fontWeight: FontWeight.semibold,
  },
  toastContainer: {
    position: 'absolute',
    top: 24,
    left: 20,
    right: 20,
    backgroundColor: '#F6B612',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  profileHeaderContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.bgAlt,
    marginBottom: 12,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginBottom: 10,
  },
  verifiedCheckWrapper: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  verifiedText: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '600',
  },
  expertName: {
    fontSize: 18,
    fontWeight: FontWeight.bold,
    color: Colors.textHeading,
    textAlign: 'center',
    marginBottom: 4,
  },
  expertProfession: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  websiteLink: {
    fontSize: 13,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  expertLocation: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
    paddingVertical: 16,
  },
  statsCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  statsLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  statsValue: {
    fontSize: 12,
    fontWeight: FontWeight.medium,
    color: Colors.textHeading,
    marginTop: 4,
  },
  ratingNumber: {
    fontSize: 13,
    fontWeight: FontWeight.semibold,
    color: Colors.textHeading,
    marginRight: 2,
  },
  statsDivider: {
    width: 1,
    backgroundColor: Colors.borderDefault,
  },
  section: {
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDefault,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: FontWeight.semibold,
    color: Colors.textHeading,
    marginBottom: 12,
  },
  subSectionTitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 8,
    fontWeight: FontWeight.medium,
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
  pillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  pillBadge: {
    backgroundColor: Colors.bgAlt,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pillText: {
    fontSize: 12,
    color: Colors.textBody,
  },
  experienceTitle: {
    fontSize: 13,
    fontWeight: FontWeight.semibold,
    color: Colors.textHeading,
  },
  experienceSub: {
    fontSize: 12,
    color: Colors.textBody,
    marginTop: 2,
  },
  experienceDuration: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  bulletDot: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginRight: 6,
    lineHeight: 18,
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
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  connectButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textHeading,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 15,
  },
});
