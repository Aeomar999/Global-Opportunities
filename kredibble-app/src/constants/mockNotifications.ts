export type NotificationType = 'applicant' | 'message' | 'channel' | 'verification' | 'system' | 'opportunity' | 'application' | 'event' | 'ambassador';

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

const initialSeekerNotifications: NotificationItem[] = [
  { id: 's-1', type: 'opportunity', title: 'New match for you', body: 'Junior Frontend Developer at Flutterwave matches your skills.', time: '10m ago', read: false },
  { id: 's-2', type: 'application', title: 'Application update', body: 'Your application for UX Research Intern was moved to Under review.', time: '2h ago', read: false },
  { id: 's-3', type: 'event', title: 'Event tomorrow', body: 'Accra Tech Career Fair starts at 9:00 AM. Tap to see the details.', time: '5h ago', read: false },
  { id: 's-4', type: 'opportunity', title: 'Grant closing soon', body: 'The Women in Tech Grant closes in 3 days. Do not miss the deadline.', time: '1d ago', read: true },
  { id: 's-5', type: 'message', title: 'New message', body: 'A recruiter replied to your question in Product Designers Ghana.', time: '2d ago', read: true },
  { id: 's-6', type: 'system', title: 'Welcome to Kredibble', body: 'Complete your profile to get better opportunity matches.', time: '4d ago', read: true },
];

class NotificationStateStore {
  items: NotificationItem[] = [...initialHirerNotifications];
  private role: 'seeker' | 'hirer' = 'hirer';

  /** Loads the starter list for a role (only when the role changes). */
  init(role: 'seeker' | 'hirer') {
    if (role === this.role) return;
    this.role = role;
    this.items = [...(role === 'seeker' ? initialSeekerNotifications : initialHirerNotifications)];
  }

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
