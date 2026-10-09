import React, { useState, useEffect } from 'react';
import { Colors } from '../../constants/design';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { authStore } from '../../constants/authStore';

export default function RecruiterDetailsScreen() {
  const router = useRouter();
  const [company, setCompany] = useState(authStore.company);

  const [recruiterName, setRecruiterName] = useState(company?.recruiterName || '');
  const [recruiterRole, setRecruiterRole] = useState(company?.recruiterRole || '');
  const [recruiterEmail, setRecruiterEmail] = useState(company?.recruiterEmail || '');
  const [recruiterPhone, setRecruiterPhone] = useState(company?.recruiterPhone || '');
  const [recruiterLinkedin, setRecruiterLinkedin] = useState(company?.recruiterLinkedin || '');

  useEffect(() => {
    const unsubscribe = authStore.subscribe(() => setCompany(authStore.company ? { ...authStore.company } : null));
    return unsubscribe;
  }, []);

  const isValid = recruiterName.trim() && recruiterRole.trim() && recruiterEmail.trim();

  const handleSave = async () => {
    if (!isValid) return;
    
    const recruiterData = { recruiterName, recruiterRole, recruiterEmail, recruiterPhone, recruiterLinkedin };
    
    try {
      const { updateHirerProfile } = require('../../lib/api');
      const hirerId = (authStore as any).user?.hirer?.id;
      if (hirerId) {
        await updateHirerProfile(hirerId, recruiterData);
      }
      
      authStore.updateCompany(recruiterData);
      router.back();
    } catch (err) {
      alert('Failed to save recruiter profile');
      console.error(err);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <ChevronLeft size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} className="font-sans">Recruiter Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel} className="font-sans">Full Name</Text>
          <TextInput style={styles.input} value={recruiterName} onChangeText={setRecruiterName} placeholderTextColor="#8A8D9F" className="font-sans" />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel} className="font-sans">Position / Role</Text>
          <TextInput style={styles.input} value={recruiterRole} onChangeText={setRecruiterRole} placeholderTextColor="#8A8D9F" className="font-sans" />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel} className="font-sans">Work Email</Text>
          <TextInput
            style={styles.input} value={recruiterEmail} onChangeText={setRecruiterEmail}
            keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#8A8D9F" className="font-sans"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel} className="font-sans">Phone Number</Text>
          <TextInput
            style={styles.input} value={recruiterPhone} onChangeText={setRecruiterPhone}
            keyboardType="phone-pad" placeholderTextColor="#8A8D9F" className="font-sans"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel} className="font-sans">LinkedIn Profile</Text>
          <TextInput
            style={styles.input} value={recruiterLinkedin} onChangeText={setRecruiterLinkedin}
            autoCapitalize="none" placeholderTextColor="#8A8D9F" className="font-sans"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, !isValid && styles.disabledButton]}
          onPress={handleSave}
          disabled={!isValid}
          activeOpacity={0.8}
        >
          <Text style={[styles.saveButtonText, !isValid && styles.disabledButtonText]} className="font-sans">Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F9' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  backButton: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#E5E6F2',
    backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A1A' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  fieldGroup: { marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '500', color: '#1A1A1A', marginBottom: 8 },
  input: {
    height: 52, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E6F2',
    borderRadius: 12, paddingHorizontal: 16, fontSize: 14, color: '#1A1A1A',
  },
  saveButton: {
    height: 52, backgroundColor: Colors.primary, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  disabledButton: { backgroundColor: '#EBEBEE' },
  saveButtonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  disabledButtonText: { color: '#8A8D9F' },
});
