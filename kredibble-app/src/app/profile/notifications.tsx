import React, { useState, useEffect } from 'react';
import { Colors } from '../../constants/design';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { profileStore, NotificationSettings } from '../../constants/mockProfile';

export default function ManageNotificationsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<NotificationSettings>(profileStore.notifications);

  useEffect(() => {
    const unsubscribe = profileStore.subscribe(() => {
      setSettings({ ...profileStore.notifications });
    });
    return unsubscribe;
  }, []);

  const handleToggle = (key: keyof NotificationSettings) => {
    profileStore.updateNotifications({ [key]: !settings[key] });
  };

  const renderToggle = (label: string, value: boolean, key: keyof NotificationSettings) => (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel} className="font-sans">{label}</Text>
      <Switch
        value={value}
        onValueChange={() => handleToggle(key)}
        trackColor={{ false: '#E5E6F2', true: Colors.primary }}
        thumbColor="#FFFFFF"
        ios_backgroundColor="#E5E6F2"
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <ChevronLeft size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} className="font-sans">Manage notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Jobs Section */}
        <Text style={styles.sectionHeader} className="font-sans">Jobs</Text>
        <View style={styles.card}>
          {renderToggle('Job alerts', settings.jobAlerts, 'jobAlerts')}
          <View style={styles.divider} />
          {renderToggle('AI Personalised job recommendations', settings.aiRecommendations, 'aiRecommendations')}
          <View style={styles.divider} />
          {renderToggle('Job activity', settings.jobActivity, 'jobActivity')}
          <View style={styles.divider} />
          {renderToggle('Saved jobs', settings.savedJobs, 'savedJobs')}
        </View>

        {/* Application Updates Section */}
        <Text style={styles.sectionHeader} className="font-sans">Application Updates</Text>
        <View style={styles.card}>
          {renderToggle('Application status updates', settings.statusUpdates, 'statusUpdates')}
          <View style={styles.divider} />
          {renderToggle('Interview invitations', settings.interviewInvites, 'interviewInvites')}
        </View>

        {/* Community Section */}
        <Text style={styles.sectionHeader} className="font-sans">Community</Text>
        <View style={styles.card}>
          {renderToggle('New posts', settings.newPosts, 'newPosts')}
        </View>

        {/* Recruiter Section */}
        <Text style={styles.sectionHeader} className="font-sans">Recruiter Notifications</Text>
        <View style={styles.card}>
          {renderToggle('Recruiter profile views', settings.recruiterViews, 'recruiterViews')}
        </View>

        {/* Marketing Section */}
        <Text style={styles.sectionHeader} className="font-sans">Marketing communication</Text>
        <View style={styles.card}>
          {renderToggle('Marketing communication updates', settings.marketingUpdates, 'marketingUpdates')}
          <View style={styles.divider} />
          {renderToggle('Push notifications', settings.pushNotifications, 'pushNotifications')}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F9',
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },
  sectionHeader: {
    fontSize: 13,
    color: '#8A8D9F',
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A1A',
    flex: 1,
    marginRight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#F7F7F9',
    marginHorizontal: 16,
  },
});
