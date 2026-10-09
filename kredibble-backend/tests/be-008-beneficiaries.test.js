import request from 'supertest';
import { app } from '../src/app.js';
import { User, AuditLog } from '../src/models/User.js';
import { Ambassador, Beneficiary, TargetChange, ThresholdChange } from '../src/models/AdminPortal.js';
import { signAdminToken } from '../src/middleware/auth.js';
import { AUDIT_ACTIONS } from '../src/lib/audit.js';

describe('BE-008: Database Records (Beneficiaries)', () => {
  let adminCookie;
  let adminUser;
  let sampleAmbassador;

  beforeEach(async () => {
    await Beneficiary.deleteMany({});
    await Ambassador.deleteMany({});
    await TargetChange.deleteMany({});
    await ThresholdChange.deleteMany({});
    await User.deleteMany({});
    await AuditLog.deleteMany({});

    adminUser = await User.create({
      name: 'Admin Database Officer',
      email: 'admin.database@example.com',
      role: 'admin',
      passwordHash: 'dummy-hash-password',
    });

    const token = signAdminToken(adminUser);
    adminCookie = `kredibble_admin_token=${token}`;

    sampleAmbassador = await Ambassador.create({
      fullName: 'Kofi Mensah',
      email: 'kofi.mensah@example.com',
      country: 'Ghana',
      campus: 'Legon',
      tier: 'ambassador',
      status: 'active',
      referralCode: 'GOD-234ABC',
      joinedAt: '2026-01-15',
    });
  });

  describe('Beneficiary Creation & Field Mappings', () => {
    it('creates a beneficiary with canonical source and default unverified status', async () => {
      const res = await request(app)
        .post('/api/v1/admin/beneficiaries')
        .set('Cookie', adminCookie)
        .send({
          name: 'Ama Serwaa',
          email: 'ama.serwaa@example.com',
          phone: '+233245551111',
          country: 'Ghana',
          institution: 'Ashesi University',
          source: 'organic',
        });

      expect(res.status).toBe(201);
      const data = res.body.data;
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Ama Serwaa');
      expect(data.fullName).toBe('Ama Serwaa');
      expect(data.email).toBe('ama.serwaa@example.com');
      expect(data.source).toBe('organic');
      expect(data.verified).toBe(false);
      expect(data.verifiedAt).toBeUndefined();
      expect(data.createdAt).toBe(new Date().toISOString().slice(0, 10));

      const audit = await AuditLog.findOne({ action: AUDIT_ACTIONS.BENEFICIARY_CREATE });
      expect(audit).toBeDefined();
      expect(audit.resourceId.toString()).toBe(data.id);
    });

    it('requires ambassadorId when source is ambassador', async () => {
      const res = await request(app)
        .post('/api/v1/admin/beneficiaries')
        .set('Cookie', adminCookie)
        .send({
          name: 'Yaw Osei',
          email: 'yaw@example.com',
          country: 'Ghana',
          source: 'ambassador',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/ambassadorId/i);
    });

    it('creates an ambassador referral with linked ambassadorId', async () => {
      const res = await request(app)
        .post('/api/v1/admin/beneficiaries')
        .set('Cookie', adminCookie)
        .send({
          name: 'Yaw Osei',
          email: 'yaw@example.com',
          country: 'Ghana',
          source: 'ambassador',
          ambassadorId: sampleAmbassador._id.toString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.data.source).toBe('ambassador');
      expect(res.body.data.ambassadorId).toBe(sampleAmbassador._id.toString());
    });

    it('automatically sets verifiedAt to today when created with verified: true', async () => {
      const res = await request(app)
        .post('/api/v1/admin/beneficiaries')
        .set('Cookie', adminCookie)
        .send({
          name: 'Kwame Manu',
          email: 'kwame.manu@example.com',
          country: 'Ghana',
          source: 'event',
          verified: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.verified).toBe(true);
      expect(res.body.data.verifiedAt).toBe(new Date().toISOString().slice(0, 10));
    });
  });

  describe('Duplicate Detection Rules', () => {
    it('detects duplicate by email (trimmed, case-insensitive) and returns field: email', async () => {
      await request(app)
        .post('/api/v1/admin/beneficiaries')
        .set('Cookie', adminCookie)
        .send({
          name: 'Original Person',
          email: 'sarah.doe@example.com',
          country: 'Nigeria',
          source: 'organic',
        });

      const res = await request(app)
        .post('/api/v1/admin/beneficiaries')
        .set('Cookie', adminCookie)
        .send({
          name: 'Duplicate Person',
          email: '  Sarah.DOE@Example.com  ',
          phone: '+2348011223344',
          country: 'Nigeria',
          source: 'partner',
        });

      expect(res.status).toBe(409);
      expect(res.body.field).toBe('email');
      expect(res.body.duplicate).toBeDefined();
      expect(res.body.duplicate.name).toBe('Original Person');
      expect(res.body.error.message).toMatch(/email/i);
    });

    it('detects duplicate by phone number with international country code normalization', async () => {
      // "+233 24-555-1007" for Ghana normalizes to "233245551007"
      await request(app)
        .post('/api/v1/admin/beneficiaries')
        .set('Cookie', adminCookie)
        .send({
          name: 'First Ghana Record',
          email: 'ghana1@example.com',
          phone: '+233 24-555-1007',
          country: 'Ghana',
          source: 'organic',
        });

      // "0245551007" for Ghana normalizes to "233245551007"
      const res = await request(app)
        .post('/api/v1/admin/beneficiaries')
        .set('Cookie', adminCookie)
        .send({
          name: 'Second Ghana Record',
          email: 'different.email@example.com',
          phone: '0245551007',
          country: 'Ghana',
          source: 'event',
        });

      expect(res.status).toBe(409);
      expect(res.body.field).toBe('phone');
      expect(res.body.duplicate).toBeDefined();
      expect(res.body.duplicate.name).toBe('First Ghana Record');
      expect(res.body.error.message).toMatch(/phone/i);
    });

    it('detects duplicate by phone with 00 prefix and spaces', async () => {
      await request(app)
        .post('/api/v1/admin/beneficiaries')
        .set('Cookie', adminCookie)
        .send({
          name: 'Record A',
          email: 'user.a@example.com',
          phone: '00233245551007',
          country: 'Ghana',
          source: 'organic',
        });

      const res = await request(app)
        .post('/api/v1/admin/beneficiaries')
        .set('Cookie', adminCookie)
        .send({
          name: 'Record B',
          email: 'user.b@example.com',
          phone: '233 245 551 007',
          country: 'Ghana',
          source: 'import',
        });

      expect(res.status).toBe(409);
      expect(res.body.field).toBe('phone');
    });

    it('checks email FIRST when candidate duplicates both email and phone', async () => {
      await request(app)
        .post('/api/v1/admin/beneficiaries')
        .set('Cookie', adminCookie)
        .send({
          name: 'Existing User',
          email: 'both.match@example.com',
          phone: '+233201112233',
          country: 'Ghana',
          source: 'organic',
        });

      const res = await request(app)
        .post('/api/v1/admin/beneficiaries')
        .set('Cookie', adminCookie)
        .send({
          name: 'Candidate User',
          email: 'both.match@example.com',
          phone: '+233201112233',
          country: 'Ghana',
          source: 'organic',
        });

      expect(res.status).toBe(409);
      expect(res.body.field).toBe('email');
    });

    it('allows updating own record without self-duplicate conflict', async () => {
      const created = await request(app)
        .post('/api/v1/admin/beneficiaries')
        .set('Cookie', adminCookie)
        .send({
          name: 'Self Updater',
          email: 'self@example.com',
          phone: '+233240001122',
          country: 'Ghana',
          source: 'organic',
        });

      const id = created.body.data.id;

      const updateRes = await request(app)
        .patch(`/api/v1/admin/beneficiaries/${id}`)
        .set('Cookie', adminCookie)
        .send({
          name: 'Self Updater Renamed',
          email: 'self@example.com',
          phone: '+233240001122',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.name).toBe('Self Updater Renamed');
    });

    it('rejects update when attempting to take another record’s email or phone', async () => {
      const first = await request(app)
        .post('/api/v1/admin/beneficiaries')
        .set('Cookie', adminCookie)
        .send({
          name: 'First User',
          email: 'first@example.com',
          phone: '+233241112233',
          country: 'Ghana',
          source: 'organic',
        });

      const second = await request(app)
        .post('/api/v1/admin/beneficiaries')
        .set('Cookie', adminCookie)
        .send({
          name: 'Second User',
          email: 'second@example.com',
          phone: '+233242223344',
          country: 'Ghana',
          source: 'organic',
        });

      const conflictRes = await request(app)
        .patch(`/api/v1/admin/beneficiaries/${second.body.data.id}`)
        .set('Cookie', adminCookie)
        .send({
          email: 'first@example.com',
        });

      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.field).toBe('email');
    });
  });

  describe('Verification & Undo Workflow', () => {
    it('verifies a record, sets verifiedAt to today, and provides undo capability', async () => {
      const created = await request(app)
        .post('/api/v1/admin/beneficiaries')
        .set('Cookie', adminCookie)
        .send({
          name: 'Verifiable Seeker',
          email: 'verifiable@example.com',
          country: 'Ghana',
          source: 'organic',
          verified: false,
        });

      const id = created.body.data.id;
      const todayIso = new Date().toISOString().slice(0, 10);

      const verifyRes = await request(app)
        .post(`/api/v1/admin/beneficiaries/${id}/verify`)
        .set('Cookie', adminCookie);

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.verified).toBe(true);
      expect(verifyRes.body.data.verifiedAt).toBe(todayIso);
      expect(verifyRes.body.undo).toEqual({
        id,
        verified: false,
        verifiedAt: undefined,
      });

      const auditVerify = await AuditLog.findOne({ action: AUDIT_ACTIONS.BENEFICIARY_VERIFY });
      expect(auditVerify).toBeDefined();

      // Undo verification restores original state
      const undoRes = await request(app)
        .post(`/api/v1/admin/beneficiaries/${id}/undo-verify`)
        .set('Cookie', adminCookie)
        .send(verifyRes.body.undo);

      expect(undoRes.status).toBe(200);
      expect(undoRes.body.data.verified).toBe(false);
      expect(undoRes.body.data.verifiedAt).toBeUndefined();

      const auditUndo = await AuditLog.findOne({ action: AUDIT_ACTIONS.BENEFICIARY_UNDO_VERIFY });
      expect(auditUndo).toBeDefined();
    });
  });

  describe('Pace Calculation (GET /api/v1/admin/beneficiaries/pace)', () => {
    it('calculates verification pace, status, and gauge geometry based on dated targets and thresholds', async () => {
      const month = new Date().toISOString().slice(0, 7);
      const todayIso = new Date().toISOString().slice(0, 10);

      // Seed 10 verified records for this month
      for (let i = 0; i < 10; i++) {
        await Beneficiary.create({
          fullName: `Verified Beneficiary ${i}`,
          email: `beneficiary${i}@example.com`,
          country: 'Ghana',
          source: 'organic',
          verified: true,
          verifiedAt: todayIso,
        });
      }

      // Seed target = 20 for beneficiaries_verified
      await TargetChange.create({
        kpi: 'beneficiaries_verified',
        value: 20,
        effectiveFrom: '2026-01',
        seq: 1,
      });

      // Seed thresholds green = 90%, amber = 60%
      await ThresholdChange.create({
        green: 90,
        amber: 60,
        effectiveFrom: '2026-01',
        seq: 2,
      });

      const res = await request(app)
        .get(`/api/v1/admin/beneficiaries/pace?month=${month}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      const paceData = res.body.data;
      expect(paceData.month).toBe(month);
      expect(paceData.verified).toBe(10);
      expect(paceData.target).toBe(20);
      expect(typeof paceData.pace).toBe('number');
      expect(typeof paceData.paceRounded).toBe('number');
      expect(['on_pace', 'behind', 'far_behind']).toContain(paceData.status);
      expect(paceData.gauge).toBeDefined();
      expect(paceData.gauge.zones).toHaveLength(3);
      expect(typeof paceData.gauge.markerAt).toBe('number');
    });
  });

  describe('Sources Breakdown (GET /api/v1/admin/beneficiaries/sources)', () => {
    it('returns the 5 canonical sources in order with accurate counts', async () => {
      await Beneficiary.create({ fullName: 'Org 1', email: 'org1@ex.com', source: 'organic' });
      await Beneficiary.create({ fullName: 'Org 2', email: 'org2@ex.com', source: 'organic' });
      await Beneficiary.create({ fullName: 'Amb 1', email: 'amb1@ex.com', source: 'ambassador', ambassadorId: sampleAmbassador._id });
      await Beneficiary.create({ fullName: 'Evt 1', email: 'evt1@ex.com', source: 'event' });
      await Beneficiary.create({ fullName: 'Prt 1', email: 'prt1@ex.com', source: 'partner' });
      await Beneficiary.create({ fullName: 'Imp 1', email: 'imp1@ex.com', source: 'import' });

      const res = await request(app)
        .get('/api/v1/admin/beneficiaries/sources')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      const sources = res.body.data;
      expect(sources).toHaveLength(5);
      expect(sources.map((s) => s.source)).toEqual(['organic', 'ambassador', 'event', 'partner', 'import']);

      const countMap = Object.fromEntries(sources.map((s) => [s.source, s.count]));
      expect(countMap.organic).toBe(2);
      expect(countMap.ambassador).toBe(1);
      expect(countMap.event).toBe(1);
      expect(countMap.partner).toBe(1);
      expect(countMap.import).toBe(1);
    });
  });

  describe('Pending Verification Count & Dashboard Sync', () => {
    it('reports pending count for sidebar pill and summary', async () => {
      await Beneficiary.create({ fullName: 'Pending 1', email: 'p1@ex.com', source: 'organic', verified: false });
      await Beneficiary.create({ fullName: 'Pending 2', email: 'p2@ex.com', source: 'organic', verified: false });
      await Beneficiary.create({ fullName: 'Pending 3', email: 'p3@ex.com', source: 'organic', verified: false });
      await Beneficiary.create({ fullName: 'Done 1', email: 'd1@ex.com', source: 'organic', verified: true, verifiedAt: '2026-05-10' });

      const pendingRes = await request(app)
        .get('/api/v1/admin/beneficiaries/pending-count')
        .set('Cookie', adminCookie);

      expect(pendingRes.status).toBe(200);
      expect(pendingRes.body.data.count).toBe(3);

      const summaryRes = await request(app)
        .get('/api/v1/dashboard/summary')
        .set('Cookie', adminCookie);

      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.data.pendingRecords).toBe(3);
    });

    it('counts beneficiaries verified in month strictly by verifiedAt', async () => {
      // Record verified in 2026-04
      await Beneficiary.create({
        fullName: 'April Verified',
        email: 'april@ex.com',
        source: 'organic',
        verified: true,
        verifiedAt: '2026-04-12',
      });

      // Record verified in 2026-05
      await Beneficiary.create({
        fullName: 'May Verified',
        email: 'may@ex.com',
        source: 'organic',
        verified: true,
        verifiedAt: '2026-05-18',
      });

      // Record verified in 2026-05 but created earlier
      await Beneficiary.create({
        fullName: 'May Verified Created Jan',
        email: 'may.jan@ex.com',
        source: 'organic',
        verified: true,
        verifiedAt: '2026-05-20',
        createdAt: new Date('2026-01-10'),
      });

      const aprilRes = await request(app)
        .get('/api/v1/admin/dashboard?month=2026-04')
        .set('Cookie', adminCookie);

      expect(aprilRes.status).toBe(200);
      expect(aprilRes.body.data.values.beneficiariesVerified).toBe(1);

      const mayRes = await request(app)
        .get('/api/v1/admin/dashboard?month=2026-05')
        .set('Cookie', adminCookie);

      expect(mayRes.status).toBe(200);
      expect(mayRes.body.data.values.beneficiariesVerified).toBe(2);
    });
  });
});
