import request from 'supertest';
import { app } from '../src/app.js';
import { User, StaffMember, AuditLog } from '../src/models/User.js';
import { Opportunity, Applicant } from '../src/models/Platform.js';
import { signAdminToken, signToken } from '../src/middleware/auth.js';
import { AUDIT_ACTIONS } from '../src/lib/audit.js';

const api = (path) => `/api/v1${path}`;

describe('BE-011: Listings Curation, Vetting Invariant, and Metric Splitting', () => {
  let adminUser;
  let adminCookie;
  let adminToken;
  let officerUser;
  let officerToken;
  let writerUser;
  let writerToken;
  let deskLeadUser;
  let deskLeadToken;
  let unauthorizedStaffUser;
  let unauthorizedStaffToken;
  let seekerUser;
  let seekerToken;

  beforeEach(async () => {
    await Opportunity.deleteMany({});
    await Applicant.deleteMany({});
    await User.deleteMany({});
    await StaffMember.deleteMany({});
    await AuditLog.deleteMany({});

    // Super Admin
    adminUser = await User.create({
      name: 'Super Admin User',
      email: 'admin.curation@example.com',
      role: 'admin',
      passwordHash: 'dummy-password-hash',
    });
    adminToken = signAdminToken(adminUser);
    adminCookie = `kredibble_admin_token=${adminToken}`;

    // Opportunities Officer
    officerUser = await User.create({
      name: 'Opportunities Lead',
      email: 'officer@example.com',
      role: 'seeker',
      passwordHash: 'dummy-password-hash',
    });
    await StaffMember.create({
      userId: officerUser._id,
      name: officerUser.name,
      email: officerUser.email,
      roles: ['opportunities_officer'],
      status: 'active',
    });
    officerToken = signToken(officerUser);

    // Writer
    writerUser = await User.create({
      name: 'Content Writer',
      email: 'writer@example.com',
      role: 'seeker',
      passwordHash: 'dummy-password-hash',
    });
    await StaffMember.create({
      userId: writerUser._id,
      name: writerUser.name,
      email: writerUser.email,
      role: 'writer',
      status: 'active',
    });
    writerToken = signToken(writerUser);

    // Desk Lead
    deskLeadUser = await User.create({
      name: 'Desk Lead Person',
      email: 'desklead@example.com',
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

    // Unauthorized Staff (Social Media Manager without opportunities_queue edit access)
    unauthorizedStaffUser = await User.create({
      name: 'Social Media Staff',
      email: 'social@example.com',
      role: 'seeker',
      passwordHash: 'dummy-password-hash',
    });
    await StaffMember.create({
      userId: unauthorizedStaffUser._id,
      name: unauthorizedStaffUser.name,
      email: unauthorizedStaffUser.email,
      roles: ['social_media_manager'],
      status: 'active',
    });
    unauthorizedStaffToken = signToken(unauthorizedStaffUser);

    // Seeker (Public User)
    seekerUser = await User.create({
      name: 'Regular Seeker',
      email: 'seeker@example.com',
      role: 'seeker',
      passwordHash: 'dummy-password-hash',
    });
    seekerToken = signToken(seekerUser);
  });

  describe('Model Invariants and Field Normalization', () => {
    it('creates draft opportunity with vetted=false by default', async () => {
      const opp = new Opportunity({
        title: 'Master Fellowship in Sustainable Energy',
        company: 'EcoEnergy Alliance',
        type: 'fellowship',
        description: 'Comprehensive research fellowship program.',
        location: 'Remote',
        status: 'draft',
      });
      await opp.save();

      expect(opp.status).toBe('draft');
      expect(opp.vetted).toBe(false);
      expect(opp.publishedAt).toBeUndefined();
      expect(opp.vettedAt).toBeUndefined();
    });

    it('enforces invariant: published listing is automatically vetted with auto-stamped publishedAt and vettedAt', async () => {
      const opp = new Opportunity({
        title: 'Global Tech Innovation Grant 2026',
        company: 'Venture Forward',
        type: 'grant',
        description: 'Funding for emerging market technological startups.',
        location: 'Remote',
        status: 'published',
      });
      await opp.save();

      expect(opp.status).toBe('published');
      expect(opp.vetted).toBe(true);
      expect(opp.publishedAt).toBeInstanceOf(Date);
      expect(opp.vettedAt).toBeInstanceOf(Date);
      expect(opp.moderationStatus).toBe('published');
    });

    it('enforces invariant when transitioning existing draft to published', async () => {
      const opp = await Opportunity.create({
        title: 'Cybersecurity Traineeship',
        company: 'SecureNet International',
        type: 'training',
        description: 'Hands-on practical training in network defense.',
        location: 'Remote',
        status: 'draft',
        vetted: false,
      });

      expect(opp.vetted).toBe(false);
      expect(opp.publishedAt).toBeUndefined();

      opp.status = 'published';
      await opp.save();

      expect(opp.status).toBe('published');
      expect(opp.vetted).toBe(true);
      expect(opp.publishedAt).toBeInstanceOf(Date);
      expect(opp.vettedAt).toBeInstanceOf(Date);
    });

    it('unpublish transition retains vetted=true and clears publishedAt', async () => {
      const opp = await Opportunity.create({
        title: 'STEM Undergrad Scholarship',
        company: 'Future Innovators Trust',
        type: 'scholarship',
        description: 'Tuition assistance for outstanding undergraduate researchers.',
        location: 'Remote',
        status: 'published',
      });

      expect(opp.vetted).toBe(true);
      expect(opp.publishedAt).toBeInstanceOf(Date);

      opp.status = 'draft';
      opp.publishedAt = undefined;
      await opp.save();

      expect(opp.status).toBe('draft');
      expect(opp.vetted).toBe(true);
      expect(opp.publishedAt).toBeUndefined();
    });

    it('supports all expanded opportunity types', async () => {
      const validTypes = ['scholarship', 'scholarships', 'grant', 'grants', 'event', 'events', 'training', 'trainings', 'competition', 'competitions', 'fellowships'];

      for (const t of validTypes) {
        const opp = new Opportunity({
          title: `Test ${t} listing`,
          company: 'Acme Test Corp',
          type: t,
          description: `Description for ${t}`,
          location: 'Remote',
          status: 'draft',
        });
        await expect(opp.save()).resolves.toBeDefined();
      }
    });

    it('normalizes field aliases and handles subdocument views and applications', async () => {
      const closesDate = new Date('2026-12-31T23:59:59.000Z');
      const eventDateStr = '2026-11-15T10:00:00.000Z';

      const opp = new Opportunity({
        title: 'Pan-African AI Symposium',
        company: 'African AI Institute',
        type: 'event',
        description: 'Annual gathering of artificial intelligence researchers and practitioners.',
        status: 'draft',
        deadline: closesDate,
        applicationUrl: 'https://example.com/apply/symposium',
        eventDateTime: eventDateStr,
        assignedWriterId: writerUser._id,
        format: 'hybrid',
        location: 'Kigali, Rwanda',
        costLabel: 'Free with registration',
        durationLabel: '3 days',
        images: ['https://cdn.example.com/symposium-banner.jpg'],
        referralOnApply: true,
      });
      await opp.save();

      expect(opp.closesAt.toISOString()).toBe(closesDate.toISOString());
      expect(opp.applyUrl).toBe('https://example.com/apply/symposium');
      expect(opp.eventAt).toBe(eventDateStr);
      expect(opp.writerId.toString()).toBe(writerUser._id.toString());
      expect(opp.format).toBe('hybrid');
      expect(opp.location).toBe('Kigali, Rwanda');
      expect(opp.costLabel).toBe('Free with registration');
      expect(opp.durationLabel).toBe('3 days');
      expect(opp.referralOnApply).toBe(true);
      expect(opp.views).toEqual({ website: 0, app: 0 });
      expect(opp.applications).toEqual({ website: 0, app: 0 });
    });
  });

  describe('Admin Opportunities Counts Endpoint (GET /admin/opportunities/counts)', () => {
    it('returns exact count breakdown including unvettedDrafts', async () => {
      // 1. Unvetted draft
      await Opportunity.create({
        title: 'Draft 1 (Unvetted)',
        company: 'Org A',
        type: 'job',
        description: 'Desc',
        location: 'Remote',
        status: 'draft',
        vetted: false,
      });

      // 2. Unvetted draft
      await Opportunity.create({
        title: 'Draft 2 (Unvetted)',
        company: 'Org B',
        type: 'grant',
        description: 'Desc',
        location: 'Remote',
        status: 'draft',
        vetted: false,
      });

      // 3. Vetted draft
      await Opportunity.create({
        title: 'Draft 3 (Vetted)',
        company: 'Org C',
        type: 'scholarship',
        description: 'Desc',
        location: 'Remote',
        status: 'draft',
        vetted: true,
      });

      // 4. Published listing (must be vetted)
      await Opportunity.create({
        title: 'Published 1',
        company: 'Org D',
        type: 'fellowship',
        description: 'Desc',
        location: 'Remote',
        status: 'published',
      });

      // 5. Published listing
      await Opportunity.create({
        title: 'Published 2',
        company: 'Org E',
        type: 'event',
        description: 'Desc',
        location: 'Remote',
        status: 'published',
      });

      const res = await request(app)
        .get(api('/admin/opportunities/counts'))
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body.data).toMatchObject({
        unvettedDrafts: 2,
        drafts: 3,
        published: 2,
        vetted: 3, // 1 vetted draft + 2 published
        total: 5,
      });
    });
  });

  describe('Public Dashboard Summary Integration (GET /dashboard/summary)', () => {
    it('surfaces unvettedDrafts in public dashboard summary metrics', async () => {
      await Opportunity.create({
        title: 'Unvetted Draft Listing',
        company: 'Alpha Corp',
        type: 'job',
        description: 'Desc',
        location: 'Remote',
        status: 'draft',
        vetted: false,
      });

      const res = await request(app)
        .get(api('/dashboard/summary'))
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body.data.unvettedDrafts).toBeDefined();
      expect(res.body.data.unvettedDrafts).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Curation CRUD, Publishing, and Vetting Workflow', () => {
    it('creates a draft listing via POST /admin/opportunities with full curation metadata', async () => {
      const payload = {
        title: 'West Africa Health Innovation Fellowship',
        company: 'HealthTech Africa',
        type: 'fellowship',
        description: 'Empowering healthcare technologists across West Africa.',
        location: 'Accra, Ghana',
        status: 'draft',
        format: 'hybrid',
        costLabel: 'Fully funded',
        durationLabel: '6 months',
        applyUrl: 'https://healthtech.org/fellowship',
        closesAt: '2026-11-30T23:59:59.000Z',
        images: ['https://images.unsplash.com/photo-healthtech'],
        referralOnApply: true,
        writerId: writerUser._id.toString(),
      };

      const res = await request(app)
        .post(api('/admin/opportunities'))
        .set('Cookie', adminCookie)
        .send(payload)
        .expect(201);

      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe(payload.title);
      expect(res.body.data.status).toBe('draft');
      expect(res.body.data.vetted).toBe(false);
      expect(res.body.data.format).toBe('hybrid');
      expect(res.body.data.location).toBe('Accra, Ghana');
      expect(res.body.data.costLabel).toBe('Fully funded');
      expect(res.body.data.durationLabel).toBe('6 months');
      expect(res.body.data.referralOnApply).toBe(true);

      // Audit log verification
      const audit = await AuditLog.findOne({
        action: AUDIT_ACTIONS.OPPORTUNITY_CREATE,
        resourceId: res.body.data.id,
      });
      expect(audit).toBeTruthy();
      expect(audit.metadata.status).toBe('draft');
    });

    it('creates directly in published status and auto-stamps vetted and publishedAt', async () => {
      const payload = {
        title: 'Global Renewable Energy Grant',
        company: 'Clean Planet Initiative',
        type: 'grant',
        description: 'Financing green tech initiatives worldwide.',
        location: 'Remote',
        status: 'published',
        applyUrl: 'https://cleanplanet.org/apply',
      };

      const res = await request(app)
        .post(api('/admin/opportunities'))
        .set('Cookie', adminCookie)
        .send(payload)
        .expect(201);

      expect(res.body.data.status).toBe('published');
      expect(res.body.data.vetted).toBe(true);
      expect(res.body.data.publishedAt).toBeDefined();
      expect(res.body.data.vettedAt).toBeDefined();

      const saved = await Opportunity.findById(res.body.data.id);
      expect(saved.vetted).toBe(true);
      expect(saved.publishedAt).toBeInstanceOf(Date);
    });

    it('publishes a draft via PATCH /admin/opportunities/:id, stamping vetting and logging audits', async () => {
      const opp = await Opportunity.create({
        title: 'Data Science Bootcamp 2026',
        company: 'DataCorp Academy',
        type: 'training',
        description: 'Comprehensive 12-week data engineering curriculum.',
        location: 'Remote',
        status: 'draft',
        vetted: false,
      });

      const res = await request(app)
        .patch(api(`/admin/opportunities/${opp._id}`))
        .set('Cookie', adminCookie)
        .send({ status: 'published' })
        .expect(200);

      expect(res.body.data.status).toBe('published');
      expect(res.body.data.vetted).toBe(true);
      expect(res.body.data.publishedAt).toBeDefined();

      // Check audit logs for both OPPORTUNITY_UPDATE and OPPORTUNITY_PUBLISH
      const publishLog = await AuditLog.findOne({
        action: AUDIT_ACTIONS.OPPORTUNITY_PUBLISH,
        resourceId: opp._id.toString(),
      });
      expect(publishLog).toBeTruthy();

      const updateLog = await AuditLog.findOne({
        action: AUDIT_ACTIONS.OPPORTUNITY_UPDATE,
        resourceId: opp._id.toString(),
      });
      expect(updateLog).toBeTruthy();
    });

    it('unpublishes a listing via POST /admin/opportunities/:id/unpublish', async () => {
      const opp = await Opportunity.create({
        title: 'Senior DevOps Fellowship',
        company: 'Cloud Innovate',
        type: 'fellowship',
        description: 'Hands-on Kubernetes and platform engineering mentorship.',
        location: 'Remote',
        status: 'published',
      });

      expect(opp.vetted).toBe(true);
      expect(opp.publishedAt).toBeInstanceOf(Date);

      const res = await request(app)
        .post(api(`/admin/opportunities/${opp._id}/unpublish`))
        .set('Cookie', adminCookie)
        .expect(200);

      expect(res.body.data.status).toBe('draft');
      expect(res.body.data.publishedAt).toBeUndefined();
      expect(res.body.data.vetted).toBe(true); // Retains vetted state

      const unpublishLog = await AuditLog.findOne({
        action: AUDIT_ACTIONS.OPPORTUNITY_UNPUBLISH,
        resourceId: opp._id.toString(),
      });
      expect(unpublishLog).toBeTruthy();
    });

    it('filters opportunities list by status, vetted, type, and search term', async () => {
      await Opportunity.create({
        title: 'Kenya Tech Summit 2026',
        company: 'Nairobi Hub',
        type: 'event',
        description: 'Developer summit in Nairobi',
        location: 'Nairobi, Kenya',
        country: 'Kenya',
        status: 'published',
      });

      await Opportunity.create({
        title: 'Accra Code Challenge',
        company: 'Accra Devs',
        type: 'competition',
        description: 'Coding hackathon in Accra',
        location: 'Accra, Ghana',
        country: 'Ghana',
        status: 'draft',
        vetted: false,
      });

      // Filter by status=published
      const publishedRes = await request(app)
        .get(api('/admin/opportunities?status=published'))
        .set('Cookie', adminCookie)
        .expect(200);
      expect(publishedRes.body.data.length).toBe(1);
      expect(publishedRes.body.data[0].title).toBe('Kenya Tech Summit 2026');

      // Filter by vetted=false
      const unvettedRes = await request(app)
        .get(api('/admin/opportunities?vetted=false'))
        .set('Cookie', adminCookie)
        .expect(200);
      expect(unvettedRes.body.data.length).toBe(1);
      expect(unvettedRes.body.data[0].title).toBe('Accra Code Challenge');

      // Filter by type=event
      const eventRes = await request(app)
        .get(api('/admin/opportunities?type=event'))
        .set('Cookie', adminCookie)
        .expect(200);
      expect(eventRes.body.data.length).toBe(1);
      expect(eventRes.body.data[0].title).toBe('Kenya Tech Summit 2026');

      // Search by q=Accra
      const searchRes = await request(app)
        .get(api('/admin/opportunities?q=Accra'))
        .set('Cookie', adminCookie)
        .expect(200);
      expect(searchRes.body.data.length).toBe(1);
      expect(searchRes.body.data[0].title).toBe('Accra Code Challenge');
    });

    it('returns 404 when querying or modifying a non-existent opportunity', async () => {
      const dummyId = '507f1f77bcf86cd799439011';
      await request(app)
        .get(api(`/admin/opportunities/${dummyId}`))
        .set('Cookie', adminCookie)
        .expect(404);

      await request(app)
        .patch(api(`/admin/opportunities/${dummyId}`))
        .set('Cookie', adminCookie)
        .send({ title: 'Updated' })
        .expect(404);

      await request(app)
        .post(api(`/admin/opportunities/${dummyId}/unpublish`))
        .set('Cookie', adminCookie)
        .expect(404);
    });

    it('deletes an opportunity and logs OPPORTUNITY_DELETE', async () => {
      const opp = await Opportunity.create({
        title: 'To Be Deleted',
        company: 'Test Corp',
        type: 'job',
        description: 'Delete me',
        location: 'Remote',
        status: 'draft',
      });

      await request(app)
        .delete(api(`/admin/opportunities/${opp._id}`))
        .set('Cookie', adminCookie)
        .expect(200);

      const exists = await Opportunity.findById(opp._id);
      expect(exists).toBeNull();

      const deleteLog = await AuditLog.findOne({
        action: AUDIT_ACTIONS.OPPORTUNITY_DELETE,
        resourceId: opp._id.toString(),
      });
      expect(deleteLog).toBeTruthy();
    });
  });

  describe('Reach Metrics Tracking and Dual-Channel Split (Website & App)', () => {
    it('records and retrieves views and applications split by website and app', async () => {
      const opp = await Opportunity.create({
        title: 'AfroTech Leadership Fellowship',
        company: 'AfroTech Foundation',
        type: 'fellowship',
        description: 'Leadership development for emerging technology executives.',
        location: 'Remote',
        status: 'published',
      });

      // 1. Initial metrics should be zeros
      const initialMetricsRes = await request(app)
        .get(api(`/admin/opportunities/${opp._id}/metrics`))
        .set('Cookie', adminCookie)
        .expect(200);

      expect(initialMetricsRes.body.data).toEqual({
        listingId: opp._id.toString(),
        views: { website: 0, app: 0 },
        applications: { website: 0, app: 0 },
      });

      // 2. Increment website views via POST /opportunities/:id/views with source=website
      await request(app)
        .post(api(`/opportunities/${opp._id}/views`))
        .send({ source: 'website' })
        .expect(202);

      await request(app)
        .post(api(`/opportunities/${opp._id}/views`))
        .send({ source: 'website' })
        .expect(202);

      // 3. Increment app views with source=app
      await request(app)
        .post(api(`/opportunities/${opp._id}/views`))
        .send({ source: 'app' })
        .expect(202);

      // 4. Verify views incremented on Opportunity model and metrics endpoint
      const updatedMetricsRes = await request(app)
        .get(api(`/admin/opportunities/${opp._id}/metrics`))
        .set('Cookie', adminCookie)
        .expect(200);

      expect(updatedMetricsRes.body.data.views).toEqual({
        website: 2,
        app: 1,
      });

      // 5. Submit application as regular seeker to increment applications counter
      await request(app)
        .post(api(`/opportunities/${opp._id}/applicants`))
        .set('Authorization', `Bearer ${seekerToken}`)
        .send({
          name: 'Regular Seeker',
          skills: ['Coding'],
        })
        .expect(201);

      const afterAppMetricsRes = await request(app)
        .get(api(`/admin/opportunities/${opp._id}/metrics`))
        .set('Cookie', adminCookie)
        .expect(200);

      expect(afterAppMetricsRes.body.data.applications).toEqual({
        website: 0,
        app: 1,
      });
    });
  });

  describe('Temporal KPI Verification ("Opportunities published")', () => {
    it('counts vetted, published listings by publishedAt within month bounds', async () => {
      const thisMonth = new Date().toISOString().slice(0, 7);
      const prevMonthDate = new Date();
      prevMonthDate.setUTCMonth(prevMonthDate.getUTCMonth() - 1);
      const lastMonth = prevMonthDate.toISOString().slice(0, 7);

      // 1. Published THIS MONTH (vetted: true) -> should count
      await Opportunity.create({
        title: 'Listing Published This Month',
        company: 'Org 1',
        type: 'grant',
        description: 'Desc',
        location: 'Remote',
        status: 'published',
        vetted: true,
        publishedAt: new Date(),
      });

      // 2. Published LAST MONTH (vetted: true) -> should NOT count for this month
      await Opportunity.create({
        title: 'Listing Published Last Month',
        company: 'Org 2',
        type: 'scholarship',
        description: 'Desc',
        location: 'Remote',
        status: 'published',
        vetted: true,
        publishedAt: prevMonthDate,
      });

      // 3. Draft THIS MONTH (even if vetted: true) -> should NOT count as published
      await Opportunity.create({
        title: 'Draft Listing This Month',
        company: 'Org 3',
        type: 'fellowship',
        description: 'Desc',
        location: 'Remote',
        status: 'draft',
        vetted: true,
        createdAt: new Date(),
      });

      // 4. Query dashboard summary for this month
      const thisMonthRes = await request(app)
        .get(api(`/admin/dashboard?month=${thisMonth}`))
        .set('Cookie', adminCookie)
        .expect(200);

      expect(thisMonthRes.body.data.values.opportunitiesPublished).toBe(1);

      // 5. Query dashboard summary for last month
      const lastMonthRes = await request(app)
        .get(api(`/admin/dashboard?month=${lastMonth}`))
        .set('Cookie', adminCookie)
        .expect(200);

      expect(lastMonthRes.body.data.values.opportunitiesPublished).toBe(1);
    });
  });

  describe('RBAC and Access Control Matrix', () => {
    const testListingPayload = {
      title: 'Global AI Research Internship',
      company: 'FutureMind AI',
      type: 'internship',
      description: 'Applied machine learning research internship.',
      location: 'Remote',
      status: 'draft',
    };

    it('allows Super Admin to view and manage opportunities', async () => {
      await request(app)
        .get(api('/admin/opportunities'))
        .set('Cookie', adminCookie)
        .expect(200);

      const createRes = await request(app)
        .post(api('/admin/opportunities'))
        .set('Cookie', adminCookie)
        .send(testListingPayload)
        .expect(201);

      await request(app)
        .get(api(`/admin/opportunities/${createRes.body.data.id}`))
        .set('Cookie', adminCookie)
        .expect(200);
    });

    it('allows Opportunities Officer to view and manage opportunities', async () => {
      await request(app)
        .get(api('/admin/opportunities'))
        .set('Authorization', `Bearer ${officerToken}`)
        .expect(200);

      await request(app)
        .post(api('/admin/opportunities'))
        .set('Authorization', `Bearer ${officerToken}`)
        .send(testListingPayload)
        .expect(201);
    });

    it('allows Writer to view and manage opportunities', async () => {
      await request(app)
        .get(api('/admin/opportunities'))
        .set('Authorization', `Bearer ${writerToken}`)
        .expect(200);

      await request(app)
        .post(api('/admin/opportunities'))
        .set('Authorization', `Bearer ${writerToken}`)
        .send(testListingPayload)
        .expect(201);
    });

    it('allows Desk Lead to view and manage opportunities', async () => {
      await request(app)
        .get(api('/admin/opportunities'))
        .set('Authorization', `Bearer ${deskLeadToken}`)
        .expect(200);

      await request(app)
        .post(api('/admin/opportunities'))
        .set('Authorization', `Bearer ${deskLeadToken}`)
        .send(testListingPayload)
        .expect(201);
    });

    it('rejects unauthorized staff member without opportunity screen access with 403', async () => {
      await request(app)
        .get(api('/admin/opportunities'))
        .set('Authorization', `Bearer ${unauthorizedStaffToken}`)
        .expect(403);

      await request(app)
        .post(api('/admin/opportunities'))
        .set('Authorization', `Bearer ${unauthorizedStaffToken}`)
        .send(testListingPayload)
        .expect(403);
    });

    it('rejects unauthenticated caller with 401 and public seeker with 403', async () => {
      await request(app)
        .get(api('/admin/opportunities'))
        .expect(401);

      await request(app)
        .post(api('/admin/opportunities'))
        .send(testListingPayload)
        .expect(401);

      await request(app)
        .get(api('/admin/opportunities'))
        .set('Authorization', `Bearer ${seekerToken}`)
        .expect(403);

      await request(app)
        .post(api('/admin/opportunities'))
        .set('Authorization', `Bearer ${seekerToken}`)
        .send(testListingPayload)
        .expect(403);
    });
  });
});
