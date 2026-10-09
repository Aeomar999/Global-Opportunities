import request from 'supertest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { SeekerProfile } from '../src/models/Profiles.js';
import { Channel, CommunityMembership, ChannelMessage } from '../src/models/Community.js';
import { Ambassador, AmbassadorRequest } from '../src/models/AdminPortal.js';
import { Notification } from '../src/models/Content.js';
import { signAdminToken, signToken } from '../src/middleware/auth.js';

const api = (path) => `/api/v1${path}`;
const bearer = (user) => ({ Authorization: `Bearer ${signToken(user)}` });
const adminCookie = (admin) => `kredibble_admin_token=${signAdminToken(admin)}`;

const createAdmin = () => User.create({ name: 'Ada Admin', email: 'ada@example.com', role: 'admin', passwordHash: 'x' });
const createSeeker = async (email = 'ama@example.com') => {
  const user = await User.create({ name: 'Ama Mensah', email, role: 'seeker', passwordHash: 'x' });
  await SeekerProfile.create({ userId: user._id, profession: 'Designer', country: 'Ghana', city: 'Accra', phone: '+233201112222' });
  return user;
};

describe('ambassador requests (user side)', () => {
  it('creates a request with a server-built snapshot, then blocks a second open request', async () => {
    const user = await createSeeker();

    const created = await request(app).post(api('/ambassador-requests')).set(bearer(user)).send({ motivation: 'I would love to represent Kredibble at my campus' });
    const again = await request(app).post(api('/ambassador-requests')).set(bearer(user)).send({ motivation: 'I would love to represent Kredibble at my campus' });
    const mine = await request(app).get(api('/ambassador-requests/me')).set(bearer(user));

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ status: 'pending', role: 'seeker', name: 'Ama Mensah', profession: 'Designer', country: 'Ghana' });
    expect(again.status).toBe(409);
    expect(mine.body.data).toMatchObject({ isAmbassador: false, request: { status: 'pending' } });
  });

  it('ignores identity fields sent in the body and rejects unknown keys', async () => {
    const user = await createSeeker();
    const noReason = await request(app).post(api('/ambassador-requests')).set(bearer(user)).send({});
    const res = await request(app).post(api('/ambassador-requests')).set(bearer(user)).send({ motivation: 'I would love to represent Kredibble at my campus', name: 'Someone Else', status: 'approved' });
    expect(noReason.status).toBe(400);
    expect(res.status).toBe(400);
    expect(await AmbassadorRequest.countDocuments()).toBe(0);
  });

  it('requires authentication and refuses admins', async () => {
    const admin = await createAdmin();
    expect((await request(app).post(api('/ambassador-requests')).send({ motivation: 'I would love to represent Kredibble at my campus' })).status).toBe(401);
    expect((await request(app).post(api('/ambassador-requests')).set(bearer(admin)).send({ motivation: 'I would love to represent Kredibble at my campus' })).status).toBe(403);
  });

  it('detects existing ambassador by email when linkedUserId is unset and blocks duplicate application', async () => {
    const user = await createSeeker('unlinked.ambassador@example.com');
    await Ambassador.create({
      fullName: 'Unlinked Ambassador',
      email: 'unlinked.ambassador@example.com',
      memberType: 'graduate',
      status: 'active',
      referralCode: 'GOD-7K2M4Q',
    });

    const res = await request(app)
      .post(api('/ambassador-requests'))
      .set(bearer(user))
      .send({ motivation: 'I would love to represent Kredibble at my campus' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/already a Kredibble ambassador/i);

    const meRes = await request(app).get(api('/ambassador-requests/me')).set(bearer(user));
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.isAmbassador).toBe(true);
  });
});

describe('ambassador requests (admin side)', () => {
  it('approves: links the registry, joins the channel, and notifies only that user', async () => {
    const admin = await createAdmin();
    const user = await createSeeker();
    const other = await createSeeker('kofi@example.com');
    const channel = await Channel.create({ name: 'Ambassadors', category: 'Ambassadors', visibility: 'private', createdBy: admin._id });
    const pending = (await request(app).post(api('/ambassador-requests')).set(bearer(user)).send({ motivation: 'I would love to represent Kredibble at my campus' })).body.data;

    const noAuth = await request(app).post(api(`/admin/ambassador-requests/${pending.id}/approve`)).send({});
    const asUser = await request(app).post(api(`/admin/ambassador-requests/${pending.id}/approve`)).set(bearer(user)).send({});
    const approved = await request(app)
      .post(api(`/admin/ambassador-requests/${pending.id}/approve`))
      .set('Cookie', adminCookie(admin))
      .send({ channelId: String(channel._id) });
    const second = await request(app).post(api(`/admin/ambassador-requests/${pending.id}/approve`)).set('Cookie', adminCookie(admin)).send({});

    expect(noAuth.status).toBe(401);
    expect(asUser.status).toBe(401);
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('approved');
    expect(second.status).toBe(409);
    expect(await Ambassador.countDocuments({ linkedUserId: user._id })).toBe(1);
    const registered = await Ambassador.findOne({ linkedUserId: user._id });
    expect(registered.referralCode).toMatch(/^GOD-[2-9A-HJ-NP-Z]{6}$/);
    expect(registered.joinedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(registered).toMatchObject({ status: 'onboarding', memberType: 'student', tier: 'ambassador' });
    expect(registered.dormantSince).toBeUndefined();
    expect((await CommunityMembership.findOne({ channelId: channel._id, userId: user._id })).status).toBe('active');

    const mineNotes = await request(app).get(api('/notifications')).set(bearer(user));
    const otherNotes = await request(app).get(api('/notifications')).set(bearer(other));
    expect(mineNotes.body.data.map((n) => n.type)).toContain('ambassador');
    expect(otherNotes.body.data.map((n) => n.type)).not.toContain('ambassador');

    const noteId = mineNotes.body.data.find((n) => n.type === 'ambassador').id;
    const marked = await request(app).post(api(`/notifications/${noteId}/read`)).set(bearer(user));
    const foreign = await request(app).post(api(`/notifications/${noteId}/read`)).set(bearer(other));
    expect(marked.status).toBe(200);
    expect(foreign.status).toBe(404);
    expect((await Notification.findById(noteId)).readAt).toBeTruthy();

    const mine = await request(app).get(api('/ambassador-requests/me')).set(bearer(user));
    expect(mine.body.data.isAmbassador).toBe(true);
  });

  it('rejects without needing a note and sends the standard message', async () => {
    const admin = await createAdmin();
    const user = await createSeeker();
    const pending = (await request(app).post(api('/ambassador-requests')).set(bearer(user)).send({ motivation: 'I would love to represent Kredibble at my campus' })).body.data;

    const detail = await request(app).get(api(`/admin/ambassador-requests/${pending.id}`)).set('Cookie', adminCookie(admin));
    const rejected = await request(app).post(api(`/admin/ambassador-requests/${pending.id}/reject`)).set('Cookie', adminCookie(admin)).send({});
    const retry = await request(app).post(api('/ambassador-requests')).set(bearer(user)).send({ motivation: 'I would love to represent Kredibble at my campus' });

    expect(detail.body.data.motivation).toBe('I would love to represent Kredibble at my campus');
    expect(detail.body.data.profile).toMatchObject({ kind: 'seeker', profession: 'Designer' });
    expect(rejected.body.data.status).toBe('rejected');
    expect(retry.status).toBe(429);
    expect(await Notification.countDocuments({ userId: user._id, type: 'ambassador' })).toBe(1);
    expect((await Notification.findOne({ userId: user._id })).message).toMatch(/unable to approve/i);
  });

  it('lists requests for admins only', async () => {
    const admin = await createAdmin();
    const user = await createSeeker();
    await request(app).post(api('/ambassador-requests')).set(bearer(user)).send({ motivation: 'I would love to represent Kredibble at my campus' });

    const listed = await request(app).get(api('/admin/ambassador-requests?status=pending')).set('Cookie', adminCookie(admin));
    const asUser = await request(app).get(api('/admin/ambassador-requests')).set(bearer(user));

    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
    expect(asUser.status).toBe(401);
  });

  it('links pre-existing ambassador by email on approval without creating a duplicate record or minting a new referral code', async () => {
    const admin = await createAdmin();
    const user = await createSeeker('manual.lead@example.com');
    // Pre-create ambassador record manually (e.g. via network registry) without linkedUserId
    const existing = await Ambassador.create({
      fullName: 'Manual Lead',
      email: 'manual.lead@example.com',
      memberType: 'staff',
      status: 'applicant',
      referralCode: 'GOD-9XY3Z2',
    });

    const pending = (await request(app)
      .post(api('/ambassador-requests'))
      .set(bearer(user))
      .send({ motivation: 'I want to link my mobile account to my ambassador role' })).body.data;

    const approved = await request(app)
      .post(api(`/admin/ambassador-requests/${pending.id}/approve`))
      .set('Cookie', adminCookie(admin))
      .send({});

    expect(approved.status).toBe(200);
    // Must NOT have created a second document
    expect(await Ambassador.countDocuments({ email: 'manual.lead@example.com' })).toBe(1);

    const linked = await Ambassador.findOne({ email: 'manual.lead@example.com' });
    expect(String(linked._id)).toBe(String(existing._id));
    expect(String(linked.linkedUserId)).toBe(String(user._id));
    expect(linked.referralCode).toBe('GOD-9XY3Z2'); // Kept original referral code
    expect(linked.memberType).toBe('staff'); // Preserved existing memberType
    expect(linked.status).toBe('onboarding');
  });
});

describe('group chat (announcements and replies)', () => {
  const setup = async () => {
    const admin = await createAdmin();
    const member = await createSeeker();
    const outsider = await createSeeker('outsider@example.com');
    const channelId = (await request(app).post(api('/admin/channels')).set('Cookie', adminCookie(admin)).send({ name: 'Ambassadors', visibility: 'private' })).body.data.id;
    await request(app).post(api(`/admin/channels/${channelId}/members`)).set('Cookie', adminCookie(admin)).send({ userId: String(member._id) });
    return { admin, member, outsider, channelId };
  };
  const adminPost = (admin, channelId, body) => request(app).post(api(`/admin/channels/${channelId}/messages`)).set('Cookie', adminCookie(admin)).send(body);
  const memberPost = (user, channelId, body) => request(app).post(api(`/community/channels/${channelId}/messages`)).set(bearer(user)).send(body);

  it('lets only admins post announcements; members and outsiders cannot', async () => {
    const { admin, member, outsider, channelId } = await setup();

    const posted = await adminPost(admin, channelId, { body: 'Welcome everyone', allowReplies: true });
    const memberTopLevel = await memberPost(member, channelId, { body: 'Hello team' });
    const outsiderPost = await memberPost(outsider, channelId, { body: 'Let me in' });
    const empty = await adminPost(admin, channelId, { body: '   ' });
    const history = await request(app).get(api(`/community/channels/${channelId}/messages`)).set(bearer(member));
    const outsiderHistory = await request(app).get(api(`/community/channels/${channelId}/messages`)).set(bearer(outsider));

    expect(posted.status).toBe(201);
    expect(posted.body.data).toMatchObject({ senderRole: 'admin', allowReplies: true, parentId: null });
    expect(memberTopLevel.status).toBe(403);
    expect(outsiderPost.status).toBe(403);
    expect(empty.status).toBe(400);
    expect(history.body.data.canPost).toBe(false);
    expect(history.body.data.posts.map((m) => m.body)).toEqual(['Welcome everyone']);
    expect(outsiderHistory.status).toBe(403);
    expect(await ChannelMessage.countDocuments({ channelId })).toBe(1);
  });

  it('lets members reply only where the admin allowed it, and the admin can switch it later', async () => {
    const { admin, member, channelId } = await setup();
    const open = (await adminPost(admin, channelId, { body: 'What did you think of the event?', allowReplies: true })).body.data;
    const closed = (await adminPost(admin, channelId, { body: 'Reminder: training is on Friday', allowReplies: false })).body.data;

    const okReply = await memberPost(member, channelId, { body: 'It was great!', parentId: open.id });
    const blocked = await memberPost(member, channelId, { body: 'Can I ask a question?', parentId: closed.id });
    const nested = await memberPost(member, channelId, { body: 'Reply to a reply', parentId: okReply.body.data.id });

    expect(okReply.status).toBe(201);
    expect(okReply.body.data).toMatchObject({ parentId: open.id, allowReplies: false });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.message).toMatch(/turned off/i);
    expect(nested.status).toBe(404);

    const turnedOn = await request(app).patch(api(`/admin/channels/${channelId}/messages/${closed.id}`)).set('Cookie', adminCookie(admin)).send({ allowReplies: true });
    const nowAllowed = await memberPost(member, channelId, { body: 'Thanks, noted', parentId: closed.id });
    const asMember = await request(app).patch(api(`/admin/channels/${channelId}/messages/${closed.id}`)).set(bearer(member)).send({ allowReplies: false });
    expect(turnedOn.body.data.allowReplies).toBe(true);
    expect(nowAllowed.status).toBe(201);
    expect(asMember.status).toBe(401);

    const adminReply = await adminPost(admin, channelId, { body: 'Glad you liked it', parentId: open.id });
    const thread = await request(app).get(api(`/community/channels/${channelId}/messages/${open.id}/replies`)).set(bearer(member));
    const list = await request(app).get(api(`/community/channels/${channelId}/messages`)).set(bearer(member));
    expect(adminReply.status).toBe(201);
    expect(thread.body.data.replies.map((r) => r.body)).toEqual(['It was great!', 'Glad you liked it']);
    expect(thread.body.data.canReply).toBe(true);
    expect(list.body.data.posts.find((p) => p.id === open.id).replyCount).toBe(2);
  });

  it('stops a removed member from reading or replying', async () => {
    const { admin, member, channelId } = await setup();
    const post = (await adminPost(admin, channelId, { body: 'Open thread', allowReplies: true })).body.data;
    await request(app).delete(api(`/admin/channels/${channelId}/members/${member._id}`)).set('Cookie', adminCookie(admin));

    const reply = await memberPost(member, channelId, { body: 'still here?', parentId: post.id });
    const read = await request(app).get(api(`/community/channels/${channelId}/messages`)).set(bearer(member));
    expect(reply.status).toBe(403);
    expect(read.status).toBe(403);
  });
});

describe('removing an approved ambassador', () => {
  it('rejects them again, removes them from the admin channel and notifies them', async () => {
    const admin = await createAdmin();
    const user = await createSeeker();
    const channel = await Channel.create({ name: 'Ambassadors', category: 'General', visibility: 'private', createdBy: admin._id });
    const own = await Channel.create({ name: 'My own group', category: 'General', visibility: 'private', createdBy: user._id });
    await CommunityMembership.create({ channelId: own._id, userId: user._id, status: 'active', role: 'admin' });
    const pending = (await request(app).post(api('/ambassador-requests')).set(bearer(user)).send({ motivation: 'I would love to represent Kredibble at my campus' })).body.data;
    await request(app).post(api(`/admin/ambassador-requests/${pending.id}/approve`)).set('Cookie', adminCookie(admin)).send({ channelId: String(channel._id) });

    const early = await request(app).post(api(`/admin/ambassador-requests/${pending.id}/revoke`)).set('Cookie', adminCookie(admin)).send({});
    const asUser = await request(app).post(api(`/admin/ambassador-requests/${pending.id}/revoke`)).set(bearer(user)).send({});
    expect(early.status).toBe(200);
    expect(early.body.data.status).toBe('rejected');
    expect(early.body.data.removedFrom).toEqual(['Ambassadors']);
    expect(asUser.status).toBe(401);

    expect((await CommunityMembership.findOne({ channelId: channel._id, userId: user._id })).status).toBe('removed');
    expect((await CommunityMembership.findOne({ channelId: own._id, userId: user._id })).status).toBe('active');
    const dormant = await Ambassador.findOne({ linkedUserId: user._id });
    expect(dormant.status).toBe('dormant');
    expect(dormant.dormantSince).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await Notification.countDocuments({ userId: user._id, title: 'Ambassador status update' })).toBe(1);

    const mine = await request(app).get(api('/ambassador-requests/me')).set(bearer(user));
    expect(mine.body.data.isAmbassador).toBe(false);
    const again = await request(app).post(api(`/admin/ambassador-requests/${pending.id}/revoke`)).set('Cookie', adminCookie(admin)).send({});
    expect(again.status).toBe(409);
  });
});

describe('channel list for members', () => {
  it('hides invite-only channels from outsiders and marks them followed for members', async () => {
    const admin = await createAdmin();
    const member = await createSeeker();
    const outsider = await createSeeker('outsider@example.com');
    const created = await request(app).post(api('/admin/channels')).set('Cookie', adminCookie(admin)).send({ name: 'G.O.D Ambassadors', visibility: 'private' });
    const channelId = created.body.data.id;
    const publicChannel = await Channel.create({ name: 'Open to all', category: 'General', visibility: 'public', createdBy: outsider._id });
    await request(app).post(api(`/admin/channels/${channelId}/members`)).set('Cookie', adminCookie(admin)).send({ userId: String(member._id) });

    const asOutsider = await request(app).get(api('/community/channels')).set(bearer(outsider));
    const asMember = await request(app).get(api('/community/channels')).set(bearer(member));

    expect(asOutsider.body.data.map((c) => c.name)).not.toContain('G.O.D Ambassadors');
    const mine = asMember.body.data.find((c) => c.id === channelId);
    expect(mine).toMatchObject({ followed: true, announcement: true });
    const open = asMember.body.data.find((c) => c.id === String(publicChannel._id));
    expect(open).toMatchObject({ followed: false, announcement: false });

    const joined = await request(app).post(api(`/community/channels/${publicChannel._id}/join-requests`)).set(bearer(member)).send({});
    const after = await request(app).get(api('/community/channels')).set(bearer(member));
    expect(joined.body.data.accepted).toBe(true);
    expect(after.body.data.find((c) => c.id === String(publicChannel._id)).followed).toBe(true);
  });
});
