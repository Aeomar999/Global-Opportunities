import request from 'supertest';
import { app } from '../src/app.js';
import { signToken, signAdminToken } from '../src/middleware/auth.js';
import { User, StaffMember } from '../src/models/User.js';
import { Opportunity } from '../src/models/Platform.js';
import { Applicant } from '../src/models/Platform.js';
import { Channel } from '../src/models/Community.js';
import { Ambassador, OpportunityEngagement } from '../src/models/AdminPortal.js';

describe('API Endpoints', () => {
  it('GET / should return running message', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('Kredibble API is running');
  });
  
  it('GET /api/nonexistent should return 404', async () => {
    const response = await request(app).get('/api/nonexistent');
    expect(response.statusCode).toBe(404);
  });

  it('does not allow public registration as an admin', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Untrusted Admin', email: 'untrusted-admin@example.com', password: 'password123', role: 'admin' });

    expect(response.statusCode).toBe(400);
  });

  it('protects generic staff management with the platform admin role', async () => {
    const user = await User.create({ name: 'Member', email: 'member@example.com', role: 'seeker' });
    const response = await request(app)
      .get('/api/staff')
      .set('Authorization', `Bearer ${signToken(user)}`);

    expect(response.statusCode).toBe(403);
  });

  it('does not expose seeker profiles without an administrator token', async () => {
    const response = await request(app).get('/api/seekers');
    expect(response.statusCode).toBe(401);
  });

  it('only returns published and vetted opportunities to the public', async () => {
    await Opportunity.create({
      title: 'Pending opportunity', type: 'competition', company: 'Example Org', location: 'Accra', description: 'Awaiting review.',
    });
    await Opportunity.create({
      title: 'Published opportunity', type: 'fellowship', company: 'Example Org', location: 'Accra', description: 'Ready to publish.', vetted: true, moderationStatus: 'published',
    });

    const response = await request(app).get('/api/opportunities');
    expect(response.statusCode).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].title).toBe('Published opportunity');
    expect(response.body.data[0].wordpressSync).toBeUndefined();
  });

  it('prevents a hirer from editing another hirer’s opportunity', async () => {
    const owner = await User.create({ name: 'Owner', email: 'owner@example.com', role: 'hirer' });
    const otherHirer = await User.create({ name: 'Other', email: 'other@example.com', role: 'hirer' });
    const opportunity = await Opportunity.create({
      title: 'Owned listing', type: 'competition', company: 'Example Org', location: 'Accra', description: 'Owned listing.', createdBy: owner._id,
    });

    const response = await request(app)
      .patch(`/api/opportunities/${opportunity.id}`)
      .set('Authorization', `Bearer ${signToken(otherHirer)}`)
      .send({ title: 'Changed title' });

    expect(response.statusCode).toBe(403);
  });

  it('does not expose applications to anonymous visitors', async () => {
    const opportunity = await Opportunity.create({
      title: 'Published listing', type: 'competition', company: 'Example Org', location: 'Accra', description: 'Published listing.', vetted: true, moderationStatus: 'published',
    });
    await Applicant.create({ opportunityId: opportunity._id, name: 'Applicant', resumeUrl: 'https://example.com/resume.pdf' });

    const response = await request(app).get(`/api/opportunities/${opportunity.id}/applicants`);
    expect(response.statusCode).toBe(401);
  });

  it('only lets a user manage their own saved items', async () => {
    const user = await User.create({ name: 'Owner', email: 'saved-owner@example.com', role: 'seeker' });
    const anotherUser = await User.create({ name: 'Other', email: 'saved-other@example.com', role: 'seeker' });
    const opportunity = await Opportunity.create({
      title: 'Saveable listing', type: 'competition', company: 'Example Org', location: 'Accra', description: 'Saveable listing.',
    });

    // SEC-026: there is no route that takes another user's id.
    const byId = await request(app)
      .post(`/api/users/${anotherUser.id}/saved`)
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ itemId: opportunity.id, itemType: 'opportunities' });
    expect(byId.statusCode).toBe(404);

    const saved = await request(app)
      .post('/api/users/me/saved')
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ itemId: opportunity.id, itemType: 'opportunities' });
    expect(saved.statusCode).toBe(201);
    expect(String(saved.body.data.userId)).toBe(String(user._id));

    const othersList = await request(app)
      .get('/api/users/me/saved')
      .set('Authorization', `Bearer ${signToken(anotherUser)}`);
    expect(othersList.statusCode).toBe(200);
    expect(othersList.body.data).toHaveLength(0);
  });

  it('does not allow standard opportunity writes to vet or publish a listing', async () => {
    const user = await User.create({ name: 'Hirer', email: 'hirer@example.com', role: 'hirer' });
    const response = await request(app)
      .post('/api/opportunities')
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({
        title: 'Unvetted listing',
        type: 'competition',
        company: 'Example Org',
        location: 'Accra',
        description: 'A listing that must be reviewed.',
        vetted: true,
        moderationStatus: 'published',
      });

    expect(response.statusCode).toBe(403);
    expect(response.body.error.message).toMatch(/admin opportunity API/);
  });

  it('records a valid ambassador referral on an opportunity view', async () => {
    const opportunity = await Opportunity.create({
      title: 'Tracked fellowship',
      type: 'fellowship',
      company: 'Example Org',
      location: 'Accra',
      description: 'A tracked listing.',
      referralCodeOnApply: true,
    });
    const ambassador = await Ambassador.create({
      fullName: 'Referral Ambassador',
      email: 'ambassador@example.com',
      referralCode: 'GOD-REF-001',
    });

    const response = await request(app)
      .post(`/api/opportunities/${opportunity.id}/views`)
      .send({ source: 'website', referralCode: 'god-ref-001', visitorId: 'visitor-001' });

    expect(response.statusCode).toBe(202);
    const engagement = await OpportunityEngagement.findOne({ opportunityId: opportunity._id });
    expect(String(engagement.ambassadorId)).toBe(String(ambassador._id));
    expect(engagement.visitorId).toBe('visitor-001');
  });

  it('shows a hirer their own unpublished listing but hides it from seekers', async () => {
    const hirer = await User.create({ name: 'Poster', email: 'poster@example.com', role: 'hirer' });
    const seeker = await User.create({ name: 'Looker', email: 'looker@example.com', role: 'seeker' });
    await Opportunity.create({
      title: 'Draft listing', type: 'competition', company: 'Example Org', location: 'Accra', description: 'Not yet vetted.', hirerId: hirer._id,
    });

    const asHirer = await request(app).get('/api/opportunities').set('Authorization', `Bearer ${signToken(hirer)}`);
    expect(asHirer.statusCode).toBe(200);
    expect(asHirer.body.data.map((item) => item.title)).toEqual(['Draft listing']);

    const asSeeker = await request(app).get('/api/opportunities').set('Authorization', `Bearer ${signToken(seeker)}`);
    expect(asSeeker.statusCode).toBe(200);
    expect(asSeeker.body.data).toHaveLength(0);
  });

  it('serves posts for public community groups and blocks private ones', async () => {
    const member = await User.create({ name: 'Member', email: 'poster-member@example.com', role: 'seeker' });
    const publicGroup = await Channel.create({ name: 'Open', category: 'General', visibility: 'public' });
    const privateGroup = await Channel.create({ name: 'Closed', category: 'General', visibility: 'private' });

    const posted = await request(app)
      .post(`/api/community/channels/${publicGroup.id}/posts`)
      .set('Authorization', `Bearer ${signToken(member)}`)
      .send({ body: 'Hello group', authorName: 'Spoofed name' });
    expect(posted.statusCode).toBe(201);
    expect(posted.body.data.authorName).toBe('Member');

    const listed = await request(app).get(`/api/community/channels/${publicGroup.id}/posts`);
    expect(listed.statusCode).toBe(200);
    expect(listed.body.data.map((post) => post.body)).toEqual(['Hello group']);

    const blocked = await request(app)
      .get(`/api/community/channels/${privateGroup.id}/posts`)
      .set('Authorization', `Bearer ${signToken(member)}`);
    expect(blocked.statusCode).toBe(403);
  });

  it('returns the dashboard summary fields the admin UI reads', async () => {
    const admin = await User.create({ name: 'Admin', email: 'summary-admin@example.com', role: 'admin' });
    const response = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${signAdminToken(admin)}`);

    expect(response.statusCode).toBe(200);
    for (const key of ['pendingVerifications', 'pendingOpportunities', 'activeSeekers', 'activeHirers', 'openReports', 'totalUsers', 'totalOpportunities']) {
      expect(typeof response.body.data[key]).toBe('number');
    }
  });

  it('automatically closes a partner when its pipeline stage is onboard', async () => {
    const user = await User.create({ name: 'Officer', email: 'officer@example.com', role: 'seeker' });
    await StaffMember.create({ userId: user._id, name: user.name, email: user.email, role: 'Partnerships Officer' });

    const response = await request(app)
      .post('/api/admin/partners')
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ organizationName: 'Partner Org', partnerType: 'NGO', stage: 'onboard' });

    expect(response.statusCode).toBe(201);
    expect(response.body.data.closed).toBe(true);
  });
});
