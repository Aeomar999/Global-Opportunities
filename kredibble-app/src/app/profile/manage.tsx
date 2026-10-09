import React, { useState, useEffect } from 'react';
import { Colors } from '../../constants/design';
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet, Clipboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Check, Copy, Star } from 'lucide-react-native';
import { profileStore } from '../../constants/mockProfile';

export default function ManageProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState(profileStore.user);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = profileStore.subscribe(() => {
      setUser({ ...profileStore.user });
    });
    return unsubscribe;
  }, []);

  const handleCopy = (text: string, label: string) => {
    Clipboard.setString(text);
    setCopyFeedback(`${label} Copied!`);
    setTimeout(() => {
      setCopyFeedback(null);
    }, 2000);
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    for (let i = 0; i < 5; i++) {
      stars.push(
        <Star 
          key={i} 
          size={12} 
          color={i < fullStars ? '#F6B612' : '#E5E6F2'} 
          fill={i < fullStars ? '#F6B612' : 'transparent'} 
          style={{ marginRight: 2 }}
        />
      );
    }
    return <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>{stars}</View>;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.replace('/(tabs)/profile')}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <ChevronLeft size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} className="font-sans">Manage profile</Text>
        <TouchableOpacity 
          onPress={() => router.push('/profile/edit')}
          style={styles.editButton}
          activeOpacity={0.7}
        >
          <Text style={styles.editButtonText} className="font-sans">Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User Card */}
        <View style={styles.userContainer}>
          <Image source={{ uri: user.image }} style={styles.avatar} />
          
          {user.verified && (
            <View style={styles.verifiedBadge}>
              <Check size={12} color="#16A34A" strokeWidth={3} style={{ marginRight: 4 }} />
              <Text style={styles.verifiedText} className="font-sans">Verified</Text>
            </View>
          )}

          <Text style={styles.userName} className="font-sans">{user.name}</Text>
          <Text style={styles.userProfession} className="font-sans">{user.profession}</Text>
          {user.website && (
            <TouchableOpacity onPress={() => {}} activeOpacity={0.7}>
              <Text style={styles.websiteLink} className="font-sans">{user.website}</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.locationText} className="font-sans">{user.location}</Text>
        </View>

        {/* Copy Feedback Toast */}
        {copyFeedback && (
          <View style={styles.toast}>
            <Text style={styles.toastText} className="font-sans">{copyFeedback}</Text>
          </View>
        )}

        {/* Contact Info Card */}
        <View style={styles.contactCard}>
          {/* Email Column */}
          <View style={styles.contactColumn}>
            <TouchableOpacity 
              style={styles.labelRow} 
              activeOpacity={0.7}
              onPress={() => handleCopy(user.email, 'Email')}
            >
              <Text style={styles.contactLabel} className="font-sans">Email</Text>
              <Copy size={11} color="#8A8D9F" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
            <Text numberOfLines={1} style={styles.contactValue} className="font-sans">{user.email}</Text>
          </View>

          <View style={styles.verticalDivider} />

          {/* Rating Column */}
          <View style={styles.contactColumn}>
            <Text style={styles.contactLabel} className="font-sans">Rating</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.contactValue} className="font-sans">{user.rating.toFixed(1)} </Text>
              {renderStars(user.rating)}
            </View>
          </View>

          <View style={styles.verticalDivider} />

          {/* Phone Column */}
          <View style={styles.contactColumn}>
            <TouchableOpacity 
              style={styles.labelRow} 
              activeOpacity={0.7}
              onPress={() => handleCopy(user.phone, 'Phone Number')}
            >
              <Text style={styles.contactLabel} className="font-sans">Number</Text>
              <Copy size={11} color="#8A8D9F" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
            <Text numberOfLines={1} style={styles.contactValue} className="font-sans">{user.phone}</Text>
          </View>
        </View>

        {/* Professional Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader} className="font-sans">Professional Summary</Text>
          <Text style={styles.bodyText} className="font-sans">
            {user.professionalSummary}
          </Text>
        </View>

        {/* Skills */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader} className="font-sans">Skills</Text>
          
          <Text style={styles.subSectionHeader} className="font-sans">Technical Skills</Text>
          <View style={styles.tagContainer}>
            {user.technicalSkills.map((skill, idx) => (
              <View key={idx} style={styles.tag}>
                <Text style={styles.tagText} className="font-sans">{skill}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.subSectionHeader, { marginTop: 12 }]} className="font-sans">Soft Skills</Text>
          <View style={styles.tagContainer}>
            {user.softSkills.map((skill, idx) => (
              <View key={idx} style={styles.tag}>
                <Text style={styles.tagText} className="font-sans">{skill}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Work Experience */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader} className="font-sans">Work Experience</Text>
          {user.workExperience.map((exp, idx) => (
            <View key={idx} style={styles.experienceItem}>
              <Text style={styles.itemTitle} className="font-sans">{exp.role} — {exp.company}</Text>
              <Text style={styles.itemSubtitle} className="font-sans">{exp.location} | {exp.duration}</Text>
              {exp.bullets.map((bullet, bIdx) => (
                <View key={bIdx} style={styles.bulletRow}>
                  <Text style={styles.bulletPoint}>•</Text>
                  <Text style={styles.bulletText} className="font-sans">{bullet}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Education */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader} className="font-sans">Education</Text>
          {user.education.map((edu, idx) => (
            <View key={idx} style={styles.educationItem}>
              <Text style={styles.itemTitle} className="font-sans">{edu.degree}</Text>
              <Text style={styles.itemSubtitle} className="font-sans">{edu.institution} | {edu.duration}</Text>
            </View>
          ))}
        </View>

        {/* Projects */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader} className="font-sans">Projects</Text>
          {user.projects.map((proj, idx) => (
            <View key={idx} style={styles.projectItem}>
              <Text style={styles.itemTitle} className="font-sans">{proj.name}</Text>
              {proj.bullets.map((bullet, bIdx) => (
                <View key={bIdx} style={styles.bulletRow}>
                  <Text style={styles.bulletPoint}>•</Text>
                  <Text style={styles.bulletText} className="font-sans">{bullet}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Certifications */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader} className="font-sans">Certifications</Text>
          {user.certifications.map((cert, idx) => (
            <View key={idx} style={styles.bulletRow}>
              <Text style={styles.bulletPoint}>•</Text>
              <Text style={styles.bulletText} className="font-sans">{cert}</Text>
            </View>
          ))}
        </View>

        {/* Tools */}
        <View style={[styles.section, { borderBottomWidth: 0 }]}>
          <Text style={styles.sectionHeader} className="font-sans">Tools</Text>
          <View style={styles.tagContainer}>
            {user.tools.map((tool, idx) => (
              <View key={idx} style={styles.tag}>
                <Text style={styles.tagText} className="font-sans">{tool}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#E5E6F2',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editButtonText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  scroll: {
    backgroundColor: '#F7F7F9',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  userContainer: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9E8F0',
    paddingTop: 12,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#EBEBEE',
    marginBottom: 12,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
  },
  verifiedText: {
    fontSize: 10,
    color: '#16A34A',
    fontWeight: '600',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  userProfession: {
    fontSize: 13,
    color: '#17121F',
    fontWeight: '300',
    marginBottom: 4,
  },
  websiteLink: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500',
    textDecorationLine: 'underline',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#17121F',
    fontWeight: '300',
  },
  toast: {
    backgroundColor: '#333333',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 12,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  contactCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9E8F0',
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  contactColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactLabel: {
    fontSize: 10,
    color: '#17121F',
    fontWeight: '300',
  },
  contactValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  verticalDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#EBEBEE',
    alignSelf: 'center',
  },
  section: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E9E8F0',
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  subSectionHeader: {
    fontSize: 12,
    color: '#17121F',
    fontWeight: '300',
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 12,
    color: '#17121F',
    fontWeight: '300',
    lineHeight: 18,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E6F2',
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 11,
    color: '#17121F',
    fontWeight: '300',
  },
  experienceItem: {
    marginBottom: 16,
  },
  educationItem: {
    marginBottom: 12,
  },
  projectItem: {
    marginBottom: 16,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  itemSubtitle: {
    fontSize: 11,
    color: '#17121F',
    fontWeight: '300',
    marginTop: 2,
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingRight: 10,
  },
  bulletPoint: {
    fontSize: 12,
    color: '#17121F',
    fontWeight: '300',
    marginRight: 6,
    marginTop: -1,
  },
  bulletText: {
    fontSize: 11,
    color: '#17121F',
    fontWeight: '300',
    lineHeight: 16,
    flex: 1,
  },
});
