import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from '../src/app.js';
import { User, StaffMember } from '../src/models/User.js';
import { Opportunity } from '../src/models/Platform.js';
import { TargetChange } from '../src/models/AdminPortal.js';
import { signAdminToken, signToken } from '../src/middleware/auth.js';
import {
  isPastMonth,
  isTooEarly,
  monthProgress,
  buildMetricResult,
  highlightOf,
  calculateComposite,
  teamSummary,
  sortTeamScorecards,
} from '../src/lib/scorecards.js';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.disconnect();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

describe('BE-015: Scorecard Pure Math & Logic Functions', () => {
  test('isPastMonth correctly identifies past vs current vs future months', () => {
    const today = new Date('2026-10-10T12:00:00Z');
    expect(isPastMonth('2026-09', today)).toBe(true);
    expect(isPastMonth('2026-01', today)).toBe(true);
    expect(isPastMonth('2026-10', today)).toBe(false);
    expect(isPastMonth('2026-11', today)).toBe(false);
  });

  test('isTooEarly enforces day 5 threshold on current month, but never on past months', () => {
    const earlyDay = new Date('2026-10-04T12:00:00Z');
    const dayFive = new Date('2026-10-05T00:00:00Z');
    const lateDay = new Date('2026-10-20T12:00:00Z');

    // Current month before day 5
    expect(isTooEarly('2026-10', earlyDay)).toBe(true);
    // Current month on/after day 5
    expect(isTooEarly('2026-10', dayFive)).toBe(false);
    expect(isTooEarly('2026-10', lateDay)).toBe(false);

    // Past month is NEVER too early, even if evaluated on day 2 of the new month
    expect(isTooEarly('2026-09', earlyDay)).toBe(false);
  });

  test('monthProgress calculates pro-rating pace for current month and full pace for past month', () => {
    const today = new Date('2026-10-10T00:00:00Z'); // day 10 of 31
    const currentProgress = monthProgress('2026-10', today);
    expect(currentProgress.dayOfMonth).toBe(10);
    expect(currentProgress.daysInMonth).toBe(31);

    const pastProgress = monthProgress('2026-09', today);
    expect(pastProgress.dayOfMonth).toBe(30);
    expect(pastProgress.daysInMonth).toBe(30);
  });

  test('buildMetricResult calculates pro-rated target for count and full target for running_total', () => {
    const today = new Date('2026-10-10T00:00:00Z'); // 10/31 pace ~ 0.32258
    const countDef = {
      key: 'opportunities_published',
      label: 'Opportunities published',
      unit: 'listings',
      kind: 'count',
    };
    const runningDef = {
      key: 'active_ambassadors',
      label: 'Active ambassadors',
      unit: 'ambassadors',
      kind: 'running_total',
    };

    const thresholds = { greenRatio: 0.95, amberRatio: 0.70 };

    // Count metric with target 31: pro-rated target is 31 * (10/31) = 10
    const countResult = buildMetricResult(countDef, 10, 31, '2026-10', today, thresholds);
    expect(countResult.prorated).toBe(true);
    expect(countResult.proratedTarget).toBeCloseTo(10, 2);
    expect(countResult.attainment).toBeCloseTo(1.0, 2);
    expect(countResult.status).toBe('green');

    // Running total with target 31: judged against full target 31, never pro-rated
    const runningResult = buildMetricResult(runningDef, 10, 31, '2026-10', today, thresholds);
    expect(runningResult.prorated).toBe(false);
    expect(runningResult.proratedTarget).toBe(31);
    expect(runningResult.attainment).toBeCloseTo(10 / 31, 2);
    expect(runningResult.status).toBe('red');
  });

  test('calculateComposite caps each metric at 100% so one high metric cannot hide a neglected one', () => {
    // Metric A has 300% attainment (3.0), Metric B has 0% attainment (0.0)
    const metrics = [
      { attainment: 3.0 },
      { attainment: 0.0 },
    ];

    // Average without capping would be (300 + 0) / 2 = 150
    // With min(attainment, 1) cap: (1.0 + 0.0) / 2 = 0.5 -> 50%
    const score = calculateComposite(metrics, false);
    expect(score).toBe(50);
  });

  test('calculateComposite returns null when tooEarly is true or when no metrics have targets', () => {
    const metrics = [{ attainment: 1.0 }, { attainment: 0.8 }];
    expect(calculateComposite(metrics, true)).toBeNull();
    expect(calculateComposite([], false)).toBeNull();
    expect(calculateComposite([{ attainment: null }], false)).toBeNull();
  });

  test('highlightOf identifies focus for 1 metric, pair for 2+, and tracks atTarget', () => {
    const m1 = { key: 'a', label: 'A', attainment: 1.2 };
    const m2 = { key: 'b', label: 'B', attainment: 0.8 };

    expect(highlightOf([m1])).toEqual({ kind: 'focus', focus: m1 });

    const pair = highlightOf([m1, m2]);
    expect(pair.kind).toBe('pair');
    expect(pair.strongest).toEqual(m1);
    expect(pair.weakest).toEqual(m2);
    expect(pair.atTarget).toBe(false);

    // Both at target
    const m3 = { key: 'c', label: 'C', attainment: 1.0 };
    const pairAtTarget = highlightOf([m1, m3]);
    expect(pairAtTarget.atTarget).toBe(true);
  });

  test('sortTeamScorecards ranks highest composite first, nulls last, breaking ties alphabetically', () => {
    const people = [
      { id: '1', name: 'Zack', composite: null },
      { id: '2', name: 'Bob', composite: 80 },
      { id: '3', name: 'Alice', composite: 95 },
      { id: '4', name: 'Charlie', composite: 80 },
      { id: '5', name: 'Adam', composite: null },
    ];

    const sorted = sortTeamScorecards(people);
    expect(sorted.map((p) => p.name)).toEqual(['Alice', 'Bob', 'Charlie', 'Adam', 'Zack']);
  });

  test('teamSummary counts scored people, average composite, and below amber threshold', () => {
    const people = [
      { composite: 95, status: 'green' },
      { composite: 75, status: 'amber' },
      { composite: 50, status: 'red' },
      { composite: null, status: null },
    ];

    const summary = teamSummary(people);
    expect(summary.scored).toBe(3);
    // (95 + 75 + 50) / 3 = 220 / 3 = 73.33 -> 73
    expect(summary.average).toBe(73);
    expect(summary.belowAmber).toBe(1);
  });
});

describe('BE-015: Scorecard API Endpoints Contract & Authorization', () => {
  const createAdminUser = async (name = 'Super Admin', email = 'admin@example.com') => {
    const user = await User.create({ name, email, role: 'admin', passwordHash: 'hashed' });
    const token = signAdminToken(user);
    return { user, token };
  };

  const createStaffUser = async (name = 'Staff Member', email = 'staff@example.com', roles = ['opportunities_officer']) => {
    const user = await User.create({ name, email, role: 'seeker', passwordHash: 'hashed' });
    const staff = await StaffMember.create({
      userId: user._id,
      name,
      email,
      roles: Array.isArray(roles) ? roles : [roles],
      role: Array.isArray(roles) ? roles.join(',') : roles,
      status: 'active',
      joinedDate: '2026-01-01',
    });
    const token = signToken(user);
    return { user, staff, token };
  };

  test('GET /api/v1/admin/scorecards/me requires authentication (401)', async () => {
    const res = await request(app).get('/api/v1/admin/scorecards/me');
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/admin/scorecards/team requires authentication (401)', async () => {
    const res = await request(app).get('/api/v1/admin/scorecards/team');
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/admin/scorecards/team returns 403 for non-Desk-Lead / non-Super-Admin staff', async () => {
    const { token } = await createStaffUser('Officer Dave', 'dave@example.com', ['opportunities_officer']);

    const res = await request(app)
      .get('/api/v1/admin/scorecards/team')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/permission denied|forbidden/i);
  });

  test('GET /api/v1/admin/scorecards/team succeeds for Desk Lead (200)', async () => {
    const { token } = await createStaffUser('Lead Sarah', 'sarah@example.com', ['desk_lead']);

    const res = await request(app)
      .get('/api/v1/admin/scorecards/team?month=2026-09')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.month).toBe('2026-09');
    expect(res.body.data.people).toBeDefined();
    expect(res.body.data.summary).toBeDefined();
  });

  test('GET /api/v1/admin/scorecards/team succeeds for Super Admin (200)', async () => {
    const { token } = await createAdminUser('Super Admin', 'admin@example.com');

    const res = await request(app)
      .get('/api/v1/admin/scorecards/team?month=2026-09')
      .set('Cookie', `kredibble_admin_token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.month).toBe('2026-09');
  });

  test('GET /api/v1/admin/scorecards aliases /scorecards/team for backward compatibility', async () => {
    const { token } = await createAdminUser('Super Admin', 'admin@example.com');

    const res = await request(app)
      .get('/api/v1/admin/scorecards?month=2026-09')
      .set('Cookie', `kredibble_admin_token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.people).toBeDefined();
  });
});

describe('BE-015: Scorecard PII Protection & Accurate Calculations', () => {
  const createAdminUser = async (name = 'Super Admin', email = 'admin@example.com') => {
    const user = await User.create({ name, email, role: 'admin', passwordHash: 'hashed' });
    const token = signAdminToken(user);
    return { user, token };
  };

  const createStaffUser = async (name = 'Test Staff', email = 'staff@example.com', roles = ['opportunities_officer']) => {
    const user = await User.create({ name, email, role: 'seeker', passwordHash: 'hashed' });
    const staff = await StaffMember.create({
      userId: user._id,
      name,
      email,
      roles: Array.isArray(roles) ? roles : [roles],
      role: Array.isArray(roles) ? roles.join(',') : roles,
      status: 'active',
      joinedDate: '2026-01-01',
    });
    const token = signToken(user);
    return { user, staff, token };
  };

  test('GET /api/v1/admin/scorecards/me never leaks colleague names (Strict PII Protection)', async () => {
    // Create 3 active staff members
    const user1 = await createStaffUser('Alice Opportunities', 'alice@example.com', ['opportunities_officer']);
    await createStaffUser('Bob SecretColleague', 'bob@example.com', ['training_officer']);
    await createStaffUser('Charlie Private', 'charlie@example.com', ['partnerships_officer']);

    // Request Alice's scorecard
    const res = await request(app)
      .get('/api/v1/admin/scorecards/me?month=2026-09')
      .set('Authorization', `Bearer ${user1.token}`);

    expect(res.status).toBe(200);
    const bodyText = JSON.stringify(res.body);

    // Alice is present
    expect(res.body.data.people).toHaveLength(1);
    expect(res.body.data.people[0].name).toBe('Alice Opportunities');

    // Bob and Charlie are NEVER leaked in response
    expect(bodyText).not.toContain('Bob SecretColleague');
    expect(bodyText).not.toContain('Charlie Private');
  });

  test('Opportunities officer scorecard owns exactly opportunities_published and computes attainment', async () => {
    const { token } = await createStaffUser('Dan Writer', 'dan@example.com', ['opportunities_officer']);

    // Set baseline target for opportunities_published
    await TargetChange.create({
      kpi: 'opportunities_published',
      value: 10,
      effectiveFrom: '2026-01',
      seq: 1,
      changedByName: 'System',
      changedAt: '2026-01-01',
    });

    // Seed 8 vetted published listings in 2026-09
    for (let i = 0; i < 8; i++) {
      await Opportunity.create({
        title: `Listing ${i}`,
        type: 'job',
        status: 'published',
        vetted: true,
        publishedAt: new Date('2026-09-15T10:00:00Z'),
        description: 'Test opportunity description',
        location: 'Accra',
        company: 'Global Org',
      });
    }

    const res = await request(app)
      .get('/api/v1/admin/scorecards/me?month=2026-09')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const person = res.body.data.people[0];
    expect(person.roles).toEqual(['opportunities_officer']);
    expect(person.metrics).toHaveLength(1);
    expect(person.metrics[0].key).toBe('opportunities_published');
    expect(person.metrics[0].value).toBe(8);
    expect(person.metrics[0].target).toBe(10);
    expect(person.metrics[0].attainment).toBeCloseTo(0.8, 2);
    // Attainment 80% with threshold green=95, amber=70 -> amber
    expect(person.metrics[0].status).toBe('amber');
    expect(person.composite).toBe(80);
    expect(person.status).toBe('amber');
    expect(person.highlight).toEqual({ kind: 'focus', focus: expect.objectContaining({ key: 'opportunities_published' }) });

    // 6-month series is returned
    expect(res.body.data.series).toBeDefined();
    expect(Array.isArray(res.body.data.series)).toBe(true);
    expect(res.body.data.series.length).toBe(6);
  });

  test('Super Admin owns 0 metrics, receives empty metrics, composite null, and series null', async () => {
    const { token } = await createAdminUser('Big Boss', 'boss@example.com');

    const res = await request(app)
      .get('/api/v1/admin/scorecards/me?month=2026-09')
      .set('Cookie', `kredibble_admin_token=${token}`);

    expect(res.status).toBe(200);
    const person = res.body.data.people[0];
    expect(person.roles).toEqual(['super_admin']);
    expect(person.metrics).toHaveLength(0);
    expect(person.composite).toBeNull();
    expect(person.highlight).toBeNull();
    expect(res.body.data.series).toBeNull();
  });

  test('Desk Lead owns all 10 KPIs and composite averages across all owned metrics', async () => {
    const { token } = await createStaffUser('Super Lead', 'lead@example.com', ['desk_lead']);

    const res = await request(app)
      .get('/api/v1/admin/scorecards/me?month=2026-09')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const person = res.body.data.people[0];
    expect(person.roles).toEqual(['desk_lead']);
    expect(person.metrics).toHaveLength(10);
    expect(res.body.data.series).toHaveLength(6);
  });

  test('Team scorecard filters out inactive staff members', async () => {
    const { token } = await createAdminUser('Admin Evaluator', 'eval@example.com');

    // Create 1 active and 1 inactive staff
    const u1 = await User.create({ name: 'Active Person', email: 'active@example.com', role: 'seeker', passwordHash: 'x' });
    await StaffMember.create({ userId: u1._id, name: 'Active Person', email: 'active@example.com', roles: ['opportunities_officer'], status: 'active' });

    const u2 = await User.create({ name: 'Terminated Person', email: 'terminated@example.com', role: 'seeker', passwordHash: 'x' });
    await StaffMember.create({ userId: u2._id, name: 'Terminated Person', email: 'terminated@example.com', roles: ['training_officer'], status: 'inactive' });

    const res = await request(app)
      .get('/api/v1/admin/scorecards/team?month=2026-09')
      .set('Cookie', `kredibble_admin_token=${token}`);

    expect(res.status).toBe(200);
    const names = res.body.data.people.map((p) => p.name);
    expect(names).toContain('Active Person');
    expect(names).not.toContain('Terminated Person');
  });

  test('Current month query before day 5 holds back composite score (tooEarly)', async () => {
    const { token } = await createStaffUser('Early Staff', 'early@example.com', ['opportunities_officer']);

    const currentMonth = new Date().toISOString().slice(0, 7);
    // Explicit simulation of day 2
    const res = await request(app)
      .get(`/api/v1/admin/scorecards/me?month=${currentMonth}&today=${currentMonth}-02T12:00:00Z`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.tooEarly).toBe(true);
    expect(res.body.data.people[0].composite).toBeNull();
    expect(res.body.data.people[0].tooEarly).toBe(true);
  });
});
