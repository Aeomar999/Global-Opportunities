import { jest } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { User, SavedItem, AuditLog, UserTombstone } from '../src/models/User.js';
import { SeekerProfile, HirerAccount } from '../src/models/Profiles.js';
import { Opportunity, Applicant, Event, EventAttendee, CompanyVerification, VerificationDoc } from '../src/models/Platform.js';
import { Channel, ChannelPost, CommunityMembership } from '../src/models/Community.js';
import { deleteAccount } from '../src/lib/account-deletion.js';

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
    const session = await login(EMAIL, PASSWORD);

    const res = await deleteMe(session.body.data.token, { password: PASSWORD, confirmation: CONFIRMATION });

    expect(res.status).toBe(200);
    expect(await findPersonalData()).toEqual([]);

    const tombstone = await UserTombstone.findOne({ userId: user._id }).lean();
    expect(tombstone).toMatchObject({ status: 'completed', mediaDeleted: true });
    expect(tombstone.emailHash).toMatch(/^[0-9a-f]{64}$/);

    const post = await ChannelPost.findOne({ channelId: channel._id }).lean();
    expect(post).toMatchObject({ authorName: 'Deleted User', authorId: null, body: 'Hello' });
    expect(await Channel.countDocuments({ _id: channel._id })).toBe(1);
    expect(await Opportunity.countDocuments({ _id: opportunity._id })).toBe(1);

    expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${session.body.data.token}`)).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: session.body.data.refreshToken })).status).toBe(401);
    expect((await login(EMAIL, PASSWORD)).status).toBe(401);
  });

  it('closes live postings and removes company records for a hirer', async () => {
    const hirer = await User.create({ name: 'Kofi Boateng', email: 'kofi@example.com', role: 'hirer', passwordHash: await bcrypt.hash(PASSWORD, 12) });
    const account = await HirerAccount.create({ userId: hirer._id, companyName: 'Boateng Ltd', industry: 'Technology', location: 'Accra', recruiterPhone: '+233209999999' });
    const live = await Opportunity.create({ ...opportunityFields, createdBy: hirer._id, hirerId: account._id, moderationStatus: 'published', vetted: true });
    await CompanyVerification.create({ hirerId: account._id, name: 'Boateng Ltd', recruiterEmail: 'kofi@example.com' });
    await VerificationDoc.create({ companyId: account._id, key: 'certificate', fileName: 'certificate.pdf' });
    const session = await login('kofi@example.com', PASSWORD);

    const res = await deleteMe(session.body.data.token, { password: PASSWORD, confirmation: CONFIRMATION });

    expect(res.status).toBe(200);
    expect((await Opportunity.findById(live._id).lean()).moderationStatus).toBe('closed');
    expect(await HirerAccount.countDocuments()).toBe(0);
    expect(await CompanyVerification.countDocuments()).toBe(0);
    expect(await VerificationDoc.countDocuments()).toBe(0);
  });

  it('rejects a wrong password with 400 and deletes nothing', async () => {
    const { user } = await seedSeeker();
    const session = await login(EMAIL, PASSWORD);

    const res = await deleteMe(session.body.data.token, { password: 'WrongPassw0rd-z', confirmation: CONFIRMATION });

    expect(res.status).toBe(400);
    expect(await SeekerProfile.countDocuments({ userId: user._id })).toBe(1);
    expect(await UserTombstone.countDocuments()).toBe(0);
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
