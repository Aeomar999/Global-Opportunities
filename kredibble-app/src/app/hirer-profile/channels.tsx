import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react-native';
import { authStore, ManagedGroup } from '../../constants/authStore';
import { getChannels, deleteChannel } from '../../lib/api';
import { useToast } from '../../components/ui/ToastProvider';

export default function MyChannelsScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [managedGroups, setManagedGroups] = useState<ManagedGroup[]>(authStore.managedGroups);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchMyChannels = async () => {
    setLoading(true);
    try {
      const data = await getChannels();
      const userId = authStore.user?.id;

      const myChannels = (Array.isArray(data) ? data : []).filter((c: any) => {
        if (!userId) return true;
        return (
          c.createdBy === userId ||
          c.createdBy?._id === userId ||
          c.ownerId === userId
        );
      });

      const mapped: ManagedGroup[] = myChannels.map((c: any) => ({
        id: String(c.id || c._id),
        name: c.name || 'Untitled Channel',
        category: c.category || 'General',
        members: `${c.membersCount || (Array.isArray(c.memberIds) ? c.memberIds.length : 1)} members`,
        bio: c.bio || '',
        avatar:
          c.avatar ||
          'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=120&auto=format&fit=crop&q=80',
      }));

      setManagedGroups(mapped);
    } catch (err: any) {
      console.warn('Failed to load my channels:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyChannels();
    const unsubscribe = authStore.subscribe(() => setManagedGroups([...authStore.managedGroups]));
    return unsubscribe;
  }, []);

  const handleDelete = (group: ManagedGroup) => {
    Alert.alert(
      'Delete Channel',
      `Are you sure you want to delete "${group.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(group.id);
              await deleteChannel(group.id);
              setManagedGroups((prev) => prev.filter((g) => g.id !== group.id));
              showToast('Channel deleted successfully', 'success');
            } catch (err: any) {
              showToast(err.message || 'Failed to delete channel', 'info');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

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
          <Plus size={18} color="#6671E4" strokeWidth={3} />
          <Text style={styles.createBannerText} className="font-sans">
            Create a new channel in Community
          </Text>
        </TouchableOpacity>

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#6671E4" />
            <Text style={{ marginTop: 12, color: '#8A8D9F', fontSize: 13 }} className="font-sans">
              Loading your channels...
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionHeader} className="font-sans">
              {managedGroups.length} channel{managedGroups.length === 1 ? '' : 's'} managed by you
            </Text>

            {managedGroups.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle} className="font-sans">No channels yet</Text>
                <Text style={styles.emptyText} className="font-sans">
                  You haven&apos;t created any community channels yet.
                </Text>
              </View>
            ) : (
              managedGroups.map((group) => {
                const isDeleting = deletingId === group.id;
                return (
                  <View key={group.id} style={styles.card}>
                    <TouchableOpacity
                      onPress={() => router.push({ pathname: '/community/feed', params: { id: group.id } })}
                      activeOpacity={0.8}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                    >
                      <Image source={{ uri: group.avatar }} style={styles.avatar} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle} numberOfLines={1} className="font-sans">
                          {group.name}
                        </Text>
                        <Text style={styles.cardSubtitle} className="font-sans">
                          {group.category} • {group.members}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.cardActions}>
                      {isDeleting ? (
                        <ActivityIndicator size="small" color="#EF4444" style={{ marginHorizontal: 8 }} />
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleDelete(group)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          style={styles.deleteButton}
                        >
                          <Trash2 size={16} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                      <ChevronRight size={18} color="#A1A1AA" />
                    </View>
                  </View>
                );
              })
            )}
          </>
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
    backgroundColor: '#EEF2FF', borderRadius: 12, paddingVertical: 14, marginBottom: 20,
  },
  createBannerText: { fontSize: 13, color: '#6671E4', fontWeight: 'bold' },
  sectionHeader: { fontSize: 13, color: '#8A8D9F', fontWeight: '500', marginBottom: 12 },
  emptyState: { paddingVertical: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#8A8D9F' },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#E5E6F2', marginBottom: 12,
  },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deleteButton: { padding: 4 },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#1A1A1A' },
  cardSubtitle: { fontSize: 12, color: '#8A8D9F', marginTop: 2 },
});
