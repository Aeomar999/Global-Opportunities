import mongoose from 'mongoose';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { runMigrations, getMigrationStatus } from '../scripts/migrate.js';

describe('Database Migration Harness (SEC-115, D2)', () => {
  let db;

  beforeAll(() => {
    db = mongoose.connection.db;
  });

  beforeEach(async () => {
    await db.collection('_migrations').deleteMany({});
  });

  test('executes pending migrations and records them in _migrations collection', async () => {
    const statusBefore = await getMigrationStatus({ db });
    expect(statusBefore.pending.length).toBeGreaterThanOrEqual(1);
    expect(statusBefore.applied.length).toBe(0);

    const result = await runMigrations({ db });
    expect(result.applied.length).toBeGreaterThanOrEqual(1);
    expect(result.applied).toContain('001_ensure_indexes.js');

    const statusAfter = await getMigrationStatus({ db });
    expect(statusAfter.pending.length).toBe(0);
    expect(statusAfter.applied.length).toBe(result.applied.length);

    const doc = await db.collection('_migrations').findOne({ name: '001_ensure_indexes.js' });
    expect(doc).not.toBeNull();
    expect(doc.batch).toBe(1);
    expect(typeof doc.checksum).toBe('string');
  });

  test('idempotency: skips already applied migrations on re-run', async () => {
    // First run
    const firstRun = await runMigrations({ db });
    expect(firstRun.applied.length).toBeGreaterThanOrEqual(1);

    // Second run
    const secondRun = await runMigrations({ db });
    expect(secondRun.applied.length).toBe(0);
    expect(secondRun.skipped.length).toBe(firstRun.applied.length);
    expect(secondRun.skipped).toContain('001_ensure_indexes.js');

    // Verify count in collection did not increase
    const count = await db.collection('_migrations').countDocuments();
    expect(count).toBe(firstRun.applied.length);
  });

  test('dry-run mode: does not write to _migrations or execute changes', async () => {
    const dryRunResult = await runMigrations({ db, dryRun: true });
    expect(dryRunResult.pending.length).toBeGreaterThanOrEqual(1);

    const count = await db.collection('_migrations').countDocuments();
    expect(count).toBe(0);
  });

  test('aborts and rolls back when a migration throws an error', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'god-migrations-test-'));

    try {
      const failingMigrationContent = `
        export const id = '002_broken';
        export async function up() {
          throw new Error('Intentional migration failure for test');
        }
      `;
      await fs.writeFile(path.join(tempDir, '002_broken.js'), failingMigrationContent, 'utf8');

      await expect(runMigrations({ db, migrationsDir: tempDir })).rejects.toThrow(
        'Intentional migration failure for test'
      );

      // Verify broken migration is not recorded in _migrations
      const doc = await db.collection('_migrations').findOne({ name: '002_broken.js' });
      expect(doc).toBeNull();
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
