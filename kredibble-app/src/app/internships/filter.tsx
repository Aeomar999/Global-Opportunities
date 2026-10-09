import { useState } from 'react';
import { Colors } from '../../constants/design';
import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft, ChevronDown, ChevronUp, Search,
  MapPin, Briefcase, TrendingUp, Building2,
  Shuffle, Settings2, Network, FileText,
  Sprout, CircleDot, Cloud, Crown,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';

// ─── Types ────────────────────────────────────────────────────────────────────

type Section = 'workType' | 'experience' | 'orgType' | null;

// ─── Data ─────────────────────────────────────────────────────────────────────

const WORK_TYPES = [
  { label: 'Remote',              Icon: Shuffle   },
  { label: 'Hybrid',              Icon: Settings2 },
  { label: 'On-Site',             Icon: Network   },
  { label: 'Freelance / Contract', Icon: FileText },
];

const EXPERIENCE_LEVELS = [
  { label: 'Beginner',     Icon: Sprout    },
  { label: 'Entry Level',  Icon: CircleDot },
  { label: 'Intermediate', Icon: Cloud     },
  { label: 'Senior',       Icon: Crown     },
];

const ORG_TYPES = [
  { label: 'NGO',               Icon: Sprout    },
  { label: 'Startup',           Icon: CircleDot },
  { label: 'University',        Icon: Cloud     },
  { label: 'Government',        Icon: Crown     },
  { label: 'Corporate Company', Icon: Crown     },
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
  Icon, label, selected, onPress,
}: {
  Icon: any; label: string; selected: boolean; onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
  >
    <Icon size={18} color={selected ? Colors.primary : '#A1A1AA'} style={{ marginRight: 12 }} />
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
    {isOpen
      ? <ChevronUp size={18} color="#A1A1AA" />
      : <ChevronDown size={18} color="#A1A1AA" />}
  </TouchableOpacity>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FilterInternshipsScreen() {
  const router = useRouter();

  const [location, setLocation] = useState('');
  const [workType, setWorkType] = useState<string[]>([]);
  const [experienceLevel, setExperienceLevel] = useState<string[]>([]);
  const [orgType, setOrgType] = useState<string[]>([]);
  const [openSection, setOpenSection] = useState<Section>(null);

  const toggleSection = (section: Section) =>
    setOpenSection(prev => (prev === section ? null : section));

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>, val: string) =>
    setter(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

  const filterCount =
    (location.trim() ? 1 : 0) +
    workType.length +
    experienceLevel.length +
    orgType.length;

  const handleApply = () => {
    router.replace({ pathname: '/internships', params: { filterCount: String(filterCount) } });
  };

  const handleReset = () => {
    setLocation('');
    setWorkType([]);
    setExperienceLevel([]);
    setOrgType([]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F9' }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/opportunities')} style={{ width: 32 }}>
          <ChevronLeft size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: '#1A1A1A' }} className="font-sans">
          Filter internships
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
            Browse for internships
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

        {/* Work type */}
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
          <SectionHeader
            Icon={Briefcase}
            label="Work type"
            count={workType.length}
            isOpen={openSection === 'workType'}
            hasSelections={workType.length > 0}
            onToggle={() => toggleSection('workType')}
          />
          {openSection === 'workType' && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              {WORK_TYPES.map(({ label, Icon }) => (
                <OptionRow
                  key={label}
                  Icon={Icon}
                  label={label}
                  selected={workType.includes(label)}
                  onPress={() => toggle(setWorkType, label)}
                />
              ))}
            </View>
          )}
        </View>

        {/* Experience level */}
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
          <SectionHeader
            Icon={TrendingUp}
            label="Experience Level"
            count={experienceLevel.length}
            isOpen={openSection === 'experience'}
            hasSelections={experienceLevel.length > 0}
            onToggle={() => toggleSection('experience')}
          />
          {openSection === 'experience' && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              {EXPERIENCE_LEVELS.map(({ label, Icon }) => (
                <OptionRow
                  key={label}
                  Icon={Icon}
                  label={label}
                  selected={experienceLevel.includes(label)}
                  onPress={() => toggle(setExperienceLevel, label)}
                />
              ))}
            </View>
          )}
        </View>

        {/* Organization type */}
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
          <SectionHeader
            Icon={Building2}
            label="Organization Type"
            count={orgType.length}
            isOpen={openSection === 'orgType'}
            hasSelections={orgType.length > 0}
            onToggle={() => toggleSection('orgType')}
          />
          {openSection === 'orgType' && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              {ORG_TYPES.map(({ label, Icon }) => (
                <OptionRow
                  key={label}
                  Icon={Icon}
                  label={label}
                  selected={orgType.includes(label)}
                  onPress={() => toggle(setOrgType, label)}
                />
              ))}
            </View>
          )}
        </View>
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
