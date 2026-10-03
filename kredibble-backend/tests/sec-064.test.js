import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { env } from '../src/config/env.js';

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

describe('SEC-064: 5xx responses leak internal error messages', () => {
  it('returns generic "Internal server error" for 500s', async () => {
    // Override isDevelopment for this test
    const originalEnv = env.isDevelopment;
    env.isDevelopment = false;

    // Mock User.findOne to return something with a throwing .select()
    jest.spyOn(User, 'findOne').mockReturnValueOnce({
      select: () => { throw new Error('SUPER_SECRET_DATABASE_FAILURE_MESSAGE'); }
    });

    const res = await request(server).post('/api/auth/login').send({ email: 'test@example.com', password: 'password123' });
    
    expect(res.status).toBe(500);
    expect(res.body.error.message).not.toContain('SUPER_SECRET_DATABASE_FAILURE_MESSAGE');
    expect(res.body.error.message).toBe('Internal server error');
    
    env.isDevelopment = originalEnv;
    jest.restoreAllMocks();
  });
});
