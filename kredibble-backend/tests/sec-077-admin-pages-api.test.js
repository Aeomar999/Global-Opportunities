import request from 'supertest';
import { app } from '../src/app.js';
import { User, StaffMember, AuditLog } from '../src/models/User.js';
import { SeekerProfile, HirerAccount } from '../src/models/Profiles.js';
import { Opportunity, Grant, GrantApplication } from '../src/models/Platform.js';
import { Channel, ChannelPost, Report } from '../src/models/Community.js';
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

describe('SEC-077: admin analytics', () => {
  it('counts seekers, hirers, applications, reports and postings by type', async () => {
    const cookie = adminCookie(await createAdmin());
    const [ama, kofi, efua] = await User.create([
      { name: 'Ama', email: 'ama@example.com', role: 'seeker', passwordHash: 'x' },
      { name: 'Kofi', email: 'kofi@example.com', role: 'seeker', passwordHash: 'x' },
      { name: 'Efua', email: 'efua@example.com', role: 'hirer', passwordHash: 'x' },
    ]);
    await SeekerProfile.create({ userId: ama._id, profession: 'Engineer', status: 'active' });
    await SeekerProfile.create({ userId: kofi._id, profession: 'Designer', status: 'suspended' });
    await HirerAccount.create({ userId: efua._id, companyName: 'Efua Ltd', industry: 'Tech', location: 'Accra', verified: true });
    await Report.create({ targetType: 'post', reason: 'spam', status: 'open' });
    await Opportunity.create({ ...postingFields });
    await Opportunity.create({ ...postingFields, title: 'Designer' });

    const res = await request(app).get(api('/admin/analytics')).set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      seekers: { total: 2, active: 1 },
      hirers: { total: 1, verified: 1 },
      applications: { total: 0 },
      reports: { total: 1, open: 1 },
      opportunitiesByType: [{ type: 'job', count: 2 }],
    });
  });
});

describe('SEC-077: admin staff invite', () => {
  const invite = (cookie, body) => request(app).post(api('/admin/staff/invite')).set('Cookie', cookie).send(body);

  it('adds an existing account to the staff list by email, once', async () => {
    const admin = await createAdmin();
    const cookie = adminCookie(admin);
    const seeker = await User.create({ name: 'Ama Mensah', email: 'ama@example.com', role: 'seeker', passwordHash: 'x' });

    const first = await invite(cookie, { email: 'AMA@Example.com', role: 'Writer' });
    const again = await invite(cookie, { email: 'ama@example.com', role: 'Writer' });

    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ name: 'Ama Mensah', email: 'ama@example.com', role: 'Writer', status: 'active' });
    expect(await StaffMember.countDocuments({ userId: seeker._id })).toBe(1);
    expect(again.status).toBe(409);
    const audit = await AuditLog.findOne({ 'metadata.staffInvite': true }).lean();
    expect(audit).toMatchObject({ outcome: 'success' });
    expect(JSON.stringify(audit)).not.toContain('ama@example.com');
  });

  it('answers 404 for an unknown email, 400 for an invalid one, 401 for a user token', async () => {
    const admin = await createAdmin();
    const cookie = adminCookie(admin);

    expect((await invite(cookie, { email: 'nobody@example.com', role: 'Writer' })).status).toBe(404);
    expect((await invite(cookie, { email: 'not-an-email', role: 'Writer' })).status).toBe(400);
    const asUser = await request(app).post(api('/admin/staff/invite'))
      .set('Authorization', `Bearer ${signToken(admin)}`).send({ email: 'ama@example.com', role: 'Writer' });
    expect(asUser.status).toBe(401);
  });
});

describe('SEC-077: admin image upload', () => {
  // A valid 1x1 PNG.
  const png = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
    0x00, 0x05, 0xFE, 0x02, 0xFE, 0x3C, 0xF2, 0xD5, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
    0xAE, 0x42, 0x60, 0x82,
  ]);
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

  it('stores an article banner under the admin folder', async () => {
    const cookie = adminCookie(await createAdmin());

    const res = await request(app).post(api('/admin/upload')).query({ purpose: 'article-banner' })
      .set('Cookie', cookie).attach('file', png, 'banner.png');

    expect(res.status).toBe(200);
    expect(res.body.data.folder).toContain('kredibble/admin/article-banner');
  });

  it('refuses a PDF and a user Bearer token', async () => {
    const admin = await createAdmin();

    const asPdf = await request(app).post(api('/admin/upload')).query({ purpose: 'article-banner' })
      .set('Cookie', adminCookie(admin)).attach('file', pdf, 'doc.pdf');
    const asUser = await request(app).post(api('/admin/upload')).query({ purpose: 'article-banner' })
      .set('Authorization', `Bearer ${signToken(admin)}`).attach('file', png, 'banner.png');

    expect(asPdf.status).toBe(400);
    expect(asUser.status).toBe(401);
  });
});

describe('SEC-077: a channel an admin removed is hidden from users', () => {
  it('drops out of the public list, its pages answer 404, and nobody can post in it', async () => {
    const admin = await createAdmin();
    const member = await User.create({ name: 'Ama', email: 'ama@example.com', role: 'seeker', passwordHash: 'x' });
    const memberAuth = ['Authorization', `Bearer ${signToken(member)}`];
    const removed = await Channel.create({ name: 'Removed group', category: 'Tech', status: 'removed', createdBy: member._id });
    await Channel.create({ name: 'Live group', category: 'Tech' });

    const list = await request(app).get(api('/community/channels'));
    const detail = await request(app).get(api(`/community/channels/${removed._id}`));
    const posts = await request(app).get(api(`/community/channels/${removed._id}/posts`));
    const ownerDetail = await request(app).get(api(`/community/channels/${removed._id}`)).set(...memberAuth);
    const newPost = await request(app).post(api(`/community/channels/${removed._id}/posts`)).set(...memberAuth)
      .send({ body: 'Still here?' });
    const adminList = await request(app).get(api('/admin/community/channels')).set('Cookie', adminCookie(admin));

    expect(list.body.data.map((c) => c.name)).toEqual(['Live group']);
    expect(detail.status).toBe(404);
    expect(posts.status).toBe(404);
    expect(ownerDetail.status).toBe(404);
    expect(newPost.status).toBe(404);
    expect(adminList.body.data.map((c) => c.name).sort()).toEqual(['Live group', 'Removed group']);
  });
});
