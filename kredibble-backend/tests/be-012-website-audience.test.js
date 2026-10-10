import request from 'supertest';
import { app } from '../src/app.js';
import { User, StaffMember, AuditLog } from '../src/models/User.js';
import { WebsiteMonth, calculateDefaultDailyFigures, getDaysForMonth } from '../src/models/AdminPortal.js';
import { signAdminToken, signToken } from '../src/middleware/auth.js';
import { AUDIT_ACTIONS } from '../src/lib/audit.js';

const api = (path) => `/api/v1${path}`;

describe('BE-012: Website Audience & KPI Integration', () => {
  let adminUser;
  let adminCookie;
  let adminToken;
  let deskLeadUser;
  let deskLeadToken;
  let commsUser;
  let commsToken;
  let seekerUser;
  let seekerToken;

  beforeEach(async () => {
    await WebsiteMonth.deleteMany({});
    await User.deleteMany({});
    await StaffMember.deleteMany({});
    await AuditLog.deleteMany({});

    // Super Admin
    adminUser = await User.create({
      name: 'Super Admin',
      email: 'admin.audience@example.com',
      role: 'admin',
      passwordHash: 'dummy-password-hash',
    });
    adminToken = signAdminToken(adminUser);
    adminCookie = `kredibble_admin_token=${adminToken}`;

    // Desk Lead (has edit on insights)
    deskLeadUser = await User.create({
      name: 'Desk Lead',
      email: 'desklead.audience@example.com',
      role: 'seeker',
      passwordHash: 'dummy-password-hash',
    });
    await StaffMember.create({
      userId: deskLeadUser._id,
      name: deskLeadUser.name,
      email: deskLeadUser.email,
      roles: ['desk_lead'],
      status: 'active',
    });
    deskLeadToken = signToken(deskLeadUser);

    // Communications Officer (has view on monthly_report)
    commsUser = await User.create({
      name: 'Comms Officer',
      email: 'comms.audience@example.com',
      role: 'seeker',
      passwordHash: 'dummy-password-hash',
    });
    await StaffMember.create({
      userId: commsUser._id,
      name: commsUser.name,
      email: commsUser.email,
      roles: ['communications_officer'],
      status: 'active',
    });
    commsToken = signToken(commsUser);

    // Regular seeker (no staff access)
    seekerUser = await User.create({
      name: 'Seeker Regular',
      email: 'seeker.audience@example.com',
      role: 'seeker',
      passwordHash: 'dummy-password-hash',
    });
    seekerToken = signToken(seekerUser);
  });

  describe('1. Model Validation and Invariants', () => {
    it('creates a valid WebsiteMonth with all channels summing to total views', async () => {
      const monthDoc = new WebsiteMonth({
        month: '2026-03',
        views: 10000,
        dailyFirstVisits: 120,
        dailyVisitors: 240,
        channels: [
          { channel: 'Direct', views: 4000 },
          { channel: 'Organic Search', views: 3500 },
          { channel: 'Social', views: 1500 },
          { channel: 'Referral', views: 1000 },
        ],
      });
      await monthDoc.save();

      expect(monthDoc._id).toBeDefined();
      expect(monthDoc.month).toBe('2026-03');
      expect(monthDoc.views).toBe(10000);
      expect(monthDoc.channels).toHaveLength(4);
      expect(monthDoc.source).toBe('manual');
    });

    it('enforces unique index on month', async () => {
      await WebsiteMonth.create({
        month: '2026-04',
        views: 5000,
        channels: [{ channel: 'Direct', views: 5000 }],
      });

      await expect(
        WebsiteMonth.create({
          month: '2026-04',
          views: 6000,
          channels: [{ channel: 'Direct', views: 6000 }],
        })
      ).rejects.toThrow();
    });

    it('fails validation when channel views do not add up to total views', async () => {
      const invalidDoc = new WebsiteMonth({
        month: '2026-05',
        views: 10000,
        channels: [
          { channel: 'Direct', views: 4000 },
          { channel: 'Social', views: 2000 }, // sum is 6000 != 10000
        ],
      });

      await expect(invalidDoc.save()).rejects.toThrow(/must add up to total views/);
    });

    it('auto-defaults channels to Direct when views is provided without channels', async () => {
      const doc = new WebsiteMonth({
        month: '2026-06',
        views: 8500,
      });
      await doc.save();

      expect(doc.channels).toHaveLength(1);
      expect(doc.channels[0].channel).toBe('Direct');
      expect(doc.channels[0].views).toBe(8500);
    });

    it('auto-computes total views when channels are provided without explicit views', async () => {
      const doc = new WebsiteMonth({
        month: '2026-07',
        channels: [
          { channel: 'Direct', views: 3000 },
          { channel: 'Email', views: 2000 },
        ],
      });
      await doc.save();

      expect(doc.views).toBe(5000);
    });

    it('auto-computes dailyFirstVisits and dailyVisitors when omitted', async () => {
      const doc = new WebsiteMonth({
        month: '2026-01', // 31 days
        views: 31000,
        channels: [{ channel: 'Direct', views: 31000 }],
      });
      await doc.save();

      expect(doc.dailyFirstVisits).toBeGreaterThan(0);
      expect(doc.dailyVisitors).toBeGreaterThan(0);
      expect(doc.dailyVisitors).toBeGreaterThan(doc.dailyFirstVisits);
    });

    it('calculates default daily figures using calculateDefaultDailyFigures helper', () => {
      const days = getDaysForMonth('2026-02');
      expect(days).toBe(28);

      const figures = calculateDefaultDailyFigures(14000, '2026-02');
      expect(figures.dailyFirstVisits).toBe(Math.round(14000 / 28 / 2.6));
      expect(figures.dailyVisitors).toBe(Math.round(14000 / 28 / 1.35));
    });
  });

  describe('2. GET /api/v1/admin/website-audience', () => {
    beforeEach(async () => {
      const months = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03'];
      for (const [index, month] of months.entries()) {
        const views = 10000 + index * 1000;
        await WebsiteMonth.create({
          month,
          views,
          dailyFirstVisits: Math.round(views / 30 / 2.6),
          dailyVisitors: Math.round(views / 30 / 1.35),
          channels: [{ channel: 'Direct', views }],
        });
      }
    });

    it('returns the last 6 months in chronological ascending order by default', async () => {
      const res = await request(app)
        .get(api('/admin/website-audience'))
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body.data).toHaveLength(6);
      expect(res.body.data[0].month).toBe('2025-10');
      expect(res.body.data[5].month).toBe('2026-03');
      expect(res.body.meta.total).toBe(6);
    });

    it('supports order=desc to retrieve newest months first', async () => {
      const res = await request(app)
        .get(api('/admin/website-audience?order=desc'))
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body.data).toHaveLength(6);
      expect(res.body.data[0].month).toBe('2026-03');
      expect(res.body.data[5].month).toBe('2025-10');
    });

    it('supports limiting months with months=3 parameter', async () => {
      const res = await request(app)
        .get(api('/admin/website-audience?months=3'))
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body.data).toHaveLength(3);
      expect(res.body.data[0].month).toBe('2026-01');
      expect(res.body.data[2].month).toBe('2026-03');
    });

    it('supports filtering by upper month bound', async () => {
      const res = await request(app)
        .get(api('/admin/website-audience?month=2025-12&months=2'))
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].month).toBe('2025-11');
      expect(res.body.data[1].month).toBe('2025-12');
    });

    it('allows communications officer with monthly_report view to read audience', async () => {
      const res = await request(app)
        .get(api('/admin/website-audience'))
        .set('Authorization', `Bearer ${commsToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(6);
    });
  });

  describe('3. GET /api/v1/admin/website-audience/:month', () => {
    it('returns a single month audience record when found', async () => {
      await WebsiteMonth.create({
        month: '2026-03',
        views: 12500,
        channels: [
          { channel: 'Direct', views: 7500 },
          { channel: 'Organic', views: 5000 },
        ],
      });

      const res = await request(app)
        .get(api('/admin/website-audience/2026-03'))
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body.data.month).toBe('2026-03');
      expect(res.body.data.views).toBe(12500);
      expect(res.body.data.channels).toHaveLength(2);
    });

    it('returns 404 when month record does not exist', async () => {
      await request(app)
        .get(api('/admin/website-audience/2026-09'))
        .set('Cookie', adminCookie)
        .expect(404);
    });

    it('returns 400 for malformed month', async () => {
      await request(app)
        .get(api('/admin/website-audience/not-a-month'))
        .set('Cookie', adminCookie)
        .expect(400);
    });
  });

  describe('4. PUT /api/v1/admin/website-audience/:month and POST /admin/website-audience', () => {
    it('creates new audience month and records audit log', async () => {
      const res = await request(app)
        .put(api('/admin/website-audience/2026-03'))
        .set('Cookie', adminCookie)
        .send({
          views: 15000,
          channels: [
            { channel: 'Direct', views: 8000 },
            { channel: 'Organic Search', views: 7000 },
          ],
        })
        .expect(200);

      expect(res.body.data.month).toBe('2026-03');
      expect(res.body.data.views).toBe(15000);
      expect(res.body.data.source).toBe('manual');

      // Verify Audit Log
      const audit = await AuditLog.findOne({ action: AUDIT_ACTIONS.WEBSITE_AUDIENCE_UPDATE });
      expect(audit).not.toBeNull();
      expect(audit.metadata.month).toBe('2026-03');
      expect(audit.metadata.updated.views).toBe(15000);
    });

    it('updates existing audience month and records previous in audit log', async () => {
      await WebsiteMonth.create({
        month: '2026-03',
        views: 12000,
        channels: [{ channel: 'Direct', views: 12000 }],
      });

      const res = await request(app)
        .put(api('/admin/website-audience/2026-03'))
        .set('Authorization', `Bearer ${deskLeadToken}`)
        .send({
          views: 16000,
          channels: [
            { channel: 'Direct', views: 10000 },
            { channel: 'Social', views: 6000 },
          ],
        })
        .expect(200);

      expect(res.body.data.views).toBe(16000);

      const audit = await AuditLog.findOne({ action: AUDIT_ACTIONS.WEBSITE_AUDIENCE_UPDATE });
      expect(audit.metadata.previous.views).toBe(12000);
      expect(audit.metadata.updated.views).toBe(16000);
    });

    it('supports POST /admin/website-audience with month in body', async () => {
      const res = await request(app)
        .post(api('/admin/website-audience'))
        .set('Cookie', adminCookie)
        .send({
          month: '2026-04',
          views: 20000,
          channels: [{ channel: 'Direct', views: 20000 }],
        })
        .expect(200);

      expect(res.body.data.month).toBe('2026-04');
      expect(res.body.data.views).toBe(20000);
    });

    it('rejects update when channel views do not match total views', async () => {
      await request(app)
        .put(api('/admin/website-audience/2026-03'))
        .set('Cookie', adminCookie)
        .send({
          views: 10000,
          channels: [{ channel: 'Direct', views: 5000 }], // mismatch
        })
        .expect(400);
    });
  });

  describe('5. POST /api/v1/admin/website-audience/sync (GA4 sync)', () => {
    it('returns skipped status when GA4 credentials are not configured', async () => {
      const originalProp = process.env.GA4_PROPERTY_ID;
      const originalSecret = process.env.GA4_API_SECRET;
      delete process.env.GA4_PROPERTY_ID;
      delete process.env.GA4_API_SECRET;

      try {
        const res = await request(app)
          .post(api('/admin/website-audience/sync'))
          .set('Cookie', adminCookie)
          .send({ month: '2026-03' })
          .expect(200);

        expect(res.body.data.status).toBe('skipped');
        expect(res.body.data.message).toMatch(/not configured/i);
      } finally {
        if (originalProp) process.env.GA4_PROPERTY_ID = originalProp;
        if (originalSecret) process.env.GA4_API_SECRET = originalSecret;
      }
    });

    it('successfully syncs and logs audit when GA4 credentials are configured', async () => {
      process.env.GA4_PROPERTY_ID = 'properties/123456789';
      process.env.GA4_API_SECRET = 'sample-ga4-secret-key-12345';

      try {
        const res = await request(app)
          .post(api('/admin/website-audience/sync'))
          .set('Cookie', adminCookie)
          .send({ month: '2026-03' })
          .expect(200);

        expect(res.body.data.status).toBe('synced');
        expect(res.body.data.record.source).toBe('ga4');
        expect(res.body.data.record.views).toBeGreaterThan(0);

        const audit = await AuditLog.findOne({ action: AUDIT_ACTIONS.WEBSITE_AUDIENCE_SYNC });
        expect(audit).not.toBeNull();
        expect(audit.metadata.source).toBe('ga4');
      } finally {
        delete process.env.GA4_PROPERTY_ID;
        delete process.env.GA4_API_SECRET;
      }
    });
  });

  describe('6. KPI Integration & Dashboard Metrics', () => {
    it('feeds website_views into dashboard summary and kpi engine', async () => {
      await WebsiteMonth.create({
        month: '2026-03',
        views: 14500,
        channels: [{ channel: 'Direct', views: 14500 }],
      });

      const res = await request(app)
        .get(api('/admin/dashboard?month=2026-03'))
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body.data.values.websiteViews).toBe(14500);
      expect(res.body.data.values.website_views).toBe(14500);

      const websiteKpi = res.body.data.kpis.find((k) => k.metric === 'website_views' || k.metric === 'websiteViews');
      expect(websiteKpi).toBeDefined();
      expect(websiteKpi.value).toBe(14500);
    });

    it('includes websiteAudience and growth in monthly reports endpoint', async () => {
      await WebsiteMonth.create({
        month: '2026-02',
        views: 10000,
        channels: [{ channel: 'Direct', views: 10000 }],
      });
      await WebsiteMonth.create({
        month: '2026-03',
        views: 12000,
        channels: [{ channel: 'Direct', views: 12000 }],
      });

      const res = await request(app)
        .get(api('/admin/reports/monthly?month=2026-03&audience=partner'))
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body.data.websiteAudience).not.toBeNull();
      expect(res.body.data.websiteAudience.views).toBe(12000);
      expect(res.body.data.monthOverMonthGrowth.websiteViews).toBe(20); // (12000 - 10000) / 10000 = +20%
    });
  });

  describe('7. Authorization and Role Enforcement', () => {
    it('rejects unauthenticated requests with 401', async () => {
      await request(app)
        .get(api('/admin/website-audience'))
        .expect(401);

      await request(app)
        .put(api('/admin/website-audience/2026-03'))
        .send({ views: 5000 })
        .expect(401);
    });

    it('rejects regular seeker without staff credentials with 403', async () => {
      await request(app)
        .get(api('/admin/website-audience'))
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(403);

      await request(app)
        .put(api('/admin/website-audience/2026-03'))
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({ views: 5000 })
        .expect(403);
    });

    it('allows desk lead to edit website audience', async () => {
      await request(app)
        .put(api('/admin/website-audience/2026-03'))
        .set('Authorization', `Bearer ${deskLeadToken}`)
        .send({
          views: 9000,
          channels: [{ channel: 'Direct', views: 9000 }],
        })
        .expect(200);
    });
  });
});
