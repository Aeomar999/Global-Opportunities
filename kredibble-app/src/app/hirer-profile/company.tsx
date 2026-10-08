import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Camera } from 'lucide-react-native';
import { authStore } from '../../constants/authStore';
import { pickImage } from '../../lib/file-picker';
import { updateHirerProfile, uploadFile } from '../../lib/api';

export default function CompanyProfileScreen() {
  const router = useRouter();
  const [company, setCompany] = useState(authStore.company);

  const [name, setName] = useState(company?.name || '');
  const [tagline, setTagline] = useState(company?.tagline || '');
  const [industry, setIndustry] = useState(company?.industry || '');
  const [companySize, setCompanySize] = useState(company?.companySize || '');
  const [location, setLocation] = useState(company?.location || '');
  const [website, setWebsite] = useState(company?.website || '');
  const [companyEmail, setCompanyEmail] = useState(company?.companyEmail || '');
  const [description, setDescription] = useState(company?.description || '');
  const [logo, setLogo] = useState(company?.logo || '');
  const [bannerImage, setBannerImage] = useState(company?.bannerImage || '');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  useEffect(() => {
    const unsubscribe = authStore.subscribe(() => setCompany(authStore.company ? { ...authStore.company } : null));
    return unsubscribe;
  }, []);

  const handlePickBanner = async () => {
    try {
      const file = await pickImage({ allowsEditing: true, aspect: [16, 9] });
      if (!file) return;
      setBannerImage(file.uri);
      setIsUploadingBanner(true);
      try {
        const uploaded = await uploadFile(file, 'company-logos');
        if (uploaded?.url) setBannerImage(uploaded.url);
      } catch (err) {
        console.warn('Upload to server failed, keeping local uri:', err);
      } finally {
        setIsUploadingBanner(false);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to select banner image');
    }
  };

  const handlePickLogo = async () => {
    try {
      const file = await pickImage({ allowsEditing: true, aspect: [1, 1] });
      if (!file) return;
      setLogo(file.uri);
      setIsUploadingLogo(true);
      try {
        const uploaded = await uploadFile(file, 'company-logos');
        if (uploaded?.url) setLogo(uploaded.url);
      } catch (err) {
        console.warn('Upload to server failed, keeping local uri:', err);
      } finally {
        setIsUploadingLogo(false);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to select company logo');
    }
  };

  const isValid = name.trim() && tagline.trim() && industry.trim() && location.trim();

  const handleSave = async () => {
    if (!isValid) return;
    
    const companyData = {
      name, tagline, industry, companySize, location, website, companyEmail, description, logo, bannerImage,
    };

    try {
      const hirerId = (authStore as any).user?.hirer?.id;
      if (hirerId) {
        await updateHirerProfile(hirerId, {
          companyName: companyData.name, // The backend expects companyName instead of name
          ...companyData
        });
      }
      
      authStore.updateCompany(companyData);
      router.back();
    } catch (err) {
      Alert.alert('Error', 'Failed to save company profile');
      console.error(err);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <ChevronLeft size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} className="font-sans">Company Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Banner + Logo */}
        <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFFFFF', marginBottom: 24, borderWidth: 1, borderColor: '#E5E6F2' }}>
          <TouchableOpacity activeOpacity={0.85} onPress={handlePickBanner}>
            <Image source={{ uri: bannerImage || 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800' }} style={{ height: 100, width: '100%' }} />
            <View style={styles.imageEditBadge}>
              {isUploadingBanner ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Camera size={14} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>

          <View style={{ padding: 16, alignItems: 'center', marginTop: -40 }}>
            <TouchableOpacity activeOpacity={0.85} onPress={handlePickLogo}>
              <Image source={{ uri: logo || 'https://via.placeholder.com/80' }} style={{ width: 80, height: 80, borderRadius: 20, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: '#FFFFFF' }} />
              <View style={[styles.imageEditBadge, { bottom: 0, right: 0, top: undefined, left: undefined }]}>
                {isUploadingLogo ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Camera size={12} color="#FFFFFF" />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel} className="font-sans">Company Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor="#8A8D9F" className="font-sans" />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel} className="font-sans">Tagline</Text>
          <TextInput style={styles.input} value={tagline} onChangeText={setTagline} placeholderTextColor="#8A8D9F" className="font-sans" />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel} className="font-sans">Industry</Text>
          <TextInput style={styles.input} value={industry} onChangeText={setIndustry} placeholderTextColor="#8A8D9F" className="font-sans" />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel} className="font-sans">Company Size</Text>
          <TextInput style={styles.input} value={companySize} onChangeText={setCompanySize} placeholderTextColor="#8A8D9F" className="font-sans" />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel} className="font-sans">Location</Text>
          <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholderTextColor="#8A8D9F" className="font-sans" />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel} className="font-sans">Website</Text>
          <TextInput style={styles.input} value={website} onChangeText={setWebsite} autoCapitalize="none" placeholderTextColor="#8A8D9F" className="font-sans" />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel} className="font-sans">Company Email</Text>
          <TextInput
            style={styles.input} value={companyEmail} onChangeText={setCompanyEmail}
            keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#8A8D9F" className="font-sans"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel} className="font-sans">Description</Text>
          <TextInput
            style={[styles.input, { height: 120, paddingVertical: 12, textAlignVertical: 'top' }]}
            value={description}
            onChangeText={setDescription}
            multiline
            placeholderTextColor="#8A8D9F"
            className="font-sans"
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
  imageEditBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  fieldGroup: { marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '500', color: '#1A1A1A', marginBottom: 8 },
  input: {
    height: 52, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E6F2',
    borderRadius: 12, paddingHorizontal: 16, fontSize: 14, color: '#1A1A1A',
  },
  saveButton: {
    height: 52, backgroundColor: '#6671E4', borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  disabledButton: { backgroundColor: '#EBEBEE' },
  saveButtonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  disabledButtonText: { color: '#8A8D9F' },
});
