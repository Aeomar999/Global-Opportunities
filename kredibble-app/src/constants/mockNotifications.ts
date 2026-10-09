export type NotificationType = 'applicant' | 'message' | 'channel' | 'verification' | 'system' | 'opportunity' | 'application' | 'event' | 'ambassador';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  time: string;
  read: boolean;
}

class NotificationStateStore {
  items: NotificationItem[] = [];

  private listeners: (() => void)[] = [];

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(l => l());
  }

  get unreadCount() {
    return this.items.filter(n => !n.read).length;
  }

  markRead(id: string) {
    const item = this.items.find(n => n.id === id);
    if (item && !item.read) {
      item.read = true;
      this.notify();
    }
  }

  markAllRead() {
    this.items = this.items.map(n => ({ ...n, read: true }));
    this.notify();
  }
}

export const notificationStore = new NotificationStateStore();
