import request from 'supertest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Opportunity, Grant, GrantApplication } from '../src/models/Platform.js';
import { Channel, ChannelPost } from '../src/models/Community.js';
import { signAdminToken, signToken } from '../src/middleware/auth.js';

const createAdmin = () => User.create({ name: 'Ada Admin', email: 'ada@example.com', role: 'admin', passwordHash: 'x' });
const adminCookie = (admin) => `kredibble_admin_token=${signAdminToken(admin)}`;
const api = (path) => `/api/v1${path}`;

const grantFields = { hirer: 'Acme', sector: 'Agri', fundingPool: 1000 };
const postingFields = { title: 'Engineer', type: 'job', company: 'Acme', location: 'Accra', description: 'Build' };

describe('SEC-077: admin grant applications', () => {
  it('lists one grant\'s applications and persists a decision', async () => {
    const cookie = adminCookie(await createAdmin());
    const grant = await Grant.create({ ...grantFields, title: 'Seed fund' });
    const other = await Grant.create({ ...grantFields, title: 'Other fund' });
    const application = await GrantApplication.create({ grantId: grant._id, applicantName: 'Ama Mensah', requestedAmount: 200 });
    await GrantApplication.create({ grantId: other._id, applicantName: 'Kofi Owusu', requestedAmount: 300 });

    const listed = await request(app).get(api(`/admin/grant-applications?grantId=${grant._id}`)).set('Cookie', cookie);
    const decided = await request(app)
      .patch(api(`/admin/grant-applications/${application._id}`))
      .set('Cookie', cookie)
      .send({ status: 'approved' });

    expect(listed.status).toBe(200);
    expect(listed.body.data.map((a) => a.applicantName)).toEqual(['Ama Mensah']);
    expect(decided.status).toBe(200);
    expect((await GrantApplication.findById(application._id).lean()).status).toBe('approved');
  });
});

describe('SEC-077: admin community posts', () => {
  it('deletes a post with the admin cookie and rejects a user Bearer token', async () => {
    const admin = await createAdmin();
    const channel = await Channel.create({ name: 'Builders', category: 'Tech' });
    const post = await ChannelPost.create({ channelId: channel._id, authorName: 'Ama Mensah', body: 'Spam' });

    const asUser = await request(app).delete(api(`/admin/community/posts/${post._id}`)).set('Authorization', `Bearer ${signToken(admin)}`);
    const asAdmin = await request(app).delete(api(`/admin/community/posts/${post._id}`)).set('Cookie', adminCookie(admin));

    expect(asUser.status).toBe(401);
    expect(asAdmin.status).toBe(204);
    expect(await ChannelPost.countDocuments({ _id: post._id })).toBe(0);
  });
});

describe('SEC-077: admin single opportunity', () => {
  it('returns one posting and 404s for an unknown or invalid id', async () => {
    const cookie = adminCookie(await createAdmin());
    const posting = await Opportunity.create({ ...postingFields, moderationStatus: 'pending' });

    const found = await request(app).get(api(`/admin/opportunities/${posting._id}`)).set('Cookie', cookie);
    const unknown = await request(app).get(api('/admin/opportunities/64b7f1c2a1b2c3d4e5f60718')).set('Cookie', cookie);
    const invalid = await request(app).get(api('/admin/opportunities/not-an-id')).set('Cookie', cookie);

    expect(found.status).toBe(200);
    expect(found.body.data).toMatchObject({ id: String(posting._id), title: 'Engineer', moderationStatus: 'pending' });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.message).toBe('Opportunity not found');
    expect(invalid.status).toBe(404);
  });

  it('rejects an operator object in the staff-portal opportunity filters (SEC-061)', async () => {
    const cookie = adminCookie(await createAdmin());
    await Opportunity.create({ ...postingFields, moderationStatus: 'pending' });

    const res = await request(app).get(api('/admin/opportunities?moderationStatus[$ne]=x')).set('Cookie', cookie);

    expect(res.status).toBe(400);
  });
});
