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
// One Playwright suite from one IP would otherwise trip the API rate limits (see env.isE2E).
process.env.E2E_SERVER = '1';
// Never reach real third-party services from the e2e API, whatever .env holds:
// empty values make uploads answer "Cloudinary is not configured" and email a no-op.
for (const key of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'RESEND_API_KEY']) {
  process.env[key] = '';
}

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

const { Event } = await import('../src/models/Platform.js');

// Events (SEC-077 Task 5).
await Event.create({
  title: 'E2E Career Fair',
  hirer: 'E2E Holdings',
  location: 'Accra',
  dateTime: '20 Nov 2026, 10:00 AM GMT',
  capacity: 50,
  attendeesCount: 5,
  status: 'upcoming',
});

const { Grant, GrantApplication } = await import('../src/models/Platform.js');

// Grants (SEC-077 Task 6).
const grant = await Grant.create({
  title: 'E2E Seed Fund',
  hirer: 'E2E Holdings',
  sector: 'Agriculture',
  fundingPool: 10000,
  allocated: 0,
  status: 'open',
});
await GrantApplication.create({ grantId: grant._id, applicantName: 'E2E Applicant', requestedAmount: 2000 });

const { Channel, ChannelPost } = await import('../src/models/Community.js');

// Community moderation (SEC-077 Task 8).
const channel = await Channel.create({
  name: 'E2E Builders',
  category: 'Tech',
  owner: 'E2E Owner',
  followers: '12 followers',
  postsCount: 1,
});
await ChannelPost.create({
  channelId: channel._id,
  authorName: 'E2E Poster',
  body: 'E2E spam post',
  date: '04 Oct 2026',
  flagged: true,
});

const { VerificationDoc } = await import('../src/models/Platform.js');

// Verification review (SEC-077 Task 10): its own company, so approving it can't
// disturb the "E2E Holdings is pending" directory test.
const reviewer = await User.create({ name: 'E2E Verify Owner', email: 'e2e-verify@kredibble.com', role: 'hirer', passwordHash: 'x' });
const reviewAccount = await HirerAccount.create({ userId: reviewer._id, companyName: 'E2E Verify Co', industry: 'Logistics', location: 'Tema' });
const reviewCase = await CompanyVerification.create({
  hirerId: reviewAccount._id,
  name: 'E2E Verify Co',
  industry: 'Logistics',
  companySize: '11-50',
  location: 'Tema',
  website: 'https://verify.example.com',
  companyEmail: 'hello@verify.example.com',
  recruiterName: 'E2E Recruiter Two',
  recruiterRole: 'HR Lead',
  recruiterEmail: 'hr@verify.example.com',
  submittedDate: '03 Oct 2026',
  overallStatus: 'pending',
});
const { Opportunity } = await import('../src/models/Platform.js');

// Opportunity moderation (SEC-077 Task 11).
await Opportunity.create({
  title: 'E2E Pending Role',
  type: 'job',
  company: 'E2E Holdings',
  location: 'Accra',
  description: 'E2E posting description',
  workType: 'Remote',
  salary: 'GHS 5,000',
  moderationStatus: 'pending',
  vetted: false,
});

await VerificationDoc.create([
  { companyId: reviewAccount._id, verificationCaseId: reviewCase._id, key: 'businessReg', label: 'E2E Business Registration', fileName: 'registration.pdf' },
  { companyId: reviewAccount._id, verificationCaseId: reviewCase._id, key: 'orgId', label: 'E2E Organisation ID', fileName: 'org-id.pdf' },
]);

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
