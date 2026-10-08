import mongoose from 'mongoose';
import { verifyRestore } from '../scripts/verify-restore.js';

describe('SEC-089: Restore Verification Suite (verify-restore.js)', () => {
  let db;

  beforeAll(() => {
    db = mongoose.connection.db;
  });

  beforeEach(async () => {
    const collections = await db.listCollections().toArray();
    for (const col of collections) {
      await db.collection(col.name).deleteMany({});
    }
  });

  test('fails if required collections are missing', async () => {
    const result = await verifyRestore({
      db,
      requiredCollections: ['users', 'opportunities', 'seekers', 'hirers'],
      minUserCount: 1,
      minOpportunityCount: 1,
    });

    expect(result.success).toBe(false);
    expect(result.errors.some((err) => err.includes('Missing required collection'))).toBe(true);
  });

  test('fails if user count is below required minimum', async () => {
    // Create collections
    await db.createCollection('users');
    await db.createCollection('opportunities');
    await db.createCollection('seekers');
    await db.createCollection('hirers');

    await db.collection('opportunities').insertOne({
      title: 'DevOps Lead',
      createdAt: new Date(),
    });

    const result = await verifyRestore({
      db,
      requiredCollections: ['users', 'opportunities', 'seekers', 'hirers'],
      minUserCount: 1,
      minOpportunityCount: 1,
    });

    expect(result.success).toBe(false);
    expect(result.errors.some((err) => err.includes('users count is 0'))).toBe(true);
  });

  test('fails if newest record exceeds maxAgeHours', async () => {
    const staleDate = new Date(Date.now() - 40 * 60 * 60 * 1000); // 40 hours ago

    await db.collection('users').insertOne({
      email: 'verified.user@example.com',
      createdAt: staleDate,
      updatedAt: staleDate,
    });

    await db.collection('opportunities').insertOne({
      title: 'Stale Role',
      createdAt: staleDate,
      updatedAt: staleDate,
    });

    await db.collection('seekers').insertOne({
      headline: 'Bioinformatics Engineer',
      createdAt: staleDate,
    });

    await db.collection('hirers').insertOne({
      companyName: 'Global Org',
      createdAt: staleDate,
    });

    const result = await verifyRestore({
      db,
      requiredCollections: ['users', 'opportunities', 'seekers', 'hirers'],
      minUserCount: 1,
      minOpportunityCount: 1,
      maxAgeHours: 26,
    });

    expect(result.success).toBe(false);
    expect(result.errors.some((err) => err.includes('exceeding maximum permitted 26 hours'))).toBe(true);
  });

  test('passes when all collections exist, counts meet threshold, and records are fresh', async () => {
    const freshDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

    await db.collection('users').insertOne({
      email: 'dr.fresh@example.com',
      createdAt: freshDate,
      updatedAt: freshDate,
    });

    await db.collection('opportunities').insertOne({
      title: 'Senior Site Reliability Engineer',
      createdAt: freshDate,
      updatedAt: freshDate,
    });

    await db.collection('seekers').insertOne({
      headline: 'SRE Specialist',
      createdAt: freshDate,
    });

    await db.collection('hirers').insertOne({
      companyName: 'Desk Corporation',
      createdAt: freshDate,
    });

    const result = await verifyRestore({
      db,
      requiredCollections: ['users', 'opportunities', 'seekers', 'hirers'],
      minUserCount: 1,
      minOpportunityCount: 1,
      maxAgeHours: 26,
    });

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.metrics.userCount).toBe(1);
    expect(result.metrics.opportunityCount).toBe(1);
    expect(result.metrics.freshnessHours).toBeLessThanOrEqual(3);
  });
});
