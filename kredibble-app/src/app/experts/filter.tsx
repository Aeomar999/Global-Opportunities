import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft, ChevronDown, ChevronUp, Search, Check,
  MapPin, Briefcase, Star, Globe, TrendingUp,
  Sprout, Lightbulb, Leaf, Crown
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, FontSize, FontWeight, Radius } from '../../constants/design';
import { professions, experienceLevels, ratingOptions, countries } from '../../constants/mockExperts';

type Section = 'city' | 'profession' | 'experience' | 'rating' | 'country' | null;

// ─── Sub-components ───────────────────────────────────────────────────────────

const RadioButton = ({ selected }: { selected: boolean }) => (
  <View style={{
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: selected ? Colors.primary : '#C4C4C4',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: selected ? Colors.primary : 'transparent',
  }}>
    {selected && <Check size={10} color="#FFFFFF" strokeWidth={3} />}
  </View>
);

const OptionRow = ({
  label, selected, onPress, customLeft
}: {
  label: string; selected: boolean; onPress: () => void; customLeft?: React.ReactNode;
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
  >
    {customLeft && <View style={{ marginRight: 12 }}>{customLeft}</View>}
    <Text
      style={{
        flex: 1,
        fontSize: 13,
        color: selected ? Colors.primary : Colors.textBody,
        fontWeight: selected ? '500' : '400'
      }}
      className="font-sans"
    >
      {label}
    </Text>
    <RadioButton selected={selected} />
  </TouchableOpacity>
);

const SectionHeader = ({
  Icon, label, selectedCount, isOpen, onToggle,
}: {
  Icon: any; label: string; selectedCount: number; isOpen: boolean; onToggle: () => void;
}) => {
  const hasSelection = selectedCount > 0;

  return (
    <TouchableOpacity
      onPress={onToggle}
      style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}
    >
      <Icon size={20} color={hasSelection ? Colors.primary : Colors.textPlaceholder} style={{ marginRight: 12 }} />
      <Text
        style={{ fontSize: 13, color: hasSelection ? Colors.primary : Colors.textMuted, fontWeight: '500' }}
        className="font-sans"
      >
        {label}
      </Text>
      {hasSelection && (
        <View style={{
          backgroundColor: Colors.primary,
          borderRadius: Radius.full,
          width: 20,
          height: 20,
          justifyContent: 'center',
          alignItems: 'center',
          marginLeft: 8,
        }}>
          <Text style={{ color: Colors.white, fontSize: 10, fontWeight: 'bold' }}>{selectedCount}</Text>
        </View>
      )}
      <View style={{ flex: 1 }} />
      {isOpen
        ? <ChevronUp size={18} color={Colors.textPlaceholder} />
        : <ChevronDown size={18} color={Colors.textPlaceholder} />}
    </TouchableOpacity>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FilterExpertsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    query?: string;
    city?: string;
    profession?: string;
    experience?: string;
    rating?: string;
    country?: string;
  }>();

  // Multi-select lists initialized from url parameters
  const [city, setCity] = useState(params.city || '');
  const [selectedProfessions, setSelectedProfessions] = useState<string[]>(
    params.profession ? params.profession.split(',') : []
  );
  const [selectedExperiences, setSelectedExperiences] = useState<string[]>(
    params.experience ? params.experience.split(',') : []
  );
  const [selectedRatings, setSelectedRatings] = useState<string[]>(
    params.rating ? params.rating.split(',') : []
  );
  const [selectedCountries, setSelectedCountries] = useState<string[]>(
    params.country ? params.country.split(',') : []
  );

  // Search filter query inside accordions
  const [professionSearch, setProfessionSearch] = useState('');
  const [countrySearch, setCountrySearch] = useState('');

  const [openSection, setOpenSection] = useState<Section>('profession'); // default open

  const toggleSection = (section: Section) =>
    setOpenSection(prev => (prev === section ? null : section));

  const toggleSelection = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, val: string) => {
    if (list.includes(val)) {
      setList(list.filter(item => item !== val));
    } else {
      setList([...list, val]);
    }
  };

  const handleApply = () => {
    // Merge new filters with existing main query (search term)
    const filterParams: Record<string, string> = {};
    
    if (params.query) filterParams.query = params.query;
    if (city.trim()) filterParams.city = city.trim();
    if (selectedProfessions.length > 0) filterParams.profession = selectedProfessions.join(',');
    if (selectedExperiences.length > 0) filterParams.experience = selectedExperiences.join(',');
    if (selectedRatings.length > 0) filterParams.rating = selectedRatings.join(',');
    if (selectedCountries.length > 0) filterParams.country = selectedCountries.join(',');

    router.replace({
      pathname: '/career',
      params: filterParams
    });
  };

  const handleReset = () => {
    setCity('');
    setSelectedProfessions([]);
    setSelectedExperiences([]);
    setSelectedRatings([]);
    setSelectedCountries([]);
    setProfessionSearch('');
    setCountrySearch('');
  };

  // Get experience level icon
  const getExperienceIcon = (iconName: string) => {
    const size = 18;
    const color = Colors.textMuted;
    switch (iconName) {
      case 'Sprout': return <Sprout size={size} color={color} />;
      case 'Lightbulb': return <Lightbulb size={size} color={color} />;
      case 'Leaf': return <Leaf size={size} color={color} />;
      case 'Crown': return <Crown size={size} color={color} />;
      default: return <Sprout size={size} color={color} />;
    }
  };

  // Render stars helper
  const renderStars = (ratingVal: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          size={14}
          color={i <= ratingVal ? '#F6B612' : '#C4C4C4'}
          fill={i <= ratingVal ? '#F6B612' : 'transparent'}
          style={{ marginRight: 2 }}
        />
      );
    }
    return <View style={{ flexDirection: 'row', alignItems: 'center' }}>{stars}</View>;
  };

  // Filtered lists for dropdown search
  const filteredProfessions = professions.filter(p =>
    p.toLowerCase().includes(professionSearch.toLowerCase())
  );

  const filteredCountries = countries.filter(c =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 32 }}>
          <ChevronLeft size={24} color={Colors.textHeading} />
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: FontSize.screenTitle, fontWeight: FontWeight.semibold, color: Colors.textHeading }} className="font-sans">
          Filter expert listing
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Search bar mock */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: Colors.white,
            borderRadius: Radius.searchBar,
            paddingHorizontal: 16,
            height: 50,
            marginBottom: 16,
          }}
        >
          <Search size={18} color={Colors.textPlaceholder} style={{ marginRight: 10 }} />
          <Text style={{ flex: 1, fontSize: 13, color: Colors.textPlaceholder }} className="font-sans">
            {params.query || 'Search for experts'}
          </Text>
        </View>

        {/* Filter label */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, color: Colors.primary, fontWeight: '500' }} className="font-sans">Filter</Text>
        </View>

        {/* Accordions */}

        {/* 1. Enter city or region */}
        <View style={{ backgroundColor: Colors.white, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
          <SectionHeader
            Icon={MapPin}
            label={city ? `City/Region: ${city}` : "Enter city or region"}
            selectedCount={city ? 1 : 0}
            isOpen={openSection === 'city'}
            onToggle={() => toggleSection('city')}
          />
          {openSection === 'city' && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderBottomWidth: 1,
                borderBottomColor: Colors.divider,
                height: 40
              }}>
                <MapPin size={16} color={Colors.textPlaceholder} style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="Accra"
                  placeholderTextColor={Colors.textPlaceholder}
                  value={city}
                  onChangeText={setCity}
                  style={{ flex: 1, fontSize: 13, color: Colors.textBody }}
                  className="font-sans"
                />
              </View>
            </View>
          )}
        </View>

        {/* 2. Profession */}
        <View style={{ backgroundColor: Colors.white, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
          <SectionHeader
            Icon={Briefcase}
            label="Profession"
            selectedCount={selectedProfessions.length}
            isOpen={openSection === 'profession'}
            onToggle={() => toggleSection('profession')}
          />
          {openSection === 'profession' && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              {/* Search text field inside dropdown */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderBottomWidth: 1,
                borderBottomColor: Colors.divider,
                height: 40,
                marginBottom: 12
              }}>
                <Search size={16} color={Colors.textPlaceholder} style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="Search..."
                  placeholderTextColor={Colors.textPlaceholder}
                  value={professionSearch}
                  onChangeText={setProfessionSearch}
                  style={{ flex: 1, fontSize: 13, color: Colors.textBody }}
                  className="font-sans"
                />
              </View>

              {filteredProfessions.map(opt => (
                <OptionRow
                  key={opt}
                  label={opt}
                  selected={selectedProfessions.includes(opt)}
                  onPress={() => toggleSelection(selectedProfessions, setSelectedProfessions, opt)}
                />
              ))}
            </View>
          )}
        </View>

        {/* 3. Experience Level */}
        <View style={{ backgroundColor: Colors.white, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
          <SectionHeader
            Icon={TrendingUp}
            label="Experience Level"
            selectedCount={selectedExperiences.length}
            isOpen={openSection === 'experience'}
            onToggle={() => toggleSection('experience')}
          />
          {openSection === 'experience' && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              {experienceLevels.map(opt => (
                <OptionRow
                  key={opt.label}
                  label={opt.label}
                  selected={selectedExperiences.includes(opt.label)}
                  onPress={() => toggleSelection(selectedExperiences, setSelectedExperiences, opt.label)}
                  customLeft={getExperienceIcon(opt.icon)}
                />
              ))}
            </View>
          )}
        </View>

        {/* 4. Rating */}
        <View style={{ backgroundColor: Colors.white, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
          <SectionHeader
            Icon={Star}
            label="Rating"
            selectedCount={selectedRatings.length}
            isOpen={openSection === 'rating'}
            onToggle={() => toggleSection('rating')}
          />
          {openSection === 'rating' && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              {ratingOptions.map(opt => (
                <OptionRow
                  key={opt.label}
                  label={opt.label}
                  selected={selectedRatings.includes(String(opt.value))}
                  onPress={() => toggleSelection(selectedRatings, setSelectedRatings, String(opt.value))}
                  customLeft={renderStars(opt.value)}
                />
              ))}
            </View>
          )}
        </View>

        {/* 5. Country */}
        <View style={{ backgroundColor: Colors.white, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
          <SectionHeader
            Icon={Globe}
            label="country"
            selectedCount={selectedCountries.length}
            isOpen={openSection === 'country'}
            onToggle={() => toggleSection('country')}
          />
          {openSection === 'country' && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              {/* Search text field inside dropdown */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderBottomWidth: 1,
                borderBottomColor: Colors.divider,
                height: 40,
                marginBottom: 12
              }}>
                <Search size={16} color={Colors.textPlaceholder} style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="Search..."
                  placeholderTextColor={Colors.textPlaceholder}
                  value={countrySearch}
                  onChangeText={setCountrySearch}
                  style={{ flex: 1, fontSize: 13, color: Colors.textBody }}
                  className="font-sans"
                />
              </View>

              {filteredCountries.map(opt => (
                <OptionRow
                  key={opt}
                  label={opt}
                  selected={selectedCountries.includes(opt)}
                  onPress={() => toggleSelection(selectedCountries, setSelectedCountries, opt)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom buttons */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          flexDirection: 'row',
          gap: 12,
          paddingHorizontal: 20,
          paddingVertical: 16,
          backgroundColor: Colors.bgScreen,
          borderTopWidth: 1,
          borderTopColor: Colors.borderDefault,
        }}
      >
        <TouchableOpacity
          onPress={handleReset}
          style={{
            flex: 1,
            height: 47,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: Colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: Colors.white,
          }}
        >
          <Text style={{ fontSize: 15, color: Colors.primary, fontWeight: '500' }} className="font-sans">
            Reset Filters
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleApply}
          style={{
            flex: 2,
            height: 47,
            borderRadius: 12,
            backgroundColor: Colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 15, color: Colors.white, fontWeight: '600' }} className="font-sans">
            Apply Filters
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
