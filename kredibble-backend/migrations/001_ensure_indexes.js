/**
 * Migration 001: Ensure Essential Database Indexes
 * Idempotently builds indexes for User, Opportunity, and Profiles models.
 */

export const id = '001_ensure_indexes';

export async function up(db, _mongoose) {
  // Ensure the _migrations collection itself has a unique index on name
  await db.collection('_migrations').createIndex({ name: 1 }, { unique: true });

  // Users collection indexes
  const usersCollection = db.collection('users');
  await usersCollection.createIndex({ email: 1 }, { unique: true });
  await usersCollection.createIndex({ role: 1 });
  await usersCollection.createIndex({ tokenVersion: 1 });

  // Opportunities collection indexes
  const oppsCollection = db.collection('opportunities');
  await oppsCollection.createIndex({ status: 1 });
  await oppsCollection.createIndex({ type: 1 });
  await oppsCollection.createIndex({ createdBy: 1 });
  await oppsCollection.createIndex({ createdAt: -1 });

  return { success: true };
}

export async function down(_db, _mongoose) {
  // Rollback helper (optional)
  return { success: true };
}
