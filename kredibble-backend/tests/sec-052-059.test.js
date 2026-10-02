import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { signToken } from '../src/middleware/auth.js';
import { User } from '../src/models/User.js';
import { Opportunity, Applicant, Event } from '../src/models/Platform.js';
import { Channel, ChannelPost } from '../src/models/Community.js';

const AUTH_BEARER = (token) => ['Authorization', `Bearer ${token}`];

const makeUser = async ({ role = 'seeker', email = `user-${Date.now()}@example.com`, name = 'Test User' } = {}) => {
  const user = await User.create({ name, email, role, passwordHash: 'x', tokenVersion: 1 });
  return { user, token: signToken(user) };
};

describe('Phase 2 P1 Security Fixes (SEC-052 - SEC-057)', () => {
  let seeker1, seeker2, hirer1, hirer2, admin;

  beforeEach(async () => {
    seeker1 = await makeUser({ role: 'seeker', email: 's1@example.com' });
    seeker2 = await makeUser({ role: 'seeker', email: 's2@example.com' });
    hirer1 = await makeUser({ role: 'hirer', email: 'h1@example.com' });
    hirer2 = await makeUser({ role: 'hirer', email: 'h2@example.com' });
    admin = await makeUser({ role: 'admin', email: 'a1@example.com' });
  });

  describe('SEC-052: Token revocation', () => {
    it('rejects tokens if tokenVersion has changed', async () => {
      const u = await makeUser({ email: 't1@example.com' });
      const oldToken = u.token;
      
      await User.findByIdAndUpdate(u.user._id, { $inc: { tokenVersion: 1 } });
      
      const res = await request(app).get('/api/v1/auth/me').set(...AUTH_BEARER(oldToken));
      expect(res.statusCode).toBe(401);
      expect(res.body.error.message).toMatch(/Token revoked/);
    });
  });

  describe('SEC-054 & SEC-055: PII Leaks', () => {
    it('blocks non-admins from /api/v1/users', async () => {
      const res = await request(app).get('/api/v1/users').set(...AUTH_BEARER(seeker1.token));
      expect(res.statusCode).toBe(403);
    });
  });

  describe('SEC-056: Applicant IDOR', () => {
    let opp;
    beforeEach(async () => {
      opp = await Opportunity.create({
        type: 'jobs',
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'Remote',
        description: 'Code things',
        createdBy: hirer1.user._id,
        vetted: true,
        status: 'published',
        moderationStatus: 'approved',
        deadline: new Date(Date.now() + 86400000).toISOString()
      });
    });

    it('allows a seeker to apply and forces seekerId from token', async () => {
      const res = await request(app)
        .post(`/api/v1/opportunities/${opp._id}/applicants`)
        .set(...AUTH_BEARER(seeker1.token))
        .send({ name: 'Seeker 1', resumeUrl: 'http://resume.com', seekerId: seeker2.user._id }); 

      expect(res.statusCode).toBe(201);
      expect(res.body.data.seekerId.toString()).toBe(seeker1.user._id.toString());
    });

    it('prevents hirer2 from reading applicants for hirer1s opportunity', async () => {
      const res = await request(app)
        .get(`/api/v1/opportunities/${opp._id}/applicants`)
        .set(...AUTH_BEARER(hirer2.token));

      expect(res.statusCode).toBe(403);
    });

    it('prevents seeker2 from patching seeker1s application', async () => {
      const applicant = await Applicant.create({ opportunityId: opp._id, seekerId: seeker1.user._id, name: 'S1' });
      
      const res = await request(app)
        .patch(`/api/v1/applicants/${applicant._id}`)
        .set(...AUTH_BEARER(seeker2.token))
        .send({ name: 'Hacked name' });

      expect(res.statusCode).toBe(403);
    });

    it('allows hirer1 to patch the application status', async () => {
      const applicant = await Applicant.create({ opportunityId: opp._id, seekerId: seeker1.user._id, name: 'S1' });
      
      const res = await request(app)
        .patch(`/api/v1/applicants/${applicant._id}`)
        .set(...AUTH_BEARER(hirer1.token))
        .send({ status: 'rejected' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe('rejected');
    });
  });

  describe('SEC-057: Community IDOR', () => {
    let channel, post;
    beforeEach(async () => {
      channel = await Channel.create({
        name: 'General',
        category: 'Discussion',
        createdBy: seeker1.user._id
      });
      post = await ChannelPost.create({
        channelId: channel._id,
        authorName: seeker1.user.name,
        authorId: seeker1.user._id,
        body: 'Hello world',
        title: 'Title'
      });
    });

    it('allows seeker1 to update their own channel', async () => {
      const res = await request(app)
        .patch(`/api/v1/community/channels/${channel._id}`)
        .set(...AUTH_BEARER(seeker1.token))
        .send({ bio: 'New bio' });
        
      expect(res.statusCode).toBe(200);
      expect(res.body.data.bio).toBe('New bio');
    });

    it('prevents seeker2 from updating seeker1s channel', async () => {
      const res = await request(app)
        .patch(`/api/v1/community/channels/${channel._id}`)
        .set(...AUTH_BEARER(seeker2.token))
        .send({ bio: 'Hacked bio' });
        
      expect(res.statusCode).toBe(403);
    });

    it('prevents seeker2 from updating seeker1s post', async () => {
      const res = await request(app)
        .patch(`/api/v1/community/posts/${post._id}`)
        .set(...AUTH_BEARER(seeker2.token))
        .send({ body: 'Hacked post' });
        
      expect(res.statusCode).toBe(403);
    });
  });
  describe('SEC-058: Verification documents IDOR', () => {
    beforeEach(async () => {
      await mongoose.connection.collection('hireraccounts').insertOne({
        _id: hirer1.user._id,
        name: 'Tech Corp'
      });
    });

    it('allows a hirer to upload documents to their own companyId', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/companies/${hirer1.user._id}/documents`)
        .set(...AUTH_BEARER(hirer1.token))
        .send({ key: 'doc1.pdf' });
      expect(res.statusCode).toBe(201);
    });

    it('prevents a hirer from uploading documents to another companyId', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/companies/${hirer1.user._id}/documents`)
        .set(...AUTH_BEARER(hirer2.token))
        .send({ key: 'doc2.pdf' });
      expect(res.statusCode).toBe(403);
    });

    it('prevents a hirer from reading documents of another companyId', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/companies/${hirer1.user._id}/documents`)
        .set(...AUTH_BEARER(hirer2.token));
      expect(res.statusCode).toBe(403);
    });
  });

  describe('SEC-059: Event bookings and capacity', () => {
    let event;
    beforeEach(async () => {
      event = await Event.create({
        title: 'Tech Meetup',
        type: 'in-person',
        dateTime: new Date(Date.now() + 86400).toISOString(),
        location: 'NYC',
        hirer: 'Tech Corp',
        capacity: 5,
        attendeesCount: 0,
        createdBy: hirer1.user._id,
        status: 'published'
      });
    });

    it('prevents booking when capacity is exceeded', async () => {
      let res = await request(app)
        .post(`/api/v1/events/${event._id}/attendees`)
        .set(...AUTH_BEARER(seeker1.token))
        .send({ quantity: 4, fullName: 'S1', email: 's1@test.com' });
      expect(res.statusCode).toBe(201);

      res = await request(app)
        .post(`/api/v1/events/${event._id}/attendees`)
        .set(...AUTH_BEARER(seeker2.token))
        .send({ quantity: 2, fullName: 'S2', email: 's2@test.com' });
      expect(res.statusCode).toBe(400);
      expect(res.body.error.message).toMatch(/capacity/i);
    });

    it('prevents non-owners from reading attendee list', async () => {
      const res = await request(app)
        .get(`/api/v1/events/${event._id}/attendees`)
        .set(...AUTH_BEARER(seeker1.token));
      expect(res.statusCode).toBe(403);
    });

    it('allows owner to read attendee list', async () => {
      const res = await request(app)
        .get(`/api/v1/events/${event._id}/attendees`)
        .set(...AUTH_BEARER(hirer1.token));
      expect(res.statusCode).toBe(200);
    });
  });

});

