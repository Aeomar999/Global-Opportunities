import request from 'supertest';
import { app } from '../src/app.js';
import { User, StaffMember, AuditLog } from '../src/models/User.js';
import {
  MonthlyReport,
  WebsiteMonth,
  OpportunityEngagement,
  Partner,
  Program,
  SocialPost,
  Ambassador,
  Beneficiary,
  MonthlyTarget,
} from '../src/models/AdminPortal.js';
import { Opportunity } from '../src/models/Platform.js';
import { signAdminToken, signToken } from '../src/middleware/auth.js';
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '../src/lib/audit.js';

const api = (path) => `/api/v1${path}`;

describe('BE-013: Monthly Reports & KPI Engine Integration', () => {
  let adminUser;
  let adminCookie;
  let adminToken;
  let deskLeadUser;
  let deskLeadToken;
  let commsUser;
  let commsToken;
  let partnershipsUser;
  let partnershipsToken;
  let seekerUser;
  let seekerToken;

  beforeEach(async () => {
    await MonthlyReport.deleteMany({});
    await WebsiteMonth.deleteMany({});
    await Opportunity.deleteMany({});
    await OpportunityEngagement.deleteMany({});
    await Partner.deleteMany({});
    await Program.deleteMany({});
    await SocialPost.deleteMany({});
    await Ambassador.deleteMany({});
    await Beneficiary.deleteMany({});
    await MonthlyTarget.deleteMany({});
    await User.deleteMany({});
    await StaffMember.deleteMany({});
    await AuditLog.deleteMany({});

    // Super Admin
    adminUser = await User.create({
      name: 'Super Admin',
      email: 'admin.reports@example.com',
      role: 'admin',
      passwordHash: 'dummy-password-hash',
    });
    adminToken = signAdminToken(adminUser);
    adminCookie = `kredibble_admin_token=${adminToken}`;

    // Desk Lead (Desk Lead and Super Admin only for team report)
    deskLeadUser = await User.create({
      name: 'Desk Lead',
      email: 'desklead.reports@example.com',
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

    // Communications Officer (has monthly_report view permission)
    commsUser = await User.create({
      name: 'Comms Officer',
      email: 'comms.reports@example.com',
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

    // Partnerships Officer (has monthly_report view permission, but NOT team report access)
    partnershipsUser = await User.create({
      name: 'Partnerships Officer',
      email: 'partnerships.reports@example.com',
      role: 'seeker',
      passwordHash: 'dummy-password-hash',
    });
    await StaffMember.create({
      userId: partnershipsUser._id,
      name: partnershipsUser.name,
      email: partnershipsUser.email,
      roles: ['partnerships_officer'],
      status: 'active',
    });
    partnershipsToken = signToken(partnershipsUser);

    // Standard Seeker (no staff role)
    seekerUser = await User.create({
      name: 'Regular Seeker',
      email: 'seeker.reports@example.com',
      role: 'seeker',
      passwordHash: 'dummy-password-hash',
    });
    seekerToken = signToken(seekerUser);
  });

  describe('1. Model Validation and Invariants', () => {
    it('creates a valid MonthlyReport with required fields', async () => {
      const report = await MonthlyReport.create({
        reportMonth: '2026-09',
        view: 'partner',
        generatedAt: new Date('2026-10-02T10:00:00Z'),
        generatedBy: adminUser._id,
        generatedByName: adminUser.name,
      });

      expect(report._id).toBeDefined();
      expect(report.reportMonth).toBe('2026-09');
      expect(report.view).toBe('partner');
      expect(report.generatedAt.toISOString()).toBe('2026-10-02T10:00:00.000Z');
      expect(report.generatedBy.toString()).toBe(adminUser._id.toString());
    });

    it('rejects invalid view enum values', async () => {
      await expect(MonthlyReport.create({
        reportMonth: '2026-09',
        view: 'board',
        generatedBy: adminUser._id,
      })).rejects.toThrow();
    });

    it('rejects malformed reportMonth format', async () => {
      await expect(MonthlyReport.create({
        reportMonth: '2026-9',
        view: 'partner',
        generatedBy: adminUser._id,
      })).rejects.toThrow();
    });

    it('defaults generatedAt to Date.now if omitted', async () => {
      const before = new Date();
      const report = await MonthlyReport.create({
        reportMonth: '2026-08',
        view: 'team',
        generatedBy: adminUser._id,
      });
      const after = new Date();

      expect(report.generatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(report.generatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('2. POST /api/v1/admin/monthly-reports (Idempotent Recording)', () => {
    it('records a new report and returns 201 with audit log', async () => {
      const res = await request(app)
        .post(api('/admin/monthly-reports'))
        .set('Cookie', adminCookie)
        .send({
          reportMonth: '2026-09',
          view: 'partner',
          generatedAt: '2026-10-02T12:00:00.000Z',
        })
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.reportMonth).toBe('2026-09');
      expect(res.body.data.view).toBe('partner');
      expect(res.body.data.id).toBeDefined();

      const saved = await MonthlyReport.findOne({ reportMonth: '2026-09', view: 'partner' });
      expect(saved).not.toBeNull();

      const audit = await AuditLog.findOne({
        action: AUDIT_ACTIONS.MONTHLY_REPORT_GENERATE,
        resourceType: AUDIT_RESOURCE_TYPES.MONTHLY_REPORT,
      });
      expect(audit).not.toBeNull();
      expect(audit.metadata.reportMonth).toBe('2026-09');
      expect(audit.metadata.view).toBe('partner');
    });

    it('returns the existing report (idempotent, 200) on a second call in the same calendar month', async () => {
      // First call
      const firstRes = await request(app)
        .post(api('/admin/monthly-reports'))
        .set('Cookie', adminCookie)
        .send({
          reportMonth: '2026-09',
          view: 'partner',
          generatedAt: '2026-10-02T12:00:00.000Z',
        })
        .expect(201);

      const firstId = firstRes.body.data.id;
      const firstDate = firstRes.body.data.generatedAt;

      // Second call in the same calendar month (October 2026)
      const secondRes = await request(app)
        .post(api('/admin/monthly-reports'))
        .set('Cookie', adminCookie)
        .send({
          reportMonth: '2026-09',
          view: 'partner',
          generatedAt: '2026-10-15T15:30:00.000Z',
        })
        .expect(200);

      expect(secondRes.body.data.id).toBe(firstId);
      expect(secondRes.body.data.generatedAt).toBe(firstDate);

      // Verify only 1 document exists
      const count = await MonthlyReport.countDocuments({ reportMonth: '2026-09', view: 'partner' });
      expect(count).toBe(1);
    });

    it('records separate reports for different views in the same calendar month', async () => {
      const partnerRes = await request(app)
        .post(api('/admin/monthly-reports'))
        .set('Cookie', adminCookie)
        .send({
          reportMonth: '2026-09',
          view: 'partner',
          generatedAt: '2026-10-02T12:00:00.000Z',
        })
        .expect(201);

      const teamRes = await request(app)
        .post(api('/admin/monthly-reports'))
        .set('Cookie', adminCookie)
        .send({
          reportMonth: '2026-09',
          view: 'team',
          generatedAt: '2026-10-02T12:05:00.000Z',
        })
        .expect(201);

      expect(partnerRes.body.data.id).not.toBe(teamRes.body.data.id);
      expect(partnerRes.body.data.view).toBe('partner');
      expect(teamRes.body.data.view).toBe('team');
      expect(await MonthlyReport.countDocuments({ reportMonth: '2026-09' })).toBe(2);
    });

    it('records a new report when generated in a different calendar month', async () => {
      // First generation in October 2026
      await request(app)
        .post(api('/admin/monthly-reports'))
        .set('Cookie', adminCookie)
        .send({
          reportMonth: '2026-09',
          view: 'partner',
          generatedAt: '2026-10-02T12:00:00.000Z',
        })
        .expect(201);

      // Subsequent generation in November 2026 for the same reportMonth
      await request(app)
        .post(api('/admin/monthly-reports'))
        .set('Cookie', adminCookie)
        .send({
          reportMonth: '2026-09',
          view: 'partner',
          generatedAt: '2026-11-01T09:00:00.000Z',
        })
        .expect(201);

      expect(await MonthlyReport.countDocuments({ reportMonth: '2026-09', view: 'partner' })).toBe(2);
    });
  });

  describe('3. KPI Integration: "Monthly reports" KPI counts reports by the month of generatedAt', () => {
    it('counts reports by the month of generatedAt regardless of reportMonth', async () => {
      // Report 1: Covers 2026-08, generated on 2026-09-02 (generatedAt in 2026-09)
      await MonthlyReport.create({
        reportMonth: '2026-08',
        view: 'partner',
        generatedAt: new Date('2026-09-02T10:00:00Z'),
        generatedBy: adminUser._id,
      });

      // Report 2: Covers 2026-09, generated on 2026-09-28 (generatedAt in 2026-09)
      await MonthlyReport.create({
        reportMonth: '2026-09',
        view: 'team',
        generatedAt: new Date('2026-09-28T16:00:00Z'),
        generatedBy: adminUser._id,
      });

      // Report 3: Covers 2026-09, generated on 2026-10-05 (generatedAt in 2026-10)
      await MonthlyReport.create({
        reportMonth: '2026-09',
        view: 'partner',
        generatedAt: new Date('2026-10-05T11:00:00Z'),
        generatedBy: adminUser._id,
      });

      // Check September 2026 dashboard metrics
      const resSept = await request(app)
        .get(api('/admin/dashboard?month=2026-09'))
        .set('Cookie', adminCookie)
        .expect(200);

      // September should count Report 1 and Report 2 (generated in 2026-09) = 2
      expect(resSept.body.data.values.monthly_reports).toBe(2);
      expect(resSept.body.data.values.monthlyReports).toBe(2);

      // Check October 2026 dashboard metrics
      const resOct = await request(app)
        .get(api('/admin/dashboard?month=2026-10'))
        .set('Cookie', adminCookie)
        .expect(200);

      // October should count Report 3 (generated in 2026-10) = 1
      expect(resOct.body.data.values.monthly_reports).toBe(1);
      expect(resOct.body.data.values.monthlyReports).toBe(1);

      // Check August 2026 dashboard metrics (zero reports were generated in August)
      const resAug = await request(app)
        .get(api('/admin/dashboard?month=2026-08'))
        .set('Cookie', adminCookie)
        .expect(200);

      expect(resAug.body.data.values.monthly_reports).toBe(0);
      expect(resAug.body.data.values.monthlyReports).toBe(0);
    });
  });

  describe('4. GET /api/v1/admin/reports/partner', () => {
    beforeEach(async () => {
      // Seed opportunities published in 2026-09
      await Opportunity.create([
        {
          title: 'Listing 1',
          description: 'A great listing 1',
          company: 'Kredibble Org',
          location: 'Accra, Ghana',
          type: 'scholarship',
          status: 'published',
          vetted: true,
          publishedAt: new Date('2026-09-05T00:00:00Z'),
          userId: adminUser._id,
        },
        {
          title: 'Listing 2',
          description: 'A great listing 2',
          company: 'Kredibble Org',
          location: 'Accra, Ghana',
          type: 'grant',
          status: 'published',
          vetted: true,
          publishedAt: new Date('2026-09-15T00:00:00Z'),
          userId: adminUser._id,
        },
      ]);

      // Seed website audience for 2026-09
      await WebsiteMonth.create({
        month: '2026-09',
        views: 15000,
        dailyFirstVisits: 300,
        dailyVisitors: 450,
        channels: [{ channel: 'Direct', views: 15000 }],
      });

      // Seed social posts in 2026-09
      await SocialPost.create({
        title: 'Social Post Sept',
        platform: 'linkedin',
        status: 'published',
        reach: 5000,
        engagement: 600,
        postedAt: new Date('2026-09-10T12:00:00Z'),
        authorId: adminUser._id,
      });

      // Seed ambassadors and staff
      await Ambassador.create({
        name: 'Secret Ambassador John',
        email: 'secret.john@example.com',
        status: 'active',
        joinedAt: '2026-09-01',
      });
      const aliceUser = await User.create({
        name: 'Private Staff Alice',
        email: 'alice.staff@example.com',
        role: 'seeker',
        passwordHash: 'dummy-password-hash',
      });
      await StaffMember.create({
        userId: aliceUser._id,
        name: aliceUser.name,
        email: aliceUser.email,
        roles: ['communications_officer'],
        status: 'active',
      });
    });

    it('returns aggregate figures that equal the Overview for the same month', async () => {
      const overviewRes = await request(app)
        .get(api('/admin/dashboard?month=2026-09'))
        .set('Cookie', adminCookie)
        .expect(200);

      const partnerRes = await request(app)
        .get(api('/admin/reports/partner?month=2026-09'))
        .set('Cookie', adminCookie)
        .expect(200);

      const overviewData = overviewRes.body.data;
      const partnerData = partnerRes.body.data;

      expect(partnerData.month).toBe('2026-09');
      expect(partnerData.audience).toBe('partner');

      // KPIs match Overview target progress exactly
      expect(partnerData.kpis).toEqual(overviewData.kpis);

      // Opportunities published match Overview values
      const oppKpiPartner = partnerData.kpis.find((k) => k.metric === 'opportunitiesPublished');
      const oppKpiOverview = overviewData.kpis.find((k) => k.metric === 'opportunitiesPublished');
      expect(oppKpiPartner.value).toBe(2);
      expect(oppKpiPartner.value).toBe(oppKpiOverview.value);
    });

    it('strictly contains NO staff names, NO ambassador names, and NO scoreboard', async () => {
      const res = await request(app)
        .get(api('/admin/reports/partner?month=2026-09'))
        .set('Cookie', adminCookie)
        .expect(200);

      const bodyText = JSON.stringify(res.body);

      // Verify no staff or ambassador personal names appear in response payload
      expect(bodyText).not.toContain('Secret Ambassador John');
      expect(bodyText).not.toContain('Private Staff Alice');
      expect(res.body.data.teamScorecards).toBeUndefined();
      expect(res.body.data.people).toBeUndefined();
      expect(res.body.data.topAmbassadors).toBeUndefined();
      expect(res.body.data.top).toBeUndefined();
    });

    it('returns all 10 Partner metrics with previous and delta', async () => {
      const res = await request(app)
        .get(api('/admin/reports/partner?month=2026-09'))
        .set('Cookie', adminCookie)
        .expect(200);

      const metrics = res.body.data.metrics;
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics).toHaveLength(10);

      const metricIds = metrics.map((m) => m.id);
      expect(metricIds).toContain('website_views');
      expect(metricIds).toContain('daily_first_visits');
      expect(metricIds).toContain('daily_visitors');
      expect(metricIds).toContain('social_reach');
      expect(metricIds).toContain('social_engagement');
      expect(metricIds).toContain('posts_published');
      expect(metricIds).toContain('new_ambassadors');
      expect(metricIds).toContain('new_partners');
      expect(metricIds).toContain('opportunities_published');
      expect(metricIds).toContain('projects_organised');

      // Verify metric fields
      const websiteMetric = metrics.find((m) => m.id === 'website_views');
      expect(websiteMetric.value).toBe(15000);
      expect(websiteMetric.delta).toBeDefined();
      expect(websiteMetric.delta.kind).toBeDefined();
    });
  });

  describe('5. GET /api/v1/admin/reports/team (Internal Team Report)', () => {
    beforeEach(async () => {
      await Ambassador.create({
        name: 'Public Ambassador Jane',
        email: 'jane.ambassador@example.com',
        referralCode: 'GOD-JANE12',
        status: 'active',
        joinedAt: '2026-09-01',
      });
    });

    it('allows Super Admin to view team report with scorecards and top ambassadors', async () => {
      const res = await request(app)
        .get(api('/admin/reports/team?month=2026-09'))
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body.data.audience).toBe('team');
      expect(res.body.data.teamScorecards).toBeDefined();
      expect(res.body.data.topAmbassadors).toBeDefined();
      expect(res.body.data.pipeline).toBeDefined();
      expect(res.body.data.databasePace).toBeDefined();
    });

    it('allows Desk Lead to view team report', async () => {
      const res = await request(app)
        .get(api('/admin/reports/team?month=2026-09'))
        .set('Authorization', `Bearer ${deskLeadToken}`)
        .expect(200);

      expect(res.body.data.audience).toBe('team');
    });

    it('rejects Communications Officer from team report with 403 Forbidden', async () => {
      await request(app)
        .get(api('/admin/reports/team?month=2026-09'))
        .set('Authorization', `Bearer ${commsToken}`)
        .expect(403);
    });

    it('rejects Partnerships Officer from team report with 403 Forbidden', async () => {
      await request(app)
        .get(api('/admin/reports/team?month=2026-09'))
        .set('Authorization', `Bearer ${partnershipsToken}`)
        .expect(403);
    });
  });

  describe('6. GET /api/v1/admin/monthly-reports (List Query)', () => {
    it('returns list of recorded monthly reports with filters', async () => {
      await MonthlyReport.create([
        { reportMonth: '2026-08', view: 'partner', generatedAt: new Date('2026-09-01T10:00:00Z'), generatedBy: adminUser._id },
        { reportMonth: '2026-08', view: 'team', generatedAt: new Date('2026-09-01T10:05:00Z'), generatedBy: adminUser._id },
        { reportMonth: '2026-09', view: 'partner', generatedAt: new Date('2026-10-01T11:00:00Z'), generatedBy: adminUser._id },
      ]);

      const resAll = await request(app)
        .get(api('/admin/monthly-reports'))
        .set('Cookie', adminCookie)
        .expect(200);

      expect(resAll.body.data).toHaveLength(3);

      const resFiltered = await request(app)
        .get(api('/admin/monthly-reports?reportMonth=2026-08&view=partner'))
        .set('Cookie', adminCookie)
        .expect(200);

      expect(resFiltered.body.data).toHaveLength(1);
      expect(resFiltered.body.data[0].reportMonth).toBe('2026-08');
      expect(resFiltered.body.data[0].view).toBe('partner');
    });
  });

  describe('7. Authorization and Role Enforcement', () => {
    it('rejects unauthenticated requests with 401', async () => {
      await request(app)
        .get(api('/admin/reports/partner?month=2026-09'))
        .expect(401);

      await request(app)
        .get(api('/admin/reports/team?month=2026-09'))
        .expect(401);

      await request(app)
        .post(api('/admin/monthly-reports'))
        .send({ reportMonth: '2026-09', view: 'partner' })
        .expect(401);
    });

    it('rejects regular seeker without staff credentials with 403', async () => {
      await request(app)
        .get(api('/admin/reports/partner?month=2026-09'))
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(403);

      await request(app)
        .post(api('/admin/monthly-reports'))
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({ reportMonth: '2026-09', view: 'partner' })
        .expect(403);
    });

    it('allows Communications Officer with monthly_report view to read partner report and record reports', async () => {
      await request(app)
        .get(api('/admin/reports/partner?month=2026-09'))
        .set('Authorization', `Bearer ${commsToken}`)
        .expect(200);

      await request(app)
        .post(api('/admin/monthly-reports'))
        .set('Authorization', `Bearer ${commsToken}`)
        .send({ reportMonth: '2026-09', view: 'partner' })
        .expect(201);
    });
  });
});
