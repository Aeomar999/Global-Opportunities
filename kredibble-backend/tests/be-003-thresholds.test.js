import request from 'supertest';
import { app } from '../src/app.js';
import { User, StaffMember, AuditLog } from '../src/models/User.js';
import { ThresholdChange, TargetChange, MonthlyTarget } from '../src/models/AdminPortal.js';
import { signAdminToken, signToken } from '../src/middleware/auth.js';
import {
  DEFAULT_THRESHOLDS,
  getThresholdsInForce,
  ensureInitialThresholds,
} from '../src/lib/thresholds.js';

const api = (path) => `/api/v1${path}`;

describe('BE-003: Thresholds Append-Only Model & Unit Logic', () => {
  beforeEach(async () => {
    await ThresholdChange.deleteMany({});
    await TargetChange.deleteMany({});
  });

  it('defines default thresholds (green: 95%, amber: 70%)', () => {
    expect(DEFAULT_THRESHOLDS.green).toBe(95);
    expect(DEFAULT_THRESHOLDS.amber).toBe(70);
  });

  it('enforces append-only constraints: updates and deletes throw an error', async () => {
    const row = new ThresholdChange({
      green: 95,
      amber: 70,
      effectiveFrom: '2026-01',
      seq: 1,
    });
    await row.save();

    await expect(
      ThresholdChange.updateOne({ _id: row._id }, { $set: { green: 90 } })
    ).rejects.toThrow('ThresholdChange is append-only and cannot be modified or deleted');

    await expect(
      ThresholdChange.deleteOne({ _id: row._id })
    ).rejects.toThrow('ThresholdChange is append-only and cannot be modified or deleted');
  });

  it('seeds initial thresholds on first read when empty', async () => {
    expect(await ThresholdChange.countDocuments()).toBe(0);

    const thresholds = await getThresholdsInForce('2026-10');
    expect(thresholds.green).toBe(95);
    expect(thresholds.amber).toBe(70);
    expect(thresholds.greenRatio).toBe(0.95);
    expect(thresholds.amberRatio).toBe(0.7);

    const count = await ThresholdChange.countDocuments();
    expect(count).toBe(1);
  });

  it('resolves historical thresholds correctly: past months keep older thresholds', async () => {
    await ensureInitialThresholds();

    // In 2026-10, save green 90, amber 65 effectiveFrom 2026-11
    const newThr = new ThresholdChange({
      green: 90,
      amber: 65,
      effectiveFrom: '2026-11',
      previous: { green: 95, amber: 70 },
      seq: 20,
    });
    await newThr.save();

    // 2026-10 (earlier month): keeps original 95 / 70
    const oct = await getThresholdsInForce('2026-10');
    expect(oct.green).toBe(95);
    expect(oct.amber).toBe(70);

    // 2026-11 (effectiveFrom): uses 90 / 65
    const nov = await getThresholdsInForce('2026-11');
    expect(nov.green).toBe(90);
    expect(nov.amber).toBe(65);

    // 2026-12 (later month): uses 90 / 65
    const dec = await getThresholdsInForce('2026-12');
    expect(dec.green).toBe(90);
    expect(dec.amber).toBe(65);
  });
});

describe('BE-003: Thresholds API Endpoints & Role Guards', () => {
  let adminUser, adminCookie;
  let deskLeadUser, deskLeadToken;
  let officerUser, officerToken;

  beforeEach(async () => {
    await ThresholdChange.deleteMany({});
    await TargetChange.deleteMany({});
    await MonthlyTarget.deleteMany({});
    await AuditLog.deleteMany({});

    adminUser = await User.create({
      name: 'Super Admin',
      email: `admin-${Date.now()}@example.com`,
      role: 'admin',
      passwordHash: 'x',
    });
    adminCookie = `kredibble_admin_token=${signAdminToken(adminUser)}`;

    deskLeadUser = await User.create({
      name: 'Lead User',
      email: `lead-${Date.now()}@example.com`,
      role: 'seeker',
      passwordHash: 'x',
    });
    await StaffMember.create({
      userId: deskLeadUser._id,
      name: deskLeadUser.name,
      email: deskLeadUser.email,
      roles: ['desk_lead'],
      status: 'active',
    });
    deskLeadToken = signToken(deskLeadUser);

    officerUser = await User.create({
      name: 'Officer User',
      email: `officer-${Date.now()}@example.com`,
      role: 'seeker',
      passwordHash: 'x',
    });
    await StaffMember.create({
      userId: officerUser._id,
      name: officerUser.name,
      email: officerUser.email,
      roles: ['training_officer'],
      status: 'active',
    });
    officerToken = signToken(officerUser);
  });

  it('GET /api/v1/admin/thresholds returns thresholds in force for the requested month', async () => {
    const res = await request(app)
      .get(api('/admin/thresholds?month=2026-10'))
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.green).toBe(95);
    expect(res.body.data.amber).toBe(70);
    expect(res.body.data.greenRatio).toBe(0.95);
    expect(res.body.data.amberRatio).toBe(0.70);
  });

  it('POST /api/v1/admin/thresholds saves new threshold and writes audit trail', async () => {
    const payload = {
      green: 92,
      amber: 68,
      effectiveFrom: '2026-11',
    };

    const res = await request(app)
      .post(api('/admin/thresholds'))
      .set('Authorization', `Bearer ${deskLeadToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.data.green).toBe(92);
    expect(res.body.data.amber).toBe(68);
    expect(res.body.data.effectiveFrom).toBe('2026-11');
    expect(res.body.data.previous).toEqual({ green: 95, amber: 70 });

    // Verify audit trail
    const audit = await AuditLog.findOne({ action: 'thresholds.update' });
    expect(audit).toBeDefined();
    expect(audit.metadata.effectiveFrom).toBe('2026-11');
    expect(audit.metadata.green).toBe(92);
    expect(audit.metadata.amber).toBe(68);

    // Verify GET /admin/thresholds reflects new values for 2026-11
    const checkRes = await request(app)
      .get(api('/admin/thresholds?month=2026-11'))
      .set('Authorization', `Bearer ${deskLeadToken}`);
    expect(checkRes.status).toBe(200);
    expect(checkRes.body.data.green).toBe(92);
    expect(checkRes.body.data.amber).toBe(68);
  });

  it('POST /api/v1/admin/thresholds validates that amber is strictly below green', async () => {
    // Amber equal to green
    let res = await request(app)
      .post(api('/admin/thresholds'))
      .set('Cookie', adminCookie)
      .send({ green: 80, amber: 80, effectiveFrom: '2026-11' });
    expect(res.status).toBe(400);

    // Amber higher than green
    res = await request(app)
      .post(api('/admin/thresholds'))
      .set('Cookie', adminCookie)
      .send({ green: 70, amber: 85, effectiveFrom: '2026-11' });
    expect(res.status).toBe(400);

    // Out of range (> 200)
    res = await request(app)
      .post(api('/admin/thresholds'))
      .set('Cookie', adminCookie)
      .send({ green: 250, amber: 70, effectiveFrom: '2026-11' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/admin/thresholds rejects unauthorized roles with 403', async () => {
    const res = await request(app)
      .post(api('/admin/thresholds'))
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ green: 90, amber: 65, effectiveFrom: '2026-11' });

    expect(res.status).toBe(403);
  });

  it('GET /api/v1/admin/thresholds/history returns threshold changes with replaced flag', async () => {
    // Save twice for 2026-11
    await request(app)
      .post(api('/admin/thresholds'))
      .set('Cookie', adminCookie)
      .send({ green: 90, amber: 65, effectiveFrom: '2026-11' });

    await request(app)
      .post(api('/admin/thresholds'))
      .set('Cookie', adminCookie)
      .send({ green: 88, amber: 60, effectiveFrom: '2026-11' });

    const res = await request(app)
      .get(api('/admin/thresholds/history'))
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3); // baseline + 2 changes

    const newest = res.body.data[0];
    expect(newest.green).toBe(88);
    expect(newest.amber).toBe(60);
    expect(newest.replaced).toBe(false);

    const replaced = res.body.data.find((row) => row.green === 90 && row.amber === 65);
    expect(replaced).toBeDefined();
    expect(replaced.replaced).toBe(true);
  });

  it('POST /api/v1/admin/targets supports saving targets and thresholds together under one effectiveFrom', async () => {
    const combinedPayload = {
      effectiveFrom: '2026-11',
      targets: [
        { kpi: 'social_reach', value: 16000 },
      ],
      thresholds: {
        green: 94,
        amber: 69,
      },
    };

    const res = await request(app)
      .post(api('/admin/targets'))
      .set('Authorization', `Bearer ${deskLeadToken}`)
      .send(combinedPayload);

    expect(res.status).toBe(201);
    expect(res.body.data.saved).toBe(2);
    expect(res.body.data.targets).toHaveLength(1);
    expect(res.body.data.thresholds).toBeDefined();
    expect(res.body.data.thresholds.green).toBe(94);
    expect(res.body.data.thresholds.amber).toBe(69);

    // Both target and threshold update audit records are present
    const targetAudit = await AuditLog.findOne({ action: 'targets.update' });
    const thresholdAudit = await AuditLog.findOne({ action: 'thresholds.update' });
    expect(targetAudit).toBeDefined();
    expect(thresholdAudit).toBeDefined();
  });

  it('GET /api/v1/admin/change-history lists targets and thresholds together sorted by seq newest first', async () => {
    // Save target then threshold
    await request(app)
      .post(api('/admin/targets'))
      .set('Cookie', adminCookie)
      .send({
        effectiveFrom: '2026-11',
        targets: [{ kpi: 'social_reach', value: 17000 }],
      });

    await request(app)
      .post(api('/admin/thresholds'))
      .set('Cookie', adminCookie)
      .send({
        effectiveFrom: '2026-11',
        green: 91,
        amber: 66,
      });

    const res = await request(app)
      .get(api('/admin/change-history'))
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    const history = res.body.data;
    expect(history.length).toBeGreaterThanOrEqual(2);

    // The items must be sorted strictly descending by seq
    for (let i = 0; i < history.length - 1; i++) {
      expect(history[i].seq).toBeGreaterThanOrEqual(history[i + 1].seq);
    }

    // Newest is the threshold change
    expect(history[0].kind).toBe('thresholds');
    expect(history[0].green).toBe(91);
  });
});
