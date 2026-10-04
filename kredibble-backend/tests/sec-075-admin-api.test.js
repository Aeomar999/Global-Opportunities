import request from 'supertest';
import { app } from '../src/app.js';
import { User, StaffMember, AuditLog } from '../src/models/User.js';
import { SeekerProfile, HirerAccount } from '../src/models/Profiles.js';
import { Event, Opportunity, CompanyVerification, VerificationDoc, Grant } from '../src/models/Platform.js';
import { Channel, ChannelPost, Report } from '../src/models/Community.js';
import { Article } from '../src/models/Content.js';
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

describe('SEC-075: admin data routes', () => {
  it('lists seekers with the owner\'s name and email', async () => {
    const cookie = adminCookie(await createAdmin());
    const user = await User.create({ name: 'Ama Mensah', email: 'ama@example.com', role: 'seeker', passwordHash: 'x' });
    await SeekerProfile.create({ userId: user._id, profession: 'Engineer', country: 'Ghana' });

    const res = await get('/admin/seekers', cookie);

    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ page: 1, total: 1 });
    expect(res.body.data[0]).toMatchObject({
      name: 'Ama Mensah', email: 'ama@example.com', profession: 'Engineer', userId: String(user._id),
    });
    expect(res.body.data[0].user).toMatchObject({ name: 'Ama Mensah', email: 'ama@example.com' });
  });

  it('finds seekers by the owner\'s name and filters by verified', async () => {
    const cookie = adminCookie(await createAdmin());
    const ama = await User.create({ name: 'Ama Mensah', email: 'ama@example.com', role: 'seeker', passwordHash: 'x' });
    const kofi = await User.create({ name: 'Kofi Owusu', email: 'kofi@example.com', role: 'seeker', passwordHash: 'x' });
    await SeekerProfile.create({ userId: ama._id, profession: 'Engineer', verified: true });
    await SeekerProfile.create({ userId: kofi._id, profession: 'Designer', verified: false });

    const byName = await get('/admin/seekers?q=ama%20mens', cookie);
    const unverified = await get('/admin/seekers?verified=false', cookie);

    expect(byName.body.data.map((s) => s.name)).toEqual(['Ama Mensah']);
    expect(unverified.body.data.map((s) => s.name)).toEqual(['Kofi Owusu']);
  });

  it('returns one seeker with the same shape', async () => {
    const cookie = adminCookie(await createAdmin());
    const user = await User.create({ name: 'Ama Mensah', email: 'ama@example.com', role: 'seeker', passwordHash: 'x' });
    const profile = await SeekerProfile.create({ userId: user._id, profession: 'Engineer' });

    const res = await get(`/admin/seekers/${profile._id}`, cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: String(profile._id), name: 'Ama Mensah', email: 'ama@example.com' });
  });

  it('lists hirers with verification status and posting count', async () => {
    const cookie = adminCookie(await createAdmin());
    const user = await User.create({ name: 'Kofi Boateng', email: 'kofi@example.com', role: 'hirer', passwordHash: 'x' });
    const account = await HirerAccount.create({ userId: user._id, companyName: 'Boateng Ltd', industry: 'Tech', location: 'Accra' });
    const verification = await CompanyVerification.create({ hirerId: account._id, name: 'Boateng Ltd', overallStatus: 'pending' });
    const posting = { title: 'Engineer', type: 'job', company: 'Boateng Ltd', location: 'Accra', description: 'Build' };
    await Opportunity.create({ ...posting, hirerId: user._id });
    await Opportunity.create({ ...posting, hirerId: user._id });

    const res = await get('/admin/hirers', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({
      companyName: 'Boateng Ltd', name: 'Kofi Boateng', email: 'kofi@example.com',
      overallStatus: 'pending', linkedVerificationId: String(verification._id), postingsCount: 2,
    });
  });

  it('lets an admin approve a company verification with only the cookie, and audits it', async () => {
    const cookie = adminCookie(await createAdmin());
    const verification = await CompanyVerification.create({ name: 'Boateng Ltd', overallStatus: 'pending' });

    const listed = await get('/admin/verification/companies?status=pending', cookie);
    const res = await request(app)
      .patch(`/api/v1/admin/verification/companies/${verification._id}`)
      .set('Cookie', cookie)
      .send({ overallStatus: 'approved' });

    expect(listed.body.data.map((v) => v.name)).toEqual(['Boateng Ltd']);
    expect(res.status).toBe(200);
    expect((await CompanyVerification.findById(verification._id).lean()).overallStatus).toBe('approved');
    expect(await AuditLog.countDocuments({ resourceId: verification._id, outcome: 'success' })).toBeGreaterThan(0);
  });

  it('lists a verification case\'s documents', async () => {
    const cookie = adminCookie(await createAdmin());
    // HirerAccount.userId is unique, so each company needs its own owner.
    const owner = await User.create({ name: 'Kofi Boateng', email: 'kofi@example.com', role: 'hirer', passwordHash: 'x' });
    const otherOwner = await User.create({ name: 'Efua Asante', email: 'efua@example.com', role: 'hirer', passwordHash: 'x' });
    const account = await HirerAccount.create({ userId: owner._id, companyName: 'Boateng Ltd', industry: 'Tech', location: 'Accra' });
    const verification = await CompanyVerification.create({ hirerId: account._id, name: 'Boateng Ltd' });
    await VerificationDoc.create({ companyId: account._id, verificationCaseId: verification._id, key: 'certificate', fileName: 'cert.pdf' });
    await VerificationDoc.create({ companyId: account._id, key: 'tax', fileName: 'tax.pdf' });
    const other = await HirerAccount.create({ userId: otherOwner._id, companyName: 'Other Ltd', industry: 'Tech', location: 'Kumasi' });
    await VerificationDoc.create({ companyId: other._id, key: 'certificate', fileName: 'other.pdf' });

    const res = await get(`/admin/verification/companies/${verification._id}/documents`, cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.map((d) => d.fileName).sort()).toEqual(['cert.pdf', 'tax.pdf']);
    expect(res.body.meta.total).toBe(2);
  });

  it('lists a channel\'s posts with their authors', async () => {
    const cookie = adminCookie(await createAdmin());
    const author = await User.create({ name: 'Ama Mensah', email: 'ama@example.com', role: 'seeker', passwordHash: 'x' });
    const channel = await Channel.create({ name: 'Builders', category: 'Tech', visibility: 'private' });
    await ChannelPost.create({ channelId: channel._id, authorId: author._id, authorName: 'Ama Mensah', body: 'Hello' });

    const res = await get(`/admin/community/channels/${channel._id}/posts`, cookie);

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ body: 'Hello' });
    expect(res.body.data[0].authorId).toMatchObject({ name: 'Ama Mensah' });
  });

  it('serves grants, articles, staff, reports and channels', async () => {
    const admin = await createAdmin();
    const cookie = adminCookie(admin);
    await Grant.create({ title: 'Seed fund', hirer: 'Acme', sector: 'Agri', fundingPool: 1000, status: 'open' });
    // `summary` and `content` are required by the Article schema.
    await Article.create({ title: 'CV tips', category: 'Careers', summary: 'Short', content: 'Long', status: 'published' });
    await StaffMember.create({ userId: admin._id, name: 'Ada Admin', email: 'ada@example.com', role: 'Desk Lead', status: 'active' });
    await Report.create({ targetType: 'post', reason: 'spam', status: 'open' });
    await Channel.create({ name: 'Builders', category: 'Tech' });

    for (const [path, total] of [['/admin/grants?status=open', 1], ['/admin/articles?category=Careers', 1],
      ['/admin/staff?role=Desk%20Lead', 1], ['/admin/reports?status=open', 1], ['/admin/community/channels?category=Tech', 1]]) {
      const res = await get(path, cookie);
      expect([path, res.status, res.body.meta?.total]).toEqual([path, 200, total]);
    }
  });
});
