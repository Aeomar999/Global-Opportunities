/**
 * Client-side store for admin-sent broadcast notifications.
 * Mirrors the class-store pattern used throughout kredibble-app
 * (authStore, communityStore, profileStore) — in-memory only, no backend.
 */

import { BRAND } from '@/config/brand';

export type Audience = 'seekers' | 'hirers' | 'both';

export interface SentNotification {
  id: string;
  title: string;
  message: string;
  audience: Audience;
  /** ISO date-time. Shown with formatDateTime() (src/lib/format.ts), never as a raw string. */
  sentAt: string;
}

const initialHistory: SentNotification[] = [
  {
    id: 'sent-1',
    title: `Welcome to ${BRAND.name}`,
    message: 'Complete your profile to start receiving personalized opportunity matches.',
    audience: 'seekers',
    sentAt: '2026-07-01T09:00:00',
  },
  {
    id: 'sent-2',
    title: 'New verification requirements',
    message: 'All hirer accounts must complete document verification by end of month to keep posting.',
    audience: 'hirers',
    sentAt: '2026-07-10T14:30:00',
  },
];

class NotificationBroadcastStore {
  // Newest first, like every entry added later.
  history: SentNotification[] = [...initialHistory].sort((a, b) => b.sentAt.localeCompare(a.sentAt));

  private listeners: (() => void)[] = [];

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach((l) => l());
  }

  send(title: string, message: string, audience: Audience) {
    const entry: SentNotification = {
      id: `sent-${Date.now()}`,
      title,
      message,
      audience,
      sentAt: new Date().toISOString(),
    };
    this.history = [entry, ...this.history];
    this.notify();
  }
}

export const notificationBroadcastStore = new NotificationBroadcastStore();
