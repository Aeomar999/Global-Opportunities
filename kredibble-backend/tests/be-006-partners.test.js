import request from 'supertest';
import { app } from '../src/app.js';
import { User, StaffMember, AuditLog } from '../src/models/User.js';
import { Partner, PipelineStageConfig } from '../src/models/AdminPortal.js';
import { signAdminToken } from '../src/middleware/auth.js';
import { preparePartner, toPartnerClientObject } from '../src/routes/admin-api.js';

const api = (path) => `/api/v1${path}`;

describe('BE-006: Partners Model & Unit Logic', () => {
  beforeEach(async () => {
    await Partner.deleteMany({});
    await PipelineStageConfig.deleteMany({});
  });

  it('auto-initializes stageHistory on creation and derives closed state', async () => {
    const partner = new Partner({
      organizationName: 'Global Tech Corp',
      partnerType: 'corporate',
      stage: 'prospect',
    });
    await partner.save();

    expect(partner.closed).toBe(false);
    expect(partner.stageHistory).toHaveLength(1);
    expect(partner.stageHistory[0].stage).toBe('prospect');
    expect(partner.stageHistory[0].at).toBeDefined();

    // Move to onboard -> closed becomes true
    partner.stage = 'onboard';
    await partner.save();
    expect(partner.closed).toBe(true);

    // Move to renew -> closed remains true
    partner.stage = 'renew';
    await partner.save();
    expect(partner.closed).toBe(true);

    // Move back to outreach -> closed becomes false
    partner.stage = 'outreach';
    await partner.save();
    expect(partner.closed).toBe(false);
  });

  it('supports virtual aliases for name, type, ownerId, and sourcedVia', async () => {
    const partner = new Partner({
      name: 'Accra University',
      type: 'university',
      sourcedVia: 'Ambassador network',
      stage: 'prospect',
    });
    await partner.save();

    expect(partner.organizationName).toBe('Accra University');
    expect(partner.partnerType).toBe('university');
    expect(partner.sourcedBy).toBe('Ambassador network');
    expect(partner.name).toBe('Accra University');
    expect(partner.type).toBe('university');
    expect(partner.sourcedVia).toBe('Ambassador network');

    // Test setters
    partner.name = 'Kumasi Institute';
    partner.type = 'ngo';
    partner.sourcedVia = 'Direct outreach';
    await partner.save();

    expect(partner.organizationName).toBe('Kumasi Institute');
    expect(partner.partnerType).toBe('ngo');
    expect(partner.sourcedBy).toBe('Direct outreach');
  });

  it('preparePartner and toPartnerClientObject format input and output with aliases', () => {
    const prepared = preparePartner({
      name: 'Alliance Foundation',
      type: 'foundation',
      stage: 'MOU',
      sourcedVia: 'Conference',
      country: 'Ghana',
    });

    expect(prepared.organizationName).toBe('Alliance Foundation');
    expect(prepared.partnerType).toBe('foundation');
    expect(prepared.stage).toBe('mou');
    expect(prepared.sourcedBy).toBe('Conference');
    expect(prepared.country).toBe('Ghana');

    const client = toPartnerClientObject({
      _id: '64b7f1c2a1b2c3d4e5f60718',
      organizationName: 'Alliance Foundation',
      partnerType: 'foundation',
      stage: 'onboard',
      stageHistory: [{ stage: 'prospect', at: '2026-10-01' }, { stage: 'onboard', at: '2026-10-05', from: 'prospect' }],
      assignedOwnerId: { _id: '64b7f1c2a1b2c3d4e5f60719', name: 'Kwame Mensah' },
    });

    expect(client.id).toBe('64b7f1c2a1b2c3d4e5f60718');
    expect(client.name).toBe('Alliance Foundation');
    expect(client.type).toBe('foundation');
    expect(client.ownerId).toBe('64b7f1c2a1b2c3d4e5f60719');
    expect(client.ownerName).toBe('Kwame Mensah');
    expect(client.closed).toBe(true);
    expect(client.stageHistory).toHaveLength(2);
    expect(client.stageHistory[1].from).toBe('prospect');
  });
});

describe('BE-006: Partner Moves & Pipeline API', () => {
  let adminUser;
  let adminCookie;
  let partnershipsOfficer;

  beforeEach(async () => {
    await Partner.deleteMany({});
    await PipelineStageConfig.deleteMany({});
    await AuditLog.deleteMany({});
    await User.deleteMany({});
    await StaffMember.deleteMany({});

    adminUser = await User.create({
      name: 'Desk Lead Admin',
      email: 'lead@kredibble.com',
      role: 'admin',
      passwordHash: 'hashed_pw_test',
    });
    adminCookie = `kredibble_admin_token=${signAdminToken(adminUser)}`;

    partnershipsOfficer = await User.create({
      name: 'Abena Osei',
      email: 'abena@kredibble.com',
      role: 'hirer',
      passwordHash: 'hashed_pw_test',
    });
    await StaffMember.create({
      userId: partnershipsOfficer._id,
      name: partnershipsOfficer.name,
      email: partnershipsOfficer.email,
      roles: ['partnerships_officer'],
      status: 'active',
    });
  });

  it('POST /admin/partners creates a partner with initialized stage history', async () => {
    const res = await request(app)
      .post(api('/admin/partners'))
      .set('Cookie', adminCookie)
      .send({
        name: 'Ecobank Ghana',
        type: 'corporate',
        country: 'Ghana',
        sector: 'Banking',
        contactName: 'Kojo Antwi',
        contactEmail: 'kojo@ecobank.com',
        provides: 'Internships and sponsorship',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Ecobank Ghana');
    expect(res.body.data.type).toBe('corporate');
    expect(res.body.data.stage).toBe('prospect');
    expect(res.body.data.closed).toBe(false);
    expect(res.body.data.stageHistory).toHaveLength(1);
    expect(res.body.data.stageHistory[0].stage).toBe('prospect');
  });

  it('POST /admin/partners/:id/move executes stage transitions, updates history, and reports closedChange', async () => {
    const partner = await Partner.create({
      organizationName: 'MTN Ghana',
      partnerType: 'tech',
      stage: 'prospect',
      createdBy: adminUser._id,
    });

    // Move 1: prospect -> outreach
    const move1 = await request(app)
      .post(api(`/admin/partners/${partner._id}/move`))
      .set('Cookie', adminCookie)
      .send({ to: 'outreach' });

    expect(move1.status).toBe(200);
    expect(move1.body.data.from).toBe('prospect');
    expect(move1.body.data.to).toBe('outreach');
    expect(move1.body.data.closedChange).toBeNull();
    expect(move1.body.data.partner.closed).toBe(false);
    expect(move1.body.data.partner.stageHistory).toHaveLength(2);
    expect(move1.body.data.partner.stageHistory[1].stage).toBe('outreach');
    expect(move1.body.data.partner.stageHistory[1].from).toBe('prospect');

    // Move 2: outreach -> onboard (deal closes)
    const move2 = await request(app)
      .post(api(`/admin/partners/${partner._id}/move`))
      .set('Cookie', adminCookie)
      .send({ to: 'onboard' });

    expect(move2.status).toBe(200);
    expect(move2.body.data.from).toBe('outreach');
    expect(move2.body.data.to).toBe('onboard');
    expect(move2.body.data.closedChange).toBe('closed');
    expect(move2.body.data.partner.closed).toBe(true);

    // Move 3: onboard -> renew (stays closed)
    const move3 = await request(app)
      .post(api(`/admin/partners/${partner._id}/move`))
      .set('Cookie', adminCookie)
      .send({ to: 'renew' });

    expect(move3.status).toBe(200);
    expect(move3.body.data.closedChange).toBeNull();
    expect(move3.body.data.partner.closed).toBe(true);

    // Move 4: renew -> prospect (reopened)
    const move4 = await request(app)
      .post(api(`/admin/partners/${partner._id}/move`))
      .set('Cookie', adminCookie)
      .send({ to: 'prospect' });

    expect(move4.status).toBe(200);
    expect(move4.body.data.closedChange).toBe('reopened');
    expect(move4.body.data.partner.closed).toBe(false);

    // Move 5: prospect -> prospect (idempotent, no changes)
    const move5 = await request(app)
      .post(api(`/admin/partners/${partner._id}/move`))
      .set('Cookie', adminCookie)
      .send({ to: 'prospect' });

    expect(move5.status).toBe(200);
    expect(move5.body.data.closedChange).toBeNull();
    expect(move5.body.data.partner.stageHistory).toHaveLength(5); // did not append duplicate

    // Check audit logs
    const auditLogs = await AuditLog.find({ action: 'partner.move' });
    expect(auditLogs.length).toBeGreaterThanOrEqual(4);
  });

  it('GET /admin/partners/pipeline-health calculates pipeline conversion metrics', async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Create 3 partners:
    // Partner 1: outreach -> onboard (closed in window)
    await Partner.create({
      organizationName: 'P1 Tech',
      partnerType: 'tech',
      stage: 'onboard',
      stageHistory: [
        { stage: 'prospect', at: today },
        { stage: 'outreach', at: today, from: 'prospect' },
        { stage: 'onboard', at: today, from: 'outreach' },
      ],
    });

    // Partner 2: reached outreach, currently in proposal (open deal)
    await Partner.create({
      organizationName: 'P2 Foundation',
      partnerType: 'foundation',
      stage: 'proposal',
      stageHistory: [
        { stage: 'prospect', at: today },
        { stage: 'outreach', at: today, from: 'prospect' },
        { stage: 'proposal', at: today, from: 'outreach' },
      ],
    });

    // Partner 3: in prospect (open deal)
    await Partner.create({
      organizationName: 'P3 Media',
      partnerType: 'media',
      stage: 'prospect',
      stageHistory: [{ stage: 'prospect', at: today }],
    });

    const res = await request(app)
      .get(api('/admin/partners/pipeline-health'))
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.openDeals).toBe(2); // P2 (proposal) and P3 (prospect)
    expect(res.body.data.reachedOutreachInWindow).toBe(2); // P1 and P2 reached outreach
    expect(res.body.data.closedInWindow).toBe(1); // P1 closed
    expect(res.body.data.closeRate).toBe(0.5); // 1 / 2 = 0.5
    expect(res.body.data.needed).toBeGreaterThan(0);
    expect(['healthy', 'thin', 'critical']).toContain(res.body.data.status);
  });

  it('GET /admin/settings/pipeline-stages returns default labels, PUT updates them, and reset restores them', async () => {
    // 1. Initial GET returns defaults
    const get1 = await request(app)
      .get(api('/admin/settings/pipeline-stages'))
      .set('Cookie', adminCookie);

    expect(get1.status).toBe(200);
    expect(get1.body.data.prospect).toBe('Prospect');
    expect(get1.body.data.outreach).toBe('Outreach');

    // 2. PUT updates custom names
    const putRes = await request(app)
      .put(api('/admin/settings/pipeline-stages'))
      .set('Cookie', adminCookie)
      .send({
        prospect: 'Discovery',
        outreach: 'Initial Contact',
        proposal: 'Pitch',
        mou: 'Contracting',
        onboard: 'Active Partner',
        renew: 'Extension',
      });

    expect(putRes.status).toBe(200);
    expect(putRes.body.data.prospect).toBe('Discovery');
    expect(putRes.body.data.outreach).toBe('Initial Contact');
    expect(putRes.body.data.onboard).toBe('Active Partner');

    // Verify persistence
    const get2 = await request(app)
      .get(api('/admin/settings/pipeline-stages'))
      .set('Cookie', adminCookie);
    expect(get2.body.data.prospect).toBe('Discovery');

    // 3. Validation: rejects duplicate names (case-insensitive)
    const dupRes = await request(app)
      .put(api('/admin/settings/pipeline-stages'))
      .set('Cookie', adminCookie)
      .send({
        prospect: 'Discovery',
        outreach: 'discovery', // duplicate
        proposal: 'Pitch',
        mou: 'Contracting',
        onboard: 'Active Partner',
        renew: 'Extension',
      });
    expect(dupRes.status).toBe(400);

    // 4. Validation: rejects label exceeding 24 characters
    const longRes = await request(app)
      .put(api('/admin/settings/pipeline-stages'))
      .set('Cookie', adminCookie)
      .send({
        prospect: 'A Very Very Very Long Custom Stage Name That Exceeds Limit',
        outreach: 'Contact',
        proposal: 'Pitch',
        mou: 'Contract',
        onboard: 'Onboard',
        renew: 'Renew',
      });
    expect(longRes.status).toBe(400);

    // 5. Reset restores default labels
    const resetRes = await request(app)
      .put(api('/admin/settings/pipeline-stages'))
      .set('Cookie', adminCookie)
      .send({ reset: true });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.data.prospect).toBe('Prospect');
    expect(resetRes.body.data.outreach).toBe('Outreach');
    expect(resetRes.body.data.onboard).toBe('Onboard');
  });

  it('Verifies "Partners onboarded" counts partners that moved to Onboard or Renew in the month', async () => {
    const monthA = '2026-09';
    const monthB = '2026-10';

    // Partner A closed in month A
    await Partner.create({
      organizationName: 'Partner September',
      partnerType: 'corporate',
      stage: 'onboard',
      stageHistory: [
        { stage: 'prospect', at: '2026-09-01' },
        { stage: 'onboard', at: '2026-09-15', from: 'prospect' },
      ],
    });

    // Partner B closed in month B
    await Partner.create({
      organizationName: 'Partner October',
      partnerType: 'foundation',
      stage: 'onboard',
      stageHistory: [
        { stage: 'prospect', at: '2026-10-01' },
        { stage: 'onboard', at: '2026-10-08', from: 'prospect' },
      ],
    });

    // Partner C stayed in proposal (never closed)
    await Partner.create({
      organizationName: 'Partner Unclosed',
      partnerType: 'ngo',
      stage: 'proposal',
      stageHistory: [{ stage: 'proposal', at: '2026-10-02' }],
    });

    // Query dashboard for month A (September)
    const dashA = await request(app)
      .get(api(`/admin/dashboard?month=${monthA}`))
      .set('Cookie', adminCookie);
    expect(dashA.status).toBe(200);
    const kpiA = dashA.body.data.kpis.find((k) => k.metric === 'partnersClosed');
    expect(kpiA.value).toBe(1);

    // Query dashboard for month B (October)
    const dashB = await request(app)
      .get(api(`/admin/dashboard?month=${monthB}`))
      .set('Cookie', adminCookie);
    expect(dashB.status).toBe(200);
    const kpiB = dashB.body.data.kpis.find((k) => k.metric === 'partnersClosed');
    expect(kpiB.value).toBe(1);
  });
});
