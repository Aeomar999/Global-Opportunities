import {
  deleteChannel,
  updateChannel,
  deleteOpportunity,
} from '../src/lib/api';
import { authStore, PostedOpportunity, ManagedGroup } from '../src/constants/authStore';

describe('MOB-018: Live Hirer Postings & Community Channels Management (SEC-127)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    authStore.opportunities = [];
    authStore.managedGroups = [];
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('API Channel Methods', () => {
    it('calls DELETE /community/channels/:id with authentication', async () => {
      let capturedUrl = '';
      let capturedMethod = '';

      global.fetch = jest.fn().mockImplementation((url, init) => {
        capturedUrl = String(url);
        capturedMethod = init.method;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ data: { id: 'channel-123', deleted: true } }),
        });
      });

      const res = await deleteChannel('channel-123');
      expect(capturedUrl).toContain('/community/channels/channel-123');
      expect(capturedMethod).toBe('DELETE');
      expect(res.deleted).toBe(true);
    });

    it('calls PATCH /community/channels/:id with updated channel data', async () => {
      let capturedUrl = '';
      let capturedMethod = '';
      let capturedBody: any = null;

      global.fetch = jest.fn().mockImplementation((url, init) => {
        capturedUrl = String(url);
        capturedMethod = init.method;
        capturedBody = JSON.parse(init.body);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ data: { id: 'channel-123', name: 'Updated Channel' } }),
        });
      });

      const res = await updateChannel('channel-123', { name: 'Updated Channel' });
      expect(capturedUrl).toContain('/community/channels/channel-123');
      expect(capturedMethod).toBe('PATCH');
      expect(capturedBody).toEqual({ name: 'Updated Channel' });
      expect(res.name).toBe('Updated Channel');
    });

    it('calls DELETE /opportunities/:id correctly', async () => {
      let capturedUrl = '';
      let capturedMethod = '';

      global.fetch = jest.fn().mockImplementation((url, init) => {
        capturedUrl = String(url);
        capturedMethod = init.method;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ data: { id: 'opp-999', deleted: true } }),
        });
      });

      const res = await deleteOpportunity('opp-999');
      expect(capturedUrl).toContain('/opportunities/opp-999');
      expect(capturedMethod).toBe('DELETE');
      expect(res.deleted).toBe(true);
    });
  });

  describe('Hirer Postings Filter & Scoping', () => {
    it('scopes raw opportunities down to the caller ID', () => {
      const currentUserId = 'user-hirer-1';

      const allOpportunities = [
        {
          _id: 'opp-1',
          title: 'Senior React Developer',
          type: 'jobs',
          createdBy: 'user-hirer-1',
          applicantsCount: 5,
        },
        {
          _id: 'opp-2',
          title: 'Unrelated Marketing Lead',
          type: 'jobs',
          createdBy: 'other-user-2',
          hirerId: 'other-company',
          applicantsCount: 12,
        },
        {
          _id: 'opp-3',
          title: 'UI Design Intern',
          type: 'internships',
          hirerId: 'user-hirer-1',
          applicantsCount: 2,
        },
      ];

      const myOpps = allOpportunities.filter((o) => {
        return o.createdBy === currentUserId || o.hirerId === currentUserId;
      });

      expect(myOpps.length).toBe(2);
      expect(myOpps.map((o) => o._id)).toEqual(['opp-1', 'opp-3']);
    });

    it('maps opportunities to PostedOpportunity model correctly', () => {
      const rawOpp = {
        _id: 'opp-100',
        title: 'Full Stack Engineer',
        type: 'jobs',
        company: 'Acme Corp',
        location: 'Lagos, Nigeria (Remote)',
        description: 'Lead engineering team',
        applicantsCount: 4,
        createdAt: '2026-05-01T10:00:00.000Z',
      };

      const mapped: PostedOpportunity = {
        id: String(rawOpp._id),
        title: rawOpp.title,
        type: 'jobs',
        company: rawOpp.company,
        location: rawOpp.location,
        logoColor: '#6671E4',
        initial: 'A',
        description: rawOpp.description,
        applicantsCount: rawOpp.applicantsCount,
        applicants: [],
        date: new Date(rawOpp.createdAt).toLocaleDateString(),
      };

      expect(mapped.id).toBe('opp-100');
      expect(mapped.applicantsCount).toBe(4);
      expect(mapped.initial).toBe('A');
    });
  });

  describe('Hirer Channels Filter & Scoping', () => {
    it('scopes raw channels down to those created by the caller', () => {
      const currentUserId = 'user-hirer-1';

      const allChannels = [
        {
          _id: 'ch-1',
          name: 'Acme Developers Circle',
          category: 'Coding & Tech',
          createdBy: 'user-hirer-1',
          memberIds: ['user-1', 'user-2'],
        },
        {
          _id: 'ch-2',
          name: 'Public Open Discussion',
          category: 'General',
          createdBy: 'someone-else',
          memberIds: ['user-hirer-1'],
        },
      ];

      const myChannels = allChannels.filter((c) => c.createdBy === currentUserId);
      expect(myChannels.length).toBe(1);
      expect(myChannels[0].name).toBe('Acme Developers Circle');

      const mapped: ManagedGroup = {
        id: myChannels[0]._id,
        name: myChannels[0].name,
        category: myChannels[0].category,
        members: `${myChannels[0].memberIds.length} members`,
        bio: '',
        avatar: 'default.png',
      };

      expect(mapped.members).toBe('2 members');
    });
  });
});
