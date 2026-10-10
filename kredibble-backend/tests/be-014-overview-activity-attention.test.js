import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { User, StaffMember } from '../src/models/User.js';
import {
  Ambassador,
  AmbassadorRequest,
  Beneficiary,
  Partner,
  Program,
  Testimonial,
} from '../src/models/AdminPortal.js';
import { Opportunity, CompanyVerification } from '../src/models/Platform.js';
import { Report } from '../src/models/Community.js';
import { signAdminToken, signToken } from '../src/middleware/auth.js';

const api = (path) => `/api/v1${path}`;

describe('BE-014: Overview Feed & Attention Counts', () => {
  let adminUser;
  let adminToken;
  let adminCookie;
  let staffUser;
  let staffToken;
  let seekerUser;
  let seekerToken;

  beforeEach(async () => {
    await CompanyVerification.deleteMany({});
    await Report.deleteMany({});
    await Testimonial.deleteMany({});
    await Opportunity.deleteMany({});
    await Beneficiary.deleteMany({});
    await AmbassadorRequest.deleteMany({});
    await Ambassador.deleteMany({});
    await Partner.deleteMany({});
    await Program.deleteMany({});
    await User.deleteMany({});
    await StaffMember.deleteMany({});

    // Super Admin
    adminUser = await User.create({
      name: 'Super Admin',
      email: 'admin.overview@example.com',
      role: 'admin',
      passwordHash: 'dummy-hash-value',
    });
    adminToken = signAdminToken(adminUser);
    adminCookie = `kredibble_admin_token=${adminToken}`;

    // Desk Lead staff member
    staffUser = await User.create({
      name: 'Desk Lead User',
      email: 'lead.overview@example.com',
      role: 'seeker',
      passwordHash: 'dummy-hash-value',
    });
    await StaffMember.create({
      userId: staffUser._id,
      name: staffUser.name,
      email: staffUser.email,
      role: 'Desk Lead',
      status: 'active',
    });
    staffToken = signToken(staffUser);

    // Regular seeker (not staff/admin)
    seekerUser = await User.create({
      name: 'Regular Seeker',
      email: 'seeker.overview@example.com',
      role: 'seeker',
      passwordHash: 'dummy-hash-value',
    });
    seekerToken = signToken(seekerUser);
  });

  describe('GET /api/v1/admin/overview/attention', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get(api('/admin/overview/attention'));
      expect(res.status).toBe(401);
    });

    it('rejects non-staff non-admin users with 403', async () => {
      const res = await request(app)
        .get(api('/admin/overview/attention'))
        .set('Authorization', `Bearer ${seekerToken}`);
      expect(res.status).toBe(403);
    });

    it('returns empty/zero counts when collections have no pending items', async () => {
      const res = await request(app)
        .get(api('/admin/overview/attention'))
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        pendingVerifications: 0,
        openReports: 0,
        pendingTestimonials: 0,
        draftListings: 0,
        unvettedDrafts: 0,
        pendingRecords: 0,
        pendingAmbassadorRequests: 0,
      });
    });

    it('accurately counts each pending queue and ignores completed/unrelated items', async () => {
      // 2 pending verifications + 1 verified
      await CompanyVerification.create([
        { userId: adminUser._id, hirerId: new mongoose.Types.ObjectId(), name: 'Company Alpha', overallStatus: 'pending' },
        { userId: staffUser._id, hirerId: new mongoose.Types.ObjectId(), name: 'Company Beta', overallStatus: 'pending' },
        { userId: seekerUser._id, hirerId: new mongoose.Types.ObjectId(), name: 'Company Gamma', overallStatus: 'verified' },
      ]);

      // 2 open reports + 1 resolved
      await Report.create([
        { reporterId: seekerUser._id, reporterRole: 'seeker', targetType: 'post', targetId: 'post-1', reason: 'Spam', status: 'open' },
        { reporterId: seekerUser._id, reporterRole: 'seeker', targetType: 'post', targetId: 'post-2', reason: 'Abuse', status: 'open' },
        { reporterId: seekerUser._id, reporterRole: 'seeker', targetType: 'post', targetId: 'post-3', reason: 'Old', status: 'resolved' },
      ]);

      // 3 pending testimonials + 1 approved
      await Testimonial.create([
        { name: 'Alice', email: 'alice@example.com', comment: 'Great platform 1', status: 'pending' },
        { name: 'Bob', email: 'bob@example.com', comment: 'Great platform 2', status: 'pending' },
        { name: 'Charlie', email: 'charlie@example.com', comment: 'Great platform 3', status: 'pending' },
        { name: 'David', email: 'david@example.com', comment: 'Great platform 4', status: 'approved' },
      ]);

      // 2 draft unvetted listings + 1 published listing + 1 vetted draft listing
      await Opportunity.create([
        { title: 'Draft Unvetted 1', type: 'job', company: 'Acme Corp', location: 'Remote', description: 'Desc 1', status: 'draft', vetted: false, createdBy: adminUser._id },
        { title: 'Draft Unvetted 2', type: 'job', company: 'Acme Corp', location: 'Remote', description: 'Desc 2', status: 'draft', vetted: false, createdBy: adminUser._id },
        { title: 'Published Listing', type: 'job', company: 'Acme Corp', location: 'Remote', description: 'Desc 3', status: 'published', vetted: true, publishedAt: new Date(), createdBy: adminUser._id },
        { title: 'Vetted Draft', type: 'job', company: 'Acme Corp', location: 'Remote', description: 'Desc 4', status: 'draft', vetted: true, createdBy: adminUser._id },
      ]);

      // 3 unverified beneficiaries + 2 verified
      await Beneficiary.create([
        { fullName: 'Beneficiary 1', email: 'ben1@example.com', verified: false },
        { fullName: 'Beneficiary 2', email: 'ben2@example.com', verified: false },
        { fullName: 'Beneficiary 3', email: 'ben3@example.com', verified: false },
        { fullName: 'Beneficiary 4', email: 'ben4@example.com', verified: true, verifiedAt: new Date() },
        { fullName: 'Beneficiary 5', email: 'ben5@example.com', verified: true, verifiedAt: new Date() },
      ]);

      // 2 pending ambassador requests + 1 approved
      await AmbassadorRequest.create([
        { userId: seekerUser._id, role: 'seeker', name: 'Req 1', email: 'req1@example.com', status: 'pending' },
        { userId: staffUser._id, role: 'seeker', name: 'Req 2', email: 'req2@example.com', status: 'pending' },
        { userId: adminUser._id, role: 'hirer', name: 'Req 3', email: 'req3@example.com', status: 'approved' },
      ]);

      const res = await request(app)
        .get(api('/admin/overview/attention'))
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        pendingVerifications: 2,
        openReports: 2,
        pendingTestimonials: 3,
        draftListings: 2,
        unvettedDrafts: 2,
        pendingRecords: 3,
        pendingAmbassadorRequests: 2,
      });
    });

    it('shares the exact same numbers with GET /dashboard/summary (coherence test)', async () => {
      await CompanyVerification.create({ userId: adminUser._id, hirerId: new mongoose.Types.ObjectId(), name: 'Acme LLC', overallStatus: 'pending' });
      await Report.create({ reporterId: seekerUser._id, reporterRole: 'seeker', targetType: 'post', targetId: 'post-1', reason: 'Spam', status: 'open' });
      await Testimonial.create({ name: 'Alice', email: 'alice@example.com', comment: 'Great', status: 'pending' });
      await Opportunity.create({ title: 'Draft Listing', type: 'job', company: 'Acme Corp', location: 'Remote', description: 'Desc', status: 'draft', vetted: false, createdBy: adminUser._id });
      await Beneficiary.create({ fullName: 'Ben', email: 'ben@example.com', verified: false });
      await AmbassadorRequest.create({ userId: seekerUser._id, role: 'seeker', name: 'Req', email: 'req@example.com', status: 'pending' });

      const attentionRes = await request(app)
        .get(api('/admin/overview/attention'))
        .set('Cookie', adminCookie);

      const summaryRes = await request(app)
        .get(api('/dashboard/summary'))
        .set('Cookie', adminCookie);

      expect(attentionRes.status).toBe(200);
      expect(summaryRes.status).toBe(200);

      // Verify mathematical identity across both endpoints
      expect(attentionRes.body.data.pendingVerifications).toBe(summaryRes.body.data.pendingVerifications);
      expect(attentionRes.body.data.openReports).toBe(summaryRes.body.data.openReports);
      expect(attentionRes.body.data.pendingTestimonials).toBe(summaryRes.body.data.pendingTestimonials);
      expect(attentionRes.body.data.unvettedDrafts).toBe(summaryRes.body.data.unvettedDrafts);
      expect(attentionRes.body.data.draftListings).toBe(summaryRes.body.data.unvettedDrafts);
      expect(attentionRes.body.data.pendingRecords).toBe(summaryRes.body.data.pendingRecords);
      expect(attentionRes.body.data.pendingAmbassadorRequests).toBe(summaryRes.body.data.pendingAmbassadorRequests);
    });

    it('dynamically decreases counts as items are actioned', async () => {
      const doc = await CompanyVerification.create({ userId: adminUser._id, hirerId: new mongoose.Types.ObjectId(), name: 'Dynamic Company', overallStatus: 'pending' });
      const testDoc = await Testimonial.create({ name: 'Test User', email: 'test@example.com', comment: 'Quote', status: 'pending' });

      let res = await request(app)
        .get(api('/admin/overview/attention'))
        .set('Cookie', adminCookie);
      expect(res.body.data.pendingVerifications).toBe(1);
      expect(res.body.data.pendingTestimonials).toBe(1);

      // Action items
      await CompanyVerification.findByIdAndUpdate(doc._id, { overallStatus: 'verified' });
      await Testimonial.findByIdAndUpdate(testDoc._id, { status: 'approved' });

      res = await request(app)
        .get(api('/admin/overview/attention'))
        .set('Cookie', adminCookie);
      expect(res.body.data.pendingVerifications).toBe(0);
      expect(res.body.data.pendingTestimonials).toBe(0);
    });
  });

  describe('GET /api/v1/admin/overview/activity', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get(api('/admin/overview/activity'));
      expect(res.status).toBe(401);
    });

    it('rejects non-staff non-admin users with 403', async () => {
      const res = await request(app)
        .get(api('/admin/overview/activity'))
        .set('Authorization', `Bearer ${seekerToken}`);
      expect(res.status).toBe(403);
    });

    it('returns empty list when there are no events', async () => {
      const res = await request(app)
        .get(api('/admin/overview/activity'))
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('returns at most two events of each kind and sorts them newest first', async () => {
      // 1. Seed 3 Ambassadors (dates: 2026-10-01, 2026-10-04, 2026-10-09)
      await Ambassador.create([
        { fullName: 'Ambassador One', email: 'amb1@example.com', campus: 'Campus A', status: 'active', joinedAt: '2026-10-01' },
        { fullName: 'Ambassador Two', email: 'amb2@example.com', campus: 'Campus B', status: 'active', joinedAt: '2026-10-04' },
        { fullName: 'Ambassador Three', email: 'amb3@example.com', campus: 'Campus C', status: 'active', joinedAt: '2026-10-09' },
      ]);

      // 2. Seed 1 Partner with 3 stage moves (initial prospect + moves to proposal on 2026-10-02, onboard on 2026-10-07)
      await Partner.create({
        organizationName: 'Global Tech Corp',
        partnerType: 'corporate',
        sector: 'Fintech',
        stage: 'onboard',
        stageHistory: [
          { stage: 'prospect', at: '2026-10-01' },
          { stage: 'proposal', from: 'prospect', at: '2026-10-02' },
          { stage: 'onboard', from: 'proposal', at: '2026-10-07' },
        ],
      });

      // 3. Seed 3 published vetted listings (dates: 2026-10-02, 2026-10-05, 2026-10-08)
      await Opportunity.create([
        { title: 'Listing A', company: 'Org A', location: 'Remote', description: 'Desc A', type: 'job', status: 'published', vetted: true, publishedAt: new Date('2026-10-02'), createdBy: adminUser._id },
        { title: 'Listing B', company: 'Org B', location: 'Remote', description: 'Desc B', type: 'grant', status: 'published', vetted: true, publishedAt: new Date('2026-10-05'), createdBy: adminUser._id },
        { title: 'Listing C', company: 'Org C', location: 'Remote', description: 'Desc C', type: 'scholarship', status: 'published', vetted: true, publishedAt: new Date('2026-10-08'), createdBy: adminUser._id },
      ]);

      // 4. Seed 3 delivered programs (dates: 2026-10-03, 2026-10-06, 2026-10-10)
      await Program.create([
        { title: 'Program A', programType: 'training', status: 'delivered', participantCount: 20, participantTarget: 25, deliveredAt: new Date('2026-10-03'), createdBy: adminUser._id },
        { title: 'Program B', programType: 'bootcamp', status: 'delivered', participantCount: 50, participantTarget: 50, deliveredAt: new Date('2026-10-06'), createdBy: adminUser._id },
        { title: 'Program C', programType: 'webinar', status: 'delivered', participantCount: 120, participantTarget: 100, deliveredAt: new Date('2026-10-10'), createdBy: adminUser._id },
      ]);

      // 5. Seed 3 verified records (dates: 2026-10-04, 2026-10-07, 2026-10-11)
      await Beneficiary.create([
        { fullName: 'Student A', email: 'sa@example.com', institution: 'University X', verified: true, verifiedAt: new Date('2026-10-04') },
        { fullName: 'Student B', email: 'sb@example.com', institution: 'University Y', verified: true, verifiedAt: new Date('2026-10-07') },
        { fullName: 'Student C', email: 'sc@example.com', institution: 'University Z', verified: true, verifiedAt: new Date('2026-10-11') },
      ]);

      // 6. Seed 3 approved testimonials (dates: 2026-10-03, 2026-10-08, 2026-10-12)
      await Testimonial.create([
        { name: 'Jane', email: 'jane@example.com', comment: 'Inspired', role: 'Scholar', status: 'approved', decidedAt: new Date('2026-10-03') },
        { name: 'John', email: 'john@example.com', comment: 'Impactful', role: 'Fellow', status: 'approved', decidedAt: new Date('2026-10-08') },
        { name: 'Mary', email: 'mary@example.com', comment: 'Empowered', role: 'Alum', status: 'approved', decidedAt: new Date('2026-10-12') },
      ]);

      const res = await request(app)
        .get(api('/admin/overview/activity'))
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      const items = res.body.data;

      // Exactly 2 of each kind (6 kinds * 2 = 12 total items)
      expect(items.length).toBe(12);

      const kindsCount = items.reduce((acc, item) => {
        acc[item.kind] = (acc[item.kind] || 0) + 1;
        return acc;
      }, {});

      expect(kindsCount).toEqual({
        ambassador: 2,
        partner: 2,
        listing: 2,
        program: 2,
        record: 2,
        testimonial: 2,
      });

      // Verify that the oldest of the 3 in each kind was excluded:
      // Ambassador Three (10-09) and Two (10-04) kept; One (10-01) excluded.
      const ambTitles = items.filter((i) => i.kind === 'ambassador').map((i) => i.title);
      expect(ambTitles).toContain('Ambassador Three joined as an ambassador');
      expect(ambTitles).toContain('Ambassador Two joined as an ambassador');
      expect(ambTitles).not.toContain('Ambassador One joined as an ambassador');

      // Listing C (10-08) and B (10-05) kept; A (10-02) excluded.
      const listingTitles = items.filter((i) => i.kind === 'listing').map((i) => i.title);
      expect(listingTitles).toContain('Listing C was published');
      expect(listingTitles).toContain('Listing B was published');
      expect(listingTitles).not.toContain('Listing A was published');

      // Program C (10-10) and B (10-06) kept; A (10-03) excluded.
      const programTitles = items.filter((i) => i.kind === 'program').map((i) => i.title);
      expect(programTitles).toContain('Program C was delivered');
      expect(programTitles).toContain('Program B was delivered');
      expect(programTitles).not.toContain('Program A was delivered');

      // Record Student C (10-11) and Student B (10-07) kept; Student A (10-04) excluded.
      const recordTitles = items.filter((i) => i.kind === 'record').map((i) => i.title);
      expect(recordTitles).toContain('Student C was verified');
      expect(recordTitles).toContain('Student B was verified');
      expect(recordTitles).not.toContain('Student A was verified');

      // Testimonial Mary (10-12) and John (10-08) kept; Jane (10-03) excluded.
      const testimonialTitles = items.filter((i) => i.kind === 'testimonial').map((i) => i.title);
      expect(testimonialTitles).toContain('A testimonial from Mary was approved');
      expect(testimonialTitles).toContain('A testimonial from John was approved');
      expect(testimonialTitles).not.toContain('A testimonial from Jane was approved');

      // Partner move to Onboard (10-07) and Proposal (10-02) kept
      const partnerTitles = items.filter((i) => i.kind === 'partner').map((i) => i.title);
      expect(partnerTitles).toContain('Global Tech Corp moved to Onboarded');
      expect(partnerTitles).toContain('Global Tech Corp moved to Proposal');

      // Verify all items are ordered newest first (descending date strings)
      for (let i = 0; i < items.length - 1; i++) {
        const currentAt = items[i].at.slice(0, 10);
        const nextAt = items[i + 1].at.slice(0, 10);
        expect(currentAt >= nextAt).toBe(true);
      }

      // Verify item fields integrity
      for (const item of items) {
        expect(item.key).toBeDefined();
        expect(item.kind).toBeDefined();
        expect(item.title).toBeTruthy();
        expect(item.description).toBeTruthy();
        expect(item.at).toMatch(/^\d{4}-\d{2}-\d{2}/);
        expect(item.time).toMatch(/\d{1,2}\s+[A-Za-z]{3}\s+\d{4}/);
      }
    });

    it('does not include unapproved or unverified items in the feed', async () => {
      // Unvetted draft listing
      await Opportunity.create({
        title: 'Draft Opp',
        company: 'Test Co',
        location: 'Remote',
        description: 'Test Desc',
        type: 'job',
        status: 'draft',
        vetted: false,
        createdBy: adminUser._id,
      });

      // Applicant ambassador (not active yet)
      await Ambassador.create({
        fullName: 'Pending Applicant',
        email: 'applicant@example.com',
        status: 'applicant',
      });

      // Pending testimonial
      await Testimonial.create({
        name: 'Pending Testimonial Author',
        email: 'pending.auth@example.com',
        comment: 'Draft quote',
        status: 'pending',
      });

      // Planned program (not delivered)
      await Program.create({
        title: 'Planned Program',
        programType: 'training',
        status: 'planned',
        createdBy: adminUser._id,
      });

      // Unverified record
      await Beneficiary.create({
        fullName: 'Unverified Ben',
        email: 'unverified@example.com',
        verified: false,
      });

      const res = await request(app)
        .get(api('/admin/overview/activity'))
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('respects the limit query parameter', async () => {
      // Seed 2 programs and 2 listings
      await Program.create([
        { title: 'Program 1', programType: 'training', status: 'delivered', deliveredAt: new Date('2026-10-01'), createdBy: adminUser._id },
        { title: 'Program 2', programType: 'training', status: 'delivered', deliveredAt: new Date('2026-10-02'), createdBy: adminUser._id },
      ]);
      await Opportunity.create([
        { title: 'Listing 1', company: 'Test Co', location: 'Remote', description: 'Desc 1', type: 'job', status: 'published', vetted: true, publishedAt: new Date('2026-10-03'), createdBy: adminUser._id },
        { title: 'Listing 2', company: 'Test Co', location: 'Remote', description: 'Desc 2', type: 'job', status: 'published', vetted: true, publishedAt: new Date('2026-10-04'), createdBy: adminUser._id },
      ]);

      const res = await request(app)
        .get(api('/admin/overview/activity?limit=2'))
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].title).toBe('Listing 2 was published');
      expect(res.body.data[1].title).toBe('Listing 1 was published');
    });
  });
});
