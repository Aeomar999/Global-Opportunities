import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft, ChevronDown, ChevronUp, Search,
  Calendar, MapPin, Grid, Ticket, Globe
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, FontSize, FontWeight, Radius } from '../../constants/design';

type Section = 'date' | 'region' | 'category' | 'ticketType' | 'eventType' | null;

// ─── Filter Options ───────────────────────────────────────────────────────────

const DATE_OPTIONS = ['Any date', 'Today', 'Tomorrow', 'This week', 'This weekend'];

const REGION_OPTIONS = [
  'Greater Accra Region', 'Ashanti Region', 'Western Region', 'Eastern Region',
  'Central Region', 'Volta Region', 'Northern Region', 'Upper East Region',
  'Upper West Region', 'Bono Region', 'Bono East Region'
];

const CATEGORY_OPTIONS = ['Business', 'Music', 'Tech', 'Health', 'Fashion'];

const TICKET_OPTIONS = ['Free', 'Paid'];

const EVENT_TYPE_OPTIONS = ['In-person', 'Online'];

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
      style={{ flex: 1, fontSize: 13, color: selected ? Colors.primary : Colors.textBody, fontWeight: selected ? '500' : '400' }}
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

export default function FilterEventsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    date?: string;
    region?: string;
    category?: string;
    ticketType?: string;
    eventType?: string;
  }>();

  // Initialize states with params split into arrays if present
  const [date, setDate] = useState<string[]>(params.date ? params.date.split(',') : []);
  const [region, setRegion] = useState<string[]>(params.region ? params.region.split(',') : []);
  const [category, setCategory] = useState<string[]>(params.category ? params.category.split(',') : []);
  const [ticketType, setTicketType] = useState<string[]>(params.ticketType ? params.ticketType.split(',') : []);
  const [eventType, setEventType] = useState<string[]>(params.eventType ? params.eventType.split(',') : []);
  const [openSection, setOpenSection] = useState<Section>(null);

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
    // Construct filter params dynamically
    const filterParams: Record<string, string> = {};
    if (date.length > 0) filterParams.date = date.join(',');
    if (region.length > 0) filterParams.region = region.join(',');
    if (category.length > 0) filterParams.category = category.join(',');
    if (ticketType.length > 0) filterParams.ticketType = ticketType.join(',');
    if (eventType.length > 0) filterParams.eventType = eventType.join(',');

    router.replace({
      pathname: '/events',
      params: filterParams
    });
  };

  const handleReset = () => {
    setDate([]);
    setRegion([]);
    setCategory([]);
    setTicketType([]);
    setEventType([]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/events')} style={{ width: 32 }}>
          <ChevronLeft size={24} color={Colors.textHeading} />
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: FontSize.screenTitle, fontWeight: FontWeight.semibold, color: Colors.textHeading }} className="font-sans">
          Filter events
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
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
            Browse for events or location
          </Text>
        </View>

        {/* Filter label */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 13, color: Colors.primary, fontWeight: '500' }} className="font-sans">Filter</Text>
        </View>

        {/* Accordions */}
        {/* 1. Date */}
        <View style={{ backgroundColor: Colors.white, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
          <SectionHeader
            Icon={Calendar}
            label="Date"
            selectedCount={date.length}
            isOpen={openSection === 'date'}
            onToggle={() => toggleSection('date')}
          />
          {openSection === 'date' && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              {DATE_OPTIONS.map(opt => (
                <OptionRow
                  key={opt}
                  label={opt}
                  selected={opt === 'Any date' ? date.length === 0 : date.includes(opt)}
                  onPress={() => {
                    if (opt === 'Any date') {
                      setDate([]);
                    } else {
                      toggleSelection(date, setDate, opt);
                    }
                  }}
                />
              ))}
            </View>
          )}
        </View>

        {/* 2. Region */}
        <View style={{ backgroundColor: Colors.white, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
          <SectionHeader
            Icon={MapPin}
            label="Region"
            selectedCount={region.length}
            isOpen={openSection === 'region'}
            onToggle={() => toggleSection('region')}
          />
          {openSection === 'region' && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              {REGION_OPTIONS.map(opt => (
                <OptionRow
                  key={opt}
                  label={opt}
                  selected={region.includes(opt)}
                  onPress={() => toggleSelection(region, setRegion, opt)}
                />
              ))}
            </View>
          )}
        </View>

        {/* 3. Category */}
        <View style={{ backgroundColor: Colors.white, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
          <SectionHeader
            Icon={Grid}
            label="Category"
            selectedCount={category.length}
            isOpen={openSection === 'category'}
            onToggle={() => toggleSection('category')}
          />
          {openSection === 'category' && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              {CATEGORY_OPTIONS.map(opt => (
                <OptionRow
                  key={opt}
                  label={opt}
                  selected={category.includes(opt)}
                  onPress={() => toggleSelection(category, setCategory, opt)}
                />
              ))}
            </View>
          )}
        </View>

        {/* 4. Ticket type */}
        <View style={{ backgroundColor: Colors.white, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
          <SectionHeader
            Icon={Ticket}
            label="Ticket type"
            selectedCount={ticketType.length}
            isOpen={openSection === 'ticketType'}
            onToggle={() => toggleSection('ticketType')}
          />
          {openSection === 'ticketType' && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              {TICKET_OPTIONS.map(opt => (
                <OptionRow
                  key={opt}
                  label={opt}
                  selected={ticketType.includes(opt)}
                  onPress={() => toggleSelection(ticketType, setTicketType, opt)}
                />
              ))}
            </View>
          )}
        </View>

        {/* 5. Event type */}
        <View style={{ backgroundColor: Colors.white, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
          <SectionHeader
            Icon={Globe}
            label="Event type"
            selectedCount={eventType.length}
            isOpen={openSection === 'eventType'}
            onToggle={() => toggleSection('eventType')}
          />
          {openSection === 'eventType' && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              {EVENT_TYPE_OPTIONS.map(opt => (
                <OptionRow
                  key={opt}
                  label={opt}
                  selected={eventType.includes(opt)}
                  onPress={() => toggleSelection(eventType, setEventType, opt)}
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
