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
    email: 'admin61@example.com',
    emailNormalized: 'admin61@example.com',
    passwordHash: '$2a$12$0Vmq9Y7r73XzqNej22SIa.sHaSNvNahF8aDpHB3xdngsNnRWy80LW',
    name: 'Admin 61',
    role: 'admin',
    emailVerified: true
  });
});

describe('SEC-061: NoSQL Operator Injection', () => {
  it('returns 400 for object-valued query params on /opportunities', async () => {
    const login = await request(server)
      .post('/api/auth/login')
      .send({ email: 'admin61@example.com', password: 'password123' });
    const token = login.body.data.token;

    const res = await request(server)
      .get('/api/opportunities?status[$ne]=approved')
      .set('Authorization', `Bearer ${token}`);
    
    // Express parses ?status[$ne]=approved as { status: { $ne: 'approved' } }
    // We expect it to return 400.
    expect(res.status).toBe(400);
  });
});
