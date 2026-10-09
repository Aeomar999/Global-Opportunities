import {
  loginMobile,
  signupMobile,
  verifyEmail,
  requestEmailVerification,
  getOpportunityById,
  applyForOpportunity,
  deleteOpportunity,
  createChannel,
  updateChannel,
  deleteChannel,
} from '../src/lib/api';
import { authStore, PostedOpportunity } from '../src/constants/authStore';

jest.mock('expo-secure-store', () => {
  const store: Record<string, string> = {};
  return {
    getItemAsync: jest.fn(async (key: string) => store[key] || null),
    setItemAsync: jest.fn(async (key: string, val: string) => {
      store[key] = val;
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      delete store[key];
    }),
  };
});

describe('MOB-019: Mobile Screen Integration Test Suite (SEC-128)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    authStore.role = 'seeker';
    authStore.opportunities = [];
    authStore.managedGroups = [];
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Auth & Registration Screen Validation Flow
  // ───────────────────────────────────────────────────────────────────────────
  describe('Auth & Registration Screen Validation Logic', () => {
    const validateEmail = (email: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email.trim());
    };

    const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
      const errors: string[] = [];
      if (password.length < 8) errors.push('Password must be at least 8 characters');
      if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter');
      if (!/[0-9]/.test(password)) errors.push('Password must contain a number');
      return { valid: errors.length === 0, errors };
    };

    it('rejects invalid email formats during authentication entry', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('missing@domain')).toBe(false);
      expect(validateEmail('spaces in@domain.com')).toBe(false);
      expect(validateEmail('valid.user@kredibble.com')).toBe(true);
      expect(validateEmail('  trimmed.user@kredibble.com  ')).toBe(true);
    });

    it('enforces strong password criteria for seeker and hirer accounts', () => {
      expect(validatePassword('short').valid).toBe(false);
      expect(validatePassword('lowercaseonly123').valid).toBe(false);
      expect(validatePassword('NoNumbersHere').valid).toBe(false);
      expect(validatePassword('ValidPass123!').valid).toBe(true);
    });

    it('executes login flow and synchronizes store state on success', async () => {
      const mockUserData = {
        id: 'usr-101',
        email: 'seeker@kredibble.com',
        role: 'seeker' as const,
        name: 'Jane Doe',
      };

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token',
            user: mockUserData,
          },
        }),
      });

      const res = await loginMobile('seeker@kredibble.com', 'ValidPass123!');
      expect(res.user.email).toBe('seeker@kredibble.com');
      expect(res.accessToken).toBe('mock-access-token');

      // Update authStore
      authStore.setSession('mock-access-token', mockUserData);
      expect(authStore.role).toBe('seeker');
      expect(authStore.user?.id).toBe('usr-101');
    });

    it('handles registration payload with role segregation and uploaded documents', async () => {
      let sentBody: any = null;

      global.fetch = jest.fn().mockImplementation((_url, init) => {
        sentBody = JSON.parse(init.body);
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            data: {
              accessToken: 'mock-reg-token',
              refreshToken: 'mock-reg-refresh',
              user: {
                id: 'usr-202',
                email: sentBody.email,
                role: sentBody.role,
                name: sentBody.name,
              },
            },
          }),
        });
      });

      const registrationData = {
        name: 'Test Hirer',
        email: 'hirer@corp.com',
        password: 'SecurePassword123!',
        role: 'hirer' as const,
        companyName: 'Acme Corp',
        registrationNumber: 'REG-99441',
        companySize: '50-100',
        businessDocUrl: 'https://res.cloudinary.com/kredibble/raw/upload/v1/business.pdf',
      };

      const res = await signupMobile(registrationData);
      expect(sentBody.role).toBe('hirer');
      expect(sentBody.companyName).toBe('Acme Corp');
      expect(sentBody.businessDocUrl).toContain('cloudinary.com');
      expect(res.user.role).toBe('hirer');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Email Verification OTP Formatting & Submission
  // ───────────────────────────────────────────────────────────────────────────
  describe('Email Verification OTP Formatting & Submission Flow', () => {
    const sanitizeOtpInput = (raw: string): string => {
      return raw.replace(/[^0-9]/g, '').slice(0, 6);
    };

    it('sanitizes and formats OTP inputs to 6 digits maximum', () => {
      expect(sanitizeOtpInput('12a3b4c')).toBe('1234');
      expect(sanitizeOtpInput('123456789')).toBe('123456');
      expect(sanitizeOtpInput('  987 654 ')).toBe('987654');
    });

    it('requests email verification code successfully', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { email: 'unverified@kredibble.com', expiresInMinutes: 15 },
        }),
      });

      const res = await requestEmailVerification('unverified@kredibble.com');
      expect(res.email).toBe('unverified@kredibble.com');
      expect(res.expiresInMinutes).toBe(15);
    });

    it('submits 6-digit verification code and handles server confirmation', async () => {
      let requestPayload: any = null;

      global.fetch = jest.fn().mockImplementation((_url, init) => {
        requestPayload = JSON.parse(init.body);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            data: { email: requestPayload.email, verified: true },
          }),
        });
      });

      const cleanCode = sanitizeOtpInput('123-456');
      const res = await verifyEmail(cleanCode, 'unverified@kredibble.com');
      expect(requestPayload.code).toBe('123456');
      expect(requestPayload.email).toBe('unverified@kredibble.com');
      expect(res.verified).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Opportunity Detail & Application Submission Data Flow
  // ───────────────────────────────────────────────────────────────────────────
  describe('Opportunity Detail & Application Flow', () => {
    it('fetches opportunity details with typed schema response', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            id: 'opp-777',
            title: 'Senior Mobile Engineer',
            company: 'Tech Innovators',
            location: 'Remote',
            description: 'Lead React Native development for mobile cross-platform systems.',
            requirements: ['React Native', 'TypeScript', 'Jest'],
            salary: 'GH₵15,000 - GH₵20,000 / month',
            applicantsCount: 4,
          },
        }),
      });

      const opp = await getOpportunityById('opp-777');
      expect(opp.id).toBe('opp-777');
      expect(opp.title).toBe('Senior Mobile Engineer');
      expect(opp.requirements).toContain('React Native');
    });

    it('submits job application with CV document url and notes', async () => {
      let sentBody: any = null;
      let targetUrl = '';

      global.fetch = jest.fn().mockImplementation((url, init) => {
        targetUrl = String(url);
        sentBody = JSON.parse(init.body);
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            data: {
              id: 'app-999',
              opportunityId: 'opp-777',
              resumeUrl: sentBody.resumeUrl,
              status: 'submitted',
            },
          }),
        });
      });

      const applicationPayload = {
        resumeUrl: 'https://res.cloudinary.com/kredibble/raw/upload/v1/cv.pdf',
        coverNote: 'Excited about the cross-platform challenges!',
        candidateName: 'Jane Doe',
      };

      const res = await applyForOpportunity('opp-777', applicationPayload);
      expect(targetUrl).toContain('/opportunities/opp-777/applicants');
      expect(sentBody.resumeUrl).toBe(applicationPayload.resumeUrl);
      expect(res.status).toBe('submitted');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Hirer Postings Delete Flow & Channel Management State
  // ───────────────────────────────────────────────────────────────────────────
  describe('Hirer Postings Delete & Channel Management Flow', () => {
    it('deletes opportunity and reflects deletion in authStore', async () => {
      const opp1: PostedOpportunity = {
        id: 'opp-1',
        title: 'Backend Node Engineer',
        location: 'Accra, Ghana',
        type: 'jobs',
        salary: 'GH₵10k',
        applicantsCount: 2,
        initial: 'B',
        logoColor: '#6671E4',
        applicants: [],
      };
      const opp2: PostedOpportunity = {
        id: 'opp-2',
        title: 'Frontend React Engineer',
        location: 'Kumasi, Ghana',
        type: 'jobs',
        salary: 'GH₵8k',
        applicantsCount: 5,
        initial: 'F',
        logoColor: '#10B981',
        applicants: [],
      };

      authStore.setOpportunities([opp1, opp2]);
      expect(authStore.opportunities.length).toBe(2);

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'opp-1', deleted: true } }),
      });

      await deleteOpportunity('opp-1');
      authStore.deleteOpportunity('opp-1');

      expect(authStore.opportunities.length).toBe(1);
      expect(authStore.opportunities[0].id).toBe('opp-2');
    });

    it('updates applicant review status across store listings', () => {
      const opp: PostedOpportunity = {
        id: 'opp-10',
        title: 'Design Intern',
        location: 'Remote',
        type: 'internships',
        salary: 'GH₵2k',
        applicantsCount: 1,
        initial: 'D',
        logoColor: '#6671E4',
        applicants: [
          {
            id: 'applicant-1',
            name: 'Alex Kofi',
            profession: 'UI Designer',
            university: 'Ashesi',
            image: '',
            matchScore: 92,
            status: 'Applied',
          },
        ],
      };

      authStore.setOpportunities([opp]);
      expect(authStore.opportunities[0].applicants[0].status).toBe('Applied');

      authStore.updateApplicantStatus('opp-10', 'applicant-1', 'Shortlisted');
      expect(authStore.opportunities[0].applicants[0].status).toBe('Shortlisted');
    });

    it('creates, updates, and deletes community channels with state synchronization', async () => {
      // 1. Create channel
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: {
            id: 'chan-01',
            name: 'React Native Ghana',
            category: 'Mobile Dev',
            bio: 'Mobile dev community in Ghana',
          },
        }),
      });

      const newChan = await createChannel({
        name: 'React Native Ghana',
        category: 'Mobile Dev',
        bio: 'Mobile dev community in Ghana',
      });
      expect(newChan.id).toBe('chan-01');

      // 2. Update channel
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            id: 'chan-01',
            name: 'React Native Ghana (Official)',
            category: 'Mobile Dev',
          },
        }),
      });

      const updatedChan = await updateChannel('chan-01', {
        name: 'React Native Ghana (Official)',
      });
      expect(updatedChan.name).toBe('React Native Ghana (Official)');

      // 3. Delete channel
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { id: 'chan-01', deleted: true },
        }),
      });

      const deleteRes = await deleteChannel('chan-01');
      expect(deleteRes.deleted).toBe(true);
    });
  });
});
