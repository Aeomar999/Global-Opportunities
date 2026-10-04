import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

import { jest } from '@jest/globals';

let mongoServer;

jest.setTimeout(60000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({ instance: { launchTimeout: 30000 } });
  const uri = mongoServer.getUri();
  
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  await mongoose.connect(uri);
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});
