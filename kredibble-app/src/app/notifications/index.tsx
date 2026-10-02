import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Users, MessageCircle, Hash, ShieldCheck, Info } from 'lucide-react-native';
import { notificationStore, NotificationItem, NotificationType } from '../../constants/mockNotifications';

const TYPE_META: Record<NotificationType, { Icon: any; color: string }> = {
  applicant: { Icon: Users, color: '#6671E4' },
  message: { Icon: MessageCircle, color: '#10B981' },
  channel: { Icon: Hash, color: '#F59E0B' },
  verification: { Icon: ShieldCheck, color: '#16A34A' },
  system: { Icon: Info, color: '#8A8D9F' },
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>(notificationStore.items);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const { authStore } = require('../../constants/authStore');
        const { getNotifications } = require('../../lib/api');
        const userId = authStore.user?.id;
        if (userId) {
          const apiNotifications = await getNotifications(userId);
          if (apiNotifications && apiNotifications.length > 0) {
            notificationStore.items = apiNotifications;
            setItems(apiNotifications);
            notificationStore.notify();
          }
        }
      } catch (err) {
        console.warn('Failed to load notifications from API', err);
      }
    };
    fetchNotifications();

    const unsubscribe = notificationStore.subscribe(() => setItems([...notificationStore.items]));
    return unsubscribe;
  }, []);

  const handlePress = (item: NotificationItem) => {
    notificationStore.markRead(item.id);
    switch (item.type) {
      case 'applicant':
        router.push({ pathname: '/(tabs)/opportunities', params: { view: 'all' } });
        break;
      case 'message':
      case 'channel':
        router.push('/(tabs)/community');
        break;
      case 'verification':
        router.push('/hirer-profile/verification');
        break;
      default:
        break;
    }
  };

  const unreadCount = items.filter(n => !n.read).length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <ChevronLeft size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} className="font-sans">Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={() => notificationStore.markAllRead()} style={styles.markAllButton}>
            <Text style={styles.markAllText} className="font-sans">Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText} className="font-sans">You&apos;re all caught up.</Text>
          </View>
        ) : (
          items.map(item => {
            const meta = TYPE_META[item.type];
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => handlePress(item)}
                activeOpacity={0.8}
                style={[styles.card, !item.read && styles.cardUnread]}
              >
                <View style={[styles.iconWrap, { backgroundColor: meta.color }]}>
                  <meta.Icon size={18} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.cardTitle} className="font-sans">{item.title}</Text>
                    {!item.read && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.cardBody} className="font-sans">{item.body}</Text>
                  <Text style={styles.cardTime} className="font-sans">{item.time}</Text>
                </View>
              </TouchableOpacity>
            );
          })
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
  markAllButton: { paddingHorizontal: 8, paddingVertical: 8 },
  markAllText: { fontSize: 12, color: '#6671E4', fontWeight: '600' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  emptyState: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#8A8D9F' },
  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#E5E6F2', marginBottom: 12,
  },
  cardUnread: { backgroundColor: '#F8F9FF', borderColor: '#DDE1FA' },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  unreadDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#6671E4' },
  cardBody: { fontSize: 12, color: '#595959', marginTop: 4, lineHeight: 17 },
  cardTime: { fontSize: 11, color: '#A1A1AA', marginTop: 6 },
});
