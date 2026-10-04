import request from 'supertest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Event } from '../src/models/Platform.js';
import { signAdminToken, signToken } from '../src/middleware/auth.js';

const createAdmin = () => User.create({ name: 'Ada Admin', email: 'ada@example.com', role: 'admin', passwordHash: 'x' });
const adminCookie = (admin) => `kredibble_admin_token=${signAdminToken(admin)}`;
const get = (path, cookie) => request(app).get(`/api/v1${path}`).set('Cookie', cookie);

const eventFields = { hirer: 'Acme', location: 'Accra', dateTime: '2026-11-01T10:00', capacity: 10 };

describe('SEC-075: admin collection mounts', () => {
  it('lists with the admin cookie, paginated and filtered by exact value', async () => {
    const cookie = adminCookie(await createAdmin());
    await Event.create({ ...eventFields, title: 'Career fair', status: 'upcoming' });
    await Event.create({ ...eventFields, title: 'Old meetup', status: 'past' });

    const res = await get('/admin/events?status=upcoming', cookie);

    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ page: 1, total: 1 });
    expect(res.body.data.map((e) => e.title)).toEqual(['Career fair']);
  });

  it('rejects an operator object in a filter (SEC-061)', async () => {
    const cookie = adminCookie(await createAdmin());

    const res = await get('/admin/events?status[$ne]=past', cookie);

    expect(res.status).toBe(400);
  });

  it('rejects a user Bearer token, even one belonging to an admin account', async () => {
    const admin = await createAdmin();

    const res = await request(app).get('/api/v1/admin/events').set('Authorization', `Bearer ${signToken(admin)}`);

    expect(res.status).toBe(401);
  });

  it('rejects an anonymous request', async () => {
    expect((await request(app).get('/api/v1/admin/events')).status).toBe(401);
  });
});
