import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronDown } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { authStore } from '../../constants/authStore';
import { createOpportunity, updateOpportunity } from '../../lib/api';
import { useToast } from '../../components/ui/ToastProvider';
import { DateTimePickerModal } from '../../components/ui/DateTimePickerModal';

// Polish Dropdown Selector Component
const DropdownSelector = ({ 
  label, 
  selectedValue, 
  onSelect, 
  options, 
  isOpen, 
  onToggle 
}: { 
  label: string; 
  selectedValue: string; 
  onSelect: (val: string) => void; 
  options: string[]; 
  isOpen: boolean; 
  onToggle: () => void; 
}) => {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.label} className="font-sans">{label}</Text>
      <TouchableOpacity 
        onPress={onToggle}
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#F3F4F6',
          borderRadius: 10,
          paddingHorizontal: 14,
          height: 48,
        }}
        activeOpacity={0.8}
      >
        <Text style={{ fontSize: 14, color: '#1A1A1A' }} className="font-sans">{selectedValue}</Text>
        <ChevronDown size={18} color="#8A8D9F" />
      </TouchableOpacity>

      {isOpen && (
        <View style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 10,
          marginTop: 6,
          borderWidth: 1,
          borderColor: '#E5E6F2',
          paddingVertical: 4,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 3,
        }}>
          {options.map((option) => (
            <TouchableOpacity
              key={option}
              onPress={() => {
                onSelect(option);
                onToggle();
              }}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderBottomWidth: option === options[options.length - 1] ? 0 : 1,
                borderBottomColor: '#F3F4F6',
              }}
            >
              <Text style={{
                fontSize: 14,
                color: selectedValue === option ? '#6671E4' : '#1A1A1A',
                fontWeight: selectedValue === option ? 'bold' : 'normal',
              }} className="font-sans">
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

// Experience Level Chip Selector Component
const ExperienceLevelSelector = ({
  selectedLevels,
  onChange,
}: {
  selectedLevels: string[];
  onChange: (levels: string[]) => void;
}) => {
  const { showToast } = useToast();
  const levels = ['Beginner', 'Entry level', 'Intermediate', 'Senior'];

  const handleToggle = (level: string) => {
    if (selectedLevels.includes(level)) {
      onChange(selectedLevels.filter(l => l !== level));
    } else {
      if (selectedLevels.length >= 2) {
        showToast('You can select a maximum of 2 experience levels.', 'info');
        return;
      }
      onChange([...selectedLevels, level]);
    }
  };

  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.label} className="font-sans">Experience Level (Select 1-2)</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {levels.map((level) => {
          const isSelected = selectedLevels.includes(level);
          return (
            <TouchableOpacity
              key={level}
              onPress={() => handleToggle(level)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: isSelected ? '#6671E4' : '#E5E6F2',
                backgroundColor: isSelected ? '#EEF2FF' : '#FFFFFF',
              }}
              activeOpacity={0.8}
            >
              <Text style={{
                fontSize: 13,
                color: isSelected ? '#6671E4' : '#8A8D9F',
                fontWeight: isSelected ? '600' : '500',
              }} className="font-sans">
                {level}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export default function CreateOpportunityScreen() {
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId: string }>();
  const isEditing = !!editId;
  const { showToast } = useToast();

  // Core Form Fields
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'jobs' | 'internships' | 'events' | 'grants'>('jobs');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  // Job-Specific States
  const [workType, setWorkType] = useState('Remote');
  const [showWorkTypeDropdown, setShowWorkTypeDropdown] = useState(false);

  const [salaryOption, setSalaryOption] = useState('GH₵1,000 - GH₵2,000 / mo');
  const [customSalary, setCustomSalary] = useState('');
  const [showSalaryDropdown, setShowSalaryDropdown] = useState(false);

  const [experienceLevels, setExperienceLevels] = useState<string[]>([]);

  const [orgType, setOrgType] = useState('Private Company');
  const [showOrgTypeDropdown, setShowOrgTypeDropdown] = useState(false);

  // Grant-Specific States
  const [grantSector, setGrantSector] = useState('Tech/Innovation');
  const [showSectorDropdown, setShowSectorDropdown] = useState(false);

  const [grantApplicantType, setGrantApplicantType] = useState('Startups/SMEs');
  const [showApplicantTypeDropdown, setShowApplicantTypeDropdown] = useState(false);

  const [grantFundingAgency, setGrantFundingAgency] = useState('Private Philanthropy');
  const [showFundingAgencyDropdown, setShowFundingAgencyDropdown] = useState(false);

  const [grantCountry, setGrantCountry] = useState('Global/Any Country');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  const [grantPurpose, setGrantPurpose] = useState('Research & Development');
  const [showPurposeDropdown, setShowPurposeDropdown] = useState(false);

  const [grantAppMethod, setGrantAppMethod] = useState('Online Form');
  const [showAppMethodDropdown, setShowAppMethodDropdown] = useState(false);

  const [grantBudgetRange, setGrantBudgetRange] = useState('GH₵50,000 - GH₵200,000');
  const [showBudgetRangeDropdown, setShowBudgetRangeDropdown] = useState(false);

  const [grantLogoUri, setGrantLogoUri] = useState<string>('');

  // Event-Specific States
  const [eventDateTime, setEventDateTime] = useState('');
  const [isDateTimePickerVisible, setIsDateTimePickerVisible] = useState(false);
  const [eventRegion, setEventRegion] = useState('Greater Accra');
  const [showEventRegionDropdown, setShowEventRegionDropdown] = useState(false);

  const [eventCategory, setEventCategory] = useState('Technology');
  const [showEventCategoryDropdown, setShowEventCategoryDropdown] = useState(false);

  const [eventTicketType, setEventTicketType] = useState('Free');
  const [showEventTicketTypeDropdown, setShowEventTicketTypeDropdown] = useState(false);

  const [eventStyle, setEventStyle] = useState('In-Person');
  const [showEventStyleDropdown, setShowEventStyleDropdown] = useState(false);

  const [eventBannerUri, setEventBannerUri] = useState<string>('');

  useEffect(() => {
    if (editId) {
      const opp = authStore.opportunities.find(o => o.id === editId);
      if (opp) {
        // One-time prefill of ~25 independent form fields from the listing being
        // edited (editId is fixed for the screen). Lifting every initializer is a
        // larger refactor than this extra render is worth.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTitle(opp.title);
        setType(opp.type);
        setLocation(opp.location);
        setDescription(opp.description);
        if (opp.type === 'jobs' || opp.type === 'internships') {
          if (opp.workType) setWorkType(opp.workType);
          if (opp.type === 'jobs' && opp.salary) {
            const standardOptions = [
              'GH₵500 - GH₵1,000 / mo',
              'GH₵1,000 - GH₵2,000 / mo',
              'GH₵2,000 - GH₵5,000 / mo',
              'GH₵5,000 - GH₵10,000 / mo',
              'GH₵10,000+ / mo',
            ];
            if (standardOptions.includes(opp.salary)) {
              setSalaryOption(opp.salary);
              setCustomSalary('');
            } else {
              setSalaryOption('Enter custom salary...');
              setCustomSalary(opp.salary);
            }
          }
          if (opp.experienceLevels) setExperienceLevels(opp.experienceLevels);
          if (opp.organizationType) setOrgType(opp.organizationType);
        } else if (opp.type === 'grants') {
          if (opp.grantSector) setGrantSector(opp.grantSector);
          if (opp.grantApplicantType) setGrantApplicantType(opp.grantApplicantType);
          if (opp.grantFundingAgency) setGrantFundingAgency(opp.grantFundingAgency);
          if (opp.grantCountry) setGrantCountry(opp.grantCountry);
          if (opp.grantPurpose) setGrantPurpose(opp.grantPurpose);
          if (opp.grantAppMethod) setGrantAppMethod(opp.grantAppMethod);
          if (opp.grantBudgetRange) setGrantBudgetRange(opp.grantBudgetRange);
          if (opp.grantLogoUri) setGrantLogoUri(opp.grantLogoUri);
        } else if (opp.type === 'events') {
          if (opp.eventDateTime) setEventDateTime(opp.eventDateTime);
          if (opp.eventRegion) setEventRegion(opp.eventRegion);
          if (opp.eventCategory) setEventCategory(opp.eventCategory);
          if (opp.eventTicketType) setEventTicketType(opp.eventTicketType);
          if (opp.eventStyle) setEventStyle(opp.eventStyle);
          if (opp.eventBannerUri) setEventBannerUri(opp.eventBannerUri);
        }
      }
    }
  }, [editId]);

  const closeAllDropdowns = () => {
    setShowWorkTypeDropdown(false);
    setShowSalaryDropdown(false);
    setShowOrgTypeDropdown(false);
    setShowSectorDropdown(false);
    setShowApplicantTypeDropdown(false);
    setShowFundingAgencyDropdown(false);
    setShowCountryDropdown(false);
    setShowPurposeDropdown(false);
    setShowAppMethodDropdown(false);
    setShowBudgetRangeDropdown(false);
    setShowEventRegionDropdown(false);
    setShowEventCategoryDropdown(false);
    setShowEventTicketTypeDropdown(false);
    setShowEventStyleDropdown(false);
  };

  const clearForm = () => {
    setTitle('');
    setLocation('');
    setDescription('');
    setWorkType('Remote');
    setSalaryOption('GH₵1,000 - GH₵2,000 / mo');
    setCustomSalary('');
    setExperienceLevels([]);
    setOrgType('Private Company');
    setGrantSector('Tech/Innovation');
    setGrantApplicantType('Startups/SMEs');
    setGrantFundingAgency('Private Philanthropy');
    setGrantCountry('Global/Any Country');
    setGrantPurpose('Research & Development');
    setGrantAppMethod('Online Form');
    setGrantBudgetRange('GH₵50,000 - GH₵200,000');
    setGrantLogoUri('');
    setEventDateTime('');
    setEventRegion('Greater Accra');
    setEventCategory('Technology');
    setEventTicketType('Free');
    setEventStyle('In-Person');
    setEventBannerUri('');
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePostOpportunity = async () => {
    if (!title.trim() || !location.trim() || !description.trim()) {
      showToast('Please fill out all core fields.', 'info');
      return;
    }

    if (type === 'jobs' || type === 'internships') {
      if (experienceLevels.length === 0) {
        showToast('Please select at least one experience level.', 'info');
        return;
      }
      if (type === 'jobs' && salaryOption === 'Enter custom salary...' && !customSalary.trim()) {
        showToast('Please input custom salary or select a salary range.', 'info');
        return;
      }
    }

    if (type === 'events') {
      if (!eventDateTime.trim()) {
        showToast('Please specify the date and time for the event.', 'info');
        return;
      }
    }

    // Choose logo color and initial based on type
    let logoColor = '#6671E4';
    let initial = 'J';
    if (type === 'internships') { logoColor = '#34D399'; initial = 'I'; }
    if (type === 'events') { logoColor = '#F87171'; initial = 'E'; }
    if (type === 'grants') { logoColor = '#FBBF24'; initial = 'G'; }

    const finalSalary = salaryOption === 'Enter custom salary...' ? customSalary : salaryOption;

    const payload: any = {
      title: title.trim(),
      type,
      company: authStore.company?.name || 'Company',
      location: location.trim(),
      logoColor,
      initial,
      description: description.trim(),
      ...(type === 'jobs' || type === 'internships' ? {
        workType,
        ...(type === 'jobs' ? { salary: finalSalary.trim() } : {}),
        experienceLevels,
        organizationType: orgType,
      } : type === 'grants' ? {
        grantSector,
        grantApplicantType,
        grantFundingAgency,
        grantCountry,
        grantPurpose,
        grantAppMethod,
        grantBudgetRange,
        grantLogoUri: grantLogoUri || undefined,
      } : type === 'events' ? {
        eventDateTime: eventDateTime.trim(),
        eventRegion,
        eventCategory,
        eventTicketType,
        eventStyle,
        eventBannerUri: eventBannerUri || undefined,
      } : {})
    };

    setIsSubmitting(true);
    try {
      if (isEditing && editId) {
        await updateOpportunity(editId, payload);
        authStore.updateOpportunity(editId, payload);
        showToast('Opportunity updated successfully', 'success');
      } else {
        await createOpportunity(payload);
        authStore.addOpportunity(payload);
        showToast('Opportunity published successfully', 'success');
      }
      clearForm();
      router.back();
    } catch (err: any) {
      showToast(err.message || 'Failed to save opportunity', 'info');
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', textAlign: 'center' }} className="font-sans">
            {isEditing ? 'Edit Opportunity' : 'Post Opportunity'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={{
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
          {/* Title */}
          <Text style={styles.label} className="font-sans">Opportunity Title</Text>
          <TextInput
            placeholder="e.g. UX Design Intern"
            placeholderTextColor="#A1A1AA"
            value={title}
            onChangeText={setTitle}
            style={styles.input}
            className="font-sans"
          />

          {/* Type Selection */}
          <Text style={styles.label} className="font-sans">Type</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 18 }}>
            {(['jobs', 'internships', 'grants', 'events'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setType(t)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 8,
                  alignItems: 'center',
                  backgroundColor: type === t ? '#6671E4' : '#F3F4F6'
                }}
              >
                <Text style={{
                  fontSize: 12,
                  fontWeight: 'bold',
                  color: type === t ? '#FFFFFF' : '#8A8D9F',
                  textTransform: 'capitalize'
                }} className="font-sans">
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Location */}
          <Text style={styles.label} className="font-sans">Location</Text>
          <TextInput
            placeholder="e.g. Accra, Ghana (Hybrid)"
            placeholderTextColor="#A1A1AA"
            value={location}
            onChangeText={setLocation}
            style={styles.input}
            className="font-sans"
          />

          {/* Job/Internship Specific Fields (Conditional on type === 'jobs' or type === 'internships') */}
          {(type === 'jobs' || type === 'internships') && (
            <View>
              {/* Work Type Dropdown */}
              <DropdownSelector
                label="Work Type"
                selectedValue={workType}
                onSelect={setWorkType}
                options={['Remote', 'Hybrid', 'On-site', 'Freelance/Contract']}
                isOpen={showWorkTypeDropdown}
                onToggle={() => {
                  const nextState = !showWorkTypeDropdown;
                  closeAllDropdowns();
                  setShowWorkTypeDropdown(nextState);
                }}
              />

              {/* Salary Range Dropdown (Only for jobs) */}
              {type === 'jobs' && (
                <>
                  <DropdownSelector
                    label="Salary Range"
                    selectedValue={salaryOption}
                    onSelect={(val) => {
                      setSalaryOption(val);
                      if (val !== 'Enter custom salary...') {
                        setCustomSalary('');
                      }
                    }}
                    options={[
                      'GH₵500 - GH₵1,000 / mo',
                      'GH₵1,000 - GH₵2,000 / mo',
                      'GH₵2,000 - GH₵5,000 / mo',
                      'GH₵5,000 - GH₵10,000 / mo',
                      'GH₵10,000+ / mo',
                      'Enter custom salary...'
                    ]}
                    isOpen={showSalaryDropdown}
                    onToggle={() => {
                      const nextState = !showSalaryDropdown;
                      closeAllDropdowns();
                      setShowSalaryDropdown(nextState);
                    }}
                  />

                  {/* Custom Salary Input (Only visible when 'Enter custom salary...' is selected) */}
                  {salaryOption === 'Enter custom salary...' && (
                    <View style={{ marginBottom: 18 }}>
                      <Text style={styles.label} className="font-sans">Enter Custom Salary</Text>
                      <TextInput
                        placeholder="e.g. GH₵1,500 / month, or GH₵85,000 / year"
                        placeholderTextColor="#A1A1AA"
                        value={customSalary}
                        onChangeText={setCustomSalary}
                        style={styles.input}
                        className="font-sans"
                      />
                    </View>
                  )}
                </>
              )}

              {/* Experience Level Chip Selector */}
              <ExperienceLevelSelector
                selectedLevels={experienceLevels}
                onChange={setExperienceLevels}
              />

              {/* Organization Type Dropdown */}
              <DropdownSelector
                label="Organization Type"
                selectedValue={orgType}
                onSelect={setOrgType}
                options={['Private Company', 'Public Company', 'Non-Profit', 'Government Agency', 'Startup']}
                isOpen={showOrgTypeDropdown}
                onToggle={() => {
                  const nextState = !showOrgTypeDropdown;
                  closeAllDropdowns();
                  setShowOrgTypeDropdown(nextState);
                }}
              />
            </View>
          )}

          {/* Grant Specific Fields (Conditional on type === 'grants') */}
          {type === 'grants' && (
            <View>
              {/* Grant Organisation Logo */}
              <Text style={styles.label} className="font-sans">Organisation Logo</Text>
              <View style={{ alignItems: 'center', marginBottom: 22 }}>
                <TouchableOpacity
                  onPress={async () => {
                    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (!permission.granted) {
                      showToast('Permission to access photos is required.', 'info');
                      return;
                    }
                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.Images,
                      allowsEditing: true,
                      aspect: [1, 1],
                      quality: 0.85,
                    });
                    if (!result.canceled && result.assets.length > 0) {
                      setGrantLogoUri(result.assets[0].uri);
                    }
                  }}
                  activeOpacity={0.85}
                  style={{
                    width: 90,
                    height: 90,
                    borderRadius: 45,
                    overflow: 'hidden',
                    backgroundColor: '#EEF2FF',
                    borderWidth: 2,
                    borderColor: grantLogoUri ? '#6671E4' : '#C7CBEE',
                    borderStyle: grantLogoUri ? 'solid' : 'dashed',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  {grantLogoUri ? (
                    <Image
                      source={{ uri: grantLogoUri }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={{ alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 26 }}>🏢</Text>
                      <Text style={{ fontSize: 9, color: '#8A8D9F', textAlign: 'center' }} className="font-sans">
                        Add logo
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                {grantLogoUri ? (
                  <TouchableOpacity
                    onPress={() => setGrantLogoUri('')}
                    style={{ marginTop: 8 }}
                  >
                    <Text style={{ fontSize: 11, color: '#6671E4', fontWeight: '600' }} className="font-sans">
                      Change Logo
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={{ fontSize: 11, color: '#8A8D9F', marginTop: 8 }} className="font-sans">
                    Tap circle to upload
                  </Text>
                )}
              </View>

              {/* Sector Dropdown */}
              <DropdownSelector
                label="Sector"
                selectedValue={grantSector}
                onSelect={setGrantSector}
                options={['Tech/Innovation', 'Agriculture', 'Healthcare', 'Education', 'Renewable Energy', 'Social Impact', 'Creative Arts/Media']}
                isOpen={showSectorDropdown}
                onToggle={() => {
                  const nextState = !showSectorDropdown;
                  closeAllDropdowns();
                  setShowSectorDropdown(nextState);
                }}
              />

              {/* Eligible Applicant Types Dropdown */}
              <DropdownSelector
                label="Eligible Applicant Types"
                selectedValue={grantApplicantType}
                onSelect={setGrantApplicantType}
                options={['Individual Researchers', 'Startups/SMEs', 'Non-Profit Organizations (NGOs)', 'Academic Institutions', 'Student Projects']}
                isOpen={showApplicantTypeDropdown}
                onToggle={() => {
                  const nextState = !showApplicantTypeDropdown;
                  closeAllDropdowns();
                  setShowApplicantTypeDropdown(nextState);
                }}
              />

              {/* Funding Agencies Dropdown */}
              <DropdownSelector
                label="Funding Agency"
                selectedValue={grantFundingAgency}
                onSelect={setGrantFundingAgency}
                options={['Government Body', 'International Development Bank', 'Corporate Foundation', 'Private Philanthropy', 'Venture Fund']}
                isOpen={showFundingAgencyDropdown}
                onToggle={() => {
                  const nextState = !showFundingAgencyDropdown;
                  closeAllDropdowns();
                  setShowFundingAgencyDropdown(nextState);
                }}
              />

              {/* Eligible Applicant Country Dropdown */}
              <DropdownSelector
                label="Eligible Applicant Country"
                selectedValue={grantCountry}
                onSelect={setGrantCountry}
                options={['Ghana', 'Nigeria', 'Kenya', 'South Africa', 'All African Countries', 'Global/Any Country']}
                isOpen={showCountryDropdown}
                onToggle={() => {
                  const nextState = !showCountryDropdown;
                  closeAllDropdowns();
                  setShowCountryDropdown(nextState);
                }}
              />

              {/* Grant Purpose Dropdown */}
              <DropdownSelector
                label="Grant Purpose"
                selectedValue={grantPurpose}
                onSelect={setGrantPurpose}
                options={['Research & Development', 'Business Scale-up', 'Community Project', 'Academic Scholarship', 'Event Sponsorship']}
                isOpen={showPurposeDropdown}
                onToggle={() => {
                  const nextState = !showPurposeDropdown;
                  closeAllDropdowns();
                  setShowPurposeDropdown(nextState);
                }}
              />

              {/* Application Methods Dropdown */}
              <DropdownSelector
                label="Application Method"
                selectedValue={grantAppMethod}
                onSelect={setGrantAppMethod}
                options={['Online Form', 'Email Submission', 'External Portal Link', 'Offline Mail']}
                isOpen={showAppMethodDropdown}
                onToggle={() => {
                  const nextState = !showAppMethodDropdown;
                  closeAllDropdowns();
                  setShowAppMethodDropdown(nextState);
                }}
              />

              {/* Budget Range Dropdown */}
              <DropdownSelector
                label="Budget Range"
                selectedValue={grantBudgetRange}
                onSelect={setGrantBudgetRange}
                options={['Under GH₵10,000', 'GH₵10,000 - GH₵50,000', 'GH₵50,000 - GH₵200,000', 'GH₵200,000 - GH₵1,000,000', 'GH₵1,000,000+']}
                isOpen={showBudgetRangeDropdown}
                onToggle={() => {
                  const nextState = !showBudgetRangeDropdown;
                  closeAllDropdowns();
                  setShowBudgetRangeDropdown(nextState);
                }}
              />
            </View>
          )}

          {/* Event Specific Fields (Conditional on type === 'events') */}
          {type === 'events' && (
            <View>
              {/* Event Banner Upload */}
              <Text style={styles.label} className="font-sans">Event Banner</Text>
              <TouchableOpacity
                onPress={async () => {
                  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (!permission.granted) {
                    showToast('Permission to access photos is required.', 'info');
                    return;
                  }
                  const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    aspect: [16, 7],
                    quality: 0.85,
                  });
                  if (!result.canceled && result.assets.length > 0) {
                    setEventBannerUri(result.assets[0].uri);
                  }
                }}
                activeOpacity={0.85}
                style={{
                  height: 140,
                  borderRadius: 14,
                  overflow: 'hidden',
                  backgroundColor: '#EEF2FF',
                  borderWidth: 2,
                  borderColor: eventBannerUri ? 'transparent' : '#C7CBEE',
                  borderStyle: 'dashed',
                  marginBottom: 18,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                {eventBannerUri ? (
                  <>
                    <Image
                      source={{ uri: eventBannerUri }}
                      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                    {/* Edit overlay */}
                    <View style={{
                      position: 'absolute',
                      bottom: 8,
                      right: 10,
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 20,
                    }}>
                      <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '600' }} className="font-sans">Change Banner</Text>
                    </View>
                  </>
                ) : (
                  <View style={{ alignItems: 'center', gap: 8 }}>
                    <View style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: '#D8DBFF',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                      <Text style={{ fontSize: 22 }}>🖼️</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: '#6671E4', fontWeight: '600' }} className="font-sans">
                      Tap to upload banner
                    </Text>
                    <Text style={{ fontSize: 11, color: '#8A8D9F' }} className="font-sans">
                      Recommended: 16:7 ratio
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Event Date & Time */}
              <Text style={styles.label} className="font-sans">Event Date & Time</Text>
              <TouchableOpacity
                onPress={() => {
                  closeAllDropdowns();
                  setIsDateTimePickerVisible(true);
                }}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#F3F4F6',
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  height: 48,
                  marginBottom: 18,
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 14, color: eventDateTime ? '#1A1A1A' : '#A1A1AA' }} className="font-sans">
                  {eventDateTime || "Select date and time..."}
                </Text>
                <ChevronDown size={18} color="#8A8D9F" />
              </TouchableOpacity>

              {/* Regions Dropdown */}
              <DropdownSelector
                label="Region"
                selectedValue={eventRegion}
                onSelect={setEventRegion}
                options={['Greater Accra', 'Ashanti', 'Western', 'Eastern', 'Central', 'Northern', 'Volta', 'Other']}
                isOpen={showEventRegionDropdown}
                onToggle={() => {
                  const nextState = !showEventRegionDropdown;
                  closeAllDropdowns();
                  setShowEventRegionDropdown(nextState);
                }}
              />

              {/* Category Dropdown */}
              <DropdownSelector
                label="Category"
                selectedValue={eventCategory}
                onSelect={setEventCategory}
                options={['Technology', 'Business & Finance', 'Career & Networking', 'Arts & Culture', 'Education', 'Health & Wellness', 'Other']}
                isOpen={showEventCategoryDropdown}
                onToggle={() => {
                  const nextState = !showEventCategoryDropdown;
                  closeAllDropdowns();
                  setShowEventCategoryDropdown(nextState);
                }}
              />

              {/* Ticket Type Dropdown */}
              <DropdownSelector
                label="Ticket Type"
                selectedValue={eventTicketType}
                onSelect={setEventTicketType}
                options={['Free', 'Paid']}
                isOpen={showEventTicketTypeDropdown}
                onToggle={() => {
                  const nextState = !showEventTicketTypeDropdown;
                  closeAllDropdowns();
                  setShowEventTicketTypeDropdown(nextState);
                }}
              />

              {/* Event Type / Style Dropdown */}
              <DropdownSelector
                label="Event Type"
                selectedValue={eventStyle}
                onSelect={setEventStyle}
                options={['Virtual/Online', 'In-Person', 'Hybrid']}
                isOpen={showEventStyleDropdown}
                onToggle={() => {
                  const nextState = !showEventStyleDropdown;
                  closeAllDropdowns();
                  setShowEventStyleDropdown(nextState);
                }}
              />
            </View>
          )}

          {/* Description */}
          <Text style={styles.label} className="font-sans">
            {type === 'grants'
              ? 'Grant Description'
              : type === 'events'
              ? 'Event Description / Details'
              : 'Job Description / Requirements'}
          </Text>
          <TextInput
            placeholder={
              type === 'grants'
                ? 'Describe the grant details, eligibility requirements, and purpose...'
                : type === 'events'
                ? 'Describe the event details, agenda, and speakers...'
                : 'Describe the opportunity responsibilities, benefits, and requirements...'
            }
            placeholderTextColor="#A1A1AA"
            multiline
            numberOfLines={6}
            value={description}
            onChangeText={setDescription}
            style={[styles.input, { minHeight: 120, textAlignVertical: 'top', paddingVertical: 12 }]}
            className="font-sans"
          />

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handlePostOpportunity}
            style={styles.button}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 15, color: '#FFFFFF', fontWeight: 'bold' }} className="font-sans">
              {isEditing ? 'Save Changes' : 'Publish Listing'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <DateTimePickerModal
        isVisible={isDateTimePickerVisible}
        onClose={() => setIsDateTimePickerVisible(false)}
        onConfirm={(formatted) => setEventDateTime(formatted)}
        initialValue={eventDateTime}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 18,
    outlineWidth: 0,
  },
  button: {
    height: 52,
    backgroundColor: '#6671E4',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  }
});
