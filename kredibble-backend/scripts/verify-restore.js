#!/usr/bin/env node

/**
 * ==============================================================================
 * Database Restore Verification Script (SEC-089, D8)
 * ==============================================================================
 * Verifies restored MongoDB database integrity during disaster recovery and
 * automated monthly restore drills.
 *
 * Checks:
 * 1. Required collections exist (users, opportunities, seekers, hirers, etc.)
 * 2. Documents are populated (user count >= min, opportunity count >= min)
 * 3. Freshness: newest record createdAt/updatedAt is within maxAgeHours window
 * 4. Outputs structured JSON summary report
 * ==============================================================================
 */

import mongoose from 'mongoose';

/**
 * Programmatic verification function for unit tests and CI runners.
 *
 * @param {Object} options
 * @param {import('mongodb').Db} options.db - Connected MongoDB Db instance
 * @param {string[]} [options.requiredCollections] - Expected collections
 * @param {number} [options.minUserCount] - Minimum expected user records
 * @param {number} [options.minOpportunityCount] - Minimum expected opportunity records
 * @param {number|null} [options.maxAgeHours] - Maximum allowable age for newest record in hours
 * @returns {Promise<{ success: boolean, errors: string[], metrics: Object }>}
 */
export async function verifyRestore({
  db,
  requiredCollections = ['users', 'opportunities', 'seekers', 'hirers'],
  minUserCount = 1,
  minOpportunityCount = 1,
  maxAgeHours = null,
} = {}) {
  const errors = [];
  const metrics = {
    collectionsFound: [],
    userCount: 0,
    opportunityCount: 0,
    seekerCount: 0,
    hirerCount: 0,
    newestRecordDate: null,
    freshnessHours: null,
  };

  if (!db) {
    throw new Error('verifyRestore: db instance is required');
  }

  // 1. Check collection existence
  const existingCollectionObjects = await db.listCollections().toArray();
  const existingNames = new Set(existingCollectionObjects.map((c) => c.name));
  metrics.collectionsFound = Array.from(existingNames);

  for (const requiredName of requiredCollections) {
    if (!existingNames.has(requiredName)) {
      errors.push(`Missing required collection: '${requiredName}'`);
    }
  }

  // 2. Document count checks
  if (existingNames.has('users')) {
    metrics.userCount = await db.collection('users').countDocuments();
    if (metrics.userCount < minUserCount) {
      errors.push(`users count is ${metrics.userCount}, expected at least ${minUserCount}`);
    }
  }

  if (existingNames.has('opportunities')) {
    metrics.opportunityCount = await db.collection('opportunities').countDocuments();
    if (metrics.opportunityCount < minOpportunityCount) {
      errors.push(`opportunities count is ${metrics.opportunityCount}, expected at least ${minOpportunityCount}`);
    }
  }

  if (existingNames.has('seekers')) {
    metrics.seekerCount = await db.collection('seekers').countDocuments();
  }

  if (existingNames.has('hirers')) {
    metrics.hirerCount = await db.collection('hirers').countDocuments();
  }

  // 3. Freshness check: locate newest createdAt or updatedAt
  let newestTimestamp = 0;

  for (const collectionName of ['users', 'opportunities', 'seekers', 'hirers', 'auditlogs']) {
    if (!existingNames.has(collectionName)) continue;

    const [latestCreated] = await db
      .collection(collectionName)
      .find({ createdAt: { $exists: true } }, { projection: { createdAt: 1 } })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();

    if (latestCreated?.createdAt) {
      const time = new Date(latestCreated.createdAt).getTime();
      if (time > newestTimestamp) newestTimestamp = time;
    }

    const [latestUpdated] = await db
      .collection(collectionName)
      .find({ updatedAt: { $exists: true } }, { projection: { updatedAt: 1 } })
      .sort({ updatedAt: -1 })
      .limit(1)
      .toArray();

    if (latestUpdated?.updatedAt) {
      const time = new Date(latestUpdated.updatedAt).getTime();
      if (time > newestTimestamp) newestTimestamp = time;
    }
  }

  if (newestTimestamp > 0) {
    metrics.newestRecordDate = new Date(newestTimestamp).toISOString();
    const diffHours = (Date.now() - newestTimestamp) / (1000 * 60 * 60);
    metrics.freshnessHours = Math.max(0, Number(diffHours.toFixed(2)));

    if (maxAgeHours !== null && diffHours > maxAgeHours) {
      errors.push(
        `Newest record is ${diffHours.toFixed(1)} hours old (${metrics.newestRecordDate}), exceeding maximum permitted ${maxAgeHours} hours`
      );
    }
  } else if (maxAgeHours !== null && (metrics.userCount > 0 || metrics.opportunityCount > 0)) {
    errors.push('No timestamps (createdAt/updatedAt) found to calculate data freshness');
  }

  return {
    success: errors.length === 0,
    errors,
    metrics,
  };
}

// CLI Execution Entry Point
const isDirectExecution =
  process.argv[1] &&
  (process.argv[1].endsWith('verify-restore.js') || process.argv[1].includes('verify-restore'));

if (isDirectExecution) {
  const args = process.argv.slice(2);
  let uri = process.env.DATABASE_URL || process.env.MONGODB_URI;
  let maxAgeHours = 26;
  let minUserCount = 1;
  let minOpportunityCount = 1;

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--uri' && args[index + 1]) {
      uri = args[index + 1];
      index += 1;
    } else if (args[index] === '--max-age-hours' && args[index + 1]) {
      maxAgeHours = parseFloat(args[index + 1]);
      index += 1;
    } else if (args[index] === '--min-users' && args[index + 1]) {
      minUserCount = parseInt(args[index + 1], 10);
      index += 1;
    } else if (args[index] === '--min-opportunities' && args[index + 1]) {
      minOpportunityCount = parseInt(args[index + 1], 10);
      index += 1;
    }
  }

  if (!uri) {
    console.error('verify-restore: Error: database URI not specified via --uri or DATABASE_URL');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    const result = await verifyRestore({
      db: mongoose.connection.db,
      maxAgeHours,
      minUserCount,
      minOpportunityCount,
    });

    console.log(JSON.stringify(result, null, 2));

    await mongoose.disconnect();
    if (!result.success) {
      process.exit(1);
    }
  } catch (error) {
    console.error('verify-restore: Fatal connection or execution error:', error.message);
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
    process.exit(1);
  }
}
