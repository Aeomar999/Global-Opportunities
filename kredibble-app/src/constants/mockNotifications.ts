export type NotificationType = 'applicant' | 'message' | 'channel' | 'verification' | 'system';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  time: string;
  read: boolean;
}

const initialHirerNotifications: NotificationItem[] = [
  {
    id: 'n-1',
    type: 'applicant',
    title: 'New applicant',
    body: 'Kojo Boateng applied to Senior Product Designer with a 96% match score.',
    time: '5m ago',
    read: false,
  },
  {
    id: 'n-2',
    type: 'applicant',
    title: 'New applicant',
    body: 'Ama Serwaa applied to UX Research Intern.',
    time: '1h ago',
    read: false,
  },
  {
    id: 'n-3',
    type: 'message',
    title: 'New message',
    body: 'Elona Blankson sent you a message about the Senior Product Designer role.',
    time: '2h ago',
    read: false,
  },
  {
    id: 'n-4',
    type: 'channel',
    title: 'Channel activity',
    body: '3 new members joined Google Tech Circle.',
    time: '6h ago',
    read: true,
  },
  {
    id: 'n-5',
    type: 'verification',
    title: 'Verification approved',
    body: 'Your company documents were reviewed and Google LLC is now a Verified Enterprise.',
    time: '1d ago',
    read: true,
  },
  {
    id: 'n-6',
    type: 'system',
    title: 'Welcome to Kredibble',
    body: 'Post your first opportunity to start receiving applicants.',
    time: '3d ago',
    read: true,
  },
];

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
