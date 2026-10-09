import React, { useState, useEffect } from 'react';
import { Colors } from '../../constants/design';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Check, ShieldCheck, ShieldAlert, FileText } from 'lucide-react-native';
import { authStore, DocStatus, VerificationDocs } from '../../constants/authStore';
import { uploadVerificationDoc } from '../../lib/api';

const DOC_META: { key: keyof VerificationDocs; label: string; hint: string; accept: string }[] = [
  { key: 'businessReg', label: 'Business Registration Document', hint: 'txt, docx, pdf — Up to 5MB', accept: '.txt,.docx,.pdf' },
  { key: 'orgId', label: 'Organization ID', hint: 'txt, docx, pdf — Up to 5MB', accept: '.txt,.docx,.pdf' },
  { key: 'companyLogo', label: 'Company Logo', hint: 'jpg, png, svg — Up to 5MB', accept: '.jpg,.jpeg,.png,.svg' },
  { key: 'proofOfOrg', label: 'Official Proof of Organization', hint: 'tax certificate, NGO registration, company license', accept: '.txt,.docx,.pdf' },
];

export default function VerificationCenterScreen() {
  const router = useRouter();
  const [company, setCompany] = useState(authStore.company);
  const [docs, setDocs] = useState<VerificationDocs>(authStore.verificationDocs);

  useEffect(() => {
    const unsubscribe = authStore.subscribe(() => {
      setCompany(authStore.company ? { ...authStore.company } : null);
      setDocs({ ...authStore.verificationDocs });
    });
    return unsubscribe;
  }, []);

  const handleReupload = async (key: keyof VerificationDocs, accept: string) => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    (input as any).onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      authStore.updateVerificationDoc(key, 'loading');
      try {
        if (company?.id) {
          // Send to actual backend
          await uploadVerificationDoc(company.id, {
            docType: key,
            fileName: file.name,
            fileSize: file.size,
            status: 'approved',
          });
        }
        setTimeout(() => authStore.updateVerificationDoc(key, 'done'), 500);
      } catch (err) {
        console.error('Failed to upload verification document:', err);
        authStore.updateVerificationDoc(key, 'idle'); // revert on error
      }
    };
    input.click();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <ChevronLeft size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} className="font-sans">Verification Center</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.statusBanner, company?.verified ? styles.statusVerified : styles.statusPending]}>
          {company?.verified ? (
            <ShieldCheck size={22} color="#16A34A" style={{ marginRight: 10 }} />
          ) : (
            <ShieldAlert size={22} color="#F6B612" style={{ marginRight: 10 }} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusTitle, { color: company?.verified ? '#16A34A' : '#B7791F' }]} className="font-sans">
              {company?.verified ? 'Verified Enterprise' : 'Verification Pending'}
            </Text>
            <Text style={styles.statusSubtitle} className="font-sans">
              {company?.verified
                ? 'All required documents are approved.'
                : 'Upload the documents below to get verified.'}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionHeader} className="font-sans">Required Documents</Text>

        {DOC_META.map(doc => (
          <View key={doc.key} style={styles.docRow}>
            <View style={styles.docIconWrap}>
              <FileText size={18} color="#8A8D9F" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.docLabel} className="font-sans">{doc.label}</Text>
              <Text style={styles.docHint} className="font-sans">{doc.hint}</Text>
            </View>

            {docs[doc.key] === 'loading' ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : docs[doc.key] === 'done' ? (
              <View style={styles.doneBadge}>
                <Check size={12} color="#16A34A" strokeWidth={3} />
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => handleReupload(doc.key, doc.accept)}
                style={styles.uploadButton}
              >
                <Text style={styles.uploadButtonText} className="font-sans">Upload</Text>
              </TouchableOpacity>
            )}

            {docs[doc.key] === 'done' && (
              <TouchableOpacity onPress={() => handleReupload(doc.key, doc.accept)} style={{ marginLeft: 10 }}>
                <Text style={styles.replaceText} className="font-sans">Replace</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
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
  statusBanner: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1,
  },
  statusVerified: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  statusPending: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  statusTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  statusSubtitle: { fontSize: 12, color: '#8A8D9F' },
  sectionHeader: { fontSize: 13, color: '#8A8D9F', fontWeight: '500', marginBottom: 12 },
  docRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#E5E6F2', marginBottom: 12,
  },
  docIconWrap: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#F5F6FA',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  docLabel: { fontSize: 13, fontWeight: '600', color: '#1A1A1A' },
  docHint: { fontSize: 11, color: '#8A8D9F', marginTop: 2 },
  doneBadge: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#DCFCE7',
    justifyContent: 'center', alignItems: 'center',
  },
  uploadButton: {
    backgroundColor: Colors.primaryTransparent, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  uploadButtonText: { fontSize: 12, color: Colors.primary, fontWeight: 'bold' },
  replaceText: { fontSize: 11, color: '#8A8D9F', fontWeight: '500', textDecorationLine: 'underline' },
});
