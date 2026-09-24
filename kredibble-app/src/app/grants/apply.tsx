import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, UploadCloud, Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { GRANTS_DATA } from './index';
import { Colors } from '../../constants/design';
import { useToast } from '../../components/ui/ToastProvider';
import { applyForGrant } from '../../lib/api';

const DURATION_OPTIONS = ['Less than 3 months', '3 - 6 months', '6 - 12 months', '1 - 2 years', 'More than 2 years'];
const ENTITY_OPTIONS = ['Non-Governmental Organization (NGO)', 'Startup', 'Corporation', 'Individual / Freelancer', 'Academic Institution', 'Other'];
const LEARN_OPTIONS = ['Social Media', 'Referral / Word of Mouth', 'Search Engine', 'Event or Conference', 'Newsletter', 'Other'];

const Dropdown = ({ label, options, value, onSelect, placeholder }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <View style={styles.formGroup}>
      <Text style={styles.label} className="font-sans">{label} <Text style={styles.asterisk}>*</Text></Text>
      <TouchableOpacity 
        style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} 
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.7}
      >
        <Text style={{ color: value ? Colors.textHeading : Colors.textMuted, fontSize: 14 }} className="font-sans">
          {value || placeholder}
        </Text>
        {isOpen ? <ChevronUp size={16} color={Colors.textMuted} /> : <ChevronDown size={16} color={Colors.textMuted} />}
      </TouchableOpacity>
      {isOpen && (
        <View style={{ borderWidth: 1, borderColor: Colors.borderDefault, borderRadius: 8, marginTop: 4, backgroundColor: Colors.white, overflow: 'hidden' }}>
          {options.map((opt: string, index: number) => (
            <TouchableOpacity 
              key={index} 
              style={{ padding: 12, borderBottomWidth: index === options.length - 1 ? 0 : 1, borderBottomColor: Colors.borderDefault }}
              onPress={() => { onSelect(opt); setIsOpen(false); }}
            >
              <Text style={{ color: Colors.textHeading, fontSize: 14 }} className="font-sans">{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

export default function ApplyGrantScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const grant = GRANTS_DATA.find(g => g.id === id) ?? GRANTS_DATA[0];
  const { showToast } = useToast();

  const [hasReceivedFunding, setHasReceivedFunding] = useState<'yes' | 'no' | null>(null);
  const [projectDuration, setProjectDuration] = useState('');
  const [entityType, setEntityType] = useState('');
  const [learnSource, setLearnSource] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgYear, setOrgYear] = useState('');
  const [orgCountry, setOrgCountry] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [projectBudget, setProjectBudget] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [sector, setSector] = useState('');
  const [projectSummary, setProjectSummary] = useState('');
  const [consentAccuracy, setConsentAccuracy] = useState(false);
  const [consentContact, setConsentContact] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApplied, setIsApplied] = useState(false);

  // Mock auto-filled data
  const autoFilledName = "Jane Doe";
  const autoFilledEmail = "jane.doe@example.com";

  const handleSubmit = async () => {
    if (!consentAccuracy || !consentContact) {
      showToast('Please check all consent boxes to proceed.', 'info');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await applyForGrant(grant.id, {
        applicantName: autoFilledName,
        requestedAmount: parseFloat(projectBudget) || 0,
        organizationName: orgName,
        projectTitle,
      });

      setIsApplied(true);
      showToast('Your application has been successfully submitted!', 'success');
      
      // Reset form
      setOrgName('');
      setOrgYear('');
      setOrgCountry('');
      setProjectTitle('');
      setProjectDuration('');
      setProjectBudget('');
      setHasReceivedFunding(null);
      setPhoneNumber('');
      setEntityType('');
      setRegistrationNumber('');
      setLearnSource('');
      setSector('');
      setProjectSummary('');
      setConsentAccuracy(false);
      setConsentContact(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to submit application', 'info');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.circleHeaderButton}
        >
          <ChevronLeft size={20} color={Colors.textHeading} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} className="font-sans">Apply for Grant</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.subHeading} className="font-sans">
          {grant.title}
        </Text>
        <Text style={styles.companyText} className="font-sans">
          {grant.org}
        </Text>

        {/* Form Fields */}
        <View style={styles.formGroup}>
          <Text style={styles.label} className="font-sans">Full Name</Text>
          <TextInput
            style={[styles.input, styles.disabledInput]}
            value={autoFilledName}
            editable={false}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label} className="font-sans">Organization Name <Text style={styles.asterisk}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="Enter organization name"
            placeholderTextColor={Colors.textMuted}
            value={orgName}
            onChangeText={setOrgName}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label} className="font-sans">Email Address</Text>
          <TextInput
            style={[styles.input, styles.disabledInput]}
            value={autoFilledEmail}
            editable={false}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label} className="font-sans">Organisation Year of Registration <Text style={styles.asterisk}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 2015"
            keyboardType="number-pad"
            placeholderTextColor={Colors.textMuted}
            value={orgYear}
            onChangeText={setOrgYear}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label} className="font-sans">Country of Registration</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter country"
            placeholderTextColor={Colors.textMuted}
            value={orgCountry}
            onChangeText={setOrgCountry}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label} className="font-sans">Project Title <Text style={styles.asterisk}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="Enter project title"
            placeholderTextColor={Colors.textMuted}
            value={projectTitle}
            onChangeText={setProjectTitle}
          />
        </View>

        <Dropdown
          label="Expected Project Duration"
          placeholder="Select project duration"
          options={DURATION_OPTIONS}
          value={projectDuration}
          onSelect={setProjectDuration}
        />

        <View style={styles.formGroup}>
          <Text style={styles.label} className="font-sans">Estimated Budget (in USD) <Text style={styles.asterisk}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 1500"
            keyboardType="numeric"
            placeholderTextColor={Colors.textMuted}
            value={projectBudget}
            onChangeText={setProjectBudget}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label} className="font-sans">
            Have you previously received funding from {grant.org}? <Text style={styles.asterisk}>*</Text>
          </Text>
          <View style={styles.radioGroup}>
            <TouchableOpacity 
              style={styles.radioOption} 
              onPress={() => setHasReceivedFunding('yes')}
            >
              <View style={[styles.radioCircle, hasReceivedFunding === 'yes' && styles.radioCircleSelected]} />
              <Text style={styles.radioText} className="font-sans">Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.radioOption} 
              onPress={() => setHasReceivedFunding('no')}
            >
              <View style={[styles.radioCircle, hasReceivedFunding === 'no' && styles.radioCircleSelected]} />
              <Text style={styles.radioText} className="font-sans">No</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label} className="font-sans">Phone Number <Text style={styles.asterisk}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="Enter phone number"
            keyboardType="phone-pad"
            placeholderTextColor={Colors.textMuted}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />
        </View>

        <Dropdown
          label="Type of Entity"
          placeholder="Select entity type"
          options={ENTITY_OPTIONS}
          value={entityType}
          onSelect={setEntityType}
        />

        <View style={styles.formGroup}>
          <Text style={styles.label} className="font-sans">Registration Number (if applicable) <Text style={styles.asterisk}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="Enter registration number"
            placeholderTextColor={Colors.textMuted}
            value={registrationNumber}
            onChangeText={setRegistrationNumber}
          />
        </View>

        <Dropdown
          label="Where did you learn about us?"
          placeholder="Select an option"
          options={LEARN_OPTIONS}
          value={learnSource}
          onSelect={setLearnSource}
        />

        <View style={styles.formGroup}>
          <Text style={styles.label} className="font-sans">Which sector does your project align with? <Text style={styles.asterisk}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Education, Health, Tech"
            placeholderTextColor={Colors.textMuted}
            value={sector}
            onChangeText={setSector}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label} className="font-sans">Brief Summary of Your Project (max 300 words) <Text style={styles.asterisk}>*</Text></Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your project here..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            value={projectSummary}
            onChangeText={setProjectSummary}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label} className="font-sans">Upload supporting documents (e.g. project proposal) <Text style={styles.asterisk}>*</Text></Text>
          <TouchableOpacity style={styles.uploadBox}>
            <UploadCloud size={24} color={Colors.primary} />
            <Text style={styles.uploadText} className="font-sans">Tap to upload file</Text>
            <Text style={styles.uploadSubtext} className="font-sans">PDF, DOCX up to 10MB</Text>
          </TouchableOpacity>
        </View>

        {/* Consent Section */}
        <View style={styles.consentSection}>
          <Text style={styles.label} className="font-sans">Consent <Text style={styles.asterisk}>*</Text></Text>
          <TouchableOpacity 
            style={styles.checkboxRow} 
            onPress={() => setConsentAccuracy(!consentAccuracy)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, consentAccuracy && styles.checkboxSelected]}>
              {consentAccuracy && <Check size={14} color="#FFF" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.consentText} className="font-sans">
                I confirm that all information provided is accurate to the best of my knowledge.
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.checkboxRow, { marginTop: 16 }]} 
            onPress={() => setConsentContact(!consentContact)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, consentContact && styles.checkboxSelected]}>
              {consentContact && <Check size={14} color="#FFF" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.consentText} className="font-sans">
                I agree to be contacted via email for updates regarding this application and future opportunities.
              </Text>
            </View>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Sticky Footer Apply CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleSubmit}
          style={[styles.applyButton, (isSubmitting || isApplied) && styles.applyButtonDisabled]}
          disabled={isSubmitting || isApplied}
        >
          <Text style={styles.applyButtonText} className="font-sans">
            {isSubmitting ? 'Submitting...' : isApplied ? 'Applied' : 'Submit Application'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgScreen,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgScreen,
    justifyContent: 'space-between'
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
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textHeading,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 100,
  },
  subHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textHeading,
    marginBottom: 4,
  },
  companyText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textHeading,
    marginBottom: 8,
  },
  asterisk: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.textHeading,
  },
  disabledInput: {
    backgroundColor: '#F3F4F6',
    color: Colors.textMuted,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 20,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.borderDefault,
    marginRight: 8,
  },
  radioCircleSelected: {
    borderColor: Colors.primary,
    borderWidth: 6,
  },
  radioText: {
    fontSize: 14,
    color: Colors.textHeading,
  },
  uploadBox: {
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: Colors.white,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textHeading,
    marginTop: 8,
  },
  uploadSubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  consentSection: {
    marginTop: 10,
    marginBottom: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    backgroundColor: Colors.white,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  consentText: {
    fontSize: 13,
    color: Colors.textBody,
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
  },
  applyButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButtonDisabled: {
    opacity: 0.7,
  },
  applyButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: 'bold',
  },
});
