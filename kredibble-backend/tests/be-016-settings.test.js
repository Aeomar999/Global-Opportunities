import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from '../src/app.js';
import { User, StaffMember } from '../src/models/User.js';
import { IntegrationConfig } from '../src/models/AdminPortal.js';
import { signAdminToken, signToken } from '../src/middleware/auth.js';
import {
  encryptSecret,
  decryptSecret,
  normalizeIntegrationKind,
  getIntegrationStatus,
  saveIntegrationSettings,
} from '../src/lib/integrations.js';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.disconnect();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

describe('BE-016: Integrations Cryptography & Model Unit Tests', () => {
  test('encryptSecret and decryptSecret perform roundtrip AES-256-GCM encryption', () => {
    const secret = 'super-secret-wp-app-pass-2026';
    const encrypted = encryptSecret(secret);

    expect(typeof encrypted).toBe('string');
    const parts = encrypted.split(':');
    expect(parts.length).toBe(3); // iv:tag:ciphertext

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(secret);
  });

  test('decryptSecret throws when payload is tampered', () => {
    const encrypted = encryptSecret('test-secret');
    const parts = encrypted.split(':');
    // Tamper with the ciphertext
    const tampered = `${parts[0]}:${parts[1]}:badbeef99`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  test('normalizeIntegrationKind handles aliases and rejects invalid kinds', () => {
    expect(normalizeIntegrationKind('wordpress')).toBe('wordpress');
    expect(normalizeIntegrationKind('WORDPRESS')).toBe('wordpress');
    expect(normalizeIntegrationKind('analytics')).toBe('analytics');
    expect(normalizeIntegrationKind('ga4')).toBe('analytics');
    expect(() => normalizeIntegrationKind('stripe')).toThrow(/invalid integration kind/i);
  });

  test('saveIntegrationSettings stores encrypted secret and preserves secret tail', async () => {
    const saved = await saveIntegrationSettings({
      kind: 'wordpress',
      identifier: 'https://example.org',
      secret: 'wp-app-pw-abcd',
    });

    expect(saved.saved).toBe(true);
    expect(saved.tail).toBe('abcd');
    expect(saved.identifier).toBe('https://example.org');

    const doc = await IntegrationConfig.findOne({ key: 'wordpress' });
    expect(doc).toBeDefined();
    expect(doc.encryptedSecret).not.toContain('wp-app-pw-abcd'); // encrypted at rest
    expect(decryptSecret(doc.encryptedSecret)).toBe('wp-app-pw-abcd');
  });

  test('getIntegrationStatus returns status without ever leaking plaintext secret', async () => {
    await saveIntegrationSettings({
      kind: 'analytics',
      identifier: '987654321',
      secret: 'ga4-secret-key-9999',
    });

    const status = await getIntegrationStatus('analytics');
    expect(status.saved).toBe(true);
    expect(status.tail).toBe('9999');
    expect(status.identifier).toBe('987654321');
    expect(JSON.stringify(status)).not.toContain('ga4-secret-key-9999');
  });
});

describe('BE-016: Integrations API Endpoints & RBAC Protection', () => {
  const createAdminUser = async (name = 'Super Admin', email = 'admin@example.com') => {
    const user = await User.create({ name, email, role: 'admin', passwordHash: 'hashed' });
    const token = signAdminToken(user);
    return { user, token };
  };

  const createStaffUser = async (name = 'Staff Member', email = 'staff@example.com', roles = ['opportunities_officer']) => {
    const user = await User.create({ name, email, role: 'seeker', passwordHash: 'hashed' });
    const staff = await StaffMember.create({
      userId: user._id,
      name,
      email,
      roles: Array.isArray(roles) ? roles : [roles],
      role: Array.isArray(roles) ? roles.join(',') : roles,
      status: 'active',
      joinedDate: '2026-01-01',
    });
    const token = signToken(user);
    return { user, staff, token };
  };

  test('GET /api/v1/admin/settings/integrations requires authentication (401)', async () => {
    const res = await request(app).get('/api/v1/admin/settings/integrations');
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/admin/settings/integrations returns 403 for non-lead non-admin staff', async () => {
    const { token } = await createStaffUser('Dan Writer', 'dan@example.com', ['opportunities_officer']);
    const res = await request(app)
      .get('/api/v1/admin/settings/integrations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  test('GET /api/v1/admin/settings/integrations succeeds for Desk Lead (200)', async () => {
    const { token } = await createStaffUser('Sarah Lead', 'lead@example.com', ['desk_lead']);
    const res = await request(app)
      .get('/api/v1/admin/settings/integrations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.wordpress).toBeDefined();
    expect(res.body.data.analytics).toBeDefined();
  });

  test('PUT /api/v1/admin/settings/integrations/:kind saves settings write-only with masked secret tail', async () => {
    const { token } = await createAdminUser();

    const res = await request(app)
      .put('/api/v1/admin/settings/integrations/wordpress')
      .set('Cookie', `kredibble_admin_token=${token}`)
      .send({
        identifier: 'https://globalopportunitydesk.com',
        secret: 'wp-secure-pass-7788',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.saved).toBe(true);
    expect(res.body.data.tail).toBe('7788');
    expect(res.body.data.identifier).toBe('https://globalopportunitydesk.com');
    // Secret itself is never in the response
    expect(JSON.stringify(res.body)).not.toContain('wp-secure-pass-7788');

    // Subsequent GET returns the configured settings
    const getRes = await request(app)
      .get('/api/v1/admin/settings/integrations')
      .set('Cookie', `kredibble_admin_token=${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.wordpress.saved).toBe(true);
    expect(getRes.body.data.wordpress.tail).toBe('7788');
    expect(getRes.body.data.wordpress.identifier).toBe('https://globalopportunitydesk.com');
    expect(JSON.stringify(getRes.body)).not.toContain('wp-secure-pass-7788');
  });

  test('POST /api/v1/admin/settings/integrations/:kind/test verifies analytics connection parameters', async () => {
    const { token } = await createAdminUser();

    // First configure analytics
    await request(app)
      .put('/api/v1/admin/settings/integrations/analytics')
      .set('Cookie', `kredibble_admin_token=${token}`)
      .send({
        identifier: '445566778',
        secret: 'analytics-api-secret-1234',
      });

    const testRes = await request(app)
      .post('/api/v1/admin/settings/integrations/analytics/test')
      .set('Cookie', `kredibble_admin_token=${token}`);

    expect(testRes.status).toBe(200);
    expect(testRes.body.data.success).toBe(true);
    expect(testRes.body.data.kind).toBe('analytics');
    expect(JSON.stringify(testRes.body)).not.toContain('analytics-api-secret-1234');
  });

  test('POST /api/v1/admin/settings/integrations/:kind/test returns failure when unconfigured', async () => {
    const { token } = await createAdminUser();

    const testRes = await request(app)
      .post('/api/v1/admin/settings/integrations/wordpress/test')
      .set('Cookie', `kredibble_admin_token=${token}`);

    expect(testRes.status).toBe(200);
    expect(testRes.body.data.success).toBe(false);
    expect(testRes.body.data.message).toMatch(/not configured/i);
  });
});

describe('BE-016: My Account Profile & Password Change Endpoints', () => {
  const createStaffAccount = async (name, email, password = 'InitialPassword123!') => {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email,
      role: 'seeker',
      passwordHash,
      tokenVersion: 1,
      notificationPreferences: {
        digest: true,
        verifications: true,
        reports: true,
        testimonials: false,
      },
    });

    const staff = await StaffMember.create({
      userId: user._id,
      name,
      email,
      roles: ['opportunities_officer'],
      role: 'opportunities_officer',
      status: 'active',
      joinedDate: '2026-01-01',
    });

    const token = signToken(user);
    return { user, staff, token, password };
  };

  test('GET /api/v1/admin/settings/account returns caller profile and preferences', async () => {
    const { token, user } = await createStaffAccount('Alice Officer', 'alice.officer@example.com');

    const res = await request(app)
      .get('/api/v1/admin/settings/account')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(user._id.toString());
    expect(res.body.data.name).toBe('Alice Officer');
    expect(res.body.data.email).toBe('alice.officer@example.com');
    expect(res.body.data.roles).toEqual(['opportunities_officer']);
    expect(res.body.data.notificationPreferences).toEqual({
      digest: true,
      verifications: true,
      reports: true,
      testimonials: false,
    });
  });

  test('PUT /api/v1/admin/settings/account updates name and notification preferences', async () => {
    const { token, user, staff } = await createStaffAccount('Bob Officer', 'bob.officer@example.com');

    const res = await request(app)
      .put('/api/v1/admin/settings/account')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Bob Updated Name',
        notificationPreferences: {
          digest: false,
          testimonials: true,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Bob Updated Name');
    expect(res.body.data.notificationPreferences.digest).toBe(false);
    expect(res.body.data.notificationPreferences.testimonials).toBe(true);

    // Verify database sync on both User and StaffMember
    const updatedUser = await User.findById(user._id);
    expect(updatedUser.name).toBe('Bob Updated Name');
    expect(updatedUser.notificationPreferences.digest).toBe(false);

    const updatedStaff = await StaffMember.findById(staff._id);
    expect(updatedStaff.name).toBe('Bob Updated Name');
  });

  test('POST /api/v1/admin/settings/password rejects incorrect current password', async () => {
    const { token } = await createStaffAccount('Charlie Officer', 'charlie@example.com', 'OldPassword123!');

    const res = await request(app)
      .post('/api/v1/admin/settings/password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'WrongPassword!',
        newPassword: 'BrandNewPassword456!',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/current password is incorrect/i);
  });

  test('POST /api/v1/admin/settings/password rejects new password identical to current', async () => {
    const { token } = await createStaffAccount('David Officer', 'david@example.com', 'SamePassword123!');

    const res = await request(app)
      .post('/api/v1/admin/settings/password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'SamePassword123!',
        newPassword: 'SamePassword123!',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/must be different/i);
  });

  test('POST /api/v1/admin/settings/password rejects new password under 8 characters', async () => {
    const { token } = await createStaffAccount('Emma Officer', 'emma@example.com', 'ValidPass123!');

    const res = await request(app)
      .post('/api/v1/admin/settings/password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'ValidPass123!',
        newPassword: 'short',
      });

    expect(res.status).toBe(400);
  });

  test('POST /api/v1/admin/settings/password successfully changes password and bumps tokenVersion', async () => {
    const { token, user } = await createStaffAccount('Frank Officer', 'frank@example.com', 'OldValidPass123!');

    const res = await request(app)
      .post('/api/v1/admin/settings/password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'OldValidPass123!',
        newPassword: 'NewValidPass789!',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);

    const refreshedUser = await User.findById(user._id).select('+passwordHash');
    expect(refreshedUser.tokenVersion).toBe(user.tokenVersion + 1);

    // Verify bcrypt hash matches new password
    const matchesNew = await bcrypt.compare('NewValidPass789!', refreshedUser.passwordHash);
    expect(matchesNew).toBe(true);

    const matchesOld = await bcrypt.compare('OldValidPass123!', refreshedUser.passwordHash);
    expect(matchesOld).toBe(false);
  });
});
