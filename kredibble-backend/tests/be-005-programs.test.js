import request from 'supertest';
import { app } from '../src/app.js';
import { User, StaffMember } from '../src/models/User.js';
import { Program, Partner } from '../src/models/AdminPortal.js';
import { signAdminToken, signToken } from '../src/middleware/auth.js';
import { prepareProgram, toProgramClientObject } from '../src/routes/admin-api.js';

const api = (path) => `/api/v1${path}`;

describe('BE-005: Programs Model & Unit Logic', () => {
  beforeEach(async () => {
    await Program.deleteMany({});
    await Partner.deleteMany({});
  });

  it('sets deliveredAt automatically when status is delivered and clears it when status changes', async () => {
    const program = new Program({
      title: 'AI Bootcamp',
      programType: 'bootcamp',
      format: 'in-person',
      status: 'planned',
      participantCount: 20,
      participantTarget: 30,
    });
    await program.save();
    expect(program.deliveredAt).toBeUndefined();

    // Move to delivered
    program.status = 'delivered';
    await program.save();
    expect(program.deliveredAt).toBeDefined();
    expect(program.deliveredAt instanceof Date).toBe(true);

    // Cancel delivered program
    program.status = 'cancelled';
    await program.save();
    expect(program.deliveredAt).toBeUndefined();
  });

  it('supports virtual aliases for name, type, participants, and target', async () => {
    const program = new Program({
      title: 'Youth Mentorship',
      programType: 'mentorship',
      participantCount: 15,
      participantTarget: 25,
      status: 'planned',
    });
    await program.save();

    expect(program.name).toBe('Youth Mentorship');
    expect(program.type).toBe('mentorship');
    expect(program.participants).toBe(15);
    expect(program.target).toBe(25);

    // Test setters
    program.name = 'Updated Title';
    program.type = 'training';
    program.participants = 40;
    program.target = 50;
    await program.save();

    expect(program.title).toBe('Updated Title');
    expect(program.programType).toBe('training');
    expect(program.participantCount).toBe(40);
    expect(program.participantTarget).toBe(50);
  });

  it('prepareProgram normalizes input and computes deliveredAt', () => {
    const planned = prepareProgram({
      name: 'Webinar 101',
      type: 'webinar',
      participants: 10,
      target: 20,
      status: 'planned',
      endAt: '2026-10-15T12:00:00Z',
    });
    expect(planned.title).toBe('Webinar 101');
    expect(planned.programType).toBe('webinar');
    expect(planned.participantCount).toBe(10);
    expect(planned.participantTarget).toBe(20);
    expect(planned.deliveredAt).toBeUndefined();

    const delivered = prepareProgram({
      name: 'Delivered Webinar',
      type: 'webinar',
      status: 'delivered',
      endAt: '2026-10-15T12:00:00Z',
    });
    expect(delivered.deliveredAt).toBeDefined();
  });

  it('toProgramClientObject generates participant overflow warning when participants exceed target', () => {
    const normal = toProgramClientObject({
      title: 'Dev Workshop',
      programType: 'training',
      participantCount: 20,
      participantTarget: 25,
      status: 'planned',
    });
    expect(normal.warning).toBeUndefined();

    const overflow = toProgramClientObject({
      title: 'Crowded Workshop',
      programType: 'training',
      participantCount: 35,
      participantTarget: 25,
      status: 'planned',
    });
    expect(overflow.warning).toBe('Participants (35) exceed target (25)');
    expect(overflow.participants).toBe(35);
    expect(overflow.target).toBe(25);
  });
});

describe('BE-005: Programs API Endpoints & Role Access', () => {
  let superAdminToken;
  let superAdminCookie;
  let trainingOfficerToken;
  let unauthorizedStaffToken;
  let seekerToken;
  let testPartner;

  beforeEach(async () => {
    await Program.deleteMany({});
    await Partner.deleteMany({});
    await User.deleteMany({});
    await StaffMember.deleteMany({});

    // Super Admin
    const superAdminUser = await User.create({
      name: 'Super Admin',
      email: `admin-${Date.now()}@kredibble.com`,
      passwordHash: 'x',
      role: 'admin',
    });
    superAdminToken = signAdminToken(superAdminUser);
    superAdminCookie = `kredibble_admin_token=${superAdminToken}`;

    // Training Officer
    const trainingUser = await User.create({
      name: 'Training Lead',
      email: `training-${Date.now()}@kredibble.com`,
      passwordHash: 'x',
      role: 'seeker',
    });
    await StaffMember.create({
      userId: trainingUser._id,
      name: trainingUser.name,
      email: trainingUser.email,
      roles: ['training_officer'],
      status: 'active',
    });
    trainingOfficerToken = signToken(trainingUser);

    // Unauthorized Staff (social media manager, no programs edit grant)
    const unauthorizedUser = await User.create({
      name: 'Staff Writer',
      email: `writer-${Date.now()}@kredibble.com`,
      passwordHash: 'x',
      role: 'seeker',
    });
    await StaffMember.create({
      userId: unauthorizedUser._id,
      name: unauthorizedUser.name,
      email: unauthorizedUser.email,
      roles: ['social_media_manager'],
      status: 'active',
    });
    unauthorizedStaffToken = signToken(unauthorizedUser);

    // Seeker
    const seekerUser = await User.create({
      name: 'John Seeker',
      email: `seeker-${Date.now()}@kredibble.com`,
      passwordHash: 'x',
      role: 'seeker',
    });
    seekerToken = signToken(seekerUser);

    // Partner
    testPartner = await Partner.create({
      organizationName: 'Tech Academy Africa',
      partnerType: 'university',
      stage: 'onboard',
      closed: true,
    });
  });

  it('rejects unauthenticated and unauthorized callers on POST /admin/programs', async () => {
    const payload = {
      title: 'Digital Skills Workshop',
      programType: 'training',
      status: 'planned',
      participantTarget: 30,
    };

    // Anonymous
    await request(app)
      .post(api('/admin/programs'))
      .send(payload)
      .expect(401);

    // Seeker
    await request(app)
      .post(api('/admin/programs'))
      .set('Authorization', `Bearer ${seekerToken}`)
      .send(payload)
      .expect(403);

    // Unauthorized staff without program edit permissions
    await request(app)
      .post(api('/admin/programs'))
      .set('Authorization', `Bearer ${unauthorizedStaffToken}`)
      .send(payload)
      .expect(403);
  });

  it('allows Training Officer to create a program with partner association and returns 201', async () => {
    const payload = {
      title: 'Cloud Computing 101',
      programType: 'training',
      format: 'hybrid',
      country: 'Ghana',
      location: 'Accra',
      partnerId: testPartner._id.toString(),
      participantCount: 15,
      participantTarget: 40,
      status: 'planned',
      startAt: '2026-11-01T09:00:00Z',
      endAt: '2026-11-05T17:00:00Z',
    };

    const res = await request(app)
      .post(api('/admin/programs'))
      .set('Authorization', `Bearer ${trainingOfficerToken}`)
      .send(payload)
      .expect(201);

    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.title).toBe('Cloud Computing 101');
    expect(res.body.data.name).toBe('Cloud Computing 101');
    expect(res.body.data.partnerName).toBe('Tech Academy Africa');
    expect(res.body.data.participants).toBe(15);
    expect(res.body.data.target).toBe(40);
    expect(res.body.data.warning).toBeUndefined();
  });

  it('warns but does not block when participantCount exceeds participantTarget', async () => {
    const payload = {
      title: 'Overbooked Bootcamp',
      programType: 'bootcamp',
      format: 'in-person',
      participantCount: 55,
      participantTarget: 40,
      status: 'running',
    };

    const res = await request(app)
      .post(api('/admin/programs'))
      .set('Authorization', `Bearer ${trainingOfficerToken}`)
      .send(payload)
      .expect(201);

    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.participants).toBe(55);
    expect(res.body.data.target).toBe(40);
    expect(res.body.data.warning).toBe('Participants (55) exceed target (40)');
  });

  it('GET /admin/programs/upcoming returns next planned or running programs sorted by start date', async () => {
    // Create 6 programs: 2 planned, 2 running, 1 delivered, 1 cancelled
    await Program.create([
      { title: 'Delivered Yesterday', programType: 'training', status: 'delivered', startAt: new Date('2026-09-01'), deliveredAt: new Date('2026-09-05') },
      { title: 'Cancelled Event', programType: 'event', status: 'cancelled', startAt: new Date('2026-10-01') },
      { title: 'Planned Soon', programType: 'webinar', status: 'planned', startAt: new Date('2026-11-01'), partnerId: testPartner._id },
      { title: 'Running Now', programType: 'bootcamp', status: 'running', startAt: new Date('2026-10-15') },
      { title: 'Planned Later', programType: 'project', status: 'planned', startAt: new Date('2026-12-01') },
      { title: 'Planned Far Future', programType: 'event', status: 'planned', startAt: new Date('2027-01-01') },
    ]);

    const res = await request(app)
      .get(api('/admin/programs/upcoming'))
      .set('Authorization', `Bearer ${trainingOfficerToken}`)
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data).toHaveLength(4); // Only the 4 planned/running programs

    // Verify ordering: Running Now (Oct 15) -> Planned Soon (Nov 1) -> Planned Later (Dec 1) -> Planned Far Future (Jan 1)
    expect(res.body.data[0].title).toBe('Running Now');
    expect(res.body.data[1].title).toBe('Planned Soon');
    expect(res.body.data[1].partnerName).toBe('Tech Academy Africa');
    expect(res.body.data[2].title).toBe('Planned Later');
    expect(res.body.data[3].title).toBe('Planned Far Future');
  });

  it('PATCH /admin/programs/:id updates status flow and manages deliveredAt', async () => {
    const program = await Program.create({
      title: 'Leadership Mentorship',
      programType: 'mentorship',
      status: 'running',
      participantCount: 20,
      participantTarget: 25,
      startAt: new Date('2026-10-01'),
      endAt: new Date('2026-10-20'),
    });

    const patchRes = await request(app)
      .patch(api(`/admin/programs/${program._id}`))
      .set('Authorization', `Bearer ${trainingOfficerToken}`)
      .send({ status: 'delivered', deliveredAt: '2026-10-20T17:00:00Z' })
      .expect(200);

    expect(patchRes.body.data.status).toBe('delivered');
    expect(patchRes.body.data.deliveredAt).toBeDefined();

    // Check DB record
    const updated = await Program.findById(program._id);
    expect(updated.status).toBe('delivered');
    expect(updated.deliveredAt).toBeDefined();

    // Cancel program -> deliveredAt must be cleared
    const cancelRes = await request(app)
      .patch(api(`/admin/programs/${program._id}`))
      .set('Authorization', `Bearer ${trainingOfficerToken}`)
      .send({ status: 'cancelled' })
      .expect(200);

    expect(cancelRes.body.data.status).toBe('cancelled');
    expect(cancelRes.body.data.deliveredAt).toBeUndefined();

    const cancelledInDb = await Program.findById(program._id);
    expect(cancelledInDb.status).toBe('cancelled');
    expect(cancelledInDb.deliveredAt).toBeUndefined();
  });

  it('DELETE /admin/programs/:id deletes the program', async () => {
    const program = await Program.create({
      title: 'Obsolete Webinar',
      programType: 'webinar',
      status: 'planned',
    });

    await request(app)
      .delete(api(`/admin/programs/${program._id}`))
      .set('Cookie', superAdminCookie)
      .expect(200);

    const check = await Program.findById(program._id);
    expect(check).toBeNull();
  });
});
