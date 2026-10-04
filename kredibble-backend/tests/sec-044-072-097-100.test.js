import request from 'supertest';
import { app } from '../src/app.js';
import { signToken, signAdminToken } from '../src/middleware/auth.js';
import { User } from '../src/models/User.js';
import { Opportunity, Applicant, Grant, GrantApplication } from '../src/models/Platform.js';
import { Channel, ChannelPost, CommunityMembership } from '../src/models/Community.js';
import { Notification } from '../src/models/Content.js';

const AUTH_BEARER = (token) => ['Authorization', `Bearer ${token}`];

const makeUser = async ({ role = 'seeker', email = `user-${Date.now()}-${Math.random()}@example.com`, name = 'Test User' } = {}) => {
  const user = await User.create({ name, email, role, passwordHash: 'x', tokenVersion: 1 });
  return { user, token: signToken(user) };
};

describe('Production Hardening: SEC-044, SEC-072, SEC-097, SEC-100', () => {
  let seeker1, seeker2, hirer1, hirer2;

  beforeEach(async () => {
    seeker1 = await makeUser({ role: 'seeker', email: `s1-${Date.now()}@example.com` });
    seeker2 = await makeUser({ role: 'seeker', email: `s2-${Date.now()}@example.com` });
    hirer1 = await makeUser({ role: 'hirer', email: `h1-${Date.now()}@example.com` });
    hirer2 = await makeUser({ role: 'hirer', email: `h2-${Date.now()}@example.com` });
  });

  describe('SEC-044: Notification audience scoping', () => {
    it('scopes notifications by audience and isActive for seekers and hirers', async () => {
      await Notification.deleteMany({});

      await Notification.create({
        title: 'Platform Maintenance',
        message: 'System will be updated',
        audience: 'all',
        isActive: true,
      });

      await Notification.create({
        title: 'New Jobs Available',
        message: 'Check out recent openings',
        audience: 'seekers',
        isActive: true,
      });

      const notifHirer = await Notification.create({
        title: 'Candidate Pool Updated',
        message: 'Review top candidates',
        audience: 'hirers',
        isActive: true,
      });

      await Notification.create({
        title: 'Old Notice',
        message: 'This is inactive',
        audience: 'all',
        isActive: false,
      });

      // Seeker should see 'all' and 'seekers', not 'hirers' or inactive
      const seekerRes = await request(app)
        .get('/api/v1/notifications')
        .set(...AUTH_BEARER(seeker1.token));
      expect(seekerRes.statusCode).toBe(200);
      const seekerTitles = seekerRes.body.data.map((n) => n.title);
      expect(seekerTitles).toContain('Platform Maintenance');
      expect(seekerTitles).toContain('New Jobs Available');
      expect(seekerTitles).not.toContain('Candidate Pool Updated');
      expect(seekerTitles).not.toContain('Old Notice');

      // Hirer should see 'all' and 'hirers', not 'seekers' or inactive
      const hirerRes = await request(app)
        .get('/api/v1/notifications')
        .set(...AUTH_BEARER(hirer1.token));
      expect(hirerRes.statusCode).toBe(200);
      const hirerTitles = hirerRes.body.data.map((n) => n.title);
      expect(hirerTitles).toContain('Platform Maintenance');
      expect(hirerTitles).toContain('Candidate Pool Updated');
      expect(hirerTitles).not.toContain('New Jobs Available');
      expect(hirerTitles).not.toContain('Old Notice');

      // Seeker GET /:id for hirers-only notification returns 404
      const singleRes = await request(app)
        .get(`/api/v1/notifications/${notifHirer._id}`)
        .set(...AUTH_BEARER(seeker1.token));
      expect(singleRes.statusCode).toBe(404);

      // Hirer GET /:id for hirers-only notification returns 200
      const hirerSingleRes = await request(app)
        .get(`/api/v1/notifications/${notifHirer._id}`)
        .set(...AUTH_BEARER(hirer1.token));
      expect(hirerSingleRes.statusCode).toBe(200);
    });
  });

  describe('SEC-097: Private-channel posts scoping via /community/posts', () => {
    it('restricts /community/posts to accessible channels for non-members', async () => {
      const privateChannel = await Channel.create({
        name: 'Secret Circle',
        category: 'Exclusive',
        visibility: 'private',
        createdBy: hirer1.user._id,
      });

      const publicChannel = await Channel.create({
        name: 'Public Square',
        category: 'General',
        visibility: 'public',
        createdBy: hirer1.user._id,
      });

      const privatePost = await ChannelPost.create({
        channelId: privateChannel._id,
        authorId: hirer1.user._id,
        authorName: 'Hirer 1',
        title: 'Secret announcement',
        body: 'VIP only',
      });

      const publicPost = await ChannelPost.create({
        channelId: publicChannel._id,
        authorId: hirer1.user._id,
        authorName: 'Hirer 1',
        title: 'Public announcement',
        body: 'Open for all',
      });

      // Seeker 1 is not a member of privateChannel
      const listRes = await request(app)
        .get('/api/v1/community/posts')
        .set(...AUTH_BEARER(seeker1.token));
      expect(listRes.statusCode).toBe(200);
      const postIds = listRes.body.data.map((p) => String(p.id || p._id));
      expect(postIds).toContain(String(publicPost._id));
      expect(postIds).not.toContain(String(privatePost._id));

      // Direct GET /:id on private post by non-member returns 404
      const getRes = await request(app)
        .get(`/api/v1/community/posts/${privatePost._id}`)
        .set(...AUTH_BEARER(seeker1.token));
      expect(getRes.statusCode).toBe(404);

      // Once seeker joins privateChannel, the post becomes visible
      await CommunityMembership.create({
        channelId: privateChannel._id,
        userId: seeker1.user._id,
        status: 'active',
        role: 'member',
      });

      const memberRes = await request(app)
        .get(`/api/v1/community/posts/${privatePost._id}`)
        .set(...AUTH_BEARER(seeker1.token));
      expect(memberRes.statusCode).toBe(200);
    });
  });

  describe('SEC-072: Seekers list own applications', () => {
    it('returns only the authenticated seeker applications with populated opportunity info', async () => {
      const opp = await Opportunity.create({
        title: 'Full Stack Engineer',
        company: 'Innovate Labs',
        type: 'jobs',
        location: 'Remote',
        description: 'Build web applications',
        createdBy: hirer1.user._id,
        vetted: true,
        status: 'published',
        moderationStatus: 'approved',
      });

      const app1 = await Applicant.create({
        opportunityId: opp._id,
        seekerId: seeker1.user._id,
        name: seeker1.user.name,
        email: seeker1.user.email,
        status: 'applied',
      });

      const app2 = await Applicant.create({
        opportunityId: opp._id,
        seekerId: seeker2.user._id,
        name: seeker2.user.name,
        email: seeker2.user.email,
        status: 'applied',
      });

      // Seeker 1 queries their applications
      const res = await request(app)
        .get('/api/v1/users/me/applications')
        .set(...AUTH_BEARER(seeker1.token));

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(String(res.body.data[0].id || res.body.data[0]._id)).toBe(String(app1._id));
      expect(res.body.data[0].opportunity).toBeDefined();
      expect(res.body.data[0].opportunity.title).toBe('Full Stack Engineer');
      expect(res.body.data[0].opportunity.company).toBe('Innovate Labs');

      // Seeker 2 queries their applications
      const res2 = await request(app)
        .get('/api/v1/users/me/applications')
        .set(...AUTH_BEARER(seeker2.token));

      expect(res2.statusCode).toBe(200);
      expect(res2.body.data.length).toBe(1);
      expect(String(res2.body.data[0].id || res2.body.data[0]._id)).toBe(String(app2._id));
    });
  });

  describe('SEC-047 / SEC-100: Hirer applicant access on postings', () => {
    it('allows the creating hirer to view applicants on API-created opportunities', async () => {
      // Hirer creates opportunity through the API
      const createRes = await request(app)
        .post('/api/v1/opportunities')
        .set(...AUTH_BEARER(hirer1.token))
        .send({
          title: 'Frontend Developer',
          company: 'Awesome Startups',
          type: 'jobs',
          location: 'Accra',
          description: 'React expert needed',
        });

      expect(createRes.statusCode).toBe(201);
      const oppId = createRes.body.data.id;

      // Admin vets and approves the opportunity for seekers to see and apply
      await Opportunity.findByIdAndUpdate(oppId, {
        vetted: true,
        moderationStatus: 'approved',
        status: 'published',
      });

      // Seeker applies
      const applyRes = await request(app)
        .post(`/api/v1/opportunities/${oppId}/applicants`)
        .set(...AUTH_BEARER(seeker1.token))
        .send({
          coverLetter: 'I would love this job',
        });
      expect(applyRes.statusCode).toBe(201);

      // Hirer 1 (the creator) can view applicants
      const listAppRes = await request(app)
        .get(`/api/v1/opportunities/${oppId}/applicants`)
        .set(...AUTH_BEARER(hirer1.token));
      expect(listAppRes.statusCode).toBe(200);
      expect(listAppRes.body.data.length).toBe(1);

      // Hirer 2 gets 403
      const rivalRes = await request(app)
        .get(`/api/v1/opportunities/${oppId}/applicants`)
        .set(...AUTH_BEARER(hirer2.token));
      expect(rivalRes.statusCode).toBe(403);
    });
  });

  describe('SEC-104: Mass assignment protection on staff-portal opportunity writes', () => {
    it('PATCH /admin/opportunities/:id ignores applicantsCount and createdBy', async () => {
      const admin = await User.create({
        name: 'Super Admin',
        email: `admin-${Date.now()}@example.com`,
        role: 'admin',
        passwordHash: 'x',
        tokenVersion: 1,
      });
      const cookie = `kredibble_admin_token=${signAdminToken(admin)}`;

      const originalCreator = hirer1.user._id;
      const otherUser = seeker1.user._id;

      const opp = await Opportunity.create({
        title: 'Senior Developer',
        company: 'Original Corp',
        type: 'jobs',
        location: 'Accra',
        description: 'Original job description',
        createdBy: originalCreator,
        applicantsCount: 5,
        vetted: true,
        moderationStatus: 'approved',
      });

      const patchRes = await request(app)
        .patch(`/api/v1/admin/opportunities/${opp._id}`)
        .set('Cookie', cookie)
        .send({
          title: 'Staff Developer',
          applicantsCount: 999,
          createdBy: otherUser,
          hirerId: otherUser,
        });

      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.body.data.title).toBe('Staff Developer');

      const updated = await Opportunity.findById(opp._id).lean();
      expect(updated.title).toBe('Staff Developer');
      expect(updated.applicantsCount).toBe(5);
      expect(String(updated.createdBy)).toBe(String(originalCreator));
      expect(updated.hirerId).toBeUndefined();
    });
  });

  describe('SEC-060: Grant allocation atomicity and applicant tracking', () => {
    it('prevents over-allocation and lets applicant list own grant applications', async () => {
      const grant = await Grant.create({
        title: 'Tech Seed Fund',
        hirer: 'Ghana Tech Corp',
        sector: 'Fintech',
        fundingPool: 5000,
        allocated: 0,
        status: 'open',
      });

      // Seeker 1 applies for 3000
      const res1 = await request(app)
        .post(`/api/v1/grants/${grant._id}/applications`)
        .set(...AUTH_BEARER(seeker1.token))
        .send({
          applicantName: 'Seeker One',
          requestedAmount: 3000,
        });
      expect(res1.statusCode).toBe(201);
      expect(res1.body.data.requestedAmount).toBe(3000);

      // Check grant allocated incremented
      const grantAfterFirst = await Grant.findById(grant._id).lean();
      expect(grantAfterFirst.allocated).toBe(3000);

      // Seeker 2 tries to apply for 2500 (3000 + 2500 = 5500 > 5000) -> 400
      const res2 = await request(app)
        .post(`/api/v1/grants/${grant._id}/applications`)
        .set(...AUTH_BEARER(seeker2.token))
        .send({
          applicantName: 'Seeker Two',
          requestedAmount: 2500,
        });
      expect(res2.statusCode).toBe(400);
      expect(res2.body.error.message).toMatch(/funding pool/i);

      // Seeker 2 applies for 1500 (3000 + 1500 = 4500 <= 5000) -> 201
      const res3 = await request(app)
        .post(`/api/v1/grants/${grant._id}/applications`)
        .set(...AUTH_BEARER(seeker2.token))
        .send({
          applicantName: 'Seeker Two',
          requestedAmount: 1500,
        });
      expect(res3.statusCode).toBe(201);

      const grantFinal = await Grant.findById(grant._id).lean();
      expect(grantFinal.allocated).toBe(4500);

      // Seeker 1 lists own grant applications via /users/me/grant-applications
      const listRes1 = await request(app)
        .get('/api/v1/users/me/grant-applications')
        .set(...AUTH_BEARER(seeker1.token));
      expect(listRes1.statusCode).toBe(200);
      expect(listRes1.body.data.length).toBe(1);
      expect(listRes1.body.data[0].requestedAmount).toBe(3000);
      expect(listRes1.body.data[0].grant).toBeDefined();
      expect(listRes1.body.data[0].grant.title).toBe('Tech Seed Fund');

      // Seeker 2 lists own grant applications
      const listRes2 = await request(app)
        .get('/api/v1/users/me/grant-applications')
        .set(...AUTH_BEARER(seeker2.token));
      expect(listRes2.statusCode).toBe(200);
      expect(listRes2.body.data.length).toBe(1);
      expect(listRes2.body.data[0].requestedAmount).toBe(1500);
    });
  });
});
