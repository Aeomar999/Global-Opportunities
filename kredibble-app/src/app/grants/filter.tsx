import { useState } from 'react';
import { Colors } from '../../constants/design';
import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft, ChevronDown, ChevronUp, Search,
  MapPin, Briefcase, CircleMinus, Building2, Target, Award, Send, ArrowLeftRight,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';

// ─── Types ────────────────────────────────────────────────────────────────────

type Section = 'sectors' | 'applicantTypes' | 'fundingAgencies' | 'country' | 'purposes' | 'methods' | 'budget' | null;

// ─── Data ─────────────────────────────────────────────────────────────────────

const SECTORS = [
  'Administration', 'Advocacy', 'Agriculture and rural development', 'Border management',
  'Civic engineering', 'Community development & NGO', 'Culture & arts', 'Education',
  'Environment', 'Health', 'Human rights', 'Humanitarian aid', 'Infrastructure',
  'Legal & governance', 'Media & communications', 'Peacebuilding', 'Water & sanitation',
];

const APPLICANT_TYPES = [
  'NGOs / nonprofit organization', 'Government / public bodies', 'Academic institution',
  'Private sector', 'Unrestricted / unspecific', 'Individuals', 'Others',
];

const FUNDING_AGENCIES = [
  'AF - adaptation fund', 'Alliance - alliance for public health',
  'Academic institution', 'Others',
];

const COUNTRIES = [
  'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi',
  'Cameroon', 'Cape Verde', 'Chad', 'Congo', 'Ethiopia', 'Ghana',
  'Kenya', 'Mozambique', 'Nigeria', 'Rwanda', 'Senegal', 'Tanzania', 'Uganda', 'Zimbabwe',
];

const GRANT_PURPOSES = ['Project idea', 'Operational support'];

const APPLICATION_METHODS = ['Call for proposal', 'Letter of inquiry', 'By-invitation', 'Unspecified'];

const BUDGET_RANGES = [
  'GH₵ 0 – GH₵ 2,500',
  'GH₵ 6,000 – GH₵ 15,000',
  'GH₵ 15,000 – GH₵ 35,000',
  'GH₵ 35,000 – GH₵ 55,000+',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const RadioButton = ({ selected }: { selected: boolean }) => (
  <View style={{
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5,
    borderColor: selected ? Colors.primary : '#C4C4C4',
    justifyContent: 'center', alignItems: 'center',
  }}>
    {selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary }} />}
  </View>
);

const OptionRow = ({
  label, selected, onPress,
}: {
  label: string; selected: boolean; onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
  >
    <Text
      style={{ flex: 1, fontSize: 12, color: selected ? Colors.primary : '#1A1A1A', fontWeight: selected ? '500' : '400' }}
      className="font-sans"
    >
      {label}
    </Text>
    <RadioButton selected={selected} />
  </TouchableOpacity>
);

const SectionHeader = ({
  Icon, label, count, isOpen, hasSelections, onToggle,
}: {
  Icon: any; label: string; count: number; isOpen: boolean; hasSelections: boolean; onToggle: () => void;
}) => (
  <TouchableOpacity
    onPress={onToggle}
    style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}
  >
    <Icon size={20} color={hasSelections ? Colors.primary : '#A1A1AA'} style={{ marginRight: 12 }} />
    <Text
      style={{ fontSize: 12, color: hasSelections ? Colors.primary : '#8A8D9F', fontWeight: '500' }}
      className="font-sans"
    >
      {label}
    </Text>
    {count > 0 && (
      <View style={{
        backgroundColor: Colors.primary, borderRadius: 9999,
        width: 20, height: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 6,
      }}>
        <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>{count}</Text>
      </View>
    )}
    <View style={{ flex: 1 }} />
    {isOpen ? <ChevronUp size={18} color="#A1A1AA" /> : <ChevronDown size={18} color="#A1A1AA" />}
  </TouchableOpacity>
);

const SearchableSection = ({
  Icon, label, options, selected, onToggle, isOpen, onToggleOpen, searchable = true,
}: {
  Icon: any; label: string; options: string[]; selected: string[];
  onToggle: (val: string) => void; isOpen: boolean; onToggleOpen: () => void; searchable?: boolean;
}) => {
  const [query, setQuery] = useState('');
  const visible = searchable && query.trim()
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
      <SectionHeader
        Icon={Icon}
        label={label}
        count={selected.length}
        isOpen={isOpen}
        hasSelections={selected.length > 0}
        onToggle={onToggleOpen}
      />
      {isOpen && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          {searchable && (
            <>
              <TextInput
                placeholder="Search..."
                placeholderTextColor="#A1A1AA"
                value={query}
                onChangeText={setQuery}
                style={{ fontSize: 12, color: '#1A1A1A', paddingVertical: 8, outline: 'none' } as any}
                className="font-sans"
              />
              <View style={{ height: 1, backgroundColor: '#E5E6F2', marginBottom: 4 }} />
            </>
          )}
          {visible.map(opt => (
            <OptionRow
              key={opt}
              label={opt}
              selected={selected.includes(opt)}
              onPress={() => onToggle(opt)}
            />
          ))}
        </View>
      )}
    </View>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FilterGrantsScreen() {
  const router = useRouter();

  const [location, setLocation] = useState('');
  const [sectors, setSectors] = useState<string[]>([]);
  const [applicantTypes, setApplicantTypes] = useState<string[]>([]);
  const [fundingAgencies, setFundingAgencies] = useState<string[]>([]);
  const [country, setCountry] = useState<string[]>([]);
  const [purposes, setPurposes] = useState<string[]>([]);
  const [methods, setMethods] = useState<string[]>([]);
  const [budgetRange, setBudgetRange] = useState<string[]>([]);
  const [openSection, setOpenSection] = useState<Section>(null);

  const toggleSection = (section: Section) =>
    setOpenSection(prev => (prev === section ? null : section));

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>, val: string) =>
    setter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

  const filterCount =
    (location.trim() ? 1 : 0) +
    sectors.length +
    applicantTypes.length +
    fundingAgencies.length +
    country.length +
    purposes.length +
    methods.length +
    budgetRange.length;

  const handleApply = () => {
    router.replace({ pathname: '/grants', params: { filterCount: String(filterCount) } });
  };

  const handleReset = () => {
    setLocation('');
    setSectors([]);
    setApplicantTypes([]);
    setFundingAgencies([]);
    setCountry([]);
    setPurposes([]);
    setMethods([]);
    setBudgetRange([]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F9' }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/opportunities')} style={{ width: 32 }}>
          <ChevronLeft size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: '#1A1A1A' }} className="font-sans">
          Filter grants
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Search bar */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#FFFFFF', borderRadius: 15,
            paddingHorizontal: 16, height: 50, marginBottom: 8,
          }}
        >
          <Search size={18} color="#A1A1AA" style={{ marginRight: 10 }} />
          <Text style={{ flex: 1, fontSize: 12, color: '#A1A1AA' }} className="font-sans">
            Browse for grants
          </Text>
        </View>

        {/* Filter label */}
        <TouchableOpacity style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: '500' }} className="font-sans">Filter</Text>
        </TouchableOpacity>

        {/* Location */}
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 12, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}>
          <MapPin size={18} color="#A1A1AA" style={{ marginRight: 12 }} />
          <TextInput
            placeholder="Enter city or region"
            placeholderTextColor="#A1A1AA"
            value={location}
            onChangeText={setLocation}
            style={{ flex: 1, fontSize: 12, color: '#1A1A1A', outline: 'none' } as any}
            className="font-sans"
          />
        </View>

        {/* Sectors */}
        <SearchableSection
          Icon={Briefcase}
          label="Sectors"
          options={SECTORS}
          selected={sectors}
          onToggle={val => toggle(setSectors, val)}
          isOpen={openSection === 'sectors'}
          onToggleOpen={() => toggleSection('sectors')}
        />

        {/* Eligible Applicant Types */}
        <SearchableSection
          Icon={CircleMinus}
          label="Eligible Applicant Types"
          options={APPLICANT_TYPES}
          selected={applicantTypes}
          onToggle={val => toggle(setApplicantTypes, val)}
          isOpen={openSection === 'applicantTypes'}
          onToggleOpen={() => toggleSection('applicantTypes')}
        />

        {/* Funding Agencies */}
        <SearchableSection
          Icon={Building2}
          label="Funding Agencies"
          options={FUNDING_AGENCIES}
          selected={fundingAgencies}
          onToggle={val => toggle(setFundingAgencies, val)}
          isOpen={openSection === 'fundingAgencies'}
          onToggleOpen={() => toggleSection('fundingAgencies')}
        />

        {/* Eligible Applicant Country */}
        <SearchableSection
          Icon={Target}
          label="Eligible Applicant Country"
          options={COUNTRIES}
          selected={country}
          onToggle={val => toggle(setCountry, val)}
          isOpen={openSection === 'country'}
          onToggleOpen={() => toggleSection('country')}
        />

        {/* Grant Purposes (no search) */}
        <SearchableSection
          Icon={Award}
          label="Grant Purposes"
          options={GRANT_PURPOSES}
          selected={purposes}
          onToggle={val => toggle(setPurposes, val)}
          isOpen={openSection === 'purposes'}
          onToggleOpen={() => toggleSection('purposes')}
          searchable={false}
        />

        {/* Application Methods */}
        <SearchableSection
          Icon={Send}
          label="Application Methods"
          options={APPLICATION_METHODS}
          selected={methods}
          onToggle={val => toggle(setMethods, val)}
          isOpen={openSection === 'methods'}
          onToggleOpen={() => toggleSection('methods')}
        />

        {/* Budget range (no search) */}
        <SearchableSection
          Icon={ArrowLeftRight}
          label="Budget range"
          options={BUDGET_RANGES}
          selected={budgetRange}
          onToggle={val => toggle(setBudgetRange, val)}
          isOpen={openSection === 'budget'}
          onToggleOpen={() => toggleSection('budget')}
          searchable={false}
        />
      </ScrollView>

      {/* Footer buttons */}
      <View style={{
        flexDirection: 'row', gap: 12,
        paddingHorizontal: 20, paddingBottom: 24, paddingTop: 12,
        backgroundColor: '#F7F7F9',
      }}>
        <TouchableOpacity
          onPress={handleReset}
          style={{
            flex: 1, height: 47, borderRadius: 12,
            borderWidth: 1.5, borderColor: Colors.primary,
            justifyContent: 'center', alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 15, color: Colors.primary, fontWeight: '500' }} className="font-sans">
            Reset Filters
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleApply}
          style={{
            flex: 2, height: 47, borderRadius: 12,
            backgroundColor: Colors.primary,
            justifyContent: 'center', alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 15, color: '#FFFFFF', fontWeight: '600' }} className="font-sans">
            Apply Filters
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
