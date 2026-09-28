import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { signToken, signAdminToken } from '../src/middleware/auth.js';
import { User } from '../src/models/User.js';
import { Opportunity, Event, EventAttendee } from '../src/models/Platform.js';
import { Candidate, SeekerProfile } from '../src/models/Profiles.js';
import { stripSensitive } from '../src/utils/http.js';

const AUTH_BEARER = (token) => ['Authorization', `Bearer ${token}`];

const makeUser = async ({ role = 'seeker', email = 'user@example.com' } = {}) => {
  const user = await User.create({ name: 'Test User', email, role, passwordHash: 'x' });
  return { user, token: signToken(user) };
};

describe('SEC-001: public registration must not mint admins', () => {
  it('rejects role: admin at the schema boundary', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Mallory', email: 'mallory@example.com', password: 'Password123', role: 'admin' });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(await User.exists({ email: 'mallory@example.com' })).toBeNull();
  });

  it('never persists an admin even if role is smuggled past validation', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Mallory', email: 'mallory2@example.com', password: 'Password123', role: 'admin' });

    if (res.statusCode === 201) {
      const created = await User.findOne({ email: 'mallory2@example.com' });
      expect(created.role).not.toBe('admin');
    }
  });

  it('still allows the legitimate public roles', async () => {
    for (const role of ['seeker', 'hirer']) {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Valid User', email: `ok-${role}@example.com`, password: 'Password123', role });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.user.role).toBe(role);
      expect(res.body.data.user.passwordHash).toBeUndefined();
    }
  });
});
describe('SEC-008: password policy enforces strength', () => {
  const strongPassword = 'Password123';
  const basePayload = { name: 'Test User', role: 'seeker' };

  it('rejects password shorter than 10 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...basePayload, email: 'short@example.com', password: 'Pass1' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toMatch(/at least 10/i);
  });

  it('rejects password longer than 128 characters', async () => {
    const longPassword = 'Aa1' + 'x'.repeat(126);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...basePayload, email: 'long@example.com', password: longPassword });
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toMatch(/at most 128/i);
  });

  it('rejects password with no lowercase letter', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...basePayload, email: 'nolower@example.com', password: 'PASSWORD123' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toMatch(/lowercase/i);
  });

  it('rejects password with no uppercase letter', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...basePayload, email: 'noupper@example.com', password: 'password123' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toMatch(/uppercase/i);
  });

  it('rejects password with no digit', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...basePayload, email: 'nodigit@example.com', password: 'Password' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toMatch(/digit/i);
  });

  it('rejects common passwords', async () => {
    for (const pwd of ['password', '123456', 'qwerty', 'admin', 'welcome']) {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...basePayload, email: `common-${pwd}@example.com`, password: pwd });
      expect(res.statusCode).toBe(400);
      expect(res.body.error.message).toMatch(/too common/i);
    }
  });

  it('accepts a strong password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...basePayload, email: 'strong@example.com', password: strongPassword });
    expect(res.statusCode).toBe(201);
  });

  it('accepts valid passwords for both seeker and hirer roles', async () => {
    for (const role of ['seeker', 'hirer']) {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...basePayload, email: `ok-${role}@example.com`, password: strongPassword, role });
      expect(res.statusCode).toBe(201);
      expect(res.body.data.user.role).toBe(role);
    }
  });
});

describe('SEC-002: collection routes must require authentication', () => {
  // Previously a hard-coded `protectedPaths` array. It is replaced by the live
  // route-manifest sweep below, which covers these plus every route added since.
  it('GET /api/dashboard/summary is 401 without a token', async () => {
    const res = await request(app).get('/api/dashboard/summary');
    expect(res.statusCode).toBe(401);
  });

  it('rejects a garbage bearer token', async () => {
    const res = await request(app).get('/api/users').set(...AUTH_BEARER('not.a.real.token'));
    expect(res.statusCode).toBe(401);
  });

  it('does not leak password hashes to an authenticated non-admin reader', async () => {
    await makeUser({ email: 'reader@example.com' });
    const { token } = await makeUser({ email: 'reader2@example.com' });

    const res = await request(app).get('/api/users').set(...AUTH_BEARER(token));

    expect(res.statusCode).toBe(200);
    for (const row of res.body.data) {
      expect(row.passwordHash).toBeUndefined();
    }
  });
});

describe('SEC-003: dashboard summary is admin-only', () => {
  it('is 401 for an authenticated non-admin (user token rejected by admin verifier)', async () => {
    const { token } = await makeUser({ email: 'seeker@example.com' });
    const res = await request(app).get('/api/dashboard/summary').set(...AUTH_BEARER(token));
    expect(res.statusCode).toBe(401);
  });

  it('is 200 for an admin', async () => {
    const { user } = await makeUser({ role: 'admin', email: 'admin@example.com' });
    const adminToken = signAdminToken(user);
    const res = await request(app).get('/api/dashboard/summary').set(...AUTH_BEARER(adminToken));
    expect(res.statusCode).toBe(200);
  });
});

describe('SEC-007: mass assignment cannot escalate privilege', () => {
  it('an anonymous caller cannot create a user', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ name: 'Ghost', email: 'ghost@example.com', role: 'admin' });

    expect(res.statusCode).toBe(401);
    expect(await User.exists({ email: 'ghost@example.com' })).toBeNull();
  });

  it('a non-admin cannot write role or passwordHash on another user', async () => {
    const victim = await makeUser({ email: 'victim@example.com' });
    const { token } = await makeUser({ email: 'attacker@example.com' });

    const res = await request(app)
      .patch(`/api/users/${victim.user.id}`)
      .set(...AUTH_BEARER(token))
      .send({ role: 'admin', passwordHash: 'attacker-chosen-hash' });

    if (res.statusCode === 200) {
      const after = await User.findById(victim.user.id);
      expect(after.role).not.toBe('admin');
      expect(after.passwordHash).toBe('x');
    }
  });

  it('a non-admin cannot inject moderation status on an opportunity', async () => {
    const { token } = await makeUser({ role: 'hirer', email: 'poster@example.com' });

    const res = await request(app)
      .post('/api/opportunities')
      .set(...AUTH_BEARER(token))
      .send({
        title: 'Suspicious role',
        company: 'Acme',
        type: 'internship',
        moderationStatus: 'approved',
        applicantsCount: 9999,
      });

    if (res.statusCode === 201) {
      const created = await Opportunity.findOne({ title: 'Suspicious role' });
      expect(created.moderationStatus).not.toBe('approved');
    }
  });
});

describe('SEC-015: the global limiter cannot be bypassed via the root mount', () => {
  it('a non-/api path is rate limited like an /api path', async () => {
    const app2 = (await import('../src/app.js')).app;
    expect(app2).toBe(app);
    // The router is mounted twice (/api and /). Both must sit behind the limiter.
    const res = await request(app).get('/users');
    expect(res.statusCode).not.toBe(200);
  });
});

describe('SEC-006: production must refuse to boot on weak or shared secrets', () => {
  // Run from a temp cwd so dotenv cannot pick up the developer's local .env and
  // mask a missing variable.
  const emptyCwd = mkdtempSync(join(tmpdir(), 'kredibble-env-'));
  const envScript = resolve(process.cwd(), 'src/config/env.js');

  const runEnv = (envPatch) => {
    try {
      execFileSync(process.execPath, [envScript], {
        cwd: emptyCwd,
        env: { PATH: process.env.PATH, NODE_ENV: 'production', ...envPatch },
        stdio: 'pipe',
      });
      return { ok: true, stderr: '' };
    } catch (error) {
      return { ok: false, stderr: String(error.stderr || '') };
    }
  };

  it('throws when JWT_SECRET is absent', () => {
    const result = runEnv({ ADMIN_JWT_SECRET: 'a'.repeat(64) });
    expect(result.ok).toBe(false);
  });

  it('throws when ADMIN_JWT_SECRET is absent', () => {
    const result = runEnv({ JWT_SECRET: 'a'.repeat(64) });
    expect(result.ok).toBe(false);
  });

  it('throws when JWT_SECRET is too short', () => {
    const result = runEnv({ JWT_SECRET: 'short', ADMIN_JWT_SECRET: 'a'.repeat(64) });
    expect(result.ok).toBe(false);
  });

  it('throws when ADMIN_JWT_SECRET equals JWT_SECRET', () => {
    const shared = 'b'.repeat(64);
    const result = runEnv({ JWT_SECRET: shared, ADMIN_JWT_SECRET: shared });
    expect(result.ok).toBe(false);
  });

  it('boots when both secrets are strong and distinct', () => {
    const result = runEnv({
      JWT_SECRET: 'c'.repeat(64),
      ADMIN_JWT_SECRET: 'd'.repeat(64),
      DATABASE_URL: 'mongodb://127.0.0.1:27017/kredibble',
    });
    expect(result.stderr).not.toContain('CRITICAL SECURITY ERROR');
  });

  it('never hardcodes a secret fallback for a missing variable', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/config/env.js'), 'utf8');
    expect(source).not.toMatch(/jwtSecret:\s*process\.env\.JWT_SECRET\s*\|\|\s*'/i);
    expect(source).not.toMatch(/'[0-9a-f]{64}'/i);
  });
});

describe('SEC-004: the realtime transport must not be an unauthenticated wildcard', () => {
  const socketSource = () => readFileSync(resolve(process.cwd(), 'src/socket.js'), 'utf8');

  it('does not accept any origin', () => {
    expect(socketSource()).not.toMatch(/origin:\s*['"]\*['"]/);
  });

  it('authenticates the handshake before accepting a connection', () => {
    const source = socketSource();
    expect(source).toContain('io.use(');
    expect(source).toContain('jwt.verify');
  });

  it('pins join_user to the authenticated identity', () => {
    // Horizontal privilege escalation: without this a caller subscribes to
    // someone else's direct messages just by sending their user id.
    expect(socketSource()).toMatch(/String\(userId\)\s*!==\s*auth\.sub/);
  });

  it('shares one CORS authority with the HTTP layer', () => {
    const source = socketSource();
    expect(source).toContain('socketCorsOptions');
    const corsSource = readFileSync(resolve(process.cwd(), 'src/lib/cors.js'), 'utf8');
    expect(corsSource).toContain('isAllowedOrigin');
  });

  it('does not blanket-allow multi-tenant deploy wildcards (SEC-022)', () => {
    const corsSource = readFileSync(resolve(process.cwd(), 'src/lib/cors.js'), 'utf8');
    expect(corsSource).not.toContain("endsWith('.vercel.app')");
    expect(corsSource).not.toContain("endsWith('.onrender.com')");
  });
});

describe('SEC-022: search routes are reachable and not a ReDoS vector', () => {
  it('matches candidates/search instead of treating "search" as an id', async () => {
    await Candidate.create({
      name: 'Regex Victim',
      profession: 'Engineer',
      skills: 'nodejs',
      location: 'Accra',
      university: 'KNUST',
    });

    const { token } = await makeUser({ role: 'hirer', email: 'search-hirer@example.com' });
    const res = await request(app)
      .get('/api/candidates/search')
      .set(...AUTH_BEARER(token))
      .query({ q: 'Regex Victim' });

    // A shadowed route would surface as 400/404 from findById('search').
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('does not execute regex metacharacters supplied as a query', async () => {
    const { token } = await makeUser({ role: 'hirer', email: 'redos-hirer@example.com' });

    // `(a+)+b` against an unescaped $regex is catastrophic backtracking; escaped
    // it is a literal substring search that cannot blow up.
    const res = await request(app)
      .get('/api/candidates/search')
      .set(...AUTH_BEARER(token))
      .query({ q: '(a+)+b' });

    expect(res.statusCode).toBe(200);
  });

  it('still requires authentication for search', async () => {
    const res = await request(app).get('/api/candidates/search');
    expect(res.statusCode).toBe(401);
  });
});

describe('SEC-007: the attendee counter cannot be driven negative or inflated', () => {
  const bookAs = async (token, body) => {
    const event = await Event.create({
      title: 'Hiring Fair',
      hirer: new mongoose.Types.ObjectId(),
      location: 'Accra',
      dateTime: new Date(Date.now() + 86_400_000),
      capacity: 100,
      attendeesCount: 10,
    });
    const res = await request(app)
      .post(`/api/events/${event._id}/attendees`)
      .set(...AUTH_BEARER(token))
      .send({ fullName: 'Ama Boateng', email: 'ama@example.com', ...body });
    return { res, event };
  };

  it('clamps a negative quantity to 1 instead of decrementing', async () => {
    const { token } = await makeUser({ role: 'seeker', email: 'booker@example.com' });
    const { res, event } = await bookAs(token, { quantity: -5 });

    expect(res.statusCode).toBe(201);
    const stored = await EventAttendee.findById(res.body.data.id);
    expect(stored.quantity).toBe(1);
    const updated = await Event.findById(event._id);
    expect(updated.attendeesCount).toBe(11);
  });

  it('caps an inflated quantity', async () => {
    const { token } = await makeUser({ role: 'seeker', email: 'booker2@example.com' });
    const { res, event } = await bookAs(token, { quantity: 1_000_000 });

    expect(res.statusCode).toBe(201);
    const updated = await Event.findById(event._id);
    expect(updated.attendeesCount).toBeLessThanOrEqual(20);
  });

  it('ignores fields outside the allowlist', async () => {
    const { token } = await makeUser({ role: 'seeker', email: 'booker3@example.com' });
    const { res } = await bookAs(token, { status: 'vip', attendeesCount: 999 });

    expect(res.statusCode).toBe(201);
    const stored = await EventAttendee.findById(res.body.data.id);
    expect(stored.attendeesCount).toBeUndefined();
  });
});

describe('SEC-002: record-level ownership, not just role-level permission', () => {
  // A role policy answers "may this ROLE write?". It cannot answer "is this THEIR
  // record?". Before this, any authenticated user could PATCH or DELETE another
  // user's seeker profile by guessing/reading its id.

  const makeSeekerProfile = async (email) => {
    const { token, user } = await makeUser({ role: 'seeker', email });
    await SeekerProfile.create({ userId: user._id, profession: 'Nurse', city: 'Accra' });
    const profile = await SeekerProfile.findOne({ userId: user._id });
    return { token, user, profile };
  };

  it('lets an owner update their own seeker profile', async () => {
    const { token, profile } = await makeSeekerProfile('owner@example.com');
    const res = await request(app)
      .patch(`/api/seekers/${profile._id}`)
      .set(...AUTH_BEARER(token))
      .send({ profession: 'Midwife' });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.profession).toBe('Midwife');
  });

  it('rejects a non-owner mutating another seeker profile', async () => {
    const victim = await makeSeekerProfile('victim@example.com');
    const attacker = await makeSeekerProfile('attacker@example.com');

    const res = await request(app)
      .patch(`/api/seekers/${victim.profile._id}`)
      .set(...AUTH_BEARER(attacker.token))
      .send({ profession: 'Hacked' });

    expect(res.statusCode).toBe(403);
    const unchanged = await SeekerProfile.findById(victim.profile._id);
    expect(unchanged.profession).toBe('Nurse');
  });

  it('rejects a non-owner deleting another seeker profile', async () => {
    const victim = await makeSeekerProfile('victim2@example.com');
    const attacker = await makeSeekerProfile('attacker2@example.com');

    const res = await request(app)
      .delete(`/api/seekers/${victim.profile._id}`)
      .set(...AUTH_BEARER(attacker.token));

    expect(res.statusCode).toBe(403);
    expect(await SeekerProfile.findById(victim.profile._id)).not.toBeNull();
  });

  it('rejects a hirer deleting another hirers opportunity', async () => {
    // Deletion is allowed for the HIRER role generally, so only the ownership
    // check can stop this. (The seeker delete case above is already blocked by
    // the role policy alone, which is why it is not sufficient evidence.)
    const owner = await makeUser({ role: 'hirer', email: 'del-owner@example.com' });
    const rival = await makeUser({ role: 'hirer', email: 'del-rival@example.com' });
    const opportunity = await Opportunity.create({
      hirerId: owner.user._id,
      title: 'Keep Me',
      type: 'job',
      description: 'Still here',
      company: 'Acme',
      location: 'Remote',
    });

    const res = await request(app)
      .delete(`/api/opportunities/${opportunity._id}`)
      .set(...AUTH_BEARER(rival.token));

    expect(res.statusCode).toBe(403);
    expect(await Opportunity.findById(opportunity._id)).not.toBeNull();
  });

it('lets a hirer delete their own opportunity', async () => {
    const owner = await makeUser({ role: 'hirer', email: 'del-self@example.com' });
    const opportunity = await Opportunity.create({
      hirerId: owner.user._id,
      title: 'Mine',
      type: 'job',
      description: 'Owner may remove this',
      company: 'Acme',
      location: 'Remote',
    });

    const res = await request(app)
      .delete(`/api/opportunities/${opportunity._id}`)
      .set(...AUTH_BEARER(owner.token));

    expect(res.statusCode).toBe(204);
    expect(await Opportunity.findById(opportunity._id)).toBeNull();
  });

  it('cannot create a seeker profile owned by someone else', async () => {
    const other = await makeUser({ role: 'seeker', email: 'impersonated@example.com' });
    const { token, user } = await makeUser({ role: 'seeker', email: 'spoof@example.com' });

    const res = await request(app)
      .post('/api/seekers')
      .set(...AUTH_BEARER(token))
      .send({ userId: other.user._id, profession: 'Impostor' });

    expect(res.statusCode).toBe(201);
    // The owner is taken from the token, not the body.
    expect(String(res.body.data.userId)).toBe(String(user._id));
    expect(String(res.body.data.userId)).not.toBe(String(other.user._id));
  });

it('rejects a hirer editing another hirers opportunity', async () => {
    const owner = await makeUser({ role: 'hirer', email: 'opp-owner@example.com' });
    const rival = await makeUser({ role: 'hirer', email: 'opp-rival@example.com' });

    const opportunity = await Opportunity.create({
      hirerId: owner.user._id,
      title: 'Original Title',
      type: 'job',
      company: 'Acme',
      location: 'Remote',
      description: 'Original description',
    });

    const res = await request(app)
      .patch(`/api/opportunities/${opportunity._id}`)
      .set(...AUTH_BEARER(rival.token))
      .send({ title: 'Stolen Title' });

    expect(res.statusCode).toBe(403);
    const unchanged = await Opportunity.findById(opportunity._id);
    expect(unchanged.title).toBe('Original Title');
  });

  it('still lets an admin moderate a record they do not own', async () => {
    const victim = await makeSeekerProfile('admin-target@example.com');
    const { token } = await makeUser({ role: 'admin', email: 'admin-owner@example.com' });

    const res = await request(app)
      .patch(`/api/seekers/${victim.profile._id}`)
      .set(...AUTH_BEARER(token))
      .send({ profession: 'Moderated' });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.profession).toBe('Moderated');
  });

  it('fails closed when the record has no owner recorded', async () => {
    // A legacy/orphaned document must not become writable just because the
    // owner field happens to be empty. `userId` is `required`, so the orphan is
    // inserted through the raw driver to simulate pre-existing bad data.
    const { insertedId } = await SeekerProfile.collection.insertOne({
      profession: 'Orphan',
      city: 'Accra',
    });
    const { token } = await makeUser({ role: 'seeker', email: 'orphan-toucher@example.com' });

    const res = await request(app)
      .patch(`/api/seekers/${insertedId}`)
      .set(...AUTH_BEARER(token))
      .send({ profession: 'Claimed' });

    expect(res.statusCode).toBe(403);
  });

  it('returns 404 rather than 403 for a record that does not exist', async () => {
    const { token } = await makeUser({ role: 'seeker', email: 'ghost@example.com' });
    const res = await request(app)
      .patch('/api/seekers/64b7f1c2a1b2c3d4e5f60718')
      .set(...AUTH_BEARER(token))
      .send({ profession: 'Nobody' });

    expect(res.statusCode).toBe(404);
  });
});

describe('SEC-012/023: redaction must not corrupt identifiers', () => {
  // Regression guard. `stripSensitive` rebuilds plain objects to drop secrets.
  // A Mongoose ObjectId is `typeof 'object'`, so a naive rebuild copies its
  // internal buffer fields and destroys `toJSON` - the client then receives
  // `{i0,i1,i2,i3}` instead of a hex id and every follow-up request 404s.
  it('preserves an ObjectId through redaction', () => {
    const id = new mongoose.Types.ObjectId();
    const out = stripSensitive({ userId: id, nested: { hirerId: id } });

    expect(out.userId.toString()).toBe(id.toString());
    expect(out.nested.hirerId.toString()).toBe(id.toString());
    expect(JSON.parse(JSON.stringify(out)).userId).toBe(id.toString());
  });

  it('preserves ObjectIds inside arrays', () => {
    const ids = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
    const out = stripSensitive({ tags: ids });
    expect(out.tags.map((t) => t.toString())).toEqual(ids.map((t) => t.toString()));
  });

  it('still strips secrets nested under a preserved structure', () => {
    const out = stripSensitive({ profile: { name: 'Ada', passwordHash: 'leak' } });
    expect(out.profile).toEqual({ name: 'Ada' });
  });

  it('sends hex-string ids over the wire, not mangled objects', async () => {
    const user = await User.create({
      name: 'Id Shape', email: 'id-shape@example.com', role: 'seeker', passwordHash: 'x',
    });
    const profile = await SeekerProfile.create({ userId: user._id, profession: 'Nurse' });

    const res = await request(app)
      .get(`/api/seekers/${profile._id}`)
      .set(...AUTH_BEARER(signToken(user)));

    expect(res.statusCode).toBe(200);
    expect(typeof res.body.data.id).toBe('string');
    expect(res.body.data.id).toMatch(/^[0-9a-f]{24}$/);
    expect(typeof res.body.data.userId).toBe('string');
    expect(res.body.data.userId).toMatch(/^[0-9a-f]{24}$/);
  });
});

const mountPrefixOf = (layer) => {
  // Express 4 does not expose the mount path on a `use()` layer; it is encoded
  // in the layer regex, e.g. "^\\/api\\/?(?=\\/|$)" -> "/api".
  if (!layer.regexp?.source) return '';
  const decoded = layer.regexp.source.replace(/^\^/, '').replace(/\\/g, '');
  const match = decoded.match(/^(.*?)\/\?\(\?=\/\|\$\)$/);
  return match ? match[1] : '';
};

/**
 * Walk the live Express router tree and return every concrete (method, path)
 * pair. This replaces the previous hard-coded `protectedPaths` array, which
 * could silently go stale the moment a collection or nested route was added -
 * exactly the failure mode that let the original SEC-002 gap exist.
 */
const enumerateRoutes = (root) => {
  const found = [];

  const walk = (stack, prefix) => {
    for (const layer of stack || []) {
      if (layer.route) {
        const full = `${prefix}${layer.route.path}`;
        for (const method of Object.keys(layer.route.methods || {})) {
          if (['get', 'post', 'patch', 'put', 'delete'].includes(method)) {
            found.push({ method: method.toUpperCase(), path: full });
          }
        }
      } else if (layer.handle?.stack) {
        walk(layer.handle.stack, `${prefix}${mountPrefixOf(layer)}`);
      }
    }
  };

  walk(root.stack, '');
  return found;
};

/** Replace `:param` / `:param?` with a plausible ObjectId so the route matches. */
const concretize = (path) =>
  path
    .replace(/:[A-Za-z0-9_]+\??/g, '64b7f1c2a1b2c3d4e5f60718')
    .replace(/\/+$/, '') || '/';

/**
 * Routes that are public **by design** — accessible without a pre-existing
 * authentication token. Every other route in the tree must reject an anonymous
 * request with 401/403. This is the machine-checked form of the "no unguarded
 * routes" guardrail in AGENTS.md: a new route is covered the moment it is
 * registered, without anyone updating a list.
 *
 * `GET /` and `GET /api/health` are liveness/banner endpoints. Register and
 * login are the only public writes, and are rate limited separately.
 * Refresh requires a refresh token in the body (not an access token), so it is
 * public in the sense of not needing a pre-existing access token. Admin
 * login/logout are cookie-based and intentionally accessible without a
 * pre-existing token (login validates credentials, logout is idempotent).
 */
const PUBLIC_ROUTES = new Set([
  'GET /',
  'GET /api/health',
  'POST /api/auth/register',
  'POST /api/auth/login',
  'POST /api/auth/refresh',
  'POST /api/auth/verification-code/send',
  'POST /api/auth/verification-code/verify',
  'POST /api/auth/admin/login',
  'POST /api/auth/admin/logout',
]);

describe('SEC-002: live route manifest — no unguarded routes', () => {
  const routes = enumerateRoutes(app._router);

  it('discovers the whole route tree', () => {
    expect(routes.length).toBeGreaterThan(40);
  });

  it('produces a requestable path for every discovered route', () => {
    const unusable = routes.filter(({ path }) => !concretize(path).startsWith('/'));
    expect(unusable).toEqual([]);
  });

  it('rejects anonymous access to every route not declared public', async () => {
    const leaks = [];

    for (const { method, path } of routes) {
      const url = concretize(path);
      if (PUBLIC_ROUTES.has(`${method} ${url}`)) continue;

      const res = await request(app)[method.toLowerCase()](url).send({});

      // Anything other than 401/403 means the request got past the auth guard.
      // 400 counts as a leak: a validation failure still means the handler ran.
      if (res.statusCode !== 401 && res.statusCode !== 403) {
        leaks.push(`${method} ${url} -> ${res.statusCode}`);
      }
    }

    expect(leaks).toEqual([]);
  });

  it('keeps every declared-public route actually reachable', async () => {
    // Guards against a route being declared public and then locked down, which
    // would silently break login/register rather than fail a security check.
    const locked = [];

    for (const route of PUBLIC_ROUTES) {
      const [method, path] = route.split(' ');
      const res = await request(app)[method.toLowerCase()](path).send({});
      if (res.statusCode === 401 || res.statusCode === 403) locked.push(route);
    }

    expect(locked).toEqual([]);
  });
});

describe('SEC-011: pagination on list endpoints', () => {
  it('defaults to page=1, limit=20', async () => {
    const { token } = await makeUser({ email: 'pagination@example.com' });
    // Create 25 seekers
    const seekers = Array.from({ length: 25 }, (_, i) => ({
      userId: `64b7f1c2a1b2c3d4e5f607${i.toString().padStart(2, '0')}`,
      profession: `Test ${i}`,
    }));
    await SeekerProfile.insertMany(seekers);

    const res = await request(app)
      .get('/api/seekers')
      .set(...AUTH_BEARER(token));

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(20);
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 20,
      total: 25,
      pages: 2,
    });
  });

  it('respects page and limit parameters', async () => {
    const { token } = await makeUser({ email: 'pagination2@example.com' });
    await SeekerProfile.insertMany(
      Array.from({ length: 15 }, (_, i) => ({
        userId: `64b7f1c2a1b2c3d4e5f608${i.toString().padStart(2, '0')}`,
        profession: `Test ${i}`,
      })),
    );

    const res = await request(app)
      .get('/api/seekers')
      .query({ page: 2, limit: 5 })
      .set(...AUTH_BEARER(token));

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.meta).toEqual({
      page: 2,
      limit: 5,
      total: 15,
      pages: 3,
    });
  });

  it('clamps limit to max 100', async () => {
    const { token } = await makeUser({ email: 'pagination3@example.com' });
    const res = await request(app)
      .get('/api/seekers')
      .query({ limit: 1000 })
      .set(...AUTH_BEARER(token));

    expect(res.statusCode).toBe(200);
    expect(res.body.meta.limit).toBe(100);
  });

  it('clamps page to minimum 1', async () => {
    const { token } = await makeUser({ email: 'pagination4@example.com' });
    const res = await request(app)
      .get('/api/seekers')
      .query({ page: 0, limit: 10 })
      .set(...AUTH_BEARER(token));

    expect(res.statusCode).toBe(200);
    expect(res.body.meta.page).toBe(1);
  });

  it('works on seekers endpoint', async () => {
    const { token } = await makeUser({ email: 'seeker-pagination@example.com' });
    for (let i = 0; i < 5; i++) {
      await SeekerProfile.create({
        userId: new mongoose.Types.ObjectId(),
        profession: `Test ${i}`,
      });
    }

    const res = await request(app)
      .get('/api/seekers')
      .query({ page: 1, limit: 2 })
      .set(...AUTH_BEARER(token));

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 2,
      total: 5,
      pages: 3,
    });
  });
});

describe('SEC-013: upload validation', () => {
  it('rejects upload without file', async () => {
    const { token } = await makeUser({ email: 'upload@example.com' });
    const res = await request(app)
      .post('/api/upload')
      .set(...AUTH_BEARER(token));
    expect(res.statusCode).toBe(400);
  });

  it('rejects disallowed MIME type (executable)', async () => {
    const { token } = await makeUser({ email: 'upload2@example.com' });
    const fakeExe = Buffer.from('MZ'); // PE header
    const res = await request(app)
      .post('/api/upload')
      .set(...AUTH_BEARER(token))
      .attach('file', fakeExe, 'test.exe');
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toMatch(/not allowed/i);
  });

  it('rejects SVG (XSS risk)', async () => {
    const { token } = await makeUser({ email: 'upload3@example.com' });
    const svg = Buffer.from('<svg onload="alert(1)"></svg>');
    const res = await request(app)
      .post('/api/upload')
      .set(...AUTH_BEARER(token))
      .attach('file', svg, 'test.svg');
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toMatch(/not allowed/i);
  });

  it('rejects HTML', async () => {
    const { token } = await makeUser({ email: 'upload4@example.com' });
    const html = Buffer.from('<script>alert(1)</script>');
    const res = await request(app)
      .post('/api/upload')
      .set(...AUTH_BEARER(token))
      .attach('file', html, 'test.html');
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toMatch(/not allowed/i);
  });

  it('rejects file with mismatched magic bytes', async () => {
    const { token } = await makeUser({ email: 'upload5@example.com' });
    // PNG header but declared as JPEG
    const fakeJpeg = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG magic bytes
    const res = await request(app)
      .post('/api/upload')
      .set(...AUTH_BEARER(token))
      .attach('file', fakeJpeg, 'test.jpg');
    expect(res.statusCode).toBe(400);
    expect(res.body.error.message).toMatch(/does not match declared type/i);
  });

  it('uses server-derived folder from user ID and purpose', async () => {
    const { token, user } = await makeUser({ email: 'upload6@example.com' });
    // Create a valid PNG buffer (1x1 transparent)
    const png = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
      0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
      0x00, 0x05, 0xFE, 0x02, 0xFE, 0x3C, 0xF2, 0xD5,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
      0xAE, 0x42, 0x60, 0x82
    ]);

    const res = await request(app)
      .post('/api/upload')
      .query({ purpose: 'avatars' })
      .set(...AUTH_BEARER(token))
      .attach('file', png, 'avatar.png');

    expect(res.statusCode).toBe(200);
    expect(res.body.data.folder).toContain(`kredibble/${user.id}/avatars`);
    expect(res.body.data.url).toMatch(/cloudinary/);
  });
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});
