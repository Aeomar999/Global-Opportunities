import { notificationStore, NotificationItem, NotificationType } from '../constants/mockNotifications';
import { authStore } from '../constants/authStore';
import { getNotifications } from './api';

const KNOWN_TYPES: NotificationType[] = [
  'applicant', 'message', 'channel', 'verification', 'system', 'opportunity', 'application', 'event', 'ambassador',
];

const timeAgo = (iso?: string) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(t)) return '';
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};

/** Turns a server notification (title, message, type, createdAt, readAt) into the shape the app screens use. */
const fromApi = (n: any): NotificationItem => {
  const id = String(n._id ?? n.id);
  const existing = notificationStore.items.find(i => i.id === id);
  return {
    id,
    type: KNOWN_TYPES.includes(n.type) ? n.type : 'system',
    title: n.title ?? 'Notification',
    body: n.message ?? n.body ?? '',
    time: timeAgo(n.createdAt) || n.time || '',
    read: existing?.read ?? !!n.readAt,
  };
};

/** True for ids that belong to a real server record (the sample notifications use short ids such as "s-1"). */
export const isServerNotificationId = (id: string) => /^[a-f\d]{24}$/i.test(id);

/**
 * Loads the signed-in user's notifications from the server into the shared store, so the Home bell and the
 * Notifications screen agree. The sample list stays when the server has nothing yet or cannot be reached.
 */
export async function syncNotifications(): Promise<void> {
  if (!authStore.user?.id) return;
  try {
    const api = await getNotifications();
    if (!Array.isArray(api) || api.length === 0) return;
    notificationStore.items = api.map(fromApi);
    notificationStore.notify();
  } catch (err) {
    console.warn('Failed to load notifications from API', err);
  }
}
