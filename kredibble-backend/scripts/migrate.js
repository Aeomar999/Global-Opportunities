#!/usr/bin/env node

/**
 * Database Migration Runner (SEC-115, D2)
 *
 * Enforces ordered, idempotent, tracked schema migrations against MongoDB.
 * Applied migrations are tracked in the `_migrations` collection with execution timestamp,
 * batch number, and content checksums.
 *
 * Usage:
 *   node scripts/migrate.js [--dry-run] [--status]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { connectToDatabase } from '../src/lib/mongodb.js';
import logger from '../src/lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

/**
 * Calculates SHA256 checksum of a file.
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function computeChecksum(filePath) {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Retrieves applied and pending migrations.
 * @param {object} params
 * @param {import('mongodb').Db} params.db
 * @param {string} [params.migrationsDir]
 */
export async function getMigrationStatus({ db, migrationsDir = DEFAULT_MIGRATIONS_DIR }) {
  await db.collection('_migrations').createIndex({ name: 1 }, { unique: true });

  let files = [];
  try {
    const dirEntries = await fs.readdir(migrationsDir);
    files = dirEntries.filter((f) => f.endsWith('.js')).sort();
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { applied: [], pending: [], all: [] };
    }
    throw err;
  }

  const appliedDocs = await db.collection('_migrations').find({}).sort({ appliedAt: 1 }).toArray();
  const appliedMap = new Map(appliedDocs.map((doc) => [doc.name, doc]));

  const applied = [];
  const pending = [];

  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const checksum = await computeChecksum(fullPath);
    if (appliedMap.has(file)) {
      applied.push({
        name: file,
        appliedAt: appliedMap.get(file).appliedAt,
        batch: appliedMap.get(file).batch,
        checksum,
      });
    } else {
      pending.push({
        name: file,
        fullPath,
        checksum,
      });
    }
  }

  return { applied, pending, all: files };
}

/**
 * Runs pending migrations sequentially.
 * @param {object} params
 * @param {import('mongodb').Db} params.db
 * @param {import('mongoose')} [params.mongooseInstance]
 * @param {string} [params.migrationsDir]
 * @param {boolean} [params.dryRun]
 * @returns {Promise<{ applied: string[], skipped: string[], total: number }>}
 */
export async function runMigrations({
  db,
  mongooseInstance = mongoose,
  migrationsDir = DEFAULT_MIGRATIONS_DIR,
  dryRun = false,
}) {
  const { applied: previouslyApplied, pending } = await getMigrationStatus({ db, migrationsDir });

  const skipped = previouslyApplied.map((m) => m.name);

  if (pending.length === 0) {
    logger.info('[migrate] Database is up to date. No pending migrations.');
    return { applied: [], skipped, total: skipped.length };
  }

  logger.info({ pendingCount: pending.length, dryRun }, `[migrate] Found ${pending.length} pending migration(s)`);

  if (dryRun) {
    logger.info({ pending: pending.map((p) => p.name) }, '[migrate] Dry-run mode enabled. Skipping execution.');
    return { applied: [], skipped, total: skipped.length, pending: pending.map((p) => p.name) };
  }

  // Determine current batch number
  const lastMigration = await db.collection('_migrations').find({}).sort({ batch: -1 }).limit(1).toArray();
  const nextBatch = (lastMigration[0]?.batch || 0) + 1;

  const appliedNow = [];

  for (const { name, fullPath, checksum } of pending) {
    logger.info({ migration: name, batch: nextBatch }, `[migrate] Executing migration: ${name}...`);

    const fileUrl = pathToFileURL(fullPath).href;
    const migrationModule = await import(fileUrl);

    if (typeof migrationModule.up !== 'function') {
      throw new Error(`Migration ${name} does not export an up() function.`);
    }

    const startTime = Date.now();
    await migrationModule.up(db, mongooseInstance);
    const durationMs = Date.now() - startTime;

    await db.collection('_migrations').insertOne({
      name,
      appliedAt: new Date(),
      batch: nextBatch,
      checksum,
      durationMs,
    });

    appliedNow.push(name);
    logger.info({ migration: name, durationMs }, `[migrate] Successfully applied: ${name}`);
  }

  logger.info({ appliedCount: appliedNow.length, batch: nextBatch }, '[migrate] All pending migrations successfully applied.');
  return { applied: appliedNow, skipped, total: skipped.length + appliedNow.length };
}

// CLI execution
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const isDryRun = process.argv.includes('--dry-run');
  const isStatus = process.argv.includes('--status');

  (async () => {
    try {
      const conn = await connectToDatabase();
      const db = conn.db;

      if (isStatus) {
        const status = await getMigrationStatus({ db });
        console.log('\n=== Database Migration Status ===');
        console.log(`Applied (${status.applied.length}):`);
        for (const m of status.applied) {
          console.log(`  ✓ ${m.name} (batch: ${m.batch}, applied: ${m.appliedAt.toISOString()})`);
        }
        console.log(`\nPending (${status.pending.length}):`);
        for (const p of status.pending) {
          console.log(`  ○ ${p.name}`);
        }
        await mongoose.disconnect();
        process.exit(0);
      }

      await runMigrations({ db, dryRun: isDryRun });
      await mongoose.disconnect();
      process.exit(0);
    } catch (err) {
      logger.error({ error: err.message, stack: err.stack }, '[migrate] Migration failed!');
      try {
        await mongoose.disconnect();
      } catch {
        // ignore disconnect failure on exit
      }
      process.exit(1);
    }
  })();
}
