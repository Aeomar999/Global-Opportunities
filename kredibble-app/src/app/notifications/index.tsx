import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Users, MessageCircle, Hash, ShieldCheck, Info, Briefcase, FileCheck, CalendarClock, BellOff, CheckCheck, Clock, Megaphone,
} from 'lucide-react-native';
import { Colors, Radius } from '../../constants/design';
import { Header } from '../../components/ui/Header';
import { authStore } from '../../constants/authStore';
import { markNotificationRead } from '../../lib/api';
import { isServerNotificationId, syncNotifications } from '../../lib/notifications';
import { notificationStore, NotificationItem, NotificationType } from '../../constants/mockNotifications';

// Icon colour is the dot value of each state colour; the tinted circle behind it is the same colour at low opacity.
const TYPE_META: Record<NotificationType, { Icon: any; color: string; tint: string }> = {
  applicant: { Icon: Users, color: Colors.primary, tint: Colors.primary10 },
  opportunity: { Icon: Briefcase, color: Colors.primary, tint: Colors.primary10 },
  application: { Icon: FileCheck, color: Colors.successDot, tint: Colors.successTint },
  verification: { Icon: ShieldCheck, color: Colors.successDot, tint: Colors.successTint },
  message: { Icon: MessageCircle, color: Colors.primary, tint: Colors.primary10 },
  channel: { Icon: Hash, color: Colors.accent500, tint: Colors.accent50 },
  event: { Icon: CalendarClock, color: Colors.accent500, tint: Colors.accent50 },
  ambassador: { Icon: Megaphone, color: Colors.accent500, tint: Colors.accent50 },
  system: { Icon: Info, color: Colors.textMuted, tint: Colors.bgScreen },
};

type Filter = 'all' | 'unread';

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>(() => {
    notificationStore.init(authStore.role === 'hirer' ? 'hirer' : 'seeker');
    return [...notificationStore.items];
  });
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    syncNotifications();
    return notificationStore.subscribe(() => setItems([...notificationStore.items]));
  }, []);

  const unreadCount = items.filter(n => !n.read).length;
  const visible = useMemo(() => (filter === 'unread' ? items.filter(n => !n.read) : items), [items, filter]);
  const fresh = visible.filter(n => !n.read);
  const earlier = visible.filter(n => n.read);

  const handlePress = (item: NotificationItem) => {
    notificationStore.markRead(item.id);
    if (isServerNotificationId(item.id)) markNotificationRead(item.id).catch(() => {});
    switch (item.type) {
      case 'applicant':
        router.push({ pathname: '/(tabs)/opportunities', params: { view: 'all' } });
        break;
      case 'opportunity':
        router.push('/(tabs)/opportunities');
        break;
      case 'application':
        router.push('/profile/applications' as any);
        break;
      case 'event':
        router.push('/events' as any);
        break;
      case 'ambassador':
        router.push('/(tabs)/profile');
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

  const renderCard = (item: NotificationItem) => {
    const meta = TYPE_META[item.type] ?? TYPE_META.system;
    return (
      <TouchableOpacity
        key={item.id}
        onPress={() => handlePress(item)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.body}`}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          backgroundColor: Colors.bgCard,
          borderRadius: Radius.card,
          borderWidth: 1,
          borderColor: item.read ? Colors.borderDefault : Colors.purple200,
          padding: 14,
          marginBottom: 10,
          overflow: 'hidden',
        }}
      >
        {!item.read && (
          <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: Colors.primary }} />
        )}
        <View
          style={{
            width: 44, height: 44, borderRadius: 22, backgroundColor: meta.tint,
            alignItems: 'center', justifyContent: 'center', marginRight: 12,
          }}
        >
          <meta.Icon size={20} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text
              numberOfLines={1}
              style={{ flex: 1, fontSize: 14, color: Colors.textBody }}
              className="font-heading font-bold"
            >
              {item.title}
            </Text>
            {!item.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent500 }} />}
          </View>
          <Text style={{ fontSize: 13, lineHeight: 19, color: Colors.textMuted, marginTop: 4 }} className="font-sans">
            {item.body}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
            <Clock size={11} color={Colors.textMuted} />
            <Text style={{ fontSize: 11, color: Colors.textMuted }} className="font-sans">{item.time}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const sectionTitle = (label: string, count: number) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 10 }}>
      <Text style={{ fontSize: 15, color: Colors.textBody }} className="font-heading font-bold">{label}</Text>
      <View style={{ backgroundColor: Colors.primary10, borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.primary }}>{count}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }} edges={['top', 'left', 'right']}>
      <Header title="Notifications" showBack />

      {/* Filter chips */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 14, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.borderDefault }}>
        {([['all', 'All'], ['unread', `Unread${unreadCount ? ` (${unreadCount})` : ''}`]] as const).map(([key, label]) => {
          const active = filter === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setFilter(key)}
              activeOpacity={0.85}
              style={{
                paddingHorizontal: 16, height: 36, borderRadius: 18, justifyContent: 'center',
                backgroundColor: active ? Colors.primary : Colors.bgCard,
                borderWidth: 1, borderColor: active ? Colors.primary : Colors.borderDefault,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: active ? Colors.white : Colors.textMuted }}>{label}</Text>
            </TouchableOpacity>
          );
        })}
        <View style={{ flex: 1 }} />
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={() => notificationStore.markAllRead()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Mark all as read"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 36 }}
          >
            <CheckCheck size={16} color={Colors.primary} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.primary }}>Read all</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={{ backgroundColor: Colors.bgScreen }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {visible.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}>
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.primary10, alignItems: 'center', justifyContent: 'center' }}>
              <BellOff size={36} color={Colors.primary} strokeWidth={1.6} />
            </View>
            <Text style={{ fontSize: 17, color: Colors.textBody, marginTop: 20 }} className="font-heading font-bold">
              {filter === 'unread' ? 'No unread notifications' : "You're all caught up"}
            </Text>
            <Text style={{ fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center' }} className="font-sans">
              {filter === 'unread' ? 'Everything has been read.' : 'New updates will appear here.'}
            </Text>
          </View>
        ) : (
          <>
            {fresh.length > 0 && (
              <>
                {sectionTitle('New', fresh.length)}
                {fresh.map(renderCard)}
              </>
            )}
            {earlier.length > 0 && (
              <>
                {sectionTitle('Earlier', earlier.length)}
                {earlier.map(renderCard)}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
