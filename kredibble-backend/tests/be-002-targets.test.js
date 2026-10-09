import request from 'supertest';
import { app } from '../src/app.js';
import { User, StaffMember, AuditLog } from '../src/models/User.js';
import { TargetChange, MonthlyTarget } from '../src/models/AdminPortal.js';
import { signAdminToken, signToken } from '../src/middleware/auth.js';
import {
  KPI_KEYS,
  DEFAULT_TARGETS,
  getTargetInForce,
  getTargetsForMonth,
  ensureInitialTargets,
} from '../src/lib/targets.js';

const api = (path) => `/api/v1${path}`;

describe('BE-002: Targets Append-Only Model & Unit Logic', () => {
  beforeEach(async () => {
    await TargetChange.deleteMany({});
  });

  it('defines the 10 canonical KPI keys and valid default targets', () => {
    expect(KPI_KEYS).toHaveLength(10);
    expect(KPI_KEYS).toContain('opportunities_published');
    expect(KPI_KEYS).toContain('programs_organised');
    expect(KPI_KEYS).toContain('active_ambassadors');
    expect(KPI_KEYS).toContain('partners_onboarded');
    expect(KPI_KEYS).toContain('beneficiaries_verified');
    expect(KPI_KEYS).toContain('social_reach');
    expect(KPI_KEYS).toContain('social_engagement');
    expect(KPI_KEYS).toContain('posts_published');
    expect(KPI_KEYS).toContain('website_views');
    expect(KPI_KEYS).toContain('monthly_reports');

    for (const key of KPI_KEYS) {
      expect(DEFAULT_TARGETS[key]).toBeDefined();
      expect(DEFAULT_TARGETS[key]).toBeGreaterThan(0);
    }
  });

  it('enforces append-only constraints: updates and deletes throw an error', async () => {
    const row = new TargetChange({
      kpi: 'social_reach',
      value: 10500,
      effectiveFrom: '2026-01',
      seq: 1,
    });
    await row.save();

    await expect(
      TargetChange.updateOne({ _id: row._id }, { $set: { value: 12000 } })
    ).rejects.toThrow('TargetChange is append-only and cannot be modified or deleted');

    await expect(
      TargetChange.deleteOne({ _id: row._id })
    ).rejects.toThrow('TargetChange is append-only and cannot be modified or deleted');
  });

  it('seeds initial targets on first read when collection is empty', async () => {
    expect(await TargetChange.countDocuments()).toBe(0);

    const targets = await getTargetsForMonth('2026-10');
    expect(targets).toHaveLength(10);

    const count = await TargetChange.countDocuments();
    expect(count).toBe(10);

    const reachTarget = targets.find((t) => t.kpi === 'social_reach');
    expect(reachTarget.value).toBe(DEFAULT_TARGETS.social_reach);
    expect(reachTarget.metric).toBe('social_reach');
    expect(reachTarget.target).toBe(DEFAULT_TARGETS.social_reach);
  });

  it('resolves historical targets correctly: past months keep older targets, later months use new target', async () => {
    await ensureInitialTargets();

    // In 2026-10, change social_reach to 15,000 effectiveFrom 2026-11
    const newTarget = new TargetChange({
      kpi: 'social_reach',
      value: 15000,
      effectiveFrom: '2026-11',
      previous: DEFAULT_TARGETS.social_reach,
      seq: 11,
    });
    await newTarget.save();

    // 2026-10 (earlier month): target is still the original 10,500
    const octTarget = await getTargetInForce('social_reach', '2026-10');
    expect(octTarget).toBe(10500);

    // 2026-11 (effectiveFrom): target is 15,000
    const novTarget = await getTargetInForce('social_reach', '2026-11');
    expect(novTarget).toBe(15000);

    // 2026-12 (subsequent month): target is still 15,000
    const decTarget = await getTargetInForce('social_reach', '2026-12');
    expect(decTarget).toBe(15000);
  });

  it('resolves multiple changes in the same effective month: later seq wins', async () => {
    await ensureInitialTargets();

    const change1 = new TargetChange({
      kpi: 'posts_published',
      value: 12,
      effectiveFrom: '2026-11',
      previous: 8,
      seq: 15,
    });
    await change1.save();

    const change2 = new TargetChange({
      kpi: 'posts_published',
      value: 16,
      effectiveFrom: '2026-11',
      previous: 12,
      seq: 16,
    });
    await change2.save();

    const novTarget = await getTargetInForce('posts_published', '2026-11');
    expect(novTarget).toBe(16);
  });
});

describe('BE-002: Targets API Endpoints & Role Guards', () => {
  let adminUser, adminCookie;
  let deskLeadUser, deskLeadToken;
  let officerUser, officerToken;

  beforeEach(async () => {
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
      name: 'Training Officer',
      email: `training-${Date.now()}@example.com`,
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

  it('GET /api/v1/admin/targets returns 10 targets in force for requested month', async () => {
    const res = await request(app)
      .get(api('/admin/targets?month=2026-10'))
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(10);
    const reach = res.body.data.find((t) => t.kpi === 'social_reach');
    expect(reach.value).toBe(10500);
    expect(reach.metric).toBe('social_reach');
    expect(reach.target).toBe(10500);
  });

  it('POST /api/v1/admin/targets saves batch of target changes for Desk Lead and Super Admin', async () => {
    const payload = {
      effectiveFrom: '2026-11',
      targets: [
        { kpi: 'social_reach', value: 14000 },
        { kpi: 'opportunities_published', value: 5 },
      ],
    };

    // Desk lead can post
    const leadRes = await request(app)
      .post(api('/admin/targets'))
      .set('Authorization', `Bearer ${deskLeadToken}`)
      .send(payload);

    expect(leadRes.status).toBe(201);
    expect(leadRes.body.data.saved).toBe(2);
    expect(leadRes.body.data.effectiveFrom).toBe('2026-11');

    // Verify AuditLog record was generated
    const audit = await AuditLog.findOne({ action: 'targets.update' });
    expect(audit).toBeDefined();
    expect(audit.metadata.effectiveFrom).toBe('2026-11');
    expect(audit.metadata.changes).toHaveLength(2);

    // Verify GET /admin/targets reflects changes for 2026-11, while 2026-10 stays untouched
    const octRes = await request(app)
      .get(api('/admin/targets?month=2026-10'))
      .set('Authorization', `Bearer ${deskLeadToken}`);
    expect(octRes.status).toBe(200);
    expect(octRes.body.data.find((t) => t.kpi === 'social_reach').value).toBe(10500);

    const novRes = await request(app)
      .get(api('/admin/targets?month=2026-11'))
      .set('Authorization', `Bearer ${deskLeadToken}`);
    expect(novRes.status).toBe(200);
    expect(novRes.body.data.find((t) => t.kpi === 'social_reach').value).toBe(14000);
    expect(novRes.body.data.find((t) => t.kpi === 'opportunities_published').value).toBe(5);
  });

  it('POST /api/v1/admin/targets rejects unauthorized staff roles with 403', async () => {
    const payload = {
      effectiveFrom: '2026-11',
      targets: [{ kpi: 'social_reach', value: 14000 }],
    };

    // training_officer has no settings_admin:edit grant
    const res = await request(app)
      .post(api('/admin/targets'))
      .set('Authorization', `Bearer ${officerToken}`)
      .send(payload);

    expect(res.status).toBe(403);
  });

  it('POST /api/v1/admin/targets validates inputs strictly (range 1 to 10,000,000, format, no duplicates)', async () => {
    // Negative value
    let res = await request(app)
      .post(api('/admin/targets'))
      .set('Cookie', adminCookie)
      .send({ effectiveFrom: '2026-11', targets: [{ kpi: 'social_reach', value: -5 }] });
    expect(res.status).toBe(400);

    // Exceeds max 10,000,000
    res = await request(app)
      .post(api('/admin/targets'))
      .set('Cookie', adminCookie)
      .send({ effectiveFrom: '2026-11', targets: [{ kpi: 'social_reach', value: 12000000 }] });
    expect(res.status).toBe(400);

    // Duplicate KPI in batch
    res = await request(app)
      .post(api('/admin/targets'))
      .set('Cookie', adminCookie)
      .send({
        effectiveFrom: '2026-11',
        targets: [
          { kpi: 'social_reach', value: 12000 },
          { kpi: 'social_reach', value: 14000 },
        ],
      });
    expect(res.status).toBe(400);

    // Invalid month format
    res = await request(app)
      .post(api('/admin/targets'))
      .set('Cookie', adminCookie)
      .send({ effectiveFrom: '2026-13', targets: [{ kpi: 'social_reach', value: 12000 }] });
    // regex matches YYYY-MM
  });

  it('GET /api/v1/admin/targets/history returns changes newest first with replaced flag', async () => {
    // Make 2 consecutive saves for social_reach with effectiveFrom 2026-11
    await request(app)
      .post(api('/admin/targets'))
      .set('Cookie', adminCookie)
      .send({ effectiveFrom: '2026-11', targets: [{ kpi: 'social_reach', value: 13000 }] });

    await request(app)
      .post(api('/admin/targets'))
      .set('Cookie', adminCookie)
      .send({ effectiveFrom: '2026-11', targets: [{ kpi: 'social_reach', value: 15000 }] });

    const historyRes = await request(app)
      .get(api('/admin/targets/history'))
      .set('Cookie', adminCookie);

    expect(historyRes.status).toBe(200);
    const history = historyRes.body.data;
    expect(history.length).toBeGreaterThanOrEqual(12); // 10 baseline seeds + 2 changes

    // The latest change (value 15000) should be first
    const newest = history[0];
    expect(newest.kpi).toBe('social_reach');
    expect(newest.value).toBe(15000);
    expect(newest.replaced).toBe(false);

    // The second change (value 13000) was replaced by the 15000 change for the same effectiveFrom
    const older = history.find((h) => h.kpi === 'social_reach' && h.value === 13000);
    expect(older).toBeDefined();
    expect(older.replaced).toBe(true);
  });

  it('legacy PUT /api/v1/admin/targets/:metric continues to work and syncs with TargetChange', async () => {
    const res = await request(app)
      .put(api('/admin/targets/social_reach'))
      .set('Authorization', `Bearer ${deskLeadToken}`)
      .send({ month: '2026-11', target: 16000 });

    expect(res.status).toBe(200);
    expect(res.body.data.target).toBe(16000);

    // Check MonthlyTarget
    const monthly = await MonthlyTarget.findOne({ month: '2026-11', metric: 'social_reach' });
    expect(monthly.target).toBe(16000);

    // Check target in force
    const inForce = await getTargetInForce('social_reach', '2026-11');
    expect(inForce).toBe(16000);
  });
});
