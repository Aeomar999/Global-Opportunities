import request from 'supertest';
import { app } from '../src/app.js';
import { signToken } from '../src/middleware/auth.js';
import { User } from '../src/models/User.js';
import { Opportunity, Applicant, Event, Grant, VerificationDoc } from '../src/models/Platform.js';
import { Article } from '../src/models/Content.js';
import { runDataRetentionSweep, cleanupRejectedApplicantPii, cleanupRejectedVerificationDocs } from '../src/lib/data-retention.js';

const AUTH_BEARER = (token) => ['Authorization', `Bearer ${token}`];

const makeUser = async ({
  role = 'seeker',
  email = `user-${Date.now()}-${Math.random()}@example.com`,
  name = 'Test User',
  emailVerified = false,
} = {}) => {
  const user = await User.create({ name, email, role, passwordHash: 'x', tokenVersion: 1, emailVerified });
  return { user, token: signToken(user) };
};

describe('Open Questions Resolutions: Q3 (Public Reads), Q9 (Email Verification), Q11 (Data Retention)', () => {
  let unverifiedSeeker, verifiedSeeker, unverifiedHirer, verifiedHirer, adminUser;

  beforeEach(async () => {
    unverifiedSeeker = await makeUser({ role: 'seeker', email: `unv-seeker-${Date.now()}@example.com`, emailVerified: false });
    verifiedSeeker = await makeUser({ role: 'seeker', email: `v-seeker-${Date.now()}@example.com`, emailVerified: true });
    unverifiedHirer = await makeUser({ role: 'hirer', email: `unv-hirer-${Date.now()}@example.com`, emailVerified: false });
    verifiedHirer = await makeUser({ role: 'hirer', email: `v-hirer-${Date.now()}@example.com`, emailVerified: true });

    adminUser = await User.create({
      name: 'Super Admin',
      email: `admin-${Date.now()}@example.com`,
      role: 'admin',
      passwordHash: 'x',
      tokenVersion: 1,
      emailVerified: true,
    });
  });

  describe('Q3: Public Read Surface for Events and Articles', () => {
    beforeEach(async () => {
      await Event.deleteMany({});
      await Article.deleteMany({});

      await Event.create([
        { title: 'Tech Summit Accra', hirer: 'TechHub', location: 'Accra', dateTime: '2026-11-15T09:00:00Z', capacity: 100, status: 'upcoming' },
        { title: 'Cancelled Workshop', hirer: 'OldOrg', location: 'Virtual', dateTime: '2026-10-01T09:00:00Z', capacity: 50, status: 'cancelled' },
      ]);

      await Article.create([
        { category: 'Career', title: 'How to Ace Technical Interviews', summary: 'Interview guide', content: 'Detailed tips', status: 'published' },
        { category: 'News', title: 'Internal Draft Strategy', summary: 'Draft memo', content: 'Secret plans', status: 'draft' },
      ]);
    });

    it('allows anonymous public reads on GET /api/v1/events and filters cancelled events', async () => {
      const res = await request(app).get('/api/v1/events');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((e) => e.title === 'Tech Summit Accra')).toBe(true);
      expect(res.body.data.some((e) => e.title === 'Cancelled Workshop')).toBe(false);
    });

    it('allows anonymous public reads on GET /api/v1/articles and filters drafts', async () => {
      const res = await request(app).get('/api/v1/articles');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((a) => a.title === 'How to Ace Technical Interviews')).toBe(true);
      expect(res.body.data.some((a) => a.title === 'Internal Draft Strategy')).toBe(false);
    });

    it('still blocks anonymous mutations on events and articles', async () => {
      const eventWrite = await request(app).post('/api/v1/events').send({ title: 'Rogue Event' });
      expect([401, 403]).toContain(eventWrite.statusCode);

      const articleWrite = await request(app).post('/api/v1/articles').send({ title: 'Rogue Article' });
      expect([401, 403]).toContain(articleWrite.statusCode);
    });
  });

  describe('Q9: Progressive Email Verification Policy', () => {
    let testOpportunity, testGrant;

    beforeEach(async () => {
      process.env.REQUIRE_EMAIL_VERIFICATION = 'true';

      testOpportunity = await Opportunity.create({
        title: 'Backend Engineer',
        company: 'Kredibble Labs',
        type: 'jobs',
        location: 'Remote',
        description: 'Node.js developer',
        moderationStatus: 'approved',
        vetted: true,
        status: 'published',
      });

      testGrant = await Grant.create({
        title: 'Youth Innovation Fund',
        hirer: 'Ghana Ministry of Tech',
        sector: 'Technology',
        fundingPool: 10000,
        allocated: 0,
        status: 'open',
      });
    });

    afterEach(() => {
      delete process.env.REQUIRE_EMAIL_VERIFICATION;
    });

    it('allows unverified seekers to search and read opportunities freely', async () => {
      const res = await request(app)
        .get('/api/v1/opportunities')
        .set(...AUTH_BEARER(unverifiedSeeker.token));
      expect(res.statusCode).toBe(200);
    });

    it('blocks unverified seeker from submitting an application (403 EMAIL_VERIFICATION_REQUIRED)', async () => {
      const res = await request(app)
        .post(`/api/v1/opportunities/${testOpportunity._id}/applicants`)
        .set(...AUTH_BEARER(unverifiedSeeker.token))
        .send({ name: 'Unverified Seeker', skills: ['Node.js'] });

      expect(res.statusCode).toBe(403);
      expect(res.body.error.code).toBe('EMAIL_VERIFICATION_REQUIRED');
      expect(res.body.error.message).toMatch(/Email verification is required/i);
    });

    it('allows verified seeker to submit an application successfully', async () => {
      const res = await request(app)
        .post(`/api/v1/opportunities/${testOpportunity._id}/applicants`)
        .set(...AUTH_BEARER(verifiedSeeker.token))
        .send({ name: 'Verified Seeker', skills: ['Node.js'] });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.opportunityId).toBe(String(testOpportunity._id));
    });

    it('blocks unverified seeker from applying for a grant', async () => {
      const res = await request(app)
        .post(`/api/v1/grants/${testGrant._id}/applications`)
        .set(...AUTH_BEARER(unverifiedSeeker.token))
        .send({ applicantName: 'Unverified Seeker', requestedAmount: 1000 });

      expect(res.statusCode).toBe(403);
      expect(res.body.error.code).toBe('EMAIL_VERIFICATION_REQUIRED');
    });

    it('allows verified seeker to apply for a grant', async () => {
      const res = await request(app)
        .post(`/api/v1/grants/${testGrant._id}/applications`)
        .set(...AUTH_BEARER(verifiedSeeker.token))
        .send({ applicantName: 'Verified Seeker', requestedAmount: 1000 });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.requestedAmount).toBe(1000);
    });

    it('blocks unverified hirer from posting an opportunity', async () => {
      const res = await request(app)
        .post('/api/v1/opportunities')
        .set(...AUTH_BEARER(unverifiedHirer.token))
        .send({
          title: 'Frontend Role',
          company: 'Acme Corp',
          type: 'jobs',
          location: 'Accra',
          description: 'React expert',
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.error.code).toBe('EMAIL_VERIFICATION_REQUIRED');
    });

    it('allows verified hirer to post an opportunity', async () => {
      const res = await request(app)
        .post('/api/v1/opportunities')
        .set(...AUTH_BEARER(verifiedHirer.token))
        .send({
          title: 'Frontend Role',
          company: 'Acme Corp',
          type: 'jobs',
          location: 'Accra',
          description: 'React expert',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.title).toBe('Frontend Role');
    });

    it('allows admin to bypass email verification checks', async () => {
      const res = await request(app)
        .post(`/api/v1/grants/${testGrant._id}/applications`)
        .set(...AUTH_BEARER(signToken(adminUser)))
        .send({ applicantName: 'Admin Beneficiary', requestedAmount: 500 });

      expect(res.statusCode).toBe(201);
    });
  });

  describe('Q11: Data Retention Policies and Automated Cleanup', () => {
    let opp;

    beforeEach(async () => {
      opp = await Opportunity.create({
        title: 'Senior DevOps',
        company: 'Cloud Corp',
        type: 'jobs',
        location: 'Remote',
        description: 'K8s specialist',
        moderationStatus: 'approved',
        vetted: true,
      });
    });

    it('redacts CV URLs of rejected applicants older than 180 days', async () => {
      const now = new Date('2026-10-04T00:00:00Z');
      const oldDate = new Date(now.getTime() - 190 * 24 * 60 * 60 * 1000); // 190 days ago
      const recentDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      // Create old rejected applicant
      const oldApplicant = await Applicant.create({
        opportunityId: opp._id,
        seekerId: unverifiedSeeker.user._id,
        name: 'Rejected Applicant Old',
        status: 'Rejected',
        resumeUrl: 'https://cloudinary.com/cv/old.pdf',
      });
      // Force updatedAt to oldDate with timestamps disabled
      await Applicant.updateOne({ _id: oldApplicant._id }, { $set: { updatedAt: oldDate } }, { timestamps: false });

      // Create recent rejected applicant
      const recentApplicant = await Applicant.create({
        opportunityId: opp._id,
        seekerId: verifiedSeeker.user._id,
        name: 'Rejected Applicant Recent',
        status: 'Rejected',
        resumeUrl: 'https://cloudinary.com/cv/recent.pdf',
      });
      await Applicant.updateOne({ _id: recentApplicant._id }, { $set: { updatedAt: recentDate } }, { timestamps: false });

      const redactedCount = await cleanupRejectedApplicantPii({ now, maxAgeDays: 180 });
      expect(redactedCount).toBe(1);

      const checkOld = await Applicant.findById(oldApplicant._id);
      expect(checkOld.resumeUrl).toBeNull();

      const checkRecent = await Applicant.findById(recentApplicant._id);
      expect(checkRecent.resumeUrl).toBe('https://cloudinary.com/cv/recent.pdf');
    });

    it('purges rejected verification documents older than 90 days', async () => {
      const now = new Date('2026-10-04T00:00:00Z');
      const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
      const recentDate = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000); // 20 days ago

      const oldDoc = await VerificationDoc.create({
        companyId: unverifiedHirer.user._id,
        key: 'cert_incorporation',
        label: 'Cert of Incorporation',
        fileName: 'old.pdf',
        status: 'rejected',
      });
      await VerificationDoc.updateOne({ _id: oldDoc._id }, { $set: { updatedAt: oldDate } }, { timestamps: false });

      const recentDoc = await VerificationDoc.create({
        companyId: verifiedHirer.user._id,
        key: 'tax_clearance',
        label: 'Tax Clearance',
        fileName: 'recent.pdf',
        status: 'rejected',
      });
      await VerificationDoc.updateOne({ _id: recentDoc._id }, { $set: { updatedAt: recentDate } }, { timestamps: false });

      const purgedCount = await cleanupRejectedVerificationDocs({ now, maxAgeDays: 90 });
      expect(purgedCount).toBe(1);

      const checkOldDoc = await VerificationDoc.findById(oldDoc._id);
      expect(checkOldDoc).toBeNull();

      const checkRecentDoc = await VerificationDoc.findById(recentDoc._id);
      expect(checkRecentDoc).not.toBeNull();
    });

    it('runDataRetentionSweep runs both retention cleanup tasks and logs metrics', async () => {
      const sweepResult = await runDataRetentionSweep();
      expect(sweepResult).toHaveProperty('applicantsRedacted');
      expect(sweepResult).toHaveProperty('verificationDocsPurged');
      expect(sweepResult).toHaveProperty('timestamp');
    });
  });
});
