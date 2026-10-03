# Plan 1: Backend Account Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can reset a forgotten password, change their password, and delete their account so that no personal data remains. CI goes green again.

**Architecture:** Three new auth routes in `kredibble-backend/src/routes/auth.js` (`POST /auth/password/forgot`, `POST /auth/password/reset`, `POST /auth/password`), plus a rewritten `DELETE /auth/me` that calls a new `src/lib/account-deletion.js`. One map of "where a user's data lives" (`userDataFilters`) drives both deletion and the data export, so the two can't drift apart. Deletion is ordered and idempotent, tracked by a `UserTombstone` with a `pending`/`completed` status, instead of a transaction (the test database is a standalone `mongodb-memory-server`, which has no transactions).

**Tech Stack:** Express 4, Mongoose 9, Zod, bcryptjs (cost 12), Resend, Cloudinary, Jest + supertest + mongodb-memory-server.

## Global Constraints

- Branch: `security/phase-3-account-security`. Commit after each task, then `git push` (AGENTS.md rules 4 and 7).
- bcrypt cost stays at 12.
- Every request body goes through `validate(schema)`; never remove `validate` to make a test pass.
- No `console.log`; use `logger` from `src/lib/logger.js`. Never log an email address, a code or a password.
- Responses must not reveal whether an email is registered.
- Wrong-password re-authentication answers **400**, not 401: the mobile client treats 401 as an expired session and signs the user out.
- Run `npm run lint && npm test` in `kredibble-backend` before every commit. Both must pass.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

All commands run from `kredibble-backend/` unless stated.

---

### Task 1: Make backend lint pass

CI on `main` fails at `npm run lint`, so the tests never run and the Render deploy is skipped.

**Files:**
- Delete: `kredibble-backend/fix-mongoose-warning.cjs` (a one-off rewrite script; its change is already in `src/routes/auth.js`, which uses `returnDocument: 'after'`)
- Modify: `kredibble-backend/src/routes/index.js` (`verifyApplicantAccess` and its 3 callers)
- Modify: `kredibble-backend/tests/sec-052-059.test.js:15-23`

- [ ] **Step 1: Confirm the 3 errors**

Run: `npm run lint`
Expected: `✖ 3 problems (3 errors, 0 warnings)` in `fix-mongoose-warning.cjs`, `src/routes/index.js`, `tests/sec-052-059.test.js`.

- [ ] **Step 2: Delete the stray script**

```bash
git rm kredibble-backend/fix-mongoose-warning.cjs
```

- [ ] **Step 3: Drop the unused `action` parameter**

In `src/routes/index.js`, change the signature:

```js
  const verifyApplicantAccess = async (req, applicantId) => {
```

and the three callers:

```js
    const applicant = await verifyApplicantAccess(req, req.params.id);
```

(in `router.get('/applicants/:id'`, `router.patch('/applicants/:id'` and `router.delete('/applicants/:id'`).

- [ ] **Step 4: Remove the unused `admin` fixture**

In `tests/sec-052-059.test.js`:

```js
  let seeker1, seeker2, hirer1, hirer2;

  beforeEach(async () => {
    seeker1 = await makeUser({ role: 'seeker', email: 's1@example.com' });
    seeker2 = await makeUser({ role: 'seeker', email: 's2@example.com' });
    hirer1 = await makeUser({ role: 'hirer', email: 'h1@example.com' });
    hirer2 = await makeUser({ role: 'hirer', email: 'h2@example.com' });
  });
```

- [ ] **Step 5: Verify**

Run: `npm run lint && npm test`
Expected: lint prints no problems; `Tests: 131 passed, 131 total`.

- [ ] **Step 6: Commit**

```bash
git add -A kredibble-backend/fix-mongoose-warning.cjs kredibble-backend/src/routes/index.js kredibble-backend/tests/sec-052-059.test.js
git commit -m "fix(ci): clear the 3 backend lint errors that block CI and deploys"
git push -u origin security/phase-3-account-security
```

---

### Task 2: Forgot and reset password (SEC-083, backend)

**Files:**
- Modify: `kredibble-backend/src/models/User.js` (add `PasswordResetCode`)
- Modify: `kredibble-backend/src/schemas/auth.js` (add `forgotPasswordSchema`, `resetPasswordSchema`)
- Modify: `kredibble-backend/src/lib/email.js` (add `sendPasswordResetEmail`)
- Modify: `kredibble-backend/src/lib/rate-limiters.js` (add `forgotPasswordLimiter`, `passwordResetAttemptLimiter`)
- Modify: `kredibble-backend/src/lib/audit.js` (add 2 actions)
- Modify: `kredibble-backend/src/routes/auth.js` (2 routes, `revokeAllSessions`, `hashesMatch`)
- Modify: `kredibble-backend/tests/security.p0.test.js:688-710` (`PUBLIC_ROUTES`)
- Test: `kredibble-backend/tests/sec-083-084.test.js` (new)

**Interfaces:**
- Produces: `PasswordResetCode` model (`userId`, `codeHash`, `attempts`, `expiresAt`); `revokeAllSessions(user)` (bumps `tokenVersion`, deletes every `RefreshToken`, does **not** save `user`), used again in Task 3.
- API: `POST /api/v1/auth/password/forgot {email}` → `202 { data: { message, expiresInMinutes } }`. `POST /api/v1/auth/password/reset {email, code, newPassword}` → `200 { data: { message } }` or `400 { error: { message: 'Invalid or expired reset code' } }`.

- [ ] **Step 1: Write the failing tests**

Create `tests/sec-083-084.test.js`:

```js
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { User, PasswordResetCode } from '../src/models/User.js';
import { hashVerificationCode } from '../src/lib/email.js';

const PASSWORD = 'OldPassw0rd-x';
const NEW_PASSWORD = 'NewPassw0rd-y';
const KNOWN_CODE = '123456';

const createUser = async ({ email = 'reset@example.com', role = 'seeker' } = {}) =>
  User.create({ name: 'Reset User', email, role, passwordHash: await bcrypt.hash(PASSWORD, 12) });

const login = (email, password) => request(app).post('/api/v1/auth/login').send({ email, password });
const forgot = (email) => request(app).post('/api/v1/auth/password/forgot').send({ email });
const reset = (email, code, newPassword = NEW_PASSWORD) =>
  request(app).post('/api/v1/auth/password/reset').send({ email, code, newPassword });
const me = (token) => request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
const refresh = (refreshToken) => request(app).post('/api/v1/auth/refresh').send({ refreshToken });

/** The emailed code is random; pin it to a known value so the test can submit it. */
const pinResetCode = (userId) =>
  PasswordResetCode.updateOne({ userId }, { codeHash: hashVerificationCode(KNOWN_CODE) });

describe('SEC-083: forgot / reset password', () => {
  it('answers 202 with the same body whether or not the email is registered', async () => {
    await createUser();
    const known = await forgot('Reset@Example.com');
    const unknown = await forgot('nobody@example.com');

    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(unknown.body).toEqual(known.body);
    expect(await PasswordResetCode.countDocuments()).toBe(1);
  });

  it('does not issue reset codes for admin accounts', async () => {
    await createUser({ email: 'admin@example.com', role: 'admin' });
    const res = await forgot('admin@example.com');

    expect(res.status).toBe(202);
    expect(await PasswordResetCode.countDocuments()).toBe(0);
  });

  it('sets the new password and ends every existing session', async () => {
    const user = await createUser();
    const session = await login('reset@example.com', PASSWORD);
    expect(session.status).toBe(200);

    await forgot('reset@example.com');
    await pinResetCode(user._id);
    const res = await reset('reset@example.com', KNOWN_CODE);

    expect(res.status).toBe(200);
    expect(await PasswordResetCode.countDocuments()).toBe(0);
    expect((await me(session.body.data.token)).status).toBe(401);
    expect((await refresh(session.body.data.refreshToken)).status).toBe(401);
    expect((await login('reset@example.com', PASSWORD)).status).toBe(401);
    expect((await login('reset@example.com', NEW_PASSWORD)).status).toBe(200);
  });

  it('gives the same error for a wrong code and for an unknown email', async () => {
    const user = await createUser();
    await forgot('reset@example.com');
    await pinResetCode(user._id);

    const wrongCode = await reset('reset@example.com', '000000');
    const unknownEmail = await reset('nobody@example.com', '000000');

    expect(wrongCode.status).toBe(400);
    expect(unknownEmail.status).toBe(400);
    expect(wrongCode.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('burns the code after five wrong guesses', async () => {
    const user = await createUser();
    await forgot('reset@example.com');
    await pinResetCode(user._id);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await reset('reset@example.com', '000000')).status).toBe(400);
    }
    const sixth = await reset('reset@example.com', KNOWN_CODE);

    expect(sixth.status).toBe(400);
    expect((await login('reset@example.com', PASSWORD)).status).toBe(200);
  });

  it('rejects a new password that fails the password policy', async () => {
    const user = await createUser();
    await forgot('reset@example.com');
    await pinResetCode(user._id);

    const res = await reset('reset@example.com', KNOWN_CODE, 'short');

    expect(res.status).toBe(400);
    expect((await login('reset@example.com', PASSWORD)).status).toBe(200);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/sec-083-084.test.js`
Expected: FAIL — `The requested module '../src/models/User.js' does not provide an export named 'PasswordResetCode'`.

- [ ] **Step 3: Add the `PasswordResetCode` model**

In `src/models/User.js`, after the `EmailVerificationCode` export:

```js
// SEC-083: one-time password-reset codes, stored hashed, 10-minute TTL, attempt-capped
const passwordResetCodeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0, min: 0 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

export const PasswordResetCode = mongoose.model('PasswordResetCode', passwordResetCodeSchema);
```

- [ ] **Step 4: Add the request schemas**

In `src/schemas/auth.js`, at the end of the file:

```js
export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
    newPassword: passwordSchema,
  }),
});
```

- [ ] **Step 5: Add the reset email**

In `src/lib/email.js`, at the end of the file. Resend v6 returns `{ data, error }` instead of throwing, so check `error`:

```js
export const sendPasswordResetEmail = async (email, code, ttlMinutes) => {
  if (!resend) {
    logger.warn('Resend not configured, skipping password reset email');
    return;
  }

  const result = await resend.emails.send({
    from: env.resendFromEmail || 'noreply@kredibble.app',
    to: email,
    subject: 'Reset your Kredibble password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Reset your password</h2>
        <p>Enter this code in the Kredibble app to choose a new password:</p>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #1a1a1a;">
          ${code}
        </div>
        <p style="color: #666; font-size: 14px;">This code expires in ${ttlMinutes} minutes.</p>
        <p style="color: #666; font-size: 14px;">If you didn't ask to reset your password, ignore this email. Your password won't change.</p>
      </div>
    `,
  });
  if (result?.error) throw new Error(result.error.message);
};
```

- [ ] **Step 6: Add the rate limiters**

In `src/lib/rate-limiters.js`, after `emailVerificationLimiter`:

```js
/** SEC-083: reset-code requests — 5 per hour per IP. */
export const forgotPasswordLimiter = createRateLimiter({
  prefix: 'forgot-password',
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: { error: { message: 'Too many password reset requests, please try again after an hour' } },
});

/** SEC-083: reset-code guesses — 10 per hour per target email, on top of the 5-attempt cap per code. */
export const passwordResetAttemptLimiter = createRateLimiter({
  prefix: 'password-reset-attempt',
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: { error: { message: 'Too many password reset attempts for this email, please try again after an hour' } },
  keyGenerator: (req) => String(req.body?.email || '').trim().toLowerCase() || 'unknown',
});
```

- [ ] **Step 7: Add the audit actions**

In `src/lib/audit.js`, inside `AUDIT_ACTIONS` after `PASSWORD_CHANGE`:

```js
  PASSWORD_RESET_REQUEST: 'auth.password.reset_request',
  PASSWORD_RESET: 'auth.password.reset',
```

- [ ] **Step 8: Add the routes**

In `src/routes/auth.js`, update the imports:

```js
import crypto from 'node:crypto';
```

```js
import { loginSchema, registerSchema, refreshSchema, forgotPasswordSchema, resetPasswordSchema } from '../schemas/auth.js';
```

```js
import { User, RevokedRefreshToken, RefreshToken, hashRefreshToken as hashRefreshTokenUtil, EmailVerificationCode, PasswordResetCode } from '../models/User.js';
```

```js
import { createVerificationCode, hashVerificationCode, sendVerificationEmail, sendPasswordResetEmail } from '../lib/email.js';
```

```js
import { registrationLimiter, passwordResetLimiter, authLimiter, emailVerificationLimiter, forgotPasswordLimiter, passwordResetAttemptLimiter } from '../lib/rate-limiters.js';
import logger from '../lib/logger.js';
```

Then add this block after the `/verification-code/verify` route and before `authRouter.get('/me'`:

```js
const PASSWORD_RESET_TTL_MINUTES = 10;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;

/**
 * Sign out every device: access tokens fail the tokenVersion check and refresh
 * tokens are gone. The caller saves `user`.
 */
const revokeAllSessions = async (user) => {
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.refreshTokenHash = null;
  await RefreshToken.deleteMany({ userId: user._id });
};

/** Constant-time comparison of two hex digests. */
const hashesMatch = (a, b) => {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

// SEC-083: request a reset code. Always 202 with the same body, so the response
// never reveals whether the email is registered. Admin accounts are recovered
// with scripts/create-admin.js, not by email.
authRouter.post(
  '/password/forgot',
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({
      emailNormalized: normalizeEmail(req.body.email),
      role: { $in: PUBLIC_ROLES },
    });

    if (user) {
      const code = createVerificationCode();
      await PasswordResetCode.deleteMany({ userId: user._id });
      await PasswordResetCode.create({
        userId: user._id,
        codeHash: hashVerificationCode(code),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000),
      });
      // Not awaited: a slower response for registered emails would reveal which ones exist.
      sendPasswordResetEmail(user.email, code, PASSWORD_RESET_TTL_MINUTES).catch((error) => {
        logger.error({ err: error.message, userId: String(user._id) }, 'Password reset email failed');
      });
    }

    await auditReq(req, {
      action: AUDIT_ACTIONS.PASSWORD_RESET_REQUEST,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: user?._id,
      outcome: user ? 'success' : 'failure',
      metadata: user ? {} : { reason: 'unknown_email' },
    });

    res.status(202).json({
      data: {
        message: 'If that email is registered, a reset code is on its way.',
        expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
      },
    });
  }),
);

// SEC-083: set a new password with the emailed code. Every failure gives the
// same message, including the attempt cap, so it can't be used to find accounts.
authRouter.post(
  '/password/reset',
  passwordResetAttemptLimiter,
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { code, newPassword } = req.body;
    const invalidCode = () => new ApiError(400, 'Invalid or expired reset code');

    const user = await User.findOne({
      emailNormalized: normalizeEmail(req.body.email),
      role: { $in: PUBLIC_ROLES },
    });
    if (!user) throw invalidCode();

    const record = await PasswordResetCode.findOneAndUpdate(
      { userId: user._id, expiresAt: { $gt: new Date() } },
      { $inc: { attempts: 1 } },
      { returnDocument: 'after', sort: { createdAt: -1 } },
    );
    if (!record) throw invalidCode();

    if (record.attempts > PASSWORD_RESET_MAX_ATTEMPTS) {
      await PasswordResetCode.deleteMany({ userId: user._id });
      throw invalidCode();
    }

    if (!hashesMatch(record.codeHash, hashVerificationCode(code))) {
      await auditReq(req, {
        action: AUDIT_ACTIONS.PASSWORD_RESET,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: user._id,
        outcome: 'failure',
        metadata: { reason: 'invalid_code', attempts: record.attempts },
      });
      throw invalidCode();
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastFailedLogin = null;
    await revokeAllSessions(user);
    await user.save();
    await PasswordResetCode.deleteMany({ userId: user._id });

    await auditReq(req, {
      action: AUDIT_ACTIONS.PASSWORD_RESET,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: user._id,
      outcome: 'success',
    });

    itemResponse(res, { message: 'Password updated. Sign in with your new password.' });
  }),
);
```

- [ ] **Step 9: Declare the two routes public in the route manifest**

In `tests/security.p0.test.js`, add to `PUBLIC_ROUTES` after `'POST /api/auth/verification-code/verify',`:

```js
  'POST /api/auth/password/forgot',
  'POST /api/auth/password/reset',
```

and after `'POST /api/v1/auth/verification-code/verify',`:

```js
  'POST /api/v1/auth/password/forgot',
  'POST /api/v1/auth/password/reset',
```

- [ ] **Step 10: Run the new tests**

Run: `npm test -- tests/sec-083-084.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 11: Run everything**

Run: `npm run lint && npm test`
Expected: no lint problems; `Tests: 137 passed, 137 total`.

- [ ] **Step 12: Commit**

```bash
git add kredibble-backend/src kredibble-backend/tests
git commit -m "feat(auth): password reset by emailed code (SEC-083)"
git push
```

---

### Task 3: Change password (SEC-084, backend)

**Files:**
- Modify: `kredibble-backend/src/schemas/auth.js` (add `changePasswordSchema`)
- Modify: `kredibble-backend/src/routes/auth.js` (add `issueSession`, use it in `/login`, add `POST /password`)
- Test: `kredibble-backend/tests/sec-083-084.test.js` (append)

**Interfaces:**
- Consumes: `revokeAllSessions(user)` from Task 2.
- Produces: `issueSession(user, req) → Promise<{ token: string, refreshToken: string }>` (saves `user`).
- API: `POST /api/v1/auth/password {currentPassword, newPassword}` (Bearer) → `200 { data: { token, refreshToken } }`. The caller must replace its stored tokens with these: the old ones are revoked.

- [ ] **Step 1: Write the failing tests**

Append to `tests/sec-083-084.test.js`:

```js
const changePassword = (token, body) =>
  request(app).post('/api/v1/auth/password').set('Authorization', `Bearer ${token}`).send(body);

describe('SEC-084: change password', () => {
  it('changes the password, signs out other devices and keeps this one signed in', async () => {
    await createUser({ email: 'change@example.com' });
    const thisDevice = await login('change@example.com', PASSWORD);
    const otherDevice = await login('change@example.com', PASSWORD);

    const res = await changePassword(thisDevice.body.data.token, { currentPassword: PASSWORD, newPassword: NEW_PASSWORD });

    expect(res.status).toBe(200);
    expect((await me(otherDevice.body.data.token)).status).toBe(401);
    expect((await refresh(otherDevice.body.data.refreshToken)).status).toBe(401);
    expect((await me(res.body.data.token)).status).toBe(200);
    expect((await refresh(res.body.data.refreshToken)).status).toBe(200);
    expect((await login('change@example.com', NEW_PASSWORD)).status).toBe(200);
  });

  it('rejects a wrong current password with 400 and keeps the old password', async () => {
    await createUser({ email: 'change@example.com' });
    const session = await login('change@example.com', PASSWORD);

    const res = await changePassword(session.body.data.token, { currentPassword: 'WrongPassw0rd-z', newPassword: NEW_PASSWORD });

    expect(res.status).toBe(400);
    expect((await me(session.body.data.token)).status).toBe(200);
    expect((await login('change@example.com', PASSWORD)).status).toBe(200);
  });

  it('rejects reusing the current password', async () => {
    await createUser({ email: 'change@example.com' });
    const session = await login('change@example.com', PASSWORD);

    const res = await changePassword(session.body.data.token, { currentPassword: PASSWORD, newPassword: PASSWORD });

    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/sec-083-084.test.js`
Expected: FAIL — the 3 new tests get `404` (route not found) where they expect `200`/`400`.

- [ ] **Step 3: Add the schema**

In `src/schemas/auth.js`, at the end:

```js
export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
  }),
});
```

and add `changePasswordSchema` to the schema import in `src/routes/auth.js`:

```js
import { loginSchema, registerSchema, refreshSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema } from '../schemas/auth.js';
```

- [ ] **Step 4: Extract `issueSession` and use it in `/login`**

In `src/routes/auth.js`, add after `normalizeEmail`:

```js
/** Mint a refresh token for this device and the access token to go with it. Saves `user`. */
const issueSession = async (user, req) => {
  const refreshToken = generateRefreshToken();
  const tokenHash = hashRefreshTokenUtil(refreshToken);
  user.refreshTokenHash = tokenHash;
  await user.save();
  await RefreshToken.create({
    userId: user._id,
    tokenHash,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    deviceLabel: req.headers['user-agent'] || 'Unknown Device',
  });
  return { token: signToken(user), refreshToken };
};
```

In the `/login` handler, replace from `const refreshToken = generateRefreshToken();` through the closing `});` of `RefreshToken.create(...)` with:

```js
    const { token, refreshToken } = await issueSession(user, req);
```

and replace the response with:

```js
    res.json({
      data: { user: publicUser(finalUser), token, refreshToken },
    });
```

- [ ] **Step 5: Add the route**

After the `/password/reset` route:

```js
// SEC-084: change the password while signed in. Signs out every other device and
// hands this one a fresh session. A wrong current password is 400, not 401: the
// mobile client reads 401 as an expired session and signs the user out.
authRouter.post(
  '/password',
  requireAuth,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.auth.sub);
    if (!user?.passwordHash) throw new ApiError(404, 'User not found');

    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      await auditReq(req, {
        action: AUDIT_ACTIONS.PASSWORD_CHANGE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: user._id,
        outcome: 'failure',
        metadata: { reason: 'invalid_current_password' },
      });
      throw new ApiError(400, 'Current password is incorrect');
    }
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      throw new ApiError(400, 'New password must be different from the current one');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await revokeAllSessions(user);
    const session = await issueSession(user, req);

    await auditReq(req, {
      action: AUDIT_ACTIONS.PASSWORD_CHANGE,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: user._id,
      outcome: 'success',
    });

    itemResponse(res, session);
  }),
);
```

- [ ] **Step 6: Run the new tests**

Run: `npm test -- tests/sec-083-084.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 7: Run everything**

Run: `npm run lint && npm test`
Expected: no lint problems; `Tests: 140 passed, 140 total`. The login tests in `api.test.js` and `sec-053.test.js` still pass, which proves the `issueSession` refactor kept `/login` unchanged.

- [ ] **Step 8: Commit**

```bash
git add kredibble-backend/src kredibble-backend/tests
git commit -m "feat(auth): change password and sign out other devices (SEC-084)"
git push
```

---

### Task 4: Complete account deletion (SEC-065)

What deletion does, per the 2026-10-03 decision:

| Data | Action |
|---|---|
| Seeker profile, hirer account, applications (incl. CV link), event bookings, company verifications and documents, saved items, channel memberships, staff record, sessions, reset and verification codes | Delete |
| Files uploaded to Cloudinary under the user's folder | Delete |
| Community posts | Keep; author becomes "Deleted User", `authorId` cleared |
| Channels the user created | Keep; `createdBy` cleared (admins moderate them) |
| Job postings the user created | Keep; live ones (`pending`, `published`, `approved`) become `closed` |
| Audit log entries | Keep (security record, 1-year TTL); the email is removed from their metadata |
| User document | Kept as an anonymised shell so references don't dangle |
| Grant applications, reports | Not reachable: they store no user id (SEC-060) |

**Files:**
- Modify: `kredibble-backend/src/models/User.js` (`deleted` role, `UserTombstone`)
- Modify: `kredibble-backend/src/lib/cloudinary.js` (add `deleteUserMedia`)
- Create: `kredibble-backend/src/lib/account-deletion.js`
- Modify: `kredibble-backend/src/routes/auth.js` (rewrite `DELETE /me`)
- Create: `kredibble-backend/scripts/complete-account-deletions.js`
- Modify: `kredibble-backend/package.json` (script entry)
- Test: `kredibble-backend/tests/sec-065.test.js` (new)

**Interfaces:**
- Produces:
  - `userDataFilters(user) → Promise<{ seekerProfile, hirerAccount, applications, eventBookings, companyVerifications, verificationDocs, savedItems, channelMemberships, communityPosts, channels, opportunities, sessions }>`: one Mongo filter per key. Task 5 uses it.
  - `purgeUserData(user, { deleteMedia }?) → Promise<{ mediaDeleted: boolean }>`: idempotent.
  - `deleteAccount(user, { deleteMedia }?) → Promise<{ deletedAt: Date }>`.
  - `deleteUserMedia(userId: string) → Promise<void>`; a no-op under `NODE_ENV=test`.
  - `UserTombstone` model: `userId`, `emailHash`, `status: 'pending'|'completed'`, `mediaDeleted`, `deletedAt`, `completedAt`, `retentionUntil` (TTL).
- API: `DELETE /api/v1/auth/me {password, confirmation: 'DELETE MY ACCOUNT'}` → `200 { data: { message, deletedAt } }`. A wrong password is now **400** (was 401).

- [ ] **Step 1: Write the failing tests**

Create `tests/sec-065.test.js`:

```js
import { jest } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { User, SavedItem, AuditLog, UserTombstone } from '../src/models/User.js';
import { SeekerProfile, HirerAccount } from '../src/models/Profiles.js';
import { Opportunity, Applicant, Event, EventAttendee, CompanyVerification, VerificationDoc } from '../src/models/Platform.js';
import { Channel, ChannelPost, CommunityMembership } from '../src/models/Community.js';
import { deleteAccount } from '../src/lib/account-deletion.js';

const PASSWORD = 'DeleteMe-Passw0rd';
const EMAIL = 'Ama.Mensah@Example.com';
const NAME = 'Ama Mensah';
const PHONE = '+233201234567';
const CONFIRMATION = 'DELETE MY ACCOUNT';

const login = (email, password) => request(app).post('/api/v1/auth/login').send({ email, password });
const deleteMe = (token, body) =>
  request(app).delete('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).send(body);

const opportunityFields = { title: 'Engineer', type: 'job', company: 'Acme', location: 'Accra', description: 'Build things' };

/** A seeker who has touched every collection deletion has to clean up. */
const seedSeeker = async () => {
  const user = await User.create({ name: NAME, email: EMAIL, role: 'seeker', passwordHash: await bcrypt.hash(PASSWORD, 12) });
  const employer = await User.create({ name: 'Acme Recruiter', email: 'recruiter@example.com', role: 'hirer', passwordHash: 'x' });
  await SeekerProfile.create({ userId: user._id, profession: 'Engineer', phone: PHONE });
  const opportunity = await Opportunity.create({ ...opportunityFields, createdBy: employer._id, moderationStatus: 'published', vetted: true });
  await Applicant.create({ opportunityId: opportunity._id, seekerId: user._id, name: NAME, resumeUrl: 'https://res.cloudinary.com/x/cv.pdf' });
  const event = await Event.create({ title: 'Meetup', hirer: 'Acme', location: 'Accra', dateTime: '2026-11-01T10:00', capacity: 10 });
  await EventAttendee.create({ eventId: event._id, fullName: NAME, email: EMAIL.toLowerCase() });
  const channel = await Channel.create({ name: 'Ama builds', category: 'Tech', createdBy: user._id });
  await ChannelPost.create({ channelId: channel._id, authorId: user._id, authorName: NAME, body: 'Hello' });
  await CommunityMembership.create({ channelId: channel._id, userId: user._id, status: 'active' });
  await SavedItem.create({ userId: user._id, itemId: opportunity._id, itemType: 'opportunities' });
  await AuditLog.create({ action: 'auth.login.failure', outcome: 'failure', metadata: { email: EMAIL, reason: 'invalid_password' } });
  return { user, opportunity, channel };
};

/** Every document in every collection that still contains the person's email, name or phone. */
const findPersonalData = async () => {
  const needles = [EMAIL.toLowerCase(), NAME.toLowerCase(), PHONE];
  const hits = [];
  for (const [name, collection] of Object.entries(mongoose.connection.collections)) {
    for (const doc of await collection.find({}).toArray()) {
      const text = JSON.stringify(doc).toLowerCase();
      for (const needle of needles) {
        if (text.includes(needle.toLowerCase())) hits.push(`${name}: ${needle}`);
      }
    }
  }
  return hits;
};

describe('SEC-065: account deletion', () => {
  it('erases personal data, keeps public content anonymised and signs the user out', async () => {
    const { user, opportunity, channel } = await seedSeeker();
    const session = await login(EMAIL, PASSWORD);

    const res = await deleteMe(session.body.data.token, { password: PASSWORD, confirmation: CONFIRMATION });

    expect(res.status).toBe(200);
    expect(await findPersonalData()).toEqual([]);

    const tombstone = await UserTombstone.findOne({ userId: user._id }).lean();
    expect(tombstone).toMatchObject({ status: 'completed', mediaDeleted: true });
    expect(tombstone.emailHash).toMatch(/^[0-9a-f]{64}$/);

    const post = await ChannelPost.findOne({ channelId: channel._id }).lean();
    expect(post).toMatchObject({ authorName: 'Deleted User', authorId: null, body: 'Hello' });
    expect(await Channel.countDocuments({ _id: channel._id })).toBe(1);
    expect(await Opportunity.countDocuments({ _id: opportunity._id })).toBe(1);

    expect((await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${session.body.data.token}`)).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: session.body.data.refreshToken })).status).toBe(401);
    expect((await login(EMAIL, PASSWORD)).status).toBe(401);
  });

  it('closes live postings and removes company records for a hirer', async () => {
    const hirer = await User.create({ name: 'Kofi Boateng', email: 'kofi@example.com', role: 'hirer', passwordHash: await bcrypt.hash(PASSWORD, 12) });
    const account = await HirerAccount.create({ userId: hirer._id, companyName: 'Boateng Ltd', recruiterPhone: '+233209999999' });
    const live = await Opportunity.create({ ...opportunityFields, createdBy: hirer._id, hirerId: account._id, moderationStatus: 'published', vetted: true });
    await CompanyVerification.create({ hirerId: account._id, name: 'Boateng Ltd', recruiterEmail: 'kofi@example.com' });
    await VerificationDoc.create({ companyId: account._id, fileName: 'certificate.pdf' });
    const session = await login('kofi@example.com', PASSWORD);

    const res = await deleteMe(session.body.data.token, { password: PASSWORD, confirmation: CONFIRMATION });

    expect(res.status).toBe(200);
    expect((await Opportunity.findById(live._id).lean()).moderationStatus).toBe('closed');
    expect(await HirerAccount.countDocuments()).toBe(0);
    expect(await CompanyVerification.countDocuments()).toBe(0);
    expect(await VerificationDoc.countDocuments()).toBe(0);
  });

  it('rejects a wrong password with 400 and deletes nothing', async () => {
    const { user } = await seedSeeker();
    const session = await login(EMAIL, PASSWORD);

    const res = await deleteMe(session.body.data.token, { password: 'WrongPassw0rd-z', confirmation: CONFIRMATION });

    expect(res.status).toBe(400);
    expect(await SeekerProfile.countDocuments({ userId: user._id })).toBe(1);
    expect(await UserTombstone.countDocuments()).toBe(0);
  });

  it('asks Cloudinary to delete the user\'s files and finishes even when that fails', async () => {
    const { user } = await seedSeeker();
    const deleteMedia = jest.fn().mockRejectedValue(new Error('cloudinary down'));

    await deleteAccount(await User.findById(user._id), { deleteMedia });

    expect(deleteMedia).toHaveBeenCalledWith(String(user._id));
    expect(await UserTombstone.findOne({ userId: user._id }).lean()).toMatchObject({ status: 'completed', mediaDeleted: false });
    expect(await findPersonalData()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/sec-065.test.js`
Expected: FAIL — `The requested module '../src/models/User.js' does not provide an export named 'UserTombstone'`.

- [ ] **Step 3: Add the `deleted` role and the tombstone model**

In `src/models/User.js`, change the role line:

```js
  role: { type: String, required: true, enum: ['seeker', 'hirer', 'admin', 'deleted'] },
```

(`registerSchema` still only allows `seeker` and `hirer`, so nobody can sign up as `deleted`.)

After the `PasswordResetCode` export:

```js
// SEC-065: record that an account was erased. Holds a hash of the email, never the email.
const userTombstoneSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  emailHash: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending', index: true },
  mediaDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, required: true },
  completedAt: { type: Date },
  retentionUntil: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

export const UserTombstone = mongoose.model('UserTombstone', userTombstoneSchema);
```

- [ ] **Step 4: Add `deleteUserMedia`**

In `src/lib/cloudinary.js`, at the end:

```js
/**
 * SEC-065: delete every file a user uploaded. The upload route builds
 * `kredibble/<userId>/<purpose>` and the upload helpers prefix `kredibble/`
 * again, so files live under `kredibble/kredibble/<userId>/`. Clear both forms.
 */
export const deleteUserMedia = async (userId) => {
  if (isTest) return;
  if (![process.env.CLOUDINARY_CLOUD_NAME, process.env.CLOUDINARY_API_KEY, process.env.CLOUDINARY_API_SECRET].every(Boolean)) {
    throw new Error('Cloudinary is not configured');
  }

  for (const prefix of [`kredibble/kredibble/${userId}/`, `kredibble/${userId}/`]) {
    for (const resourceType of ['image', 'raw', 'video']) {
      await cloudinary.api.delete_resources_by_prefix(prefix, { resource_type: resourceType });
    }
  }
};
```

- [ ] **Step 5: Create the deletion module**

Create `src/lib/account-deletion.js`:

```js
import crypto from 'node:crypto';
import {
  User, RefreshToken, SavedItem, EmailVerificationCode, PasswordResetCode, StaffMember, AuditLog, UserTombstone,
} from '../models/User.js';
import { SeekerProfile, HirerAccount } from '../models/Profiles.js';
import { Applicant, EventAttendee, CompanyVerification, VerificationDoc, Opportunity } from '../models/Platform.js';
import { Channel, ChannelPost, CommunityMembership } from '../models/Community.js';
import { deleteUserMedia } from './cloudinary.js';
import logger from './logger.js';

// Q11: the retention period is pending legal review.
const TOMBSTONE_RETENTION_MS = 7 * 365 * 24 * 60 * 60 * 1000;
const DELETED_NAME = 'Deleted User';
const LIVE_OPPORTUNITY_STATUSES = ['pending', 'published', 'approved'];

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const hashEmail = (email) =>
  crypto.createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex');

/**
 * Where a user's data lives, as one filter per collection. Deletion and the data
 * export both use this, so they cannot drift apart.
 *
 * Grant applications and reports store no user id (SEC-060), so they can't be
 * found here yet.
 */
export async function userDataFilters(user) {
  const userId = user._id;
  // Bookings and log lines keep the email as it was typed, so match any casing.
  const email = new RegExp(`^${escapeRegex(String(user.email).trim())}$`, 'i');
  // Company records hold either a HirerAccount id or a User id, depending on
  // which code path wrote them (SEC-047), so match both.
  const hirer = await HirerAccount.findOne({ userId }).select('_id').lean();
  const companyIds = hirer ? [hirer._id, userId] : [userId];

  return {
    seekerProfile: { userId },
    hirerAccount: { userId },
    applications: { seekerId: userId },
    eventBookings: { email },
    companyVerifications: { hirerId: { $in: companyIds } },
    verificationDocs: { companyId: { $in: companyIds } },
    savedItems: { userId },
    channelMemberships: { userId },
    communityPosts: { authorId: userId },
    channels: { createdBy: userId },
    opportunities: { createdBy: userId },
    sessions: { userId },
  };
}

/**
 * Delete what is private, strip the person from what stays public, then
 * anonymise the user document. Every step is idempotent, so an interrupted run
 * can be repeated (scripts/complete-account-deletions.js).
 */
export async function purgeUserData(user, { deleteMedia = deleteUserMedia } = {}) {
  const userId = user._id;
  const where = await userDataFilters(user);
  const email = where.eventBookings.email;

  await Promise.all([
    SeekerProfile.deleteMany(where.seekerProfile),
    Applicant.deleteMany(where.applications),
    EventAttendee.deleteMany(where.eventBookings),
    CompanyVerification.deleteMany(where.companyVerifications),
    VerificationDoc.deleteMany(where.verificationDocs),
    SavedItem.deleteMany(where.savedItems),
    CommunityMembership.deleteMany(where.channelMemberships),
    RefreshToken.deleteMany(where.sessions),
    StaffMember.deleteMany({ userId }),
    PasswordResetCode.deleteMany({ userId }),
    EmailVerificationCode.deleteMany({ email }),
    ChannelPost.updateMany(where.communityPosts, { $set: { authorName: DELETED_NAME, authorId: null } }),
    Channel.updateMany(where.channels, { $set: { createdBy: null } }),
    Opportunity.updateMany(
      { ...where.opportunities, moderationStatus: { $in: LIVE_OPPORTUNITY_STATUSES } },
      { $set: { moderationStatus: 'closed' } },
    ),
    AuditLog.updateMany({ 'metadata.email': email }, { $unset: { 'metadata.email': '' } }),
  ]);
  // After the rest: a re-run finds company records through this account.
  await HirerAccount.deleteMany(where.hirerAccount);

  let mediaDeleted = false;
  try {
    await deleteMedia(String(userId));
    mediaDeleted = true;
  } catch (error) {
    logger.error({ err: error.message, userId: String(userId) }, 'Account media deletion failed');
  }

  // Last: the steps above match on the email.
  const placeholder = `deleted_${userId}@kredibble.local`;
  await User.updateOne(
    { _id: userId },
    {
      $set: { name: DELETED_NAME, email: placeholder, emailNormalized: placeholder, emailVerified: false, role: 'deleted' },
      $unset: { passwordHash: '', avatarUrl: '', refreshTokenHash: '', lockUntil: '', lastFailedLogin: '' },
    },
  );

  return { mediaDeleted };
}

/**
 * SEC-065: erase an account. Access is cut first, so the person is signed out
 * everywhere even if a later step fails; the tombstone stays `pending` until
 * every step has run.
 */
export async function deleteAccount(user, deps = {}) {
  const deletedAt = new Date();
  await UserTombstone.updateOne(
    { userId: user._id },
    {
      $setOnInsert: {
        emailHash: hashEmail(user.email),
        status: 'pending',
        mediaDeleted: false,
        deletedAt,
        retentionUntil: new Date(deletedAt.getTime() + TOMBSTONE_RETENTION_MS),
      },
    },
    { upsert: true },
  );

  await User.updateOne({ _id: user._id }, { $set: { role: 'deleted' }, $inc: { tokenVersion: 1 } });
  await RefreshToken.deleteMany({ userId: user._id });

  const { mediaDeleted } = await purgeUserData(user, deps);

  await UserTombstone.updateOne(
    { userId: user._id },
    { $set: { status: 'completed', completedAt: new Date(), mediaDeleted } },
  );
  return { deletedAt };
}
```

- [ ] **Step 6: Rewrite `DELETE /me`**

In `src/routes/auth.js`, add the import:

```js
import { deleteAccount } from '../lib/account-deletion.js';
```

Replace the whole `authRouter.delete('/me', ...)` route and its 3 comment lines above it with:

```js
// SEC-065: erase the account. Needs the password and a typed confirmation.
// A wrong password is 400, not 401: the mobile client reads 401 as an expired
// session and would sign the user out.
authRouter.delete(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { password, confirmation } = req.body;
    if (confirmation !== 'DELETE MY ACCOUNT') {
      throw new ApiError(400, 'Please type "DELETE MY ACCOUNT" to confirm');
    }
    if (!password) {
      throw new ApiError(400, 'Password confirmation required for account deletion');
    }

    const userId = req.auth.sub;
    const user = await User.findById(userId).select('+passwordHash');
    if (!user?.passwordHash) throw new ApiError(404, 'User not found');

    if (!(await bcrypt.compare(password, user.passwordHash))) {
      await auditReq(req, {
        action: AUDIT_ACTIONS.ACCOUNT_DELETE,
        resourceType: AUDIT_RESOURCE_TYPES.USER,
        resourceId: userId,
        outcome: 'failure',
        metadata: { reason: 'invalid_password' },
      });
      throw new ApiError(400, 'Incorrect password');
    }

    const { deletedAt } = await deleteAccount(user);

    await auditReq(req, {
      action: AUDIT_ACTIONS.ACCOUNT_DELETE,
      resourceType: AUDIT_RESOURCE_TYPES.USER,
      resourceId: userId,
      outcome: 'success',
      metadata: { reason: 'user_request' },
    });

    res.json({ data: { message: 'Your account and personal data have been deleted.', deletedAt } });
  }),
);
```

- [ ] **Step 7: Run the new tests**

Run: `npm test -- tests/sec-065.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 8: Add the recovery script**

Create `scripts/complete-account-deletions.js`:

```js
// SEC-065: finish account deletions that stopped part-way. A tombstone stays
// `pending`, or has `mediaDeleted: false`, when a step failed. Every step is
// idempotent, so running the purge again completes it.
//
// Usage: npm run accounts:complete-deletions
import mongoose from 'mongoose';
import { connectToDatabase } from '../src/lib/mongodb.js';
import { User, UserTombstone } from '../src/models/User.js';
import { purgeUserData } from '../src/lib/account-deletion.js';
import logger from '../src/lib/logger.js';

// Leave deletions that may still be running alone.
const MIN_AGE_MS = 10 * 60 * 1000;

const run = async () => {
  await connectToDatabase();
  const tombstones = await UserTombstone.find({
    $or: [{ status: 'pending' }, { mediaDeleted: false }],
    deletedAt: { $lt: new Date(Date.now() - MIN_AGE_MS) },
  });

  for (const tombstone of tombstones) {
    const user = await User.findById(tombstone.userId);
    if (!user) continue;
    const { mediaDeleted } = await purgeUserData(user);
    tombstone.set({ status: 'completed', completedAt: new Date(), mediaDeleted });
    await tombstone.save();
    logger.info({ userId: String(user._id), mediaDeleted }, 'Account deletion completed');
  }
  return tombstones.length;
};

run()
  .then((count) => {
    logger.info({ count }, 'Unfinished account deletions processed');
    return mongoose.disconnect();
  })
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error({ err: error.message }, 'Completing account deletions failed');
    process.exit(1);
  });
```

In `package.json`, add to `"scripts"` after `"user:create-admin"`:

```json
        "accounts:complete-deletions": "node scripts/complete-account-deletions.js",
```

- [ ] **Step 9: Run everything**

Run: `npm run lint && npm test`
Expected: no lint problems; `Tests: 144 passed, 144 total`.

- [ ] **Step 10: Commit**

```bash
git add kredibble-backend/src kredibble-backend/tests kredibble-backend/scripts/complete-account-deletions.js kredibble-backend/package.json
git commit -m "feat(gdpr): account deletion removes all personal data (SEC-065)"
git push
```

---

### Task 5: Data export uses the same data map (SEC-029)

The export looks records up by fields that don't exist (`applicantEmail`, `authorEmail`, `reporterEmail`, `CompanyVerification.userId`, `Notification.userId`), so it misses most of a user's data, and it exports refresh-token hashes.

**Files:**
- Modify: `kredibble-backend/src/routes/auth.js` (rewrite `GET /me/export`, update imports)
- Test: `kredibble-backend/tests/sec-065.test.js` (append)

**Interfaces:**
- Consumes: `userDataFilters(user)` from Task 4.
- API: `GET /api/v1/auth/me/export` returns `{ user, seekerProfile, hirerAccount, applications, eventBookings, companyVerifications, verificationDocs, savedItems, channelMemberships, communityPosts, channels, opportunities, sessions, exportedAt }`. `sessions` holds `deviceLabel`, `createdAt`, `expiresAt`, `revokedAt` only. The old keys `eventAttendees`, `grantApplications`, `verifications`, `notifications`, `channelPosts`, `reports`, `refreshTokens` are gone; no client reads them.

- [ ] **Step 1: Write the failing test**

Append to `tests/sec-065.test.js`:

```js
describe('SEC-029: data export', () => {
  it('returns every record deletion would remove, without token hashes', async () => {
    await seedSeeker();
    const session = await login(EMAIL, PASSWORD);

    const res = await request(app).get('/api/v1/auth/me/export').set('Authorization', `Bearer ${session.body.data.token}`);

    expect(res.status).toBe(200);
    expect(res.body.seekerProfile.phone).toBe(PHONE);
    expect(res.body.applications).toHaveLength(1);
    expect(res.body.eventBookings).toHaveLength(1);
    expect(res.body.communityPosts).toHaveLength(1);
    expect(res.body.channels).toHaveLength(1);
    expect(res.body.channelMemberships).toHaveLength(1);
    expect(res.body.savedItems).toHaveLength(1);
    expect(res.body.sessions).toHaveLength(1);
    expect(res.body.sessions[0]).not.toHaveProperty('tokenHash');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/sec-065.test.js`
Expected: FAIL — `res.body.eventBookings` is `undefined` (the current export names it `eventAttendees`).

- [ ] **Step 3: Rewrite the export**

In `src/routes/auth.js`, replace the model imports with:

```js
import { User, RefreshToken, hashRefreshToken as hashRefreshTokenUtil, EmailVerificationCode, PasswordResetCode } from '../models/User.js';
import { SeekerProfile, HirerAccount } from '../models/Profiles.js';
import { Applicant, EventAttendee, CompanyVerification, VerificationDoc, Opportunity } from '../models/Platform.js';
import { Channel, ChannelPost, CommunityMembership } from '../models/Community.js';
import { SavedItem } from '../models/User.js';
```

(this drops `RevokedRefreshToken`, `GrantApplication`, `Report` and the `Notification` import line), and change the deletion import to:

```js
import { deleteAccount, userDataFilters } from '../lib/account-deletion.js';
```

Replace the body of the `authRouter.get('/me/export', ...)` handler, from `// Gather all related data` through the closing `};` of `exportData`, with:

```js
    const where = await userDataFilters(user);
    const [
      seekerProfile, hirerAccount, applications, eventBookings, companyVerifications, verificationDocs,
      savedItems, channelMemberships, communityPosts, channels, opportunities, sessions,
    ] = await Promise.all([
      SeekerProfile.findOne(where.seekerProfile).lean(),
      HirerAccount.findOne(where.hirerAccount).lean(),
      Applicant.find(where.applications).lean(),
      EventAttendee.find(where.eventBookings).lean(),
      CompanyVerification.find(where.companyVerifications).lean(),
      VerificationDoc.find(where.verificationDocs).lean(),
      SavedItem.find(where.savedItems).lean(),
      CommunityMembership.find(where.channelMemberships).lean(),
      ChannelPost.find(where.communityPosts).lean(),
      Channel.find(where.channels).lean(),
      Opportunity.find(where.opportunities).lean(),
      // Device and dates only: token hashes stay on the server.
      RefreshToken.find(where.sessions).select('deviceLabel createdAt expiresAt revokedAt').lean(),
    ]);

    const exportData = {
      user: publicUser(user),
      seekerProfile,
      hirerAccount,
      applications,
      eventBookings,
      companyVerifications,
      verificationDocs,
      savedItems,
      channelMemberships,
      communityPosts,
      channels,
      opportunities,
      sessions,
      exportedAt: new Date().toISOString(),
    };
```

Keep the `auditReq` call and the three `res.set` / `res.send` lines below it unchanged.

- [ ] **Step 4: Run the test**

Run: `npm test -- tests/sec-065.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run everything**

Run: `npm run lint && npm test`
Expected: no lint problems (an unused import would show here); `Tests: 145 passed, 145 total`.

- [ ] **Step 6: Commit**

```bash
git add kredibble-backend/src kredibble-backend/tests
git commit -m "fix(gdpr): data export finds the records it was missing (SEC-029)"
git push
```

---

### Task 6: Tracker, CI and pull request

**Files:**
- Modify: `task.md` (status table rows SEC-065, SEC-071, SEC-083, SEC-084; SEC-065/083/084 acceptance boxes; Progress Log; Open Questions Q11)
- Modify: `PLAN-phase-3-roadmap.md` (Plan 1 status)

- [ ] **Step 1: Update `task.md`**

Status table:

```
| SEC-065 | GDPR deletion incomplete (tombstone, media, owned content) | P1 | Backend | ✅ Done |
| SEC-071 | Backend test suite red (10/102 failing) | P1 | Backend tests | ✅ Done |
| SEC-083 | Forgot-password flow is UI-only (no backend) | P1 | Mobile + Backend | 🟡 Backend done; screen in Plan 3 |
| SEC-084 | Change password and delete account not wired (store requirement) | P1 | Mobile + Backend | 🟡 Backend done; screens in Plan 3 |
```

Tick the SEC-065 acceptance boxes. Under SEC-083 and SEC-084, tick only the backend criteria ("old password and old sessions stop working", "response doesn't reveal whether the email exists", "changing the password works and signs out other sessions").

Add to the Progress Log (use the real commit SHAs and the test count `npm test` printed):

```
| 2026-10-03 | SEC-083, SEC-084 (backend) | <sha> | Done | `POST /auth/password/forgot` (always 202, no admin resets), `POST /auth/password/reset` (CSPRNG code, 10-min TTL, 5 attempts, same error for every failure), `POST /auth/password` (signs out other devices, returns a fresh session). Wrong-password re-auth is 400 so the mobile client doesn't sign the user out. |
| 2026-10-03 | SEC-065, SEC-029 | <sha> | Done | Deletion per the 2026-10-03 decision: private data deleted, public content anonymised, live postings closed, Cloudinary folder cleared, `UserTombstone` persisted (email hash only), access cut first. Ordered + idempotent instead of a transaction; `npm run accounts:complete-deletions` finishes interrupted runs. Export now uses the same data map. Grant applications and reports still unreachable (SEC-060). |
| 2026-10-03 | SEC-071 | <sha> | Done | Backend lint clean, <n>/<n> tests pass locally and in CI. |
```

Under Open Questions, item 11, append:

```
   **2026-10-03 decision:** on deletion, private data is deleted and public content anonymised; live postings close. Tombstone retention stays 7 years pending legal review (it holds an email hash, not the email). Audit logs keep their 1-year TTL with emails removed.
```

- [ ] **Step 2: Update the roadmap**

In `PLAN-phase-3-roadmap.md`, set Plan 1's status to `In review (PR #<n>)`.

- [ ] **Step 3: Commit and push**

```bash
git add task.md PLAN-phase-3-roadmap.md
git commit -m "docs: record SEC-065, SEC-071, SEC-083, SEC-084 backend progress"
git push
```

- [ ] **Step 4: Open the pull request**

```bash
gh pr create --base main --title "Account security: password reset, change password, full account deletion" --body-file <file with summary, test evidence, and the API changes for the mobile client>
```

The body must list the API changes the mobile app (Plan 3) has to handle: `DELETE /auth/me` and `POST /auth/password` answer 400 for a wrong password; `POST /auth/password` returns new tokens that replace the stored ones.

- [ ] **Step 5: Confirm CI**

The `Backend (lint, test)` job must pass. If it fails, read the log (`gh run view <id> --log-failed`) and fix the cause; never mask a step.
