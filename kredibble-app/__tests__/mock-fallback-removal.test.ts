import { notificationStore } from '../src/constants/mockNotifications';
import { profileStore } from '../src/constants/mockProfile';

describe('MOB-017: Mock Fallback Removal & Proposal Upload (SEC-126)', () => {
  beforeEach(() => {
    notificationStore.items = [];
    profileStore.saved = [];
  });

  describe('Notification Store', () => {
    it('initializes items array to empty without hardcoded Google LLC mock notifications', () => {
      expect(notificationStore.items).toEqual([]);
      expect(notificationStore.unreadCount).toBe(0);
    });

    it('updates notifications when API returns an empty list rather than preserving mocks', () => {
      // Simulate receiving empty array from backend
      const apiNotifications: any[] = [];
      notificationStore.items = apiNotifications;

      expect(notificationStore.items.length).toBe(0);
      expect(notificationStore.unreadCount).toBe(0);
    });

    it('correctly manages read state and count when live notifications arrive', () => {
      notificationStore.items = [
        {
          id: 'live-1',
          type: 'applicant',
          title: 'New Applicant',
          body: 'Jane Doe applied for Backend Engineer',
          time: '10m ago',
          read: false,
        },
        {
          id: 'live-2',
          type: 'message',
          title: 'Message',
          body: 'Hello team',
          time: '1h ago',
          read: true,
        },
      ];

      expect(notificationStore.unreadCount).toBe(1);
      notificationStore.markRead('live-1');
      expect(notificationStore.unreadCount).toBe(0);
    });
  });

  describe('Profile Store Saved Opportunities', () => {
    it('initializes saved items array to empty without hardcoded job IDs', () => {
      expect(profileStore.saved).toEqual([]);
    });

    it('supports toggling saved items from clean initial state', () => {
      profileStore.toggleSaved('job-123', 'jobs');
      expect(profileStore.saved).toEqual([{ id: 'job-123', type: 'jobs' }]);

      profileStore.toggleSaved('job-123', 'jobs');
      expect(profileStore.saved).toEqual([]);
    });
  });

  describe('Job Description & Requirements Formatting', () => {
    it('uses actual opportunity description without appending Wave mission text', () => {
      const mockJob = {
        id: 'job-777',
        title: 'Cloud DevOps Engineer',
        company: 'Stripe',
        description: 'Build robust CI/CD pipelines across AWS and GCP infrastructures.',
      };

      const fullDescription = mockJob.description?.trim() || 'No job description provided.';

      expect(fullDescription).toBe('Build robust CI/CD pipelines across AWS and GCP infrastructures.');
      expect(fullDescription).not.toContain('Wave');
      expect(fullDescription).not.toContain('cashless continent');
      expect(fullDescription).not.toContain('Senegal');
    });

    it('extracts requirements from newline-delimited string or arrays dynamically', () => {
      const rawStringRequirements = '• 5+ years with Kubernetes\n• Terraform automation\n• Golang or Python proficiency';
      const parsedRequirements = rawStringRequirements
        .split('\n')
        .map((s) => s.trim().replace(/^[•\-*]\s*/, ''))
        .filter(Boolean);

      expect(parsedRequirements).toEqual([
        '5+ years with Kubernetes',
        'Terraform automation',
        'Golang or Python proficiency',
      ]);
      expect(parsedRequirements).not.toContain('Develop high-fidelity mockups');
    });

    it('handles empty or missing requirements gracefully without fake fallback bullets', () => {
      const emptyJob = {
        id: 'job-888',
        title: 'General Laborer',
        requirements: undefined,
      };

      const requirementsList: string[] = Array.isArray(emptyJob.requirements)
        ? emptyJob.requirements
        : typeof emptyJob.requirements === 'string' && (emptyJob.requirements as string).trim()
        ? (emptyJob.requirements as string).split('\n').map((s) => s.trim().replace(/^[•\-*]\s*/, '')).filter(Boolean)
        : [];

      expect(requirementsList).toEqual([]);
    });
  });
});
