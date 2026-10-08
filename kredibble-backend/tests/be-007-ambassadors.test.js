import request from 'supertest';
import { app } from '../src/app.js';
import { User, AuditLog } from '../src/models/User.js';
import { Ambassador, AmbassadorAmplification, Beneficiary } from '../src/models/AdminPortal.js';
import { signAdminToken } from '../src/middleware/auth.js';
import { AUDIT_ACTIONS } from '../src/lib/audit.js';

describe('BE-007: Ambassadors and the Network', () => {
  let adminCookie;
  let adminUser;

  beforeEach(async () => {
    await Ambassador.deleteMany({});
    await AmbassadorAmplification.deleteMany({});
    await Beneficiary.deleteMany({});
    await User.deleteMany({});
    await AuditLog.deleteMany({});

    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin.network@example.com',
      role: 'admin',
      passwordHash: 'dummy-hash-password',
    });

    const token = signAdminToken(adminUser);
    adminCookie = `kredibble_admin_token=${token}`;
  });

  describe('Ambassador creation, referral code generation, and date defaults', () => {
    it('creates an ambassador with auto-generated unique referral code and defaults joinedAt to today', async () => {
      const res = await request(app)
        .post('/api/v1/admin/ambassadors')
        .set('Cookie', adminCookie)
        .send({
          fullName: 'Alice Kwame',
          email: 'alice@example.com',
          country: 'Ghana',
          city: 'Accra',
          campus: 'University of Ghana',
          tier: 'ambassador',
          status: 'applicant',
        });

      expect(res.status).toBe(201);
      const data = res.body.data;
      expect(data.id).toBeDefined();
      expect(data.fullName).toBe('Alice Kwame');
      expect(data.name).toBe('Alice Kwame');
      expect(data.email).toBe('alice@example.com');
      expect(data.tier).toBe('ambassador');
      expect(data.status).toBe('applicant');

      // Referral code must start with GOD- and have 6 characters excluding 0, O, 1, I
      expect(data.referralCode).toMatch(/^GOD-[2-9A-HJ-NP-Z]{6}$/);
      expect(data.joinedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(data.dormantSince).toBeUndefined();

      // Check audit log
      const audit = await AuditLog.findOne({ action: AUDIT_ACTIONS.AMBASSADOR_CREATE });
      expect(audit).toBeDefined();
      expect(audit.resourceId.toString()).toBe(data.id);
    });

    it('accepts a valid referral code on creation and rejects invalid formats', async () => {
      // Valid referral code
      const validRes = await request(app)
        .post('/api/v1/admin/ambassadors')
        .set('Cookie', adminCookie)
        .send({
          name: 'Bob Mensah',
          email: 'bob@example.com',
          country: 'Ghana',
          referralCode: 'GOD-7K2M4Q',
        });

      expect(validRes.status).toBe(201);
      expect(validRes.body.data.referralCode).toBe('GOD-7K2M4Q');

      // Invalid referral code (contains '0' or 'O')
      const invalidRes1 = await request(app)
        .post('/api/v1/admin/ambassadors')
        .set('Cookie', adminCookie)
        .send({
          name: 'Charlie Mensah',
          email: 'charlie@example.com',
          referralCode: 'GOD-702M4Q',
        });

      expect(invalidRes1.status).toBe(400);

      // Invalid referral code (too short)
      const invalidRes2 = await request(app)
        .post('/api/v1/admin/ambassadors')
        .set('Cookie', adminCookie)
        .send({
          name: 'Charlie Mensah',
          email: 'charlie@example.com',
          referralCode: 'GOD-123',
        });

      expect(invalidRes2.status).toBe(400);
    });

    it('sets dormantSince when created with status dormant', async () => {
      const res = await request(app)
        .post('/api/v1/admin/ambassadors')
        .set('Cookie', adminCookie)
        .send({
          fullName: 'Dormant User',
          email: 'dormant@example.com',
          status: 'dormant',
          dormantSince: '2026-09-15',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('dormant');
      expect(res.body.data.dormantSince).toBe('2026-09-15');
    });
  });

  describe('Ambassador update and field immutability', () => {
    it('preserves referralCode and joinedAt on update, sets and clears dormantSince with status', async () => {
      const created = await request(app)
        .post('/api/v1/admin/ambassadors')
        .set('Cookie', adminCookie)
        .send({
          fullName: 'Eunice Owusu',
          email: 'eunice@example.com',
          referralCode: 'GOD-9XY3Z2',
          joinedAt: '2026-01-10',
          status: 'active',
          tier: 'ambassador',
        });

      expect(created.status).toBe(201);
      const id = created.body.data.id;
      expect(created.body.data.referralCode).toBe('GOD-9XY3Z2');
      expect(created.body.data.joinedAt).toBe('2026-01-10');

      // Try to mutate referralCode and joinedAt, and promote to senior
      const updateRes = await request(app)
        .patch(`/api/v1/admin/ambassadors/${id}`)
        .set('Cookie', adminCookie)
        .send({
          referralCode: 'GOD-HACKED',
          joinedAt: '2026-09-01',
          tier: 'senior',
          status: 'dormant',
          dormantSince: '2026-10-01',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.tier).toBe('senior');
      expect(updateRes.body.data.status).toBe('dormant');
      expect(updateRes.body.data.dormantSince).toBe('2026-10-01');
      // Must not change referralCode or joinedAt
      expect(updateRes.body.data.referralCode).toBe('GOD-9XY3Z2');
      expect(updateRes.body.data.joinedAt).toBe('2026-01-10');

      // Now reactivate: dormantSince must be cleared
      const reactivateRes = await request(app)
        .patch(`/api/v1/admin/ambassadors/${id}`)
        .set('Cookie', adminCookie)
        .send({
          status: 'active',
        });

      expect(reactivateRes.status).toBe(200);
      expect(reactivateRes.body.data.status).toBe('active');
      expect(reactivateRes.body.data.dormantSince).toBeUndefined();
    });
  });

  describe('Amplification logging', () => {
    it('logs an amplification with channel, clicks, at, and note', async () => {
      const ambassador = await Ambassador.create({
        fullName: 'Grace Appiah',
        email: 'grace@example.com',
        status: 'active',
        tier: 'lead',
        joinedAt: '2026-02-01',
      });

      const res = await request(app)
        .post(`/api/v1/admin/ambassadors/${ambassador._id}/amplifications`)
        .set('Cookie', adminCookie)
        .send({
          channel: 'LinkedIn',
          at: '2026-10-05',
          clicks: 25,
          note: 'Shared student fellowship program',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.channel).toBe('LinkedIn');
      expect(res.body.data.at).toBe('2026-10-05');
      expect(res.body.data.clicks).toBe(25);
      expect(res.body.data.note).toBe('Shared student fellowship program');
      expect(res.body.data.ambassadorId).toBe(ambassador._id.toString());

      // Check listing
      const listRes = await request(app)
        .get(`/api/v1/admin/ambassadors/${ambassador._id}/amplifications`)
        .set('Cookie', adminCookie);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(1);
      expect(listRes.body.data[0].channel).toBe('LinkedIn');
    });
  });

  describe('Network summary: GET /api/v1/admin/network/summary', () => {
    it('computes network size, active count, shared active, and activity rate correctly', async () => {
      const month = '2026-10';

      // 1. Active ambassador who shared in October
      const amb1 = await Ambassador.create({
        fullName: 'Active Sharer',
        email: 'sharer@example.com',
        status: 'active',
        tier: 'lead',
        joinedAt: '2026-05-01',
      });
      await AmbassadorAmplification.create({
        ambassadorId: amb1._id,
        channel: 'WhatsApp',
        at: '2026-10-02',
        clicks: 10,
      });

      // 2. Active ambassador who did not share in October
      await Ambassador.create({
        fullName: 'Active Silent',
        email: 'silent@example.com',
        status: 'active',
        tier: 'ambassador',
        joinedAt: '2026-06-01',
      });

      // 3. Dormant ambassador who went dormant in September (not active at end of October)
      await Ambassador.create({
        fullName: 'Dormant Sept',
        email: 'dormant.sept@example.com',
        status: 'dormant',
        dormantSince: '2026-09-15',
        joinedAt: '2026-01-01',
      });

      // 4. Applicant (not active)
      await Ambassador.create({
        fullName: 'Pending Applicant',
        email: 'applicant@example.com',
        status: 'applicant',
        joinedAt: '2026-10-01',
      });

      const res = await request(app)
        .get(`/api/v1/admin/network/summary?month=${month}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      const summary = res.body.data;
      expect(summary.month).toBe('2026-10');
      // Total size: 4 in network
      expect(summary.size).toBe(4);
      // Active count: 2 (amb1, amb2)
      expect(summary.active).toBe(2);
      // Shared active count: 1 (amb1)
      expect(summary.sharedActive).toBe(1);
      // Activity rate: 1 / 2 = 0.5 (50%)
      expect(summary.activityRate).toBe(0.5);
    });

    it('returns activityRate as null when active count is 0', async () => {
      await Ambassador.create({
        fullName: 'Only Applicant',
        email: 'only@example.com',
        status: 'applicant',
        joinedAt: '2026-10-01',
      });

      const res = await request(app)
        .get('/api/v1/admin/network/summary?month=2026-10')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.active).toBe(0);
      expect(res.body.data.activityRate).toBeNull();
    });
  });

  describe('Leaderboard: GET /api/v1/admin/leaderboard', () => {
    it('ranks members by verified signups, then clicks, then shares, then name; excludes applicants', async () => {
      const month = '2026-10';

      // Amb A: 2 signups, 10 clicks, 1 share
      const ambA = await Ambassador.create({
        fullName: 'Alpha Ambassador',
        email: 'alpha@example.com',
        status: 'active',
        tier: 'senior',
        joinedAt: '2026-03-01',
      });
      await AmbassadorAmplification.create({
        ambassadorId: ambA._id,
        channel: 'LinkedIn',
        at: '2026-10-01',
        clicks: 10,
      });
      await Beneficiary.create({
        fullName: 'Ben One',
        email: 'ben1@example.com',
        sourceType: 'ambassador-referral',
        ambassadorId: ambA._id,
        verified: true,
        verifiedAt: '2026-10-03',
      });
      await Beneficiary.create({
        fullName: 'Ben Two',
        email: 'ben2@example.com',
        sourceType: 'ambassador-referral',
        ambassadorId: ambA._id,
        verified: true,
        verifiedAt: '2026-10-04',
      });

      // Amb B: 3 signups (should be #1 regardless of clicks/shares)
      const ambB = await Ambassador.create({
        fullName: 'Beta Ambassador',
        email: 'beta@example.com',
        status: 'active',
        tier: 'lead',
        joinedAt: '2026-01-01',
      });
      for (let i = 1; i <= 3; i++) {
        await Beneficiary.create({
          fullName: `Ben B${i}`,
          email: `benb${i}@example.com`,
          sourceType: 'ambassador-referral',
          ambassadorId: ambB._id,
          verified: true,
          verifiedAt: '2026-10-02',
        });
      }

      // Amb C: 0 signups, 50 clicks, 2 shares
      const ambC = await Ambassador.create({
        fullName: 'Charlie Ambassador',
        email: 'charlie@example.com',
        status: 'active',
        tier: 'ambassador',
        joinedAt: '2026-02-01',
      });
      await AmbassadorAmplification.create({
        ambassadorId: ambC._id,
        channel: 'Facebook',
        at: '2026-10-05',
        clicks: 30,
      });
      await AmbassadorAmplification.create({
        ambassadorId: ambC._id,
        channel: 'Instagram',
        at: '2026-10-06',
        clicks: 20,
      });

      // Amb D: 0 signups, 50 clicks, 1 share (Amb C beats Amb D on shares)
      const ambD = await Ambassador.create({
        fullName: 'Delta Ambassador',
        email: 'delta@example.com',
        status: 'active',
        tier: 'ambassador',
        joinedAt: '2026-02-01',
      });
      await AmbassadorAmplification.create({
        ambassadorId: ambD._id,
        channel: 'TikTok',
        at: '2026-10-07',
        clicks: 50,
      });

      // Amb E: 0 signups, 50 clicks, 1 share, name 'Echo' (Amb D beats Amb E on alphabetical name 'Delta' vs 'Echo')
      const ambE = await Ambassador.create({
        fullName: 'Echo Ambassador',
        email: 'echo@example.com',
        status: 'active',
        tier: 'ambassador',
        joinedAt: '2026-02-01',
      });
      await AmbassadorAmplification.create({
        ambassadorId: ambE._id,
        channel: 'TikTok',
        at: '2026-10-08',
        clicks: 50,
      });

      // Applicant: should be excluded from leaderboard
      await Ambassador.create({
        fullName: 'Applicant Excluded',
        email: 'applicant.ex@example.com',
        status: 'applicant',
        joinedAt: '2026-10-01',
      });

      const res = await request(app)
        .get(`/api/v1/admin/leaderboard?month=${month}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      const rows = res.body.data;
      expect(rows.length).toBe(5);

      // Verify ranks
      expect(rows[0].rank).toBe(1);
      expect(rows[0].ambassador.name).toBe('Beta Ambassador');
      expect(rows[0].signups).toBe(3);

      expect(rows[1].rank).toBe(2);
      expect(rows[1].ambassador.name).toBe('Alpha Ambassador');
      expect(rows[1].signups).toBe(2);
      expect(rows[1].clicks).toBe(10);

      expect(rows[2].rank).toBe(3);
      expect(rows[2].ambassador.name).toBe('Charlie Ambassador');
      expect(rows[2].signups).toBe(0);
      expect(rows[2].clicks).toBe(50);
      expect(rows[2].shares).toBe(2);

      expect(rows[3].rank).toBe(4);
      expect(rows[3].ambassador.name).toBe('Delta Ambassador');
      expect(rows[3].signups).toBe(0);
      expect(rows[3].clicks).toBe(50);
      expect(rows[3].shares).toBe(1);

      expect(rows[4].rank).toBe(5);
      expect(rows[4].ambassador.name).toBe('Echo Ambassador');
      expect(rows[4].signups).toBe(0);
      expect(rows[4].clicks).toBe(50);
      expect(rows[4].shares).toBe(1);

      // Verify applicants are excluded
      expect(rows.some((r) => r.ambassador.name === 'Applicant Excluded')).toBe(false);
    });
  });
});
