/**
 * Starts the API for the admin Playwright suite against a throwaway in-memory
 * MongoDB that holds exactly one admin account. Nothing is persisted and no real
 * database is touched, so it runs the same on a laptop and on a CI runner.
 *
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD  admin to seed (defaults match tests/admin.e2e.spec.ts)
 *   PORT                                  defaults to 4000
 *   CORS_ORIGIN                           defaults to the admin dev server, http://localhost:3000
 *
 * Test-only: it refuses to run with NODE_ENV=production.
 */
import bcrypt from 'bcryptjs';
import http from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';

if (process.env.NODE_ENV === 'production') {
  console.error('e2e-server is test-only and will not start with NODE_ENV=production');
  process.exit(1);
}

const mongo = await MongoMemoryServer.create();
// Set before the app's config loads; dotenv never overrides variables that are already set.
process.env.NODE_ENV = 'development';
process.env.DATABASE_URL = mongo.getUri();
process.env.PORT ||= '4000';
process.env.CORS_ORIGIN ||= 'http://localhost:3000';

const { app } = await import('../src/app.js');
const { connectToDatabase } = await import('../src/lib/mongodb.js');
const { User } = await import('../src/models/User.js');
const { env } = await import('../src/config/env.js');

await connectToDatabase();
await User.create({
  name: 'E2E Admin',
  email: process.env.E2E_ADMIN_EMAIL || 'test-admin@kredibble.com',
  role: 'admin',
  emailVerified: true,
  passwordHash: await bcrypt.hash(process.env.E2E_ADMIN_PASSWORD || 'Password123', 12),
});

const { SeekerProfile, HirerAccount } = await import('../src/models/Profiles.js');
const { CompanyVerification } = await import('../src/models/Platform.js');

// One of each record the dashboard's directory pages list (tests/admin.e2e.spec.ts).
const seeker = await User.create({ name: 'E2E Seeker', email: 'e2e-seeker@kredibble.com', role: 'seeker', passwordHash: 'x' });
await SeekerProfile.create({ userId: seeker._id, profession: 'Data Analyst', country: 'Ghana' });
const hirer = await User.create({ name: 'E2E Recruiter', email: 'e2e-hirer@kredibble.com', role: 'hirer', passwordHash: 'x' });
const account = await HirerAccount.create({ userId: hirer._id, companyName: 'E2E Holdings', industry: 'Finance', location: 'Accra' });
await CompanyVerification.create({ hirerId: account._id, name: 'E2E Holdings', overallStatus: 'pending' });

const { Report } = await import('../src/models/Community.js');

// Reports queue (SEC-077 Task 4).
await Report.create({
  targetType: 'post',
  targetLabel: 'E2E Reported Post',
  reporterName: 'E2E Reporter',
  reason: 'Scam / Fraud',
  details: 'E2E report details',
  date: '04 Oct 2026',
  status: 'open',
});

const server = http.createServer(app).listen(env.port, () => {
  console.log(`e2e API listening on http://localhost:${env.port}/api`);
});

const shutdown = async () => {
  server.close();
  await mongo.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
