import React, { useState, useEffect } from 'react';
import { Colors } from '../../constants/design';
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import { authStore, ManagedGroup } from '../../constants/authStore';

export default function MyChannelsScreen() {
  const router = useRouter();
  const [managedGroups, setManagedGroups] = useState<ManagedGroup[]>(authStore.managedGroups);

  useEffect(() => {
    const unsubscribe = authStore.subscribe(() => setManagedGroups([...authStore.managedGroups]));
    return unsubscribe;
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <ChevronLeft size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} className="font-sans">My Channels</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/community')}
          activeOpacity={0.8}
          style={styles.createBanner}
        >
          <Plus size={18} color={Colors.primary} strokeWidth={3} />
          <Text style={styles.createBannerText} className="font-sans">Create a new channel in Community</Text>
        </TouchableOpacity>

        <Text style={styles.sectionHeader} className="font-sans">
          {managedGroups.length} channel{managedGroups.length === 1 ? '' : 's'} managed by you
        </Text>

        {managedGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText} className="font-sans">You haven&apos;t created any channels yet.</Text>
          </View>
        ) : (
          managedGroups.map(group => (
            <TouchableOpacity
              key={group.id}
              onPress={() => router.push({ pathname: '/community/feed', params: { id: group.id } })}
              activeOpacity={0.8}
              style={styles.card}
            >
              <Image source={{ uri: group.avatar }} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} className="font-sans">{group.name}</Text>
                <Text style={styles.cardSubtitle} className="font-sans">{group.category} • {group.members}</Text>
              </View>
              <ChevronRight size={18} color="#A1A1AA" />
            </TouchableOpacity>
          ))
        )}
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
  createBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primaryTransparent, borderRadius: 12, paddingVertical: 14, marginBottom: 20,
  },
  createBannerText: { fontSize: 13, color: Colors.primary, fontWeight: 'bold' },
  sectionHeader: { fontSize: 13, color: '#8A8D9F', fontWeight: '500', marginBottom: 12 },
  emptyState: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#8A8D9F' },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#E5E6F2', marginBottom: 12,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#1A1A1A' },
  cardSubtitle: { fontSize: 12, color: '#8A8D9F', marginTop: 2 },
});
