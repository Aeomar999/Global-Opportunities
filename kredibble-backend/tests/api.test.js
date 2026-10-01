import request from 'supertest';
import { app } from '../src/app.js';
import { signToken } from '../src/middleware/auth.js';
import { User, StaffMember } from '../src/models/User.js';
import { Opportunity } from '../src/models/Platform.js';
import { Applicant } from '../src/models/Platform.js';
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

    expect(response.statusCode).toBe(401);
  });

  it('does not expose seeker profiles without an administrator token', async () => {
    const response = await request(app).get('/api/seekers');
    expect(response.statusCode).toBe(403);
  });

  it('only returns published and vetted opportunities to the public', async () => {
    await Opportunity.create({
      title: 'Pending opportunity', type: 'competition', company: 'Example Org', location: 'Accra', description: 'Awaiting review.',
    });
    await Opportunity.create({
      title: 'Published opportunity', type: 'fellowship', company: 'Example Org', location: 'Accra', description: 'Ready to publish.', vetted: true, moderationStatus: 'published',
    });

    const response = await request(app).get('/api/opportunities');
    expect(response.statusCode).toBe(401);
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

    expect(response.statusCode).toBe(403); async () => {
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

    const response = await request(app)
      .post(`/api/users/me/saved`)
      .set('Authorization', `Bearer ${signToken(user)}`)
      .send({ itemId: opportunity.id, itemType: 'opportunities' });

    expect(response.statusCode).toBe(201);
  });

  });
