import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Search, SlidersHorizontal } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, FontWeight, Radius } from '../../constants/design';

const SUGGESTIONS = [
  'conference',
  'conference in 2026',
  'free events in accra',
  'fully funded international conference',
  'events in kumasi',
  'accra',
];

export default function SearchEventsScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? SUGGESTIONS.filter(s => s.toLowerCase().includes(query.toLowerCase()))
    : SUGGESTIONS;

  const selectSearchQuery = (text: string) => {
    // When a query is selected, navigate back to main listing with it (or filter search locally)
    router.replace({
      pathname: '/events',
      params: { searchQuery: text }
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/events')} style={{ width: 32 }}>
          <ChevronLeft size={24} color={Colors.textHeading} />
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: FontSize.screenTitle, fontWeight: FontWeight.semibold, color: Colors.textHeading }} className="font-sans">
          Search events
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* Search bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: Colors.white,
            borderRadius: Radius.searchBar,
            paddingHorizontal: 16,
            height: 50,
            marginBottom: 24,
          }}
        >
          <Search size={18} color={Colors.textPlaceholder} style={{ marginRight: 10 }} />
          <TextInput
            autoFocus
            placeholder="Browse for events or location"
            placeholderTextColor={Colors.textPlaceholder}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => selectSearchQuery(query)}
            style={{ flex: 1, fontSize: 14, color: Colors.textBody, outline: 'none' } as any}
            className="font-sans"
          />
          <TouchableOpacity onPress={() => router.push('/events/filter' as any)}>
            <SlidersHorizontal size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Suggestions */}
        {filtered.map((item, i) => (
          <View key={item}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}
              onPress={() => selectSearchQuery(item)}
            >
              <Search size={16} color={Colors.textPlaceholder} style={{ marginRight: 14 }} />
              <Text style={{ fontSize: 14, color: Colors.textMuted, fontWeight: '400' }} className="font-sans">
                {item}
              </Text>
            </TouchableOpacity>
            {i < filtered.length - 1 && (
              <View style={{ height: 1, backgroundColor: Colors.borderDefault }} />
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
