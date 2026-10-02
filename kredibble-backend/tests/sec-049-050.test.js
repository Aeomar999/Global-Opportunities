import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../src/models/User.js';

let mongoServer;
let server;
jest.setTimeout(60000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  await mongoose.connect(uri);
  server = app.listen(0);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  server.close();
});

beforeEach(async () => {
  await User.deleteMany({});
  
  const UserConstructor = mongoose.model('User');
  await UserConstructor.create({
    email: 'test@example.com',
    emailNormalized: 'test@example.com',
    passwordHash: '$2a$12$0Vmq9Y7r73XzqNej22SIa.sHaSNvNahF8aDpHB3xdngsNnRWy80LW', // 'password123'
    name: 'Test User',
    role: 'seeker',
    emailVerified: true
  });
  
  await UserConstructor.create({
    email: 'admin@example.com',
    emailNormalized: 'admin@example.com',
    passwordHash: '$2a$12$0Vmq9Y7r73XzqNej22SIa.sHaSNvNahF8aDpHB3xdngsNnRWy80LW', // 'password123'
    name: 'Admin User',
    role: 'admin',
    emailVerified: true
  });
});

describe('SEC-050: Account Lockout', () => {
  it('locks a user account after 5 failed login attempts', async () => {
    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      const res = await request(server)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' });
      expect([401, 429]).toContain(res.status);
    }
    
    // 6th attempt should be locked even with correct password
    const res2 = await request(server)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
      
    expect(res2.status).toBe(429);
    expect(res2.body.error.message).toMatch(/Account.*locked|Too many failed attempts/i);
    
    // Check DB
    const user = await User.findOne({ email: 'test@example.com' });
    expect(user.failedLoginAttempts).toBeGreaterThanOrEqual(5);
    expect(user.lockUntil).toBeDefined();
    expect(user.lockUntil.getTime()).toBeGreaterThan(Date.now());
  });

  it('locks an admin account after 5 failed login attempts', async () => {
    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      const res = await request(server)
        .post('/api/auth/admin/login')
        .send({ email: 'admin@example.com', password: 'wrongpassword' });
      expect([401, 429]).toContain(res.status);
    }
    
    // 6th attempt should be locked even with correct password
    const res2 = await request(server)
      .post('/api/auth/admin/login')
      .send({ email: 'admin@example.com', password: 'password123' });
      
    expect(res2.status).toBe(429);
    expect(res2.body.error.message).toMatch(/Account.*locked|Too many failed attempts/i);
    
    // Check DB
    const user = await User.findOne({ email: 'admin@example.com' });
    expect(user.failedLoginAttempts).toBeGreaterThanOrEqual(5);
    expect(user.lockUntil).toBeDefined();
    expect(user.lockUntil.getTime()).toBeGreaterThan(Date.now());
  });
});
