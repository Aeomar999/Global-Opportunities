import { mockExperts, Expert } from './mockExperts';

export interface SavedOpportunity {
  id: string;
  type: 'jobs' | 'internships' | 'events' | 'grants';
}

export interface Application {
  id: string;
  opportunityId: string;
  type: 'jobs' | 'internships';
  title: string;
  company: string;
  description: string;
  appliedDate: string;
  status: 'In review' | 'Interview' | 'Rejected';
}

export interface NotificationSettings {
  // Jobs
  jobAlerts: boolean;
  aiRecommendations: boolean;
  jobActivity: boolean;
  savedJobs: boolean;
  // Application Updates
  statusUpdates: boolean;
  interviewInvites: boolean;
  // Community
  newPosts: boolean;
  // Recruiter
  recruiterViews: boolean;
  // Marketing
  marketingUpdates: boolean;
  pushNotifications: boolean;
}

export interface SecuritySettings {
  showProfileToRecruiters: boolean;
}

class ProfileStateStore {
  user: Expert = { ...mockExperts[0] };
  saved: SavedOpportunity[] = [
    { id: '1', type: 'jobs' },
    { id: '1', type: 'internships' },
    { id: '1', type: 'events' },
    { id: '1', type: 'grants' },
  ];
  applications: Application[] = [
    {
      id: 'app-1',
      opportunityId: '1',
      type: 'jobs',
      title: 'Senior Product designer',
      company: 'Wave mobile money',
      description: 'In 2017, over half the population in Sub-Saharan Africa had no bank account...',
      appliedDate: '24 May 2026',
      status: 'In review'
    },
    {
      id: 'app-2',
      opportunityId: '2',
      type: 'jobs',
      title: 'Junior Product designer',
      company: 'Pinterest',
      description: 'A curious and detail-oriented Junior Product Designer with strong visual design skills...',
      appliedDate: '20 May 2026',
      status: 'Interview'
    },
    {
      id: 'app-3',
      opportunityId: '3',
      type: 'jobs',
      title: 'Junior Product designer',
      company: 'OpenSea',
      description: 'A curious and detail-oriented Junior Product Designer with strong visual design skills...',
      appliedDate: '15 May 2026',
      status: 'Rejected'
    },
    {
      id: 'app-4',
      opportunityId: '3',
      type: 'internships',
      title: 'Junior Product designer',
      company: 'OpenSea',
      description: 'A curious and detail-oriented Junior Product Designer with strong visual design skills...',
      appliedDate: '18 May 2026',
      status: 'In review'
    }
  ];

  notifications: NotificationSettings = {
    jobAlerts: true,
    aiRecommendations: true,
    jobActivity: false,
    savedJobs: true,
    statusUpdates: true,
    interviewInvites: true,
    newPosts: true,
    recruiterViews: true,
    marketingUpdates: false,
    pushNotifications: true
  };

  security: SecuritySettings = {
    showProfileToRecruiters: true
  };

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

  updateProfile(updatedUser: Partial<Expert>) {
    this.user = { ...this.user, ...updatedUser };
    // Synchronize to the shared mockExperts array so changes reflect elsewhere too
    const index = mockExperts.findIndex(e => e.id === this.user.id);
    if (index !== -1) {
      mockExperts[index] = this.user;
    }
    this.notify();
  }

  toggleSaved(id: string, type: 'jobs' | 'internships' | 'events' | 'grants') {
    const exists = this.saved.some(item => item.id === id && item.type === type);
    if (exists) {
      this.saved = this.saved.filter(item => !(item.id === id && item.type === type));
    } else {
      this.saved.push({ id, type });
    }
    this.notify();

    try {
      const { authStore } = require('./authStore');
      const { toggleSavedItem } = require('../lib/api');
      
      const userId = authStore.user?.id;
      if (userId) {
        let itemType = type === 'jobs' ? 'opportunities' : type;
        toggleSavedItem({ itemId: id, itemType: itemType }).catch((err: any) => {
          console.warn('Failed to persist bookmark to server', err);
        });
      }
    } catch (err) {
      console.warn('Could not load auth store for saving item');
    }
  }

  isSaved(id: string, type: 'jobs' | 'internships' | 'events' | 'grants'): boolean {
    return this.saved.some(item => item.id === id && item.type === type);
  }

  updateNotifications(settings: Partial<NotificationSettings>) {
    this.notifications = { ...this.notifications, ...settings };
    this.notify();
  }

  updateSecurity(settings: Partial<SecuritySettings>) {
    this.security = { ...this.security, ...settings };
    this.notify();
  }

  deleteAccount() {
    console.log('Account deleted successfully');
    // Implement state reset or navigation behavior if needed
  }

  logout() {
    console.log('Logged out of account successfully');
  }
}

export const profileStore = new ProfileStateStore();
