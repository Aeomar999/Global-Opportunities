import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Search } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, FontSize, FontWeight, Radius } from '../../constants/design';

const POPULAR_SUGGESTIONS = [
  'Software developer',
  'Enoch',
  'Frontend developer',
  'Figma',
  'Cybersecurity specialist'
];

export default function SearchExpertsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const [query, setQuery] = useState(params.query || '');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Focus input on mount
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  const handleSearchSubmit = (searchTerm: string) => {
    const finalSearch = searchTerm.trim();
    
    // Merge new query with existing filters
    const searchParams = { ...params };
    if (finalSearch) {
      searchParams.query = finalSearch;
    } else {
      delete searchParams.query;
    }

    // Go back to the career list screen with params
    router.replace({
      pathname: '/career',
      params: searchParams
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgScreen }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 32 }}>
          <ChevronLeft size={24} color={Colors.textHeading} />
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: FontSize.screenTitle, fontWeight: FontWeight.semibold, color: Colors.textHeading }} className="font-sans">
          Search expert listing
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={{ paddingHorizontal: 20, flex: 1 }}>
        {/* Search Input */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: Colors.white,
            borderRadius: Radius.searchBar,
            paddingHorizontal: 16,
            height: 50,
            marginBottom: 20,
          }}
        >
          <Search size={18} color={Colors.textPlaceholder} style={{ marginRight: 10 }} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => handleSearchSubmit(query)}
            placeholder="Search for experts or profession"
            placeholderTextColor={Colors.textPlaceholder}
            returnKeyType="search"
            style={{
              flex: 1,
              fontSize: 13,
              color: Colors.textBody,
              height: '100%',
              paddingVertical: 0,
            }}
            className="font-sans"
          />
        </View>

        {/* Popular Searches header */}
        <Text style={{ fontSize: 13, color: Colors.primary, fontWeight: '500', marginBottom: 12 }} className="font-sans">
          Popular searches
        </Text>

        {/* Suggestions List */}
        <FlatList
          data={POPULAR_SUGGESTIONS}
          keyExtractor={item => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleSearchSubmit(item)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: Colors.divider,
              }}
            >
              <Search size={16} color={Colors.textPlaceholder} style={{ marginRight: 12 }} />
              <Text style={{ fontSize: 13, color: Colors.textSecondary }} className="font-sans">
                {item}
              </Text>
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}
