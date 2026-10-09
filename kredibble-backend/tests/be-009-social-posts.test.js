import request from 'supertest';
import { app } from '../src/app.js';
import { User, StaffMember, AuditLog } from '../src/models/User.js';
import { SocialPost, TargetChange, ThresholdChange } from '../src/models/AdminPortal.js';
import { Opportunity } from '../src/models/Platform.js';
import { signAdminToken, signToken } from '../src/middleware/auth.js';
import { AUDIT_ACTIONS } from '../src/lib/audit.js';

describe('BE-009: Social Posts', () => {
  let adminCookie;
  let adminUser;
  let sampleOpportunity;

  beforeEach(async () => {
    await SocialPost.deleteMany({});
    await Opportunity.deleteMany({});
    await TargetChange.deleteMany({});
    await ThresholdChange.deleteMany({});
    await User.deleteMany({});
    await StaffMember.deleteMany({});
    await AuditLog.deleteMany({});

    adminUser = await User.create({
      name: 'Admin Social Manager',
      email: 'admin.social@example.com',
      role: 'admin',
      passwordHash: 'dummy-hash-password',
    });

    const token = signAdminToken(adminUser);
    adminCookie = `kredibble_admin_token=${token}`;

    sampleOpportunity = await Opportunity.create({
      title: 'Global Tech Fellowship 2026',
      description: 'Exclusive technology fellowship program for African youth.',
      type: 'fellowship',
      company: 'Global Opportunities',
      location: 'Accra, Ghana',
      status: 'approved',
      moderationStatus: 'published',
      vetted: true,
      publishedAt: new Date('2026-10-01'),
      createdBy: adminUser._id,
    });
  });

  describe('Post Creation & Validation', () => {
    it('creates a social post with canonical platform, valid URL, reach, engagement, and published status', async () => {
      const todayIso = new Date().toISOString().slice(0, 10);
      const res = await request(app)
        .post('/api/v1/admin/social-posts')
        .set('Cookie', adminCookie)
        .send({
          platform: 'instagram',
          title: 'Applications open for Fellowship',
          url: 'https://www.instagram.com/p/DA12345xyz',
          reach: 2500,
          engagement: 340,
          postedAt: todayIso,
          listingId: sampleOpportunity._id.toString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        platform: 'instagram',
        title: 'Applications open for Fellowship',
        url: 'https://www.instagram.com/p/DA12345xyz',
        reach: 2500,
        engagement: 340,
        status: 'published',
        postedAt: todayIso,
        listingId: sampleOpportunity._id.toString(),
        listingTitle: 'Global Tech Fellowship 2026',
      });

      // Audit log check
      const audit = await AuditLog.findOne({ action: AUDIT_ACTIONS.SOCIAL_POST_CREATE });
      expect(audit).toBeTruthy();
      expect(audit.resourceId.toString()).toBe(res.body.data.id);
      expect(audit.metadata.platform).toBe('instagram');
    });

    it('normalizes platform from uppercase/mixed case to canonical lowercase', async () => {
      const res = await request(app)
        .post('/api/v1/admin/social-posts')
        .set('Cookie', adminCookie)
        .send({
          platform: 'LinkedIn',
          title: 'Partner announcement on LinkedIn',
          url: 'https://www.linkedin.com/feed/update/urn:li:activity:789',
          reach: 1200,
          engagement: 95,
          postedAt: '2026-10-05',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.platform).toBe('linkedin');
    });

    it('rejects a post with a postedAt date in the future with 400', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureIso = futureDate.toISOString().slice(0, 10);

      const res = await request(app)
        .post('/api/v1/admin/social-posts')
        .set('Cookie', adminCookie)
        .send({
          platform: 'x',
          title: 'Future scheduled campaign',
          url: 'https://x.com/global_opps/status/123456',
          reach: 500,
          engagement: 30,
          postedAt: futureIso,
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.message || res.body.message).toMatch(/future/i);
    });

    it('rejects an invalid URL without real host or containing spaces with 400', async () => {
      const invalidUrlRes = await request(app)
        .post('/api/v1/admin/social-posts')
        .set('Cookie', adminCookie)
        .send({
          platform: 'x',
          title: 'Post with invalid link',
          url: 'not-a-valid-url',
          reach: 100,
          engagement: 10,
          postedAt: '2026-10-02',
        });

      expect(invalidUrlRes.status).toBe(400);

      const spaceUrlRes = await request(app)
        .post('/api/v1/admin/social-posts')
        .set('Cookie', adminCookie)
        .send({
          platform: 'facebook',
          title: 'Post with space in link',
          url: 'https://facebook.com/post with space',
          reach: 100,
          engagement: 10,
          postedAt: '2026-10-02',
        });

      expect(spaceUrlRes.status).toBe(400);
    });
  });

  describe('Listing & Filtering Social Posts', () => {
    beforeEach(async () => {
      await SocialPost.create([
        {
          platform: 'instagram',
          title: 'Oct Instagram Post 1',
          url: 'https://instagram.com/p/oct1',
          reach: 3000,
          engagement: 250,
          status: 'published',
          postedAt: new Date('2026-10-05T12:00:00Z'),
          postedAtDate: '2026-10-05',
          opportunityId: sampleOpportunity._id,
        },
        {
          platform: 'linkedin',
          title: 'Oct LinkedIn Post',
          url: 'https://linkedin.com/posts/oct2',
          reach: 4500,
          engagement: 400,
          status: 'published',
          postedAt: new Date('2026-10-08T09:00:00Z'),
          postedAtDate: '2026-10-08',
        },
        {
          platform: 'x',
          title: 'Oct X Draft Post',
          url: 'https://x.com/post/octdraft',
          reach: 500,
          engagement: 20,
          status: 'draft',
          postedAt: new Date('2026-10-07T10:00:00Z'),
          postedAtDate: '2026-10-07',
        },
        {
          platform: 'facebook',
          title: 'Sept Facebook Post',
          url: 'https://facebook.com/sept1',
          reach: 1500,
          engagement: 80,
          status: 'published',
          postedAt: new Date('2026-09-20T15:00:00Z'),
          postedAtDate: '2026-09-20',
        },
      ]);
    });

    it('returns social posts sorted newest first with populated listing title', async () => {
      const res = await request(app)
        .get('/api/v1/admin/social-posts')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(4);
      expect(res.body.data[0].title).toBe('Oct LinkedIn Post'); // 2026-10-08 is newest
      const instPost = res.body.data.find((p) => p.platform === 'instagram');
      expect(instPost.listingTitle).toBe('Global Tech Fellowship 2026');
    });

    it('filters social posts by month', async () => {
      const res = await request(app)
        .get('/api/v1/admin/social-posts?month=2026-10')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3);
      expect(res.body.data.every((p) => p.postedAt.startsWith('2026-10'))).toBe(true);
    });

    it('filters social posts by platform', async () => {
      const res = await request(app)
        .get('/api/v1/admin/social-posts?platform=linkedin')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].platform).toBe('linkedin');
    });

    it('filters social posts by status', async () => {
      const res = await request(app)
        .get('/api/v1/admin/social-posts?status=draft')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('Oct X Draft Post');
    });
  });

  describe('Monthly Totals & KPI Parity (GET /admin/social-posts/monthly-totals?month=)', () => {
    beforeEach(async () => {
      await TargetChange.create([
        { kpi: 'posts_published', value: 5, effectiveFrom: '2026-01', changedAt: '2026-01-01', seq: 1 },
        { kpi: 'social_reach', value: 12000, effectiveFrom: '2026-01', changedAt: '2026-01-01', seq: 2 },
        { kpi: 'social_engagement', value: 900, effectiveFrom: '2026-01', changedAt: '2026-01-01', seq: 3 },
      ]);

      await SocialPost.create([
        // Instagram: 2 posts, reach = 3000 + 4000 = 7000, eng = 250 + 350 = 600
        {
          platform: 'instagram',
          title: 'Instagram Post A',
          url: 'https://instagram.com/p/a',
          reach: 3000,
          engagement: 250,
          status: 'published',
          postedAt: new Date('2026-10-02'),
          postedAtDate: '2026-10-02',
        },
        {
          platform: 'instagram',
          title: 'Instagram Post B',
          url: 'https://instagram.com/p/b',
          reach: 4000,
          engagement: 350,
          status: 'published',
          postedAt: new Date('2026-10-05'),
          postedAtDate: '2026-10-05',
        },
        // LinkedIn: 1 post, reach = 5000, eng = 400
        {
          platform: 'linkedin',
          title: 'LinkedIn Post 1',
          url: 'https://linkedin.com/posts/1',
          reach: 5000,
          engagement: 400,
          status: 'published',
          postedAt: new Date('2026-10-06'),
          postedAtDate: '2026-10-06',
        },
        // Draft post in October: MUST NOT be counted
        {
          platform: 'x',
          title: 'Draft tweet',
          url: 'https://x.com/draft',
          reach: 9999,
          engagement: 999,
          status: 'draft',
          postedAt: new Date('2026-10-07'),
          postedAtDate: '2026-10-07',
        },
        // Scheduled post in October: MUST NOT be counted
        {
          platform: 'youtube',
          title: 'Scheduled video',
          url: 'https://youtube.com/v/1',
          reach: 8888,
          engagement: 888,
          status: 'scheduled',
          postedAt: new Date('2026-10-08'),
          postedAtDate: '2026-10-08',
        },
        // September published post: MUST NOT be counted in October
        {
          platform: 'tiktok',
          title: 'September TikTok',
          url: 'https://tiktok.com/@post/sep',
          reach: 10000,
          engagement: 500,
          status: 'published',
          postedAt: new Date('2026-09-25'),
          postedAtDate: '2026-09-25',
        },
      ]);
    });

    it('returns monthly totals with leading platform first and excludes drafts/scheduled posts', async () => {
      const res = await request(app)
        .get('/api/v1/admin/social-posts/monthly-totals?month=2026-10')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      const totals = res.body.data;
      expect(totals.month).toBe('2026-10');
      // Only 3 published posts in October: 2 Instagram + 1 LinkedIn
      expect(totals.posts).toBe(3);
      // Total reach = 7000 (Instagram) + 5000 (LinkedIn) = 12000
      expect(totals.reach).toBe(12000);
      // Total engagement = 600 (Instagram) + 400 (LinkedIn) = 1000
      expect(totals.engagement).toBe(1000);

      // Targets resolved from target history
      expect(totals.targets).toEqual({
        posts: 5,
        reach: 12000,
        engagement: 900,
      });

      // Leading platform is Instagram (reach 7000 > LinkedIn 5000)
      expect(totals.leading).toBe('instagram');

      // Platform rows: only platforms with posts > 0
      expect(totals.platforms.length).toBe(2);
      expect(totals.platforms[0]).toEqual({
        platform: 'instagram',
        label: 'Instagram',
        posts: 2,
        reach: 7000,
        engagement: 600,
      });
      expect(totals.platforms[1]).toEqual({
        platform: 'linkedin',
        label: 'LinkedIn',
        posts: 1,
        reach: 5000,
        engagement: 400,
      });

      // Platform rows sum up exactly to totals
      const sumPosts = totals.platforms.reduce((s, p) => s + p.posts, 0);
      const sumReach = totals.platforms.reduce((s, p) => s + p.reach, 0);
      const sumEngagement = totals.platforms.reduce((s, p) => s + p.engagement, 0);

      expect(sumPosts).toBe(totals.posts);
      expect(sumReach).toBe(totals.reach);
      expect(sumEngagement).toBe(totals.engagement);
    });

    it('strictly matches the KPIs "Posts published", "Social reach" and "Social engagement" on the dashboard', async () => {
      const totalsRes = await request(app)
        .get('/api/v1/admin/social-posts/monthly-totals?month=2026-10')
        .set('Cookie', adminCookie);

      const dashRes = await request(app)
        .get('/api/v1/admin/dashboard?month=2026-10')
        .set('Cookie', adminCookie);

      expect(dashRes.status).toBe(200);
      const { values } = dashRes.body.data;

      expect(values.posts_published).toBe(totalsRes.body.data.posts);
      expect(values.social_reach).toBe(totalsRes.body.data.reach);
      expect(values.social_engagement).toBe(totalsRes.body.data.engagement);
    });
  });

  describe('Update and Deletion Workflow', () => {
    it('updates a social post and logs audit entry', async () => {
      const post = await SocialPost.create({
        platform: 'x',
        title: 'Original tweet headline',
        url: 'https://x.com/original/1',
        reach: 100,
        engagement: 10,
        status: 'draft',
        postedAt: new Date('2026-10-01'),
        postedAtDate: '2026-10-01',
      });

      const res = await request(app)
        .patch(`/api/v1/admin/social-posts/${post._id}`)
        .set('Cookie', adminCookie)
        .send({
          title: 'Updated tweet headline',
          reach: 850,
          engagement: 75,
          status: 'published',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated tweet headline');
      expect(res.body.data.reach).toBe(850);
      expect(res.body.data.engagement).toBe(75);
      expect(res.body.data.status).toBe('published');

      const audit = await AuditLog.findOne({ action: AUDIT_ACTIONS.SOCIAL_POST_UPDATE });
      expect(audit).toBeTruthy();
      expect(audit.resourceId.toString()).toBe(post._id.toString());
    });

    it('deletes a social post and logs audit entry', async () => {
      const post = await SocialPost.create({
        platform: 'youtube',
        title: 'Livestream recording to delete',
        url: 'https://youtube.com/v/todelete',
        reach: 50,
        engagement: 2,
        status: 'draft',
        postedAt: new Date('2026-10-01'),
        postedAtDate: '2026-10-01',
      });

      const res = await request(app)
        .delete(`/api/v1/admin/social-posts/${post._id}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);

      const found = await SocialPost.findById(post._id);
      expect(found).toBeNull();

      const audit = await AuditLog.findOne({ action: AUDIT_ACTIONS.SOCIAL_POST_DELETE });
      expect(audit).toBeTruthy();
      expect(audit.resourceId.toString()).toBe(post._id.toString());
    });
  });

  describe('Screen Permissions (BE-001 Enforcement)', () => {
    it('rejects access when user role has none permission for social screen', async () => {
      // User with Database Officer role (which has none on social screen)
      const staffUser = await User.create({
        name: 'Database Staff Only',
        email: 'staff.db@example.com',
        role: 'seeker',
        passwordHash: 'hash',
      });
      await StaffMember.create({
        userId: staffUser._id,
        email: staffUser.email,
        name: staffUser.name,
        roles: ['database_officer'],
        status: 'active',
      });

      const token = signToken(staffUser);

      const res = await request(app)
        .get('/api/v1/admin/social-posts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('permits view access for Communications Officer', async () => {
      const staffUser = await User.create({
        name: 'Comms Officer',
        email: 'staff.comms@example.com',
        role: 'seeker',
        passwordHash: 'hash',
      });
      await StaffMember.create({
        userId: staffUser._id,
        email: staffUser.email,
        name: staffUser.name,
        roles: ['communications_officer'],
        status: 'active',
      });

      const token = signToken(staffUser);

      const res = await request(app)
        .get('/api/v1/admin/social-posts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });
});
