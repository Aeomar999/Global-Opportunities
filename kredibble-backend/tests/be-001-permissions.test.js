import request from 'supertest';
import { app } from '../src/app.js';
import { User, StaffMember, AuditLog } from '../src/models/User.js';
import { RolePermissionConfig } from '../src/models/AdminPortal.js';
import { signAdminToken, signToken } from '../src/middleware/auth.js';
import {
  ROLE_IDS,
  SCREENS,
  accessLevel,
  roleCan,
  computeGrants,
  normalizeLegacyRole,
} from '../src/lib/permissions.js';

const api = (path) => `/api/v1${path}`;

describe('BE-001: Permissions Engine Unit Logic', () => {
  it('defines 12 valid role IDs and 28 screens', () => {
    expect(ROLE_IDS).toHaveLength(12);
    expect(SCREENS).toHaveLength(28);
    expect(ROLE_IDS).toContain('super_admin');
    expect(ROLE_IDS).toContain('desk_lead');
    expect(ROLE_IDS).toContain('moderator');
    expect(ROLE_IDS).toContain('support');
    expect(ROLE_IDS).toContain('partnerships_officer');
  });

  it('super_admin has edit on all screens except team_scorecard (view)', () => {
    for (const screen of SCREENS) {
      if (screen === 'team_scorecard') {
        expect(accessLevel(['super_admin'], screen)).toBe('view');
        expect(roleCan(['super_admin'], screen, 'view')).toBe(true);
        expect(roleCan(['super_admin'], screen, 'edit')).toBe(false);
      } else {
        expect(accessLevel(['super_admin'], screen)).toBe('edit');
        expect(roleCan(['super_admin'], screen, 'edit')).toBe(true);
      }
    }
  });

  it('desk_lead has edit on all screens except team_scorecard and roles_permissions (view)', () => {
    expect(accessLevel(['desk_lead'], 'team_scorecard')).toBe('view');
    expect(accessLevel(['desk_lead'], 'roles_permissions')).toBe('view');
    expect(roleCan(['desk_lead'], 'roles_permissions', 'view')).toBe(true);
    expect(roleCan(['desk_lead'], 'roles_permissions', 'edit')).toBe(false);
    expect(accessLevel(['desk_lead'], 'partners')).toBe('edit');
  });

  it('partnerships_officer has base grants and specific partner access', () => {
    // Base grants
    expect(accessLevel(['partnerships_officer'], 'overview')).toBe('view');
    expect(accessLevel(['partnerships_officer'], 'my_scorecard')).toBe('edit');
    expect(accessLevel(['partnerships_officer'], 'settings')).toBe('edit');

    // Specific grants
    expect(accessLevel(['partnerships_officer'], 'partners')).toBe('edit');
    expect(accessLevel(['partnerships_officer'], 'network')).toBe('view');
    expect(accessLevel(['partnerships_officer'], 'leaderboard')).toBe('view');
    expect(accessLevel(['partnerships_officer'], 'monthly_report')).toBe('view');

    // Disallowed screens
    expect(accessLevel(['partnerships_officer'], 'programs')).toBeNull();
    expect(roleCan(['partnerships_officer'], 'programs', 'view')).toBe(false);

    // computeGrants dictionary
    const grants = computeGrants(['partnerships_officer']);
    expect(grants.partners).toBe('edit');
    expect(grants.network).toBe('view');
    expect(grants.overview).toBe('view');
    expect(grants.programs).toBeUndefined();
  });

  it('computes union of grants for a user with two roles', () => {
    const roles = ['partnerships_officer', 'training_officer'];
    // From partnerships_officer
    expect(roleCan(roles, 'partners', 'edit')).toBe(true);
    // From training_officer
    expect(roleCan(roles, 'programs', 'edit')).toBe(true);
    expect(roleCan(roles, 'events', 'edit')).toBe(true);
    // Neither role grants database edit
    expect(roleCan(roles, 'database', 'edit')).toBe(false);
  });

  it('evaluates editable roles (moderator, support) with custom toggles', () => {
    const customToggles = {
      Moderator: {
        verifications: false, // toggled off
        moderate: true,
        suspend: true,
        content: false,
        broadcast: true, // toggled on
        staff: false,
      },
      Support: {
        verifications: false,
        moderate: false,
        suspend: true,
        content: false,
        broadcast: false,
        staff: false,
      },
    };

    // Moderator with verifications toggled off
    expect(roleCan(['moderator'], 'verification', 'edit', customToggles)).toBe(false);
    // Moderator with broadcast toggled on gives notifications edit
    expect(roleCan(['moderator'], 'notifications', 'edit', customToggles)).toBe(true);
  });

  it('normalizes legacy role strings to valid role arrays', () => {
    expect(normalizeLegacyRole('SUPER_ADMIN')).toEqual(['super_admin']);
    expect(normalizeLegacyRole('Desk Lead')).toEqual(['desk_lead']);
    expect(normalizeLegacyRole('Partnerships Officer')).toEqual(['partnerships_officer']);
    expect(normalizeLegacyRole('Training and Capacity Development Officer')).toEqual(['training_officer']);
    expect(normalizeLegacyRole('partnerships_officer,training_officer')).toEqual([
      'partnerships_officer',
      'training_officer',
    ]);
  });
});

describe('BE-001: StaffMember Model & Multi-Role Validation', () => {
  let testUser;

  beforeEach(async () => {
    testUser = await User.create({
      name: 'Kofi Staff',
      email: `kofi-${Date.now()}@example.com`,
      role: 'seeker',
      passwordHash: 'x',
    });
  });

  it('allows creating a staff member with 1 valid role', async () => {
    const staff = await StaffMember.create({
      userId: testUser._id,
      name: testUser.name,
      email: testUser.email,
      roles: ['partnerships_officer'],
    });

    expect(staff.roles).toEqual(['partnerships_officer']);
    expect(staff.role).toBe('partnerships_officer');
  });

  it('allows creating a staff member with 2 valid roles', async () => {
    const staff = await StaffMember.create({
      userId: testUser._id,
      name: testUser.name,
      email: testUser.email,
      roles: ['partnerships_officer', 'training_officer'],
    });

    expect(staff.roles).toHaveLength(2);
    expect(staff.roles).toContain('partnerships_officer');
    expect(staff.roles).toContain('training_officer');
  });

  it('rejects creating a staff member with more than 2 roles', async () => {
    await expect(
      StaffMember.create({
        userId: testUser._id,
        name: testUser.name,
        email: testUser.email,
        roles: ['partnerships_officer', 'training_officer', 'database_officer'],
      })
    ).rejects.toThrow();
  });

  it('rejects creating a staff member with invalid role ID', async () => {
    await expect(
      StaffMember.create({
        userId: testUser._id,
        name: testUser.name,
        email: testUser.email,
        roles: ['invalid_role'],
      })
    ).rejects.toThrow();
  });
});

describe('BE-001 & BE-018: Roles & Permissions API Endpoints', () => {
  let adminUser, deskLeadUser, officerUser;
  let adminCookie, deskLeadToken, officerToken;

  beforeEach(async () => {
    await RolePermissionConfig.deleteMany({});
    await AuditLog.deleteMany({});

    adminUser = await User.create({
      name: 'Super Admin',
      email: `admin-${Date.now()}@example.com`,
      role: 'admin',
      passwordHash: 'x',
    });
    adminCookie = `kredibble_admin_token=${signAdminToken(adminUser)}`;

    deskLeadUser = await User.create({
      name: 'Ama Desk Lead',
      email: `lead-${Date.now()}@example.com`,
      role: 'seeker',
      passwordHash: 'x',
    });
    await StaffMember.create({
      userId: deskLeadUser._id,
      name: deskLeadUser.name,
      email: deskLeadUser.email,
      roles: ['desk_lead'],
      status: 'active',
    });
    deskLeadToken = signToken(deskLeadUser);

    officerUser = await User.create({
      name: 'Kwame Officer',
      email: `officer-${Date.now()}@example.com`,
      role: 'seeker',
      passwordHash: 'x',
    });
    await StaffMember.create({
      userId: officerUser._id,
      name: officerUser.name,
      email: officerUser.email,
      roles: ['partnerships_officer'],
      status: 'active',
    });
    officerToken = signToken(officerUser);
  });

  it('GET /admin/roles-permissions allows Super Admin and Desk Lead, denies other roles', async () => {
    // Super admin via cookie
    const adminRes = await request(app)
      .get(api('/admin/roles-permissions'))
      .set('Cookie', adminCookie);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data.roleIds).toEqual(ROLE_IDS);
    expect(adminRes.body.data.screens).toEqual(SCREENS);
    expect(adminRes.body.data.toggles).toBeDefined();

    // Desk lead via Bearer token
    const leadRes = await request(app)
      .get(api('/admin/roles-permissions'))
      .set('Authorization', `Bearer ${deskLeadToken}`);
    expect(leadRes.status).toBe(200);

    // Officer via Bearer token -> 403
    const officerRes = await request(app)
      .get(api('/admin/roles-permissions'))
      .set('Authorization', `Bearer ${officerToken}`);
    expect(officerRes.status).toBe(403);
  });

  it('PUT /admin/roles-permissions allows Super Admin, denies Desk Lead, logs audit trail (BE-018)', async () => {
    const nextToggles = {
      Moderator: {
        verifications: true,
        moderate: true,
        suspend: true,
        content: true, // changed
        broadcast: true, // changed
        staff: false,
      },
      Support: {
        verifications: false,
        moderate: false,
        suspend: true,
        content: false,
        broadcast: false,
        staff: false,
      },
    };

    // Desk lead cannot edit (view-only) -> 403
    const leadEditRes = await request(app)
      .put(api('/admin/roles-permissions'))
      .set('Authorization', `Bearer ${deskLeadToken}`)
      .send({ toggles: nextToggles });
    expect(leadEditRes.status).toBe(403);

    // Super admin can edit -> 200
    const adminEditRes = await request(app)
      .put(api('/admin/roles-permissions'))
      .set('Cookie', adminCookie)
      .send({ toggles: nextToggles });
    expect(adminEditRes.status).toBe(200);
    expect(adminEditRes.body.data.toggles.Moderator.content).toBe(true);

    // Verify persisted
    const fetchRes = await request(app)
      .get(api('/admin/roles-permissions'))
      .set('Cookie', adminCookie);
    expect(fetchRes.body.data.toggles.Moderator.content).toBe(true);

    // Verify AuditLog written (BE-018)
    const auditLogs = await AuditLog.find({ action: 'ROLES_PERMISSIONS_UPDATE' });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].actorId.toString()).toBe(adminUser._id.toString());
  });

  it('enforces requireScreen on admin routes: grants allowed screens, denies others with 403', async () => {
    // Partnerships officer can access /admin/partners
    const partnersRes = await request(app)
      .get(api('/admin/partners'))
      .set('Authorization', `Bearer ${officerToken}`);
    expect(partnersRes.status).toBe(200);

    // Partnerships officer cannot access /admin/programs -> 403
    const programsRes = await request(app)
      .get(api('/admin/programs'))
      .set('Authorization', `Bearer ${officerToken}`);
    expect(programsRes.status).toBe(403);
  });

  it('GET /auth/admin/me returns roles and resolved screens for active staff', async () => {
    // Super admin
    const adminMe = await request(app)
      .get(api('/auth/admin/me'))
      .set('Cookie', adminCookie);
    expect(adminMe.status).toBe(200);
    expect(adminMe.body.data.roles).toContain('super_admin');
    expect(adminMe.body.data.screens.overview).toBe('edit');
    expect(adminMe.body.data.screens.team_scorecard).toBe('view');
    expect(adminMe.body.data.screens.partners).toBe('edit');

    // Desk lead
    const leadMe = await request(app)
      .get(api('/auth/admin/me'))
      .set('Authorization', `Bearer ${deskLeadToken}`);
    expect(leadMe.status).toBe(200);
    expect(leadMe.body.data.roles).toEqual(['desk_lead']);
    expect(leadMe.body.data.screens.roles_permissions).toBe('view');
  });
});
