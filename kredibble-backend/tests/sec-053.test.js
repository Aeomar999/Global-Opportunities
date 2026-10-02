import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../src/app.js';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User, RefreshToken } from '../src/models/User.js';

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
  await RefreshToken.deleteMany({});
  
  const UserConstructor = mongoose.model('User');
  await UserConstructor.create({
    email: 'test53@example.com',
    emailNormalized: 'test53@example.com',
    passwordHash: '$2a$12$0Vmq9Y7r73XzqNej22SIa.sHaSNvNahF8aDpHB3xdngsNnRWy80LW', // 'password123'
    name: 'Test 53 User',
    role: 'seeker',
    emailVerified: true
  });
});

describe('SEC-053: Refresh Token family revocation', () => {
  it('allows two devices to refresh independently', async () => {
    const res1 = await request(server).post('/api/auth/login').send({ email: 'test53@example.com', password: 'password123' });
    expect(res1.status).toBe(200);
    const rt1 = res1.body.data.refreshToken;

    const res2 = await request(server).post('/api/auth/login').send({ email: 'test53@example.com', password: 'password123' });
    expect(res2.status).toBe(200);
    const rt2 = res2.body.data.refreshToken;

    const ref1 = await request(server).post('/api/auth/refresh').send({ refreshToken: rt1 });
    expect(ref1.status).toBe(200);

    const ref2 = await request(server).post('/api/auth/refresh').send({ refreshToken: rt2 });
    expect(ref2.status).toBe(200);
  });

  it('revokes the whole family if a token is replayed', async () => {
    const login = await request(server).post('/api/auth/login').send({ email: 'test53@example.com', password: 'password123' });
    const rt1 = login.body.data.refreshToken;

    const ref1 = await request(server).post('/api/auth/refresh').send({ refreshToken: rt1 });
    expect(ref1.status).toBe(200);
    const rt2 = ref1.body.data.refreshToken;

    const ref2 = await request(server).post('/api/auth/refresh').send({ refreshToken: rt1 });
    expect(ref2.status).toBe(401);

    const ref3 = await request(server).post('/api/auth/refresh').send({ refreshToken: rt2 });
    expect(ref3.status).toBe(401);
  });

  it('rejects malformed refresh body with 400', async () => {
    const res = await request(server).post('/api/auth/refresh').send({ refreshToken: { invalid: 'type' } });
    expect(res.status).toBe(400);
  });
});
