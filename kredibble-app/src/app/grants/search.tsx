import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Search, SlidersHorizontal } from 'lucide-react-native';
import { useRouter } from 'expo-router';

const SUGGESTIONS = [
  'Tech grant',
  'small grants',
  'partnership grant',
  'business',
  'business grants',
];

export default function SearchGrantsScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? SUGGESTIONS.filter(s => s.toLowerCase().includes(query.toLowerCase()))
    : SUGGESTIONS;

  const handleSearch = (searchQuery: string) => {
    router.push({ pathname: '/grants', params: { query: searchQuery } });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F9' }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/opportunities')} style={{ width: 32 }}>
          <ChevronLeft size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: '#1A1A1A' }} className="font-sans">
          Search grants
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        {/* Search bar */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#FFFFFF', borderRadius: 15,
            paddingHorizontal: 16, height: 50, marginBottom: 24,
            shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
          }}
        >
          <Search size={18} color="#A1A1AA" style={{ marginRight: 10 }} />
          <TextInput
            autoFocus
            placeholder="Browse for grants"
            placeholderTextColor="#A1A1AA"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => handleSearch(query)}
            style={{ flex: 1, fontSize: 14, color: '#1A1A1A', outline: 'none' } as any}
            className="font-sans"
          />
          <TouchableOpacity onPress={() => router.push('/grants/filter' as any)}>
            <SlidersHorizontal size={18} color="#6671E4" />
          </TouchableOpacity>
        </View>

        {/* Suggestions */}
        <ScrollView showsVerticalScrollIndicator={false}>
          {filtered.map((item, i) => (
            <View key={item}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}
                onPress={() => handleSearch(item)}
              >
                <Search size={16} color="#A1A1AA" style={{ marginRight: 14 }} />
                <Text style={{ fontSize: 14, color: '#8A8D9F', fontWeight: '400' }} className="font-sans">
                  {item}
                </Text>
              </TouchableOpacity>
              {i < filtered.length - 1 && (
                <View style={{ height: 1, backgroundColor: '#E5E6F2' }} />
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
