# Plan 2a: Admin Data API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every endpoint the admin dashboard calls exists and works with the admin session cookie. A test fails the build if the dashboard ever calls an endpoint the API doesn't serve.

**Why:** On `main` @ `f2921d2`, a probe with a valid admin cookie got `404 Route not found` from 9 of the 12 `/api/v1/admin/*` paths that `kredibble-admin/src/lib/api.ts` calls: seekers, hirers, verification companies and documents, events, grants, articles, staff and community. So the seekers, hirers and verification pages are broken in production. CI stayed green because no test calls those paths.

**Architecture:**
- The admin data routes reuse the existing `collectionRoutes` factory in `kredibble-backend/src/routes/index.js`. It gains five options:
  - `authenticate`: swaps the token check.
  - `filterFields`: exact-value list filters.
  - `searchFilter`: custom search.
  - `populateAlways`: populate list and single reads.
  - `decorate`: post-process presented items.
- `mountAdminDataRoutes(router)` mounts one collection per resource under `/admin/<resource>`, guarded by `requireAdminAuth` (admin cookie, admin secret and audience; admins only). It also adds two nested list routes.
- It is mounted after the staff-portal `adminApiRouter`, so the portal's own `/admin/*` paths (for example `/admin/reports/monthly`) keep matching first.
- In the client, `request` keeps returning `payload.data`. A new `requestPage` also keeps `meta`, which list pages need for page counts.
- A backend contract test reads `api.ts` and calls every path in it.

**Tech Stack:** Express 4, Mongoose 9, Jest + supertest + mongodb-memory-server (backend); Next.js 16, React 19, TypeScript strict, Playwright (admin).

## Global Constraints

- Branch: `security/phase-3-admin-data-api`, created from `main`. Commit after each task, then `git push` (AGENTS.md rules 4 and 7).
- Every admin data route answers 401 to a missing session and to a **user** Bearer token, including one belonging to an admin account (SEC-040 audience separation). Only `requireAdminAuth` (admin secret plus `aud: 'kredibble-admin'`) may authenticate them.
- Staff-portal roles get no access to these routes. Admins only.
- Never remove `validate` middleware. Never widen CORS, rate limits or upload caps. bcrypt cost stays at 12.
- SEC-061: any list filter value that isn't a plain string answers 400.
- Admin writes stay audit-logged (`collectionRoutes` already does this).
- No `console.log` in `src/`; use `logger`. No `any` in TypeScript.
- The route-manifest test in `tests/security.p0.test.js` must keep passing unchanged. Every new route answers 401 anonymously.
- Backend: `npm run lint && npm test` in `kredibble-backend` before every commit. Admin: `npm run lint && npm run typecheck && npm run build` in `kredibble-admin` before every admin commit.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- After each implementation, update `task.md` (AGENTS.md rule 6) and add any lesson-worthy decision to `C:\Users\Jerry\Desktop\PROJECT 2026\SYSTEM_DESIGN_LESSONS.md` (AGENTS.md § System Design Learning Journal). Task 5 does both.

---

### Task 1: `collectionRoutes` gains admin-mount options

**Files:**
- Modify: `kredibble-backend/src/routes/index.js` (the `collectionRoutes` options, `router.use(...)` auth line, `GET /` and `GET /:id` handlers)
- Test: `kredibble-backend/tests/sec-075-admin-api.test.js` (new; Task 2 extends it)

**Interfaces:**
- Produces new `collectionRoutes` options, all optional; existing callers are unaffected:
  - `authenticate` (`(req, res, next) => void`): replaces the default auth middleware.
  - `filterFields` (`string[]`): list query params matched by exact value. `'true'` and `'false'` become booleans; a non-string value answers 400.
  - `searchFilter` (`async (pattern) => object`): replaces the `searchFields` `$or` for `?q=`. `pattern` is the escaped `{ $regex, $options: 'i' }`.
  - `populateAlways` (`boolean`): applies `populate` on list and single reads, regardless of `enablePopulate`.
  - `decorate` (`async (items, req) => items`): runs on presented items for `GET /` and `GET /:id`.

- [ ] **Step 1: Write the failing test**

Create `tests/sec-075-admin-api.test.js`. This first test mounts nothing new itself: Task 1's options are proven through the `/admin/events` mount, which Step 4 adds as the first admin mount.

```js
import request from 'supertest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Event } from '../src/models/Platform.js';
import { signAdminToken, signToken } from '../src/middleware/auth.js';

const createAdmin = () => User.create({ name: 'Ada Admin', email: 'ada@example.com', role: 'admin', passwordHash: 'x' });
const adminCookie = (admin) => `kredibble_admin_token=${signAdminToken(admin)}`;
const get = (path, cookie) => request(app).get(`/api/v1${path}`).set('Cookie', cookie);

const eventFields = { hirer: 'Acme', location: 'Accra', dateTime: '2026-11-01T10:00', capacity: 10 };

describe('SEC-075: admin collection mounts', () => {
  it('lists with the admin cookie, paginated and filtered by exact value', async () => {
    const cookie = adminCookie(await createAdmin());
    await Event.create({ ...eventFields, title: 'Career fair', status: 'upcoming' });
    await Event.create({ ...eventFields, title: 'Old meetup', status: 'past' });

    const res = await get('/admin/events?status=upcoming', cookie);

    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ page: 1, total: 1 });
    expect(res.body.data.map((e) => e.title)).toEqual(['Career fair']);
  });

  it('rejects an operator object in a filter (SEC-061)', async () => {
    const cookie = adminCookie(await createAdmin());

    const res = await get('/admin/events?status[$ne]=past', cookie);

    expect(res.status).toBe(400);
  });

  it('rejects a user Bearer token, even one belonging to an admin account', async () => {
    const admin = await createAdmin();

    const res = await request(app).get('/api/v1/admin/events').set('Authorization', `Bearer ${signToken(admin)}`);

    expect(res.status).toBe(401);
  });

  it('rejects an anonymous request', async () => {
    expect((await request(app).get('/api/v1/admin/events')).status).toBe(401);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/sec-075-admin-api.test.js`
Expected: FAIL. The first test gets `404` where it expects `200`.

- [ ] **Step 3: Add the options to `collectionRoutes`**

In `src/routes/index.js`, add these options to the `collectionRoutes` parameter list after `assertWritable = () => {},`:

```js
  // Replaces the default token check (e.g. requireAdminAuth for the admin dashboard's mounts).
  authenticate = null,
  // Query params that filter the list by exact value; "true"/"false" become booleans.
  filterFields = [],
  // async (pattern) => Mongo filter for `?q=`; replaces the `searchFields` $or.
  searchFilter = null,
  // Populate list and single reads, whatever `enablePopulate` says.
  populateAlways = false,
  // async (items, req) => items; runs on presented items for GET / and GET /:id.
  decorate = null,
```

Replace the `router.use(publicRead ? … : requireAuth);` statement with:

```js
  router.use(authenticate || (publicRead
    ? (req, res, next) => (req.method === 'GET' ? optionalAuth : requireAuth)(req, res, next)
    : requireAuth));
```

In the `GET /` handler, replace everything from `if (type && resourceName === 'Opportunity') filter.type = type;` through the final `listResponse(...)` call with:

```js
      if (type && resourceName === 'Opportunity') filter.type = type;

      for (const field of filterFields) {
        const value = req.query[field];
        if (value === undefined) continue;
        // SEC-061: a filter value is a plain string, never an operator object.
        if (typeof value !== 'string') throw new ApiError(400, 'Invalid query parameters');
        filter[field] = value === 'true' ? true : value === 'false' ? false : value;
      }

      if (q) {
        // Escaped: `?q=a{999999}` would otherwise be a ReDoS payload.
        const pattern = searchPattern(q);
        if (pattern && searchFilter) {
          Object.assign(filter, await searchFilter(pattern));
        } else if (pattern && searchFields.length) {
          filter.$or = searchFields.map((field) => ({ [field]: pattern }));
        }
      }

      // SEC-026: for notifications, filter by authenticated user unless admin
      if (policyKey === 'notifications' && req.auth?.role !== ADMIN) {
        filter.userId = req.auth.sub;
      }

      const scoped = withScope(filter, readScope(req));
      let listQuery = Model.find(scoped).sort({ createdAt: -1 }).skip(skip).limit(limit);
      if (populateAlways && populate) listQuery = listQuery.populate(populate);
      const [data, total] = await Promise.all([listQuery, Model.countDocuments(scoped)]);

      let items = data.map((item) => present(item, req));
      if (decorate) items = await decorate(items, req);
      listResponse(res, items, total, page, limit);
```

In the `GET /:id` handler, replace from `if (enablePopulate && populate) {` through `itemResponse(res, present(item, req));` with:

```js
      if ((enablePopulate || populateAlways) && populate) {
        query = query.populate(populate);
      }
      const item = await query;
      if (!item) throw notFound(resourceName);

      let presented = present(item, req);
      if (decorate) [presented] = await decorate([presented], req);
      itemResponse(res, presented);
```

- [ ] **Step 4: Add the first admin mount**

In `src/routes/index.js`, add after `collectionRoutes` is defined (before `createApiRouter`):

```js
/**
 * SEC-075 / SEC-077: the admin dashboard's data API. Every route takes only an
 * admin session (admin secret and audience, via cookie or Bearer). A user
 * Bearer token is rejected even for an admin account. The paths mirror
 * kredibble-admin/src/lib/api.ts, and tests/admin-api-contract.test.js holds
 * the two together.
 */
const mountAdminDataRoutes = (router) => {
  const adminCollection = (path, options) => router.use(
    `/admin${path}`,
    collectionRoutes({ ...options, authenticate: requireAdminAuth, populateAlways: true }),
  );

  adminCollection('/events', {
    Model: Event, resourceName: 'Event', policyKey: 'events',
    searchFields: ['title', 'location', 'hirer'], filterFields: ['status'],
  });
};
```

In `createApiRouter`, directly after `router.use('/admin', adminApiRouter);`, add:

```js
  // After the staff-portal router, so its paths (e.g. /admin/reports/monthly) match first.
  mountAdminDataRoutes(router);
```

- [ ] **Step 5: Run the new tests**

Run: `npm test -- tests/sec-075-admin-api.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 6: Run everything**

Run: `npm run lint && npm test`
Expected: lint clean; the whole suite passes, including the unchanged route-manifest test.

- [ ] **Step 7: Commit**

```bash
git add kredibble-backend/src/routes/index.js kredibble-backend/tests/sec-075-admin-api.test.js
git commit -m "feat(admin-api): collectionRoutes options for admin mounts (SEC-075)"
git push -u origin security/phase-3-admin-data-api
```

---

### Task 2: All admin data routes and the client contract test

**Files:**
- Modify: `kredibble-backend/src/routes/index.js` (`mountAdminDataRoutes`, plus helpers above it)
- Test: `kredibble-backend/tests/sec-075-admin-api.test.js` (append)
- Test: `kredibble-backend/tests/admin-api-contract.test.js` (new)

**Interfaces:**
- Consumes: the Task 1 options.
- Serves, all behind `requireAdminAuth`. Each collection supports `GET /`, `GET /:id`, `POST /`, `PATCH /:id` and `DELETE /:id` under its resource policy:

| Path | Model | `filterFields` | Search |
|---|---|---|---|
| `/admin/seekers` | `SeekerProfile` | `verified`, `status`, `country` | profile fields + owner name/email |
| `/admin/hirers` | `HirerAccount` | `verified`, `status`, `industry` | profile fields + owner name/email |
| `/admin/verification/companies` | `CompanyVerification` | `overallStatus` (also `?status=`, via the existing mapping) | `name`, `industry`, `companyEmail` |
| `/admin/verification/documents` | `VerificationDoc` | `status` | `label`, `fileName` |
| `/admin/events` | `Event` | `status` | `title`, `location`, `hirer` |
| `/admin/grants` | `Grant` | `status`, `sector` | `title`, `sector`, `hirer` |
| `/admin/articles` | `Article` | `status`, `category` | `title`, `category` |
| `/admin/staff` | `StaffMember` | `role`, `status` | `name`, `email` |
| `/admin/reports` | `Report` | `status`, `targetType` | `reason`, `details`, `targetLabel` |
| `/admin/community/channels` | `Channel` | `status`, `category`, `visibility` | `name`, `category` |

  Plus two read-only nested lists, both paginated `{ data, meta }`:
  - `GET /admin/verification/companies/:companyId/documents`
  - `GET /admin/community/channels/:channelId/posts`
- Seeker and hirer items carry:
  - `name` and `email` (from the owner);
  - `user` (`{ id, name, email, avatarUrl, emailVerified, createdAt }`);
  - `userId` as a string.

  Hirer items also carry `overallStatus` (or `null`), `linkedVerificationId` (or `null`) and `postingsCount`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/sec-075-admin-api.test.js`, and add the imports at the top of the file:

```js
import { StaffMember, AuditLog } from '../src/models/User.js';
import { SeekerProfile, HirerAccount } from '../src/models/Profiles.js';
import { Opportunity, CompanyVerification, VerificationDoc, Grant } from '../src/models/Platform.js';
import { Channel, ChannelPost, Report } from '../src/models/Community.js';
import { Article } from '../src/models/Content.js';
```

(merge `User` and `Event` into these import lines rather than importing twice).

```js
describe('SEC-075: admin data routes', () => {
  it('lists seekers with the owner\'s name and email', async () => {
    const cookie = adminCookie(await createAdmin());
    const user = await User.create({ name: 'Ama Mensah', email: 'ama@example.com', role: 'seeker', passwordHash: 'x' });
    await SeekerProfile.create({ userId: user._id, profession: 'Engineer', country: 'Ghana' });

    const res = await get('/admin/seekers', cookie);

    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ page: 1, total: 1 });
    expect(res.body.data[0]).toMatchObject({
      name: 'Ama Mensah', email: 'ama@example.com', profession: 'Engineer', userId: String(user._id),
    });
    expect(res.body.data[0].user).toMatchObject({ name: 'Ama Mensah', email: 'ama@example.com' });
  });

  it('finds seekers by the owner\'s name and filters by verified', async () => {
    const cookie = adminCookie(await createAdmin());
    const ama = await User.create({ name: 'Ama Mensah', email: 'ama@example.com', role: 'seeker', passwordHash: 'x' });
    const kofi = await User.create({ name: 'Kofi Owusu', email: 'kofi@example.com', role: 'seeker', passwordHash: 'x' });
    await SeekerProfile.create({ userId: ama._id, profession: 'Engineer', verified: true });
    await SeekerProfile.create({ userId: kofi._id, profession: 'Designer', verified: false });

    const byName = await get('/admin/seekers?q=ama%20mens', cookie);
    const unverified = await get('/admin/seekers?verified=false', cookie);

    expect(byName.body.data.map((s) => s.name)).toEqual(['Ama Mensah']);
    expect(unverified.body.data.map((s) => s.name)).toEqual(['Kofi Owusu']);
  });

  it('returns one seeker with the same shape', async () => {
    const cookie = adminCookie(await createAdmin());
    const user = await User.create({ name: 'Ama Mensah', email: 'ama@example.com', role: 'seeker', passwordHash: 'x' });
    const profile = await SeekerProfile.create({ userId: user._id, profession: 'Engineer' });

    const res = await get(`/admin/seekers/${profile._id}`, cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: String(profile._id), name: 'Ama Mensah', email: 'ama@example.com' });
  });

  it('lists hirers with verification status and posting count', async () => {
    const cookie = adminCookie(await createAdmin());
    const user = await User.create({ name: 'Kofi Boateng', email: 'kofi@example.com', role: 'hirer', passwordHash: 'x' });
    const account = await HirerAccount.create({ userId: user._id, companyName: 'Boateng Ltd', industry: 'Tech', location: 'Accra' });
    const verification = await CompanyVerification.create({ hirerId: account._id, name: 'Boateng Ltd', overallStatus: 'pending' });
    const posting = { title: 'Engineer', type: 'job', company: 'Boateng Ltd', location: 'Accra', description: 'Build' };
    await Opportunity.create({ ...posting, hirerId: user._id });
    await Opportunity.create({ ...posting, hirerId: user._id });

    const res = await get('/admin/hirers', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({
      companyName: 'Boateng Ltd', name: 'Kofi Boateng', email: 'kofi@example.com',
      overallStatus: 'pending', linkedVerificationId: String(verification._id), postingsCount: 2,
    });
  });

  it('lets an admin approve a company verification with only the cookie, and audits it', async () => {
    const cookie = adminCookie(await createAdmin());
    const verification = await CompanyVerification.create({ name: 'Boateng Ltd', overallStatus: 'pending' });

    const listed = await get('/admin/verification/companies?status=pending', cookie);
    const res = await request(app)
      .patch(`/api/v1/admin/verification/companies/${verification._id}`)
      .set('Cookie', cookie)
      .send({ overallStatus: 'approved' });

    expect(listed.body.data.map((v) => v.name)).toEqual(['Boateng Ltd']);
    expect(res.status).toBe(200);
    expect((await CompanyVerification.findById(verification._id).lean()).overallStatus).toBe('approved');
    expect(await AuditLog.countDocuments({ resourceId: verification._id, outcome: 'success' })).toBeGreaterThan(0);
  });

  it('lists a verification case\'s documents', async () => {
    const cookie = adminCookie(await createAdmin());
    const account = await HirerAccount.create({ companyName: 'Boateng Ltd', industry: 'Tech', location: 'Accra' });
    const verification = await CompanyVerification.create({ hirerId: account._id, name: 'Boateng Ltd' });
    await VerificationDoc.create({ companyId: account._id, verificationCaseId: verification._id, key: 'certificate', fileName: 'cert.pdf' });
    await VerificationDoc.create({ companyId: account._id, key: 'tax', fileName: 'tax.pdf' });
    const other = await HirerAccount.create({ companyName: 'Other Ltd', industry: 'Tech', location: 'Kumasi' });
    await VerificationDoc.create({ companyId: other._id, key: 'certificate', fileName: 'other.pdf' });

    const res = await get(`/admin/verification/companies/${verification._id}/documents`, cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.map((d) => d.fileName).sort()).toEqual(['cert.pdf', 'tax.pdf']);
    expect(res.body.meta.total).toBe(2);
  });

  it('lists a channel\'s posts with their authors', async () => {
    const cookie = adminCookie(await createAdmin());
    const author = await User.create({ name: 'Ama Mensah', email: 'ama@example.com', role: 'seeker', passwordHash: 'x' });
    const channel = await Channel.create({ name: 'Builders', category: 'Tech', visibility: 'private' });
    await ChannelPost.create({ channelId: channel._id, authorId: author._id, authorName: 'Ama Mensah', body: 'Hello' });

    const res = await get(`/admin/community/channels/${channel._id}/posts`, cookie);

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ body: 'Hello' });
    expect(res.body.data[0].authorId).toMatchObject({ name: 'Ama Mensah' });
  });

  it('serves grants, articles, staff, reports and channels', async () => {
    const admin = await createAdmin();
    const cookie = adminCookie(admin);
    await Grant.create({ title: 'Seed fund', hirer: 'Acme', sector: 'Agri', fundingPool: 1000, status: 'open' });
    await Article.create({ title: 'CV tips', category: 'Careers', status: 'published' });
    await StaffMember.create({ userId: admin._id, name: 'Ada Admin', email: 'ada@example.com', role: 'Desk Lead', status: 'active' });
    await Report.create({ targetType: 'post', reason: 'spam', status: 'open' });
    await Channel.create({ name: 'Builders', category: 'Tech' });

    for (const [path, total] of [['/admin/grants?status=open', 1], ['/admin/articles?category=Careers', 1],
      ['/admin/staff?role=Desk%20Lead', 1], ['/admin/reports?status=open', 1], ['/admin/community/channels?category=Tech', 1]]) {
      const res = await get(path, cookie);
      expect([path, res.status, res.body.meta?.total]).toEqual([path, 200, total]);
    }
  });
});
```

Create `tests/admin-api-contract.test.js`:

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { signAdminToken } from '../src/middleware/auth.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.resolve(here, '../../kredibble-admin/src/lib/api.ts');
const SAMPLE_ID = '64b7f1c2a1b2c3d4e5f60718';

/**
 * Every `request(...)` / `requestPage(...)` call in the admin client whose
 * path is a literal, as { method, path }. Query-string holes are dropped; any
 * other hole becomes a sample id.
 */
const clientCalls = () => {
  const source = fs.readFileSync(CLIENT, 'utf8');
  const pattern = /\brequest(?:Page)?(?:<[^(]*>)?\(\s*([`"])(\/[^`"]*)\1(?:\s*,\s*\{[^}]*?method:\s*"([A-Z]+)")?/g;
  return [...source.matchAll(pattern)].map(([, , raw, method]) => ({
    method: method || 'GET',
    path: raw.replace(/\$\{(query|queryString)\}/g, '').replace(/\$\{[^}]+\}/g, SAMPLE_ID),
  }));
};

describe('admin client ↔ API contract', () => {
  it('finds the client\'s calls', () => {
    expect(clientCalls().length).toBeGreaterThan(20);
  });

  it('serves every path the admin client calls', async () => {
    const admin = await User.create({ name: 'Contract Admin', email: 'contract@example.com', role: 'admin', passwordHash: 'x' });
    const cookie = `kredibble_admin_token=${signAdminToken(admin)}`;
    const missing = [];

    for (const { method, path: callPath } of clientCalls()) {
      const res = await request(app)[method.toLowerCase()](`/api/v1${callPath}`).set('Cookie', cookie).send({});
      // A missing record is a 404 with the resource's own message; only an unknown route says this.
      if (res.status === 404 && res.body?.error?.message === 'Route not found') missing.push(`${method} ${callPath}`);
    }

    expect(missing).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- tests/sec-075-admin-api.test.js tests/admin-api-contract.test.js`
Expected: FAIL. The new route tests get 404. The contract test's `missing` lists the seekers, hirers, verification, grants, articles, staff and community paths (events already pass from Task 1). The one `POST /admin/verification/companies/<id>/documents` call is listed too; Task 3 deletes it from the client.

- [ ] **Step 3: Add the helpers and the remaining mounts**

In `src/routes/index.js`, add above `mountAdminDataRoutes`:

```js
const ADMIN_USER_FIELDS = 'name email avatarUrl emailVerified createdAt';

/** Search a profile collection by its own fields and by its owner's name or email. */
const searchProfilesByUser = (fields) => async (pattern) => {
  const owners = await User.find({ $or: [{ name: pattern }, { email: pattern }] }).select('_id').limit(500).lean();
  return {
    $or: [
      ...fields.map((field) => ({ [field]: pattern })),
      { userId: { $in: owners.map((owner) => owner._id) } },
    ],
  };
};

/** Lift the populated owner onto the record: the shape the admin pages read (`name`, `email`, `user`). */
const flattenProfileUser = (item) => {
  const user = item.userId && typeof item.userId === 'object' ? item.userId : null;
  return {
    ...item,
    userId: user ? String(user.id ?? user._id) : item.userId,
    user,
    name: user?.name,
    email: user?.email,
  };
};

/**
 * Add each hirer's verification case and posting count, with two queries per
 * page. Records point at a hirer by HirerAccount id or by the owner's User id
 * (SEC-047), so both are matched.
 */
const decorateHirers = async (items) => {
  const hirers = items.map(flattenProfileUser);
  const keysOf = (hirer) => [hirer.id, hirer.userId].filter((id) => mongoose.isValidObjectId(id)).map(String);
  const objectIds = [...new Set(hirers.flatMap(keysOf))].map((id) => new mongoose.Types.ObjectId(id));

  const [cases, postings] = await Promise.all([
    CompanyVerification.find({ hirerId: { $in: objectIds } }).select('hirerId overallStatus').lean(),
    Opportunity.aggregate([
      { $match: { $or: [{ hirerId: { $in: objectIds } }, { createdBy: { $in: objectIds } }] } },
      { $group: { _id: { $ifNull: ['$hirerId', '$createdBy'] }, count: { $sum: 1 } } },
    ]),
  ]);
  const caseByHirer = new Map(cases.map((entry) => [String(entry.hirerId), entry]));
  const countByHirer = new Map(postings.map((entry) => [String(entry._id), entry.count]));

  return hirers.map((hirer) => {
    const keys = keysOf(hirer);
    const verification = keys.map((key) => caseByHirer.get(key)).find(Boolean);
    return {
      ...hirer,
      overallStatus: verification?.overallStatus ?? null,
      linkedVerificationId: verification ? String(verification._id) : null,
      postingsCount: keys.reduce((sum, key) => sum + (countByHirer.get(key) || 0), 0),
    };
  });
};
```

Replace the body of `mountAdminDataRoutes` (keep its doc comment) with:

```js
  // Nested lists first, so the collection mounts' `/:id` never sees them.
  router.get('/admin/verification/companies/:companyId/documents', requireAdminAuth, asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.companyId)) throw notFound('Company verification');
    const verification = await CompanyVerification.findById(req.params.companyId).select('hirerId').lean();
    if (!verification) throw notFound('Company verification');
    // A document points at its case, or only at the hirer (`companyId`).
    const filter = {
      $or: [
        { verificationCaseId: verification._id },
        ...(verification.hirerId ? [{ companyId: verification.hirerId }] : []),
      ],
    };
    const { page, limit, skip } = parsePagination(req.query);
    const [docs, total] = await Promise.all([
      VerificationDoc.find(filter).sort({ _id: -1 }).skip(skip).limit(limit),
      VerificationDoc.countDocuments(filter),
    ]);
    listResponse(res, docs.map(toClientObject), total, page, limit);
  }));

  router.get('/admin/community/channels/:channelId/posts', requireAdminAuth, asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.channelId)) throw notFound('Channel');
    const filter = { channelId: req.params.channelId };
    const { page, limit, skip } = parsePagination(req.query);
    const [posts, total] = await Promise.all([
      ChannelPost.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
        .populate({ path: 'authorId', select: 'name email avatarUrl' }),
      ChannelPost.countDocuments(filter),
    ]);
    listResponse(res, posts.map(toClientObject), total, page, limit);
  }));

  const adminCollection = (path, options) => router.use(
    `/admin${path}`,
    collectionRoutes({ ...options, authenticate: requireAdminAuth, populateAlways: true }),
  );

  adminCollection('/seekers', {
    Model: SeekerProfile, resourceName: 'Seeker', policyKey: 'seekers',
    populate: { path: 'userId', select: ADMIN_USER_FIELDS },
    searchFilter: searchProfilesByUser(['profession', 'university', 'country']),
    filterFields: ['verified', 'status', 'country'],
    decorate: async (items) => items.map(flattenProfileUser),
  });
  adminCollection('/hirers', {
    Model: HirerAccount, resourceName: 'Hirer', policyKey: 'hirers',
    populate: { path: 'userId', select: ADMIN_USER_FIELDS },
    searchFilter: searchProfilesByUser(['companyName', 'industry', 'location', 'companyEmail']),
    filterFields: ['verified', 'status', 'industry'],
    decorate: decorateHirers,
  });
  adminCollection('/verification/companies', {
    Model: CompanyVerification, resourceName: 'Company verification', policyKey: 'verification/companies',
    searchFields: ['name', 'industry', 'companyEmail'], filterFields: ['overallStatus'],
  });
  adminCollection('/verification/documents', {
    Model: VerificationDoc, resourceName: 'VerificationDoc', policyKey: 'verification/documents',
    searchFields: ['label', 'fileName'], filterFields: ['status'],
  });
  adminCollection('/events', {
    Model: Event, resourceName: 'Event', policyKey: 'events',
    searchFields: ['title', 'location', 'hirer'], filterFields: ['status'],
  });
  adminCollection('/grants', {
    Model: Grant, resourceName: 'Grant', policyKey: 'grants',
    searchFields: ['title', 'sector', 'hirer'], filterFields: ['status', 'sector'],
  });
  adminCollection('/articles', {
    Model: Article, resourceName: 'Article', policyKey: 'articles',
    searchFields: ['title', 'category'], filterFields: ['status', 'category'],
  });
  adminCollection('/staff', {
    Model: StaffMember, resourceName: 'Staff', policyKey: 'staff',
    searchFields: ['name', 'email'], filterFields: ['role', 'status'],
  });
  adminCollection('/reports', {
    Model: Report, resourceName: 'Report', policyKey: 'reports',
    searchFields: ['reason', 'details', 'targetLabel'], filterFields: ['status', 'targetType'],
  });
  adminCollection('/community/channels', {
    Model: Channel, resourceName: 'Channel', policyKey: 'community/channels',
    searchFields: ['name', 'category'], filterFields: ['status', 'category', 'visibility'],
  });
```

If a model's required fields make a test fixture fail validation, add the minimum field to the fixture and say so in the report. Never weaken an assertion.

- [ ] **Step 4: Run the new tests**

Run: `npm test -- tests/sec-075-admin-api.test.js tests/admin-api-contract.test.js`
Expected: the route tests all pass. The contract test fails only on `POST /admin/verification/companies/<id>/documents` (Task 3 removes that call). Record it in the report.

- [ ] **Step 5: Run everything**

Run: `npm run lint && npm test`
Expected: lint clean. Everything passes except that one contract assertion. The route-manifest test passes unchanged: every new route answers 401 anonymously.

- [ ] **Step 6: Commit**

```bash
git add kredibble-backend/src/routes/index.js kredibble-backend/tests/sec-075-admin-api.test.js kredibble-backend/tests/admin-api-contract.test.js
git commit -m "feat(admin-api): admin data routes for every dashboard call + contract test (SEC-075)"
git push
```

---

### Task 3: Admin client keeps page counts and stops calling a route that doesn't exist

**Files:**
- Modify: `kredibble-admin/src/lib/api.ts`

**Interfaces:**
- Produces:
  - `requestPayload<P>(path, init?, retried?) → Promise<P>`: module-private; the old `request` body, with refresh-and-retry.
  - `request<T>(path, init?) → Promise<T>`: still returns `payload.data`. It now tolerates bodyless 204 responses.
  - `requestPage<T>(path) → Promise<Paginated<T>>`: returns `{ data, meta }`.
- Every list function whose return type is `Paginated<…>` uses `requestPage`, and its generic parameter becomes the item type: for example `getSeekers(params) → Promise<Paginated<SeekerProfile>>`. Pages keep calling them the same way.
- `createVerificationDocument` is deleted. Admins don't upload a hirer's documents, and no page calls it.

- [ ] **Step 1: Confirm the contract test still fails before the change**

Run (in `kredibble-backend`): `npm test -- tests/admin-api-contract.test.js`
Expected: FAIL, listing only `POST /admin/verification/companies/64b7f1c2a1b2c3d4e5f60718/documents`.

- [ ] **Step 2: Split `request`**

In `kredibble-admin/src/lib/api.ts`:
- Rename the existing `export async function request<T>(path: string, init: RequestInit = {}, retried = false): Promise<T>` to `async function requestPayload<P>(path: string, init: RequestInit = {}, retried = false): Promise<P>`.
- Inside it, change the retry call to `return requestPayload<P>(path, init, true);`.
- Change its last line from `return payload.data as T;` to `return payload as P;`.

Then add after it:

```ts
/** One record or action result: the response's `data`. Bodyless responses (204) give `undefined`. */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const payload = await requestPayload<{ data: T } | null>(path, init);
  return payload?.data as T;
}

/** A paginated list: keeps `meta` (page counts), which `request` drops. */
export async function requestPage<T>(path: string): Promise<Paginated<T>> {
  const payload = await requestPayload<Paginated<T>>(path);
  return { data: payload.data, meta: payload.meta };
}
```

- [ ] **Step 3: Use `requestPage` for every paginated list**

Change these functions so each returns `requestPage<Item>(…)` and drops its generic `T = Paginated<…>` parameter:
- `getSeekers` and `getHirers`;
- `getEvents`, `getGrants` and `getArticles`;
- `getStaff` and `getCommunityChannels`;
- `getCommunityChannelPosts`;
- `getVerificationCompanies`, `getVerificationCompanyDocuments` and `getVerificationDocuments`.

For example:

```ts
export const getSeekers = async (params?: { page?: number; limit?: number; q?: string; verified?: boolean }) => {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.q) query.set("q", params.q);
  if (params?.verified !== undefined) query.set("verified", String(params.verified));
  const queryString = query.toString() ? `?${query.toString()}` : "";
  return requestPage<SeekerProfile>(`/admin/seekers${queryString}`);
};
```

Keep each path literal in the call, with the query-string hole named `query` or `queryString`. The contract test parses exactly that form.

Delete `createVerificationDocument`.

In `src/app/(dashboard)/seekers/page.tsx`, the state type `Paginated<ExtendedSeekerProfile>` must still compile against `Promise<Paginated<SeekerProfile>>`. If `tsc` complains, type the state as `Paginated<SeekerProfile>` and keep the `ExtendedSeekerProfile` cast where it's read. Do the same in `hirers/page.tsx` if needed.

- [ ] **Step 4: Verify the admin app**

Run (in `kredibble-admin`): `npm run lint && npm run typecheck && npm run build`
Expected: all pass.

- [ ] **Step 5: Verify the contract**

Run (in `kredibble-backend`): `npm test -- tests/admin-api-contract.test.js` and then `npm test`
Expected: the contract test passes, and the full suite is green.

- [ ] **Step 6: Commit**

```bash
git add kredibble-admin/src/lib/api.ts kredibble-admin/src/app
git commit -m "fix(admin): keep page counts on list calls; drop call to a route that doesn't exist"
git push
```

---

### Task 4: End-to-end proof that the seekers, hirers and verification pages load real data

**Files:**
- Modify: `kredibble-backend/scripts/e2e-server.js` (seed one seeker, one hirer, one pending verification)
- Modify: `kredibble-admin/tests/admin.e2e.spec.ts` (3 tests)

- [ ] **Step 1: Seed the data**

In `scripts/e2e-server.js`, after the admin `User.create(...)`, add:

```js
const { SeekerProfile, HirerAccount } = await import('../src/models/Profiles.js');
const { CompanyVerification } = await import('../src/models/Platform.js');

// One of each record the dashboard's directory pages list (tests/admin.e2e.spec.ts).
const seeker = await User.create({ name: 'E2E Seeker', email: 'e2e-seeker@kredibble.com', role: 'seeker', passwordHash: 'x' });
await SeekerProfile.create({ userId: seeker._id, profession: 'Data Analyst', country: 'Ghana' });
const hirer = await User.create({ name: 'E2E Recruiter', email: 'e2e-hirer@kredibble.com', role: 'hirer', passwordHash: 'x' });
const account = await HirerAccount.create({ userId: hirer._id, companyName: 'E2E Holdings', industry: 'Finance', location: 'Accra' });
await CompanyVerification.create({ hirerId: account._id, name: 'E2E Holdings', overallStatus: 'pending' });
```

Seeding must not print anything new (use no `console.log`).

- [ ] **Step 2: Add the tests**

Append to `kredibble-admin/tests/admin.e2e.spec.ts`. Reuse its `signIn` helper and constants:

```ts
test.describe('Directory pages show real data', () => {
  test('seekers page lists the seeded seeker', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL(`${BASE_URL}/`);
    await page.goto(`${BASE_URL}/seekers`);
    await expect(page.getByText('E2E Seeker')).toBeVisible();
    await expect(page.getByText('e2e-seeker@kredibble.com')).toBeVisible();
  });

  test('hirers page lists the seeded company', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL(`${BASE_URL}/`);
    await page.goto(`${BASE_URL}/hirers`);
    await expect(page.getByText('E2E Holdings')).toBeVisible();
  });

  test('verification page lists the pending company', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL(`${BASE_URL}/`);
    await page.goto(`${BASE_URL}/verification`);
    await expect(page.getByText('E2E Holdings')).toBeVisible();
  });
});
```

If the verification page doesn't render the company name (read `src/app/(dashboard)/verification/page.tsx`), assert on the field it does render from the seeded record, and explain in the report.

- [ ] **Step 3: Run the e2e suite**

Run (in `kredibble-admin`): `npm run test:e2e`. It starts both servers itself.
Expected: all tests pass, including the 3 new ones. If Playwright browsers aren't installed locally, run `npx playwright install chromium` once. If that isn't possible, say so in the report and rely on the CI `Admin (Playwright end-to-end)` job, which must pass on the PR.

- [ ] **Step 4: Commit**

```bash
git add kredibble-backend/scripts/e2e-server.js kredibble-admin/tests/admin.e2e.spec.ts
git commit -m "test(admin-e2e): seekers, hirers and verification pages render API data"
git push
```

---

### Task 5: Tracker, journal and pull request

**Files:**
- Modify: `task.md`
- Modify: `PLAN-phase-3-roadmap.md`
- Modify: `C:\Users\Jerry\Desktop\PROJECT 2026\SYSTEM_DESIGN_LESSONS.md` (outside the repo, not committed)

- [ ] **Step 1: `task.md`**
- Status row SEC-075 becomes `✅ Done (admin data API + contract test, <sha>)`.
- SEC-077 becomes `🟡 API complete; 16 pages still on mock data`.
- Tick the SEC-075 acceptance boxes.
- Add Progress Log rows with the real SHAs and test counts:
  - The correction: "2026-10-04 probe: 9 of 12 `/admin/*` paths the client called returned 404; seekers, hirers and verification pages were broken in production. Earlier SEC-077 'wired' entry was premature."
  - The fix: the routes, the contract test and the e2e tests.

- [ ] **Step 2: Roadmap**

In `PLAN-phase-3-roadmap.md`:
- Plan 1's status becomes `Merged (PR #22)`.
- Replace Plan 2's row with two rows:
  - `2a | [Admin data API](PLAN-2a-admin-data-api.md) | SEC-075 routes, contract test | — | In review (PR pending)`
  - `2b | Admin pages on real data | SEC-077 remaining 16 pages | 2a | Not written`
- Change the namespace decision row to: `/api/v1/admin/*`, shared with the staff portal (`requireAdminOrStaffAuth`, chosen 2026-10-03 in PR #23). Dashboard data routes take admin sessions only (`requireAdminAuth`).

- [ ] **Step 3: Journal**

Append to `## Lessons Learned Per Project` in `SYSTEM_DESIGN_LESSONS.md`, in the file's exact format:

```
### Kredibble — A contract test between the app and its API
**Date:** <today>
**What happened:** The admin dashboard was updated to call 12 API endpoints, but 9 of them had never been built. Every check stayed green: the backend tests only tested endpoints that existed, and the dashboard's checks only tested that its own code compiled. The pages were broken in production. We added a test that reads the dashboard's list of endpoints and calls each one, so a missing endpoint now fails the build.
**The lesson:** When two programs talk over an API, each side's own tests can pass while the two disagree. A *contract test* checks the agreement itself: "everything the client calls, the server serves". It catches the most common integration bug, a renamed or never-built endpoint, before users do.
**Concept tags:** `#api` `#rest` `#consistency`
```

Add a concepts-table row: `| Contract tests between client and API | Kredibble — admin dashboard | <today> |`.

- [ ] **Step 4: Commit, push, open the PR**

```bash
git add task.md PLAN-phase-3-roadmap.md
git commit -m "docs: record SEC-075 admin data API and the 404 correction"
git push
gh pr create --base main --title "Admin data API: every dashboard call served, with a contract test (SEC-075)" --body-file <file>
```

The PR body must include:
- the probe result;
- the route table from Task 2;
- the note that staff-portal roles get no access to these routes;
- the test evidence.

It ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
