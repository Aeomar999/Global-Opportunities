import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User, EmailVerificationCode } from '../src/models/User.js';
import { hashVerificationCode } from '../src/lib/email.js';

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
  await EmailVerificationCode.deleteMany({});
});

describe('SEC-062: Email Verification limits', () => {
  it('invalidates the code after 5 failed attempts', async () => {
    await EmailVerificationCode.create({
      email: 'test62@example.com',
      codeHash: hashVerificationCode('123456'),
      expiresAt: new Date(Date.now() + 1000 * 60 * 10),
      attempts: 0
    });

    for (let i = 0; i < 5; i++) {
      const res = await request(server)
        .post('/api/auth/verification-code/verify')
        .send({ email: 'test62@example.com', code: '000000' });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Invalid verification code');
    }

    // 6th attempt
    const res6 = await request(server)
      .post('/api/auth/verification-code/verify')
      .send({ email: 'test62@example.com', code: '000000' });
    expect(res6.status).toBe(400);
    expect(res6.body.error.message).toBe('Too many failed attempts. Please request a new code.');
  });
});
