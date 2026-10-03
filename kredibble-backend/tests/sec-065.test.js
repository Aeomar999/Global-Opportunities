import { jest } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { signToken } from '../src/middleware/auth.js';
import { User, SavedItem, AuditLog, UserTombstone, RefreshToken } from '../src/models/User.js';
import { SeekerProfile, HirerAccount } from '../src/models/Profiles.js';
import { Opportunity, Applicant, Event, EventAttendee, CompanyVerification, VerificationDoc } from '../src/models/Platform.js';
import { Channel, ChannelPost, CommunityMembership } from '../src/models/Community.js';
import { Testimonial } from '../src/models/AdminPortal.js';
import { deleteAccount, purgeUserData, completePendingDeletions } from '../src/lib/account-deletion.js';

const PASSWORD = 'DeleteMe-Passw0rd';
const EMAIL = 'Ama.Mensah@Example.com';
const NAME = 'Ama Mensah';
const PHONE = '+233201234567';
const CONFIRMATION = 'DELETE MY ACCOUNT';

const login = (email, password) => request(app).post('/api/v1/auth/login').send({ email, password });
const deleteMe = (token, body) =>
  request(app).delete('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).send(body);

const opportunityFields = { title: 'Engineer', type: 'job', company: 'Acme', location: 'Accra', description: 'Build things' };

/** A seeker who has touched every collection deletion has to clean up. */
const seedSeeker = async () => {
  const user = await User.create({ name: NAME, email: EMAIL, role: 'seeker', passwordHash: await bcrypt.hash(PASSWORD, 12) });
  const employer = await User.create({ name: 'Acme Recruiter', email: 'recruiter@example.com', role: 'hirer', passwordHash: 'x' });
  await SeekerProfile.create({ userId: user._id, profession: 'Engineer', phone: PHONE });
  const opportunity = await Opportunity.create({ ...opportunityFields, createdBy: employer._id, moderationStatus: 'published', vetted: true });
  await Applicant.create({ opportunityId: opportunity._id, seekerId: user._id, name: NAME, resumeUrl: 'https://res.cloudinary.com/x/cv.pdf' });
  const event = await Event.create({ title: 'Meetup', hirer: 'Acme', location: 'Accra', dateTime: '2026-11-01T10:00', capacity: 10 });
  await EventAttendee.create({ eventId: event._id, fullName: NAME, email: EMAIL.toLowerCase() });
  const channel = await Channel.create({ name: 'Ama builds', category: 'Tech', createdBy: user._id });
  await ChannelPost.create({ channelId: channel._id, authorId: user._id, authorName: NAME, body: 'Hello' });
  await CommunityMembership.create({ channelId: channel._id, userId: user._id, status: 'active' });
  await SavedItem.create({ userId: user._id, itemId: opportunity._id, itemType: 'opportunities' });
  await Testimonial.create({ name: NAME, email: EMAIL, comment: 'Kredibble helped me find work.', status: 'approved' });
  await AuditLog.create({ action: 'auth.login.failure', outcome: 'failure', metadata: { email: EMAIL, reason: 'invalid_password' } });
  return { user, opportunity, channel };
};

/** Every document in every collection that still contains the person's email, name or phone. */
const findPersonalData = async () => {
  const needles = [EMAIL.toLowerCase(), NAME.toLowerCase(), PHONE];
  const hits = [];
  for (const [name, collection] of Object.entries(mongoose.connection.collections)) {
    for (const doc of await collection.find({}).toArray()) {
      const text = JSON.stringify(doc).toLowerCase();
      for (const needle of needles) {
        if (text.includes(needle.toLowerCase())) hits.push(`${name}: ${needle}`);
      }
    }
  }
  return hits;
};

describe('SEC-065: account deletion', () => {
  it('erases personal data, keeps public content anonymised and signs the user out', async () => {
    const { user, opportunity, channel } = await seedSeeker();
    // Someone else's booking and testimonial: matched by email, so they must survive.
    const otherEvent = await Event.create({ title: 'Other meetup', hirer: 'Acme', location: 'Kumasi', dateTime: '2026-11-02T10:00', capacity: 10 });
    const otherBooking = await EventAttendee.create({ eventId: otherEvent._id, fullName: 'Kwame Asante', email: 'kwame.asante@example.com' });
    const otherTestimonial = await Testimonial.create({ name: 'Kwame Asante', email: 'kwame.asante@example.com', comment: 'Great platform.', status: 'approved' });
    const session = await login(EMAIL, PASSWORD);

    const res = await deleteMe(session.body.data.token, { password: PASSWORD, confirmation: CONFIRMATION });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
    expect(await findPersonalData()).toEqual([]);
    expect(await EventAttendee.countDocuments({ _id: otherBooking._id })).toBe(1);
    expect(await Testimonial.countDocuments({ _id: otherTestimonial._id })).toBe(1);

    const tombstone = await UserTombstone.findOne({ userId: user._id }).lean();
    expect(tombstone).toMatchObject({ status: 'completed', mediaDeleted: true });
    expect(tombstone.emailHash).toMatch(/^[0-9a-f]{64}$/);

    const post = await ChannelPost.findOne({ channelId: channel._id }).lean();
    expect(post).toMatchObject({ authorName: 'Deleted User', authorId: null, body: 'Hello' });
    expect(await Channel.countDocuments({ _id: channel._id })).toBe(1);
    expect(await Opportunity.countDocuments({ _id: opportunity._id })).toBe(1);
    // Someone else's posting is not touched.
    expect((await Opportunity.findById(opportunity._id).lean()).moderationStatus).toBe('published');
    expect(await Testimonial.countDocuments()).toBe(1);

    expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${session.body.data.token}`)).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: session.body.data.refreshToken })).status).toBe(401);
    expect((await login(EMAIL, PASSWORD)).status).toBe(401);
  });

  it('exports and closes the postings a hirer made through the API, and removes company records', async () => {
    const hirer = await User.create({ name: 'Kofi Boateng', email: 'kofi@example.com', role: 'hirer', passwordHash: await bcrypt.hash(PASSWORD, 12) });
    const account = await HirerAccount.create({ userId: hirer._id, companyName: 'Boateng Ltd', industry: 'Technology', location: 'Accra', recruiterPhone: '+233209999999' });
    await CompanyVerification.create({ hirerId: account._id, name: 'Boateng Ltd', recruiterEmail: 'kofi@example.com' });
    await VerificationDoc.create({ companyId: account._id, key: 'certificate', fileName: 'certificate.pdf' });
    const otherHirer = await User.create({ name: 'Efua Owusu', email: 'efua@example.com', role: 'hirer', passwordHash: 'x' });
    const otherLive = await Opportunity.create({ ...opportunityFields, hirerId: otherHirer._id, moderationStatus: 'published', vetted: true });
    const session = await login('kofi@example.com', PASSWORD);

    // The hirer posts through the real API, which stores hirerId and no createdBy.
    const created = await request(app)
      .post('/api/v1/opportunities')
      .set('Authorization', `Bearer ${session.body.data.token}`)
      .send(opportunityFields);
    expect(created.status).toBe(201);
    const liveId = created.body.data.id || created.body.data._id;
    await Opportunity.updateOne({ _id: liveId }, { $set: { moderationStatus: 'published', vetted: true } });

    const exported = await request(app).get('/api/v1/auth/me/export').set('Authorization', `Bearer ${session.body.data.token}`);
    expect(exported.status).toBe(200);
    expect(exported.body.opportunities.map((item) => String(item._id))).toEqual([String(liveId)]);

    const res = await deleteMe(session.body.data.token, { password: PASSWORD, confirmation: CONFIRMATION });

    expect(res.status).toBe(200);
    expect((await Opportunity.findById(liveId).lean()).moderationStatus).toBe('closed');
    expect((await Opportunity.findById(otherLive._id).lean()).moderationStatus).toBe('published');
    expect(await HirerAccount.countDocuments()).toBe(0);
    expect(await CompanyVerification.countDocuments()).toBe(0);
    expect(await VerificationDoc.countDocuments()).toBe(0);
  });

  it('keeps a private channel closed to outsiders after its creator is deleted', async () => {
    const { user } = await seedSeeker();
    const member = await User.create({ name: 'Yaw Darko', email: 'yaw@example.com', role: 'seeker', passwordHash: 'x' });
    const outsider = await User.create({ name: 'Abena Ofori', email: 'abena@example.com', role: 'seeker', passwordHash: 'x' });
    const admin = await User.create({ name: 'Site Admin', email: 'admin@example.com', role: 'admin', passwordHash: 'x' });
    const channel = await Channel.create({ name: 'Private circle', category: 'Tech', visibility: 'private', createdBy: user._id });
    await CommunityMembership.create({ channelId: channel._id, userId: member._id, status: 'active' });
    await ChannelPost.create({ channelId: channel._id, authorId: member._id, authorName: 'Yaw Darko', body: 'Members only' });
    const posts = (token) => {
      const req = request(app).get(`/api/v1/community/channels/${channel._id}/posts`);
      return token ? req.set('Authorization', `Bearer ${token}`) : req;
    };
    expect((await posts()).status).toBe(403);
    const session = await login(EMAIL, PASSWORD);

    const res = await deleteMe(session.body.data.token, { password: PASSWORD, confirmation: CONFIRMATION });

    expect(res.status).toBe(200);
    expect((await Channel.findById(channel._id).lean()).createdBy).toBeNull();
    expect((await posts()).status).toBe(403);
    expect((await posts(session.body.data.token)).status).toBe(403);
    expect((await posts(signToken(outsider))).status).toBe(403);
    expect((await posts(signToken(member))).status).toBe(200);
    expect((await posts(signToken(admin))).status).toBe(200);
  });

  it('finishes a deletion that failed part-way: 202 now, completed by the recovery run', async () => {
    const { user } = await seedSeeker();
    const session = await login(EMAIL, PASSWORD);
    const spy = jest.spyOn(SavedItem, 'deleteMany').mockRejectedValueOnce(new Error('boom'));

    const res = await deleteMe(session.body.data.token, { password: PASSWORD, confirmation: CONFIRMATION });
    spy.mockRestore();

    expect(res.status).toBe(202);
    expect(res.body.data.status).toBe('pending');
    expect((await UserTombstone.findOne({ userId: user._id }).lean()).status).toBe('pending');
    expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${session.body.data.token}`)).status).toBe(401);

    await expect(completePendingDeletions({ minAgeMs: 0 })).resolves.toEqual({ processed: 1, failed: 0 });

    expect((await UserTombstone.findOne({ userId: user._id }).lean()).status).toBe('completed');
    expect(await findPersonalData()).toEqual([]);
  });

  it('refuses to delete an admin account from the app and leaves it untouched', async () => {
    const admin = await User.create({ name: 'Site Admin', email: 'admin@example.com', role: 'admin', passwordHash: await bcrypt.hash(PASSWORD, 12) });

    const res = await deleteMe(signToken(admin), { password: PASSWORD, confirmation: CONFIRMATION });

    expect(res.status).toBe(403);
    expect(await User.findById(admin._id).lean()).toMatchObject({ role: 'admin', name: 'Site Admin', email: 'admin@example.com' });
    expect(await UserTombstone.countDocuments()).toBe(0);
  });

  it('refuses to refresh a session whose user is deleted or gone', async () => {
    await seedSeeker();
    const session = await login(EMAIL, PASSWORD);
    const user = await User.findOne({ emailNormalized: EMAIL.toLowerCase() });

    await User.updateOne({ _id: user._id }, { $set: { role: 'deleted' } });
    expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: session.body.data.refreshToken })).status).toBe(401);

    await User.deleteOne({ _id: user._id });
    expect(await RefreshToken.countDocuments({ userId: user._id })).toBe(1);
    expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: session.body.data.refreshToken })).status).toBe(401);
  });

  it('rejects a wrong password with 400 and deletes nothing', async () => {
    const { user } = await seedSeeker();
    const session = await login(EMAIL, PASSWORD);

    const res = await deleteMe(session.body.data.token, { password: 'WrongPassw0rd-z', confirmation: CONFIRMATION });

    expect(res.status).toBe(400);
    expect(await SeekerProfile.countDocuments({ userId: user._id })).toBe(1);
    expect(await UserTombstone.countDocuments()).toBe(0);
  });

  it('rejects a non-string password with 400 instead of crashing, and deletes nothing', async () => {
    const { user } = await seedSeeker();
    const session = await login(EMAIL, PASSWORD);

    for (const password of [12345678, null, { $ne: '' }, '']) {
      const res = await deleteMe(session.body.data.token, { password, confirmation: CONFIRMATION });
      expect(res.status).toBe(400);
    }

    expect(await SeekerProfile.countDocuments({ userId: user._id })).toBe(1);
    expect(await UserTombstone.countDocuments()).toBe(0);
  });

  it('rejects a missing or wrong confirmation with 400 and deletes nothing', async () => {
    const { user } = await seedSeeker();
    const session = await login(EMAIL, PASSWORD);

    for (const body of [
      { password: PASSWORD },
      { password: PASSWORD, confirmation: 'delete my account' },
      { password: PASSWORD, confirmation: true },
    ]) {
      const res = await deleteMe(session.body.data.token, body);
      expect(res.status).toBe(400);
      expect(res.text).toContain('DELETE MY ACCOUNT');
    }

    expect(await SeekerProfile.countDocuments({ userId: user._id })).toBe(1);
    expect(await UserTombstone.countDocuments()).toBe(0);
  });

  it('refuses to sign in to a deleted account, even one a failed purge left a password on', async () => {
    await User.create({ name: 'Half Erased', email: 'half.erased@example.com', role: 'deleted', passwordHash: await bcrypt.hash(PASSWORD, 12) });

    const res = await login('half.erased@example.com', PASSWORD);
    const unknown = await login('nobody@example.com', PASSWORD);

    expect(res.status).toBe(401);
    expect(res.body).toEqual(unknown.body);
  });

  it('can be run twice: the second purge neither throws nor finds anything left', async () => {
    const { user, opportunity } = await seedSeeker();
    const deleteMedia = jest.fn().mockResolvedValue(undefined);

    await deleteAccount(await User.findById(user._id), { deleteMedia });
    await expect(purgeUserData(await User.findById(user._id), { deleteMedia })).resolves.toEqual({ mediaDeleted: true });

    expect(await findPersonalData()).toEqual([]);
    expect((await Opportunity.findById(opportunity._id).lean()).moderationStatus).toBe('published');
  });

  it('asks Cloudinary to delete the user\'s files and finishes even when that fails', async () => {
    const { user } = await seedSeeker();
    const deleteMedia = jest.fn().mockRejectedValue(new Error('cloudinary down'));

    await deleteAccount(await User.findById(user._id), { deleteMedia });

    expect(deleteMedia).toHaveBeenCalledWith(String(user._id));
    expect(await UserTombstone.findOne({ userId: user._id }).lean()).toMatchObject({ status: 'completed', mediaDeleted: false });
    expect(await findPersonalData()).toEqual([]);
  });
});

describe('SEC-029: data export', () => {
  it('returns every record deletion would remove, without token hashes', async () => {
    await seedSeeker();
    const session = await login(EMAIL, PASSWORD);

    const res = await request(app).get('/api/v1/auth/me/export').set('Authorization', `Bearer ${session.body.data.token}`);

    expect(res.status).toBe(200);
    expect(res.body.seekerProfile.phone).toBe(PHONE);
    expect(res.body.applications).toHaveLength(1);
    expect(res.body.eventBookings).toHaveLength(1);
    expect(res.body.communityPosts).toHaveLength(1);
    expect(res.body.channels).toHaveLength(1);
    expect(res.body.channelMemberships).toHaveLength(1);
    expect(res.body.savedItems).toHaveLength(1);
    expect(res.body.testimonials).toHaveLength(1);
    expect(res.body.sessions).toHaveLength(1);
    expect(res.body.sessions[0]).not.toHaveProperty('tokenHash');
    // The pre-SEC-029 keys are gone; the timestamp stays.
    expect(res.body).not.toHaveProperty('refreshTokens');
    expect(res.body).not.toHaveProperty('eventAttendees');
    expect(res.body).toHaveProperty('exportedAt');
  });
});
