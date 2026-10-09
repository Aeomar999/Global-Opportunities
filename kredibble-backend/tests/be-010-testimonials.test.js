import request from 'supertest';
import { app } from '../src/app.js';
import { User, StaffMember, AuditLog } from '../src/models/User.js';
import { Testimonial } from '../src/models/AdminPortal.js';
import { signAdminToken, signToken } from '../src/middleware/auth.js';
import { AUDIT_ACTIONS } from '../src/lib/audit.js';

describe('BE-010: Testimonials State Machine Moderation and PII Protection', () => {
  let adminCookie;
  let adminUser;

  beforeEach(async () => {
    await Testimonial.deleteMany({});
    await User.deleteMany({});
    await StaffMember.deleteMany({});
    await AuditLog.deleteMany({});

    adminUser = await User.create({
      name: 'Super Admin Person',
      email: 'admin.testimonials@example.com',
      role: 'admin',
      passwordHash: 'dummy-hash-password',
    });

    const token = signAdminToken(adminUser);
    adminCookie = `kredibble_admin_token=${token}`;
  });

  describe('Public Submission & PII Redaction (POST /api/v1/testimonials)', () => {
    it('creates a testimonial with status pending and returns public projection without email', async () => {
      const res = await request(app)
        .post('/api/v1/testimonials')
        .send({
          name: 'Kwame Mensah',
          email: 'kwame.mensah@example.gh',
          comment: 'Kredibble opened up life-changing tech scholarship opportunities for me!',
          role: 'Software Scholar',
          photo: 'https://images.unsplash.com/photo-kwame',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        name: 'Kwame Mensah',
        author: 'Kwame Mensah',
        comment: 'Kredibble opened up life-changing tech scholarship opportunities for me!',
        quote: 'Kredibble opened up life-changing tech scholarship opportunities for me!',
        role: 'Software Scholar',
        status: 'pending',
      });

      // Strict PII Redaction: submitter email must NEVER be returned in public response
      expect(res.body.data.email).toBeUndefined();
      expect(res.body.data.decidedBy).toBeUndefined();
      expect(res.body.data.moderatedBy).toBeUndefined();

      // Database verification: record exists with status pending and email preserved for staff verification
      const saved = await Testimonial.findById(res.body.data.id);
      expect(saved).toBeTruthy();
      expect(saved.email).toBe('kwame.mensah@example.gh');
      expect(saved.status).toBe('pending');
      expect(saved.submittedAt).toBeInstanceOf(Date);
    });

    it('rejects public submission with missing required fields or invalid email', async () => {
      const invalidEmailRes = await request(app)
        .post('/api/v1/testimonials')
        .send({
          name: 'Jane Doe',
          email: 'not-an-email',
          comment: 'Great platform!',
        });
      expect(invalidEmailRes.status).toBe(400);

      const missingCommentRes = await request(app)
        .post('/api/v1/testimonials')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
        });
      expect(missingCommentRes.status).toBe(400);
    });
  });

  describe('Public Testimonials Feed (GET /api/v1/testimonials)', () => {
    it('returns only approved testimonials and strictly excludes pending, rejected, and unpublished ones', async () => {
      // 1. Approved testimonial
      await Testimonial.create({
        name: 'Ama Serwaa',
        email: 'ama.serwaa@example.com',
        comment: 'Received my master fellowship via Kredibble!',
        role: 'Postgraduate Fellow',
        status: 'approved',
        submittedAt: new Date('2026-09-01'),
      });

      // 2. Pending testimonial
      await Testimonial.create({
        name: 'Pending User',
        email: 'pending.user@example.com',
        comment: 'Waiting for review',
        status: 'pending',
        submittedAt: new Date('2026-09-02'),
      });

      // 3. Rejected testimonial
      await Testimonial.create({
        name: 'Rejected User',
        email: 'rejected.user@example.com',
        comment: 'Spam text here',
        status: 'rejected',
        submittedAt: new Date('2026-09-03'),
      });

      // 4. Unpublished testimonial
      await Testimonial.create({
        name: 'Unpublished User',
        email: 'unpub.user@example.com',
        comment: 'Formerly approved, now pulled',
        status: 'unpublished',
        submittedAt: new Date('2026-09-04'),
      });

      const res = await request(app).get('/api/v1/testimonials');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);

      const item = res.body.data[0];
      expect(item.name).toBe('Ama Serwaa');
      expect(item.author).toBe('Ama Serwaa');
      expect(item.role).toBe('Postgraduate Fellow');
      expect(item.status).toBe('approved');

      // Crucial: No PII or staff fields leaked in public listing
      expect(item.email).toBeUndefined();
      expect(item.decidedBy).toBeUndefined();
      expect(item.moderatedBy).toBeUndefined();
      expect(item.rejectionReason).toBeUndefined();
    });
  });

  describe('Pending Badge Counts & Dashboard Summary', () => {
    it('returns accurate pending count on GET /admin/testimonials/pending-count and GET /dashboard/summary', async () => {
      await Testimonial.create([
        { name: 'P1', email: 'p1@example.com', comment: 'Review 1', status: 'pending' },
        { name: 'P2', email: 'p2@example.com', comment: 'Review 2', status: 'pending' },
        { name: 'P3', email: 'p3@example.com', comment: 'Review 3', status: 'pending' },
        { name: 'A1', email: 'a1@example.com', comment: 'Review 4', status: 'approved' },
        { name: 'R1', email: 'r1@example.com', comment: 'Review 5', status: 'rejected' },
      ]);

      // Admin dedicated pending-count endpoint
      const countRes = await request(app)
        .get('/api/v1/admin/testimonials/pending-count')
        .set('Cookie', adminCookie);

      expect(countRes.status).toBe(200);
      expect(countRes.body.data.count).toBe(3);

      // Dashboard summary integration
      const summaryRes = await request(app)
        .get('/api/v1/dashboard/summary')
        .set('Cookie', adminCookie);

      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.data.pendingTestimonials).toBe(3);
    });
  });

  describe('Admin Listing & Detail (Staff View with PII)', () => {
    it('returns full admin testimonial objects with author email and decider details', async () => {
      const created = await Testimonial.create({
        name: 'Kofi Annan',
        email: 'kofi.annan@example.org',
        comment: 'Inspiring youth empowerment throughout West Africa.',
        role: 'Community Elder',
        status: 'approved',
        submittedAt: new Date('2026-08-15'),
        decidedAt: new Date('2026-08-16'),
        decidedBy: adminUser._id,
      });

      // List endpoint
      const listRes = await request(app)
        .get('/api/v1/admin/testimonials')
        .set('Cookie', adminCookie);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);
      const adminItem = listRes.body.data[0];
      expect(adminItem.email).toBe('kofi.annan@example.org');
      expect(adminItem.author).toBe('Kofi Annan');
      expect(adminItem.decidedBy).toBe(adminUser._id.toString());
      expect(adminItem.decidedByName).toBe('Super Admin Person');

      // Detail endpoint
      const detailRes = await request(app)
        .get(`/api/v1/admin/testimonials/${created._id}`)
        .set('Cookie', adminCookie);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.email).toBe('kofi.annan@example.org');
      expect(detailRes.body.data.decidedByName).toBe('Super Admin Person');
    });

    it('filters admin testimonials by status and searches across author, email, and comment', async () => {
      await Testimonial.create([
        { name: 'Alpha Tester', email: 'alpha@example.com', comment: 'Great service', status: 'pending' },
        { name: 'Beta Builder', email: 'beta@builder.com', comment: 'Awesome opportunities', status: 'approved' },
        { name: 'Gamma Guide', email: 'gamma@example.com', comment: 'Loved it', status: 'rejected' },
      ]);

      const filterRes = await request(app)
        .get('/api/v1/admin/testimonials?status=pending')
        .set('Cookie', adminCookie);

      expect(filterRes.status).toBe(200);
      expect(filterRes.body.data).toHaveLength(1);
      expect(filterRes.body.data[0].name).toBe('Alpha Tester');

      const searchRes = await request(app)
        .get('/api/v1/admin/testimonials?search=builder.com')
        .set('Cookie', adminCookie);

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data).toHaveLength(1);
      expect(searchRes.body.data[0].name).toBe('Beta Builder');
    });
  });

  describe('State Machine Moderation (POST /api/v1/admin/testimonials/:id/moderate)', () => {
    it('approves a pending testimonial: transitions to approved, stamps decidedAt/decidedBy, and audits', async () => {
      const testimonial = await Testimonial.create({
        name: 'Esi Boateng',
        email: 'esi@example.com',
        comment: 'Secured an engineering internship within two weeks.',
        status: 'pending',
      });

      const res = await request(app)
        .post(`/api/v1/admin/testimonials/${testimonial._id}/moderate`)
        .set('Cookie', adminCookie)
        .send({ action: 'approve' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('approved');
      expect(res.body.data.decidedBy).toBe(adminUser._id.toString());
      expect(res.body.data.decidedAt).toBeTruthy();

      // DB check
      const updated = await Testimonial.findById(testimonial._id);
      expect(updated.status).toBe('approved');
      expect(updated.decidedBy.toString()).toBe(adminUser._id.toString());
      expect(updated.decidedAt).toBeInstanceOf(Date);

      // Audit log check
      const audit = await AuditLog.findOne({ action: AUDIT_ACTIONS.TESTIMONIAL_MODERATE });
      expect(audit).toBeTruthy();
      expect(audit.resourceId.toString()).toBe(testimonial._id.toString());
      expect(audit.metadata.status).toBe('approved');
      expect(audit.metadata.previousStatus).toBe('pending');
    });

    it('rejects a pending testimonial with rejection reason', async () => {
      const testimonial = await Testimonial.create({
        name: 'Spam Sender',
        email: 'spam@bot.com',
        comment: 'Buy crypto now at http://fake.com',
        status: 'pending',
      });

      const res = await request(app)
        .post(`/api/v1/admin/testimonials/${testimonial._id}/moderate`)
        .set('Cookie', adminCookie)
        .send({
          action: 'reject',
          rejectionReason: 'Promotional spam link',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('rejected');
      expect(res.body.data.rejectionReason).toBe('Promotional spam link');

      const updated = await Testimonial.findById(testimonial._id);
      expect(updated.status).toBe('rejected');
      expect(updated.rejectionReason).toBe('Promotional spam link');
    });

    it('unpublishes an approved testimonial: transitions to unpublished', async () => {
      const testimonial = await Testimonial.create({
        name: 'Yaw Osei',
        email: 'yaw@example.com',
        comment: 'Great work',
        status: 'approved',
      });

      const res = await request(app)
        .post(`/api/v1/admin/testimonials/${testimonial._id}/moderate`)
        .set('Cookie', adminCookie)
        .send({ action: 'unpublish' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('unpublished');

      const updated = await Testimonial.findById(testimonial._id);
      expect(updated.status).toBe('unpublished');
    });

    it('reapproves an unpublished testimonial back to approved', async () => {
      const testimonial = await Testimonial.create({
        name: 'Yaw Osei',
        email: 'yaw@example.com',
        comment: 'Great work',
        status: 'unpublished',
      });

      const res = await request(app)
        .post(`/api/v1/admin/testimonials/${testimonial._id}/moderate`)
        .set('Cookie', adminCookie)
        .send({ action: 'reapprove' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('approved');
    });

    it('reapproves a rejected testimonial to approved', async () => {
      const testimonial = await Testimonial.create({
        name: 'Mistaken Reject',
        email: 'genuine@example.com',
        comment: 'Legitimate heartfelt review',
        status: 'rejected',
      });

      const res = await request(app)
        .post(`/api/v1/admin/testimonials/${testimonial._id}/moderate`)
        .set('Cookie', adminCookie)
        .send({ action: 'reapprove' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('approved');
    });

    it('strictly rejects invalid state transitions with HTTP 400', async () => {
      // 1. pending -> unpublished is NOT allowed (must be approved first)
      const pendingItem = await Testimonial.create({
        name: 'P1',
        email: 'p1@example.com',
        comment: 'Pending quote',
        status: 'pending',
      });
      const pendingUnpubRes = await request(app)
        .post(`/api/v1/admin/testimonials/${pendingItem._id}/moderate`)
        .set('Cookie', adminCookie)
        .send({ action: 'unpublish' });
      expect(pendingUnpubRes.status).toBe(400);

      // 2. approved -> rejected is NOT allowed (must be unpublished first)
      const approvedItem = await Testimonial.create({
        name: 'A1',
        email: 'a1@example.com',
        comment: 'Approved quote',
        status: 'approved',
      });
      const approvedRejectRes = await request(app)
        .post(`/api/v1/admin/testimonials/${approvedItem._id}/moderate`)
        .set('Cookie', adminCookie)
        .send({ action: 'reject' });
      expect(approvedRejectRes.status).toBe(400);

      // 3. unpublished -> rejected is NOT allowed
      const unpubItem = await Testimonial.create({
        name: 'U1',
        email: 'u1@example.com',
        comment: 'Unpublished quote',
        status: 'unpublished',
      });
      const unpubRejectRes = await request(app)
        .post(`/api/v1/admin/testimonials/${unpubItem._id}/moderate`)
        .set('Cookie', adminCookie)
        .send({ action: 'reject' });
      expect(unpubRejectRes.status).toBe(400);

      // 4. rejected -> unpublished is NOT allowed
      const rejectedItem = await Testimonial.create({
        name: 'R1',
        email: 'r1@example.com',
        comment: 'Rejected quote',
        status: 'rejected',
      });
      const rejectedUnpubRes = await request(app)
        .post(`/api/v1/admin/testimonials/${rejectedItem._id}/moderate`)
        .set('Cookie', adminCookie)
        .send({ action: 'unpublish' });
      expect(rejectedUnpubRes.status).toBe(400);

      // 5. Invalid action string
      const invalidActionRes = await request(app)
        .post(`/api/v1/admin/testimonials/${rejectedItem._id}/moderate`)
        .set('Cookie', adminCookie)
        .send({ action: 'invalid_action' });
      expect(invalidActionRes.status).toBe(400);
    });
  });

  describe('Admin CRUD Operations', () => {
    it('creates a testimonial directly via admin portal with audit log', async () => {
      const res = await request(app)
        .post('/api/v1/admin/testimonials')
        .set('Cookie', adminCookie)
        .send({
          name: 'Direct Author',
          email: 'direct@example.com',
          comment: 'Direct admin created review',
          role: 'Featured Alumnus',
          status: 'approved',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Direct Author');
      expect(res.body.data.status).toBe('approved');

      const audit = await AuditLog.findOne({ action: AUDIT_ACTIONS.TESTIMONIAL_CREATE });
      expect(audit).toBeTruthy();
      expect(audit.resourceId.toString()).toBe(res.body.data.id);
    });

    it('updates testimonial content via PATCH with audit log', async () => {
      const item = await Testimonial.create({
        name: 'Initial Name',
        email: 'initial@example.com',
        comment: 'Initial comment',
        status: 'pending',
      });

      const res = await request(app)
        .patch(`/api/v1/admin/testimonials/${item._id}`)
        .set('Cookie', adminCookie)
        .send({
          name: 'Updated Name',
          comment: 'Refined inspiring comment',
          role: 'Senior Fellow',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Name');
      expect(res.body.data.comment).toBe('Refined inspiring comment');
      expect(res.body.data.role).toBe('Senior Fellow');

      const audit = await AuditLog.findOne({ action: AUDIT_ACTIONS.TESTIMONIAL_UPDATE });
      expect(audit).toBeTruthy();
      expect(audit.resourceId.toString()).toBe(item._id.toString());
    });

    it('deletes testimonial via DELETE with audit log', async () => {
      const item = await Testimonial.create({
        name: 'To Delete',
        email: 'todelete@example.com',
        comment: 'Will be deleted',
        status: 'pending',
      });

      const res = await request(app)
        .delete(`/api/v1/admin/testimonials/${item._id}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);

      const found = await Testimonial.findById(item._id);
      expect(found).toBeNull();

      const audit = await AuditLog.findOne({ action: AUDIT_ACTIONS.TESTIMONIAL_DELETE });
      expect(audit).toBeTruthy();
      expect(audit.resourceId.toString()).toBe(item._id.toString());
    });
  });

  describe('Screen Permissions (BE-001 Enforcement)', () => {
    it('permits edit access for Communications Officer', async () => {
      const commsUser = await User.create({
        name: 'Comms Staff',
        email: 'comms.staff@example.com',
        role: 'seeker',
        passwordHash: 'hash',
      });
      await StaffMember.create({
        userId: commsUser._id,
        email: commsUser.email,
        name: commsUser.name,
        roles: ['communications_officer'],
        status: 'active',
      });

      const token = signToken(commsUser);

      // Comms can view
      const viewRes = await request(app)
        .get('/api/v1/admin/testimonials')
        .set('Authorization', `Bearer ${token}`);
      expect(viewRes.status).toBe(200);

      // Comms can edit/moderate
      const item = await Testimonial.create({
        name: 'Pending Item',
        email: 'pending@example.com',
        comment: 'Quote',
        status: 'pending',
      });

      const moderateRes = await request(app)
        .post(`/api/v1/admin/testimonials/${item._id}/moderate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'approve' });
      expect(moderateRes.status).toBe(200);
    });

    it('allows view access but rejects edit access for Social Media Manager (view-only on testimonials)', async () => {
      const smmUser = await User.create({
        name: 'SMM Staff',
        email: 'smm.staff@example.com',
        role: 'seeker',
        passwordHash: 'hash',
      });
      await StaffMember.create({
        userId: smmUser._id,
        email: smmUser.email,
        name: smmUser.name,
        roles: ['social_media_manager'],
        status: 'active',
      });

      const token = signToken(smmUser);

      // View allowed
      const viewRes = await request(app)
        .get('/api/v1/admin/testimonials')
        .set('Authorization', `Bearer ${token}`);
      expect(viewRes.status).toBe(200);

      // Edit rejected with 403 Forbidden
      const item = await Testimonial.create({
        name: 'Test Item',
        email: 'test@example.com',
        comment: 'Quote',
        status: 'pending',
      });

      const moderateRes = await request(app)
        .post(`/api/v1/admin/testimonials/${item._id}/moderate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'approve' });
      expect(moderateRes.status).toBe(403);
    });

    it('rejects all access for Database Officer (none permission on testimonials)', async () => {
      const dbUser = await User.create({
        name: 'DB Staff',
        email: 'db.staff@example.com',
        role: 'seeker',
        passwordHash: 'hash',
      });
      await StaffMember.create({
        userId: dbUser._id,
        email: dbUser.email,
        name: dbUser.name,
        roles: ['database_officer'],
        status: 'active',
      });

      const token = signToken(dbUser);

      const viewRes = await request(app)
        .get('/api/v1/admin/testimonials')
        .set('Authorization', `Bearer ${token}`);
      expect(viewRes.status).toBe(403);
    });

    it('rejects unauthenticated requests to admin testimonials with 401', async () => {
      const res = await request(app).get('/api/v1/admin/testimonials');
      expect(res.status).toBe(401);
    });
  });
});
