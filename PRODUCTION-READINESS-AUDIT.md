# Kredibble — Production Readiness Audit

**Date:** 2026-10-02
**Code audited:** `main` @ `3ffc51d` (merge of PR #18), all three apps
**Method:** full read of backend routes/models/middleware/libs, admin + mobile API layers; ran every test suite, linter, type-checker, `npm audit`; ran the **real Express + Socket.io app against a throwaway in-memory MongoDB** and exercised ~40 behaviours end to end; read-only anonymous checks against the two live backends.
**Proposed IDs:** new findings are numbered `SEC-041+` / `OPS-*` / `PROD-*` so they can be added to `task.md` (not edited here — another process has uncommitted changes in it).

> **Sensitive.** Section 0 describes a live, exploitable exposure. Keep this file out of public channels until it is fixed.

---

## Verdict

**Not ready for real users.** The security foundations from the SEC-001…040 sweep are real (bcrypt-12, Zod on auth, Helmet, Socket.io handshake auth, upload magic-byte checks, profile/opportunity ownership), but:

1. A **live backend is leaking every user's password hash to the internet right now** (Section 0).
2. **The current code cannot be deployed**: the backend lockfile breaks `npm ci` (Docker/CI/Render), the admin production build fails, and the production config refuses to boot without keys for a feature that isn't mounted.
3. **Core user journeys are broken** even when it does run: applying to a job returns HTTP 500, community posting is 404, notifications are always empty, the admin panel cannot authenticate against its own data routes, and mobile sessions die after 15 minutes.
4. `task.md` marks all 40 findings ✅, but several "done" items are **not actually implemented** or are implemented incorrectly (Section 6). Treat the tracker as unverified.

### Readiness scorecard

| Area | State | Blocking launch? |
|---|---|---|
| Live deployment security | 🔴 Anonymous read of users incl. password hashes on Vercel backend | **Yes — fix today** |
| Deployability (CI/CD, Docker, config) | 🔴 `npm ci` fails, admin build fails, prod boot fails with `render.yaml` env | Yes |
| Backend core flows | 🔴 Apply-to-job 500, community posts 404, notifications empty, admin/AI/news routers unmounted | Yes |
| AuthN/AuthZ | 🟠 Rate limiting ineffective, lockout never persists, token revocation no-op, several IDORs | Yes |
| Privacy / PII | 🟠 Any signed-in user can harvest all emails; seeker phones exposed; attendee emails exposed | Yes |
| Admin dashboard | 🔴 Build fails; CSP blocks API; cookie auth can't reach data routes; 20 of ~25 pages on mock data | Yes (for ops) |
| Mobile app | 🟠 No token refresh; job/internship/event/grant detail screens hardcoded; AI assistant canned; forgot-password fake; no in-app account deletion | Yes |
| Tests | 🟠 Backend 92/102 (10 failing); mobile 20/20; admin e2e can't run in CI | Yes (CI gate) |
| Dependencies | 🟠 Admin: Next.js **critical** CVEs (RCE/SSRF); mobile: 4 high; backend: 0 | Yes (admin) |
| Ops (monitoring, Redis, hosting, backups) | 🔴 None in place; Render free tier sleeps (21 s cold start measured) | Yes |
| Store/legal (privacy policy, ToS, app identity) | 🔴 Not present | Yes |

---

## 0. LIVE INCIDENT — do this first

**SEC-041 — `kredibble-backend.vercel.app` serves pre-hardening code with anonymous data access.**

Measured 2026-10-02 (anonymous `GET`, no credentials):

| Request | Result |
|---|---|
| `GET https://kredibble-backend.vercel.app/api/users` | **200**, 10 users (6 admin, 1 hirer, 3 seeker). Fields: `id, name, email, role, passwordHash, createdAt, updatedAt` — **bcrypt hashes are public** |
| `GET …/api/dashboard/summary` | 200 (should be admin-only) |
| `GET …/api/v1/health` | 404 → this deployment predates SEC-019; it is not running `main` |
| `GET …/api/health` | 200, `database: connected` |

The task log records the test admin being created "against production DB", and that account appears in this response — so this deployment is very likely attached to the production database. The pre-SEC-002 code also allowed anonymous **writes** (create/patch/delete on `/api/users`, including `role`); I did not test writes against production. The README advertises seeded accounts with `password123`, which falls to an offline crack instantly.

**This is also the URL the admin app's `.env.production` points at** (`NEXT_PUBLIC_API_URL=https://kredibble-backend.vercel.app/api`).

**Immediate actions (in order):**
1. Take the Vercel backend project offline (pause the project or remove the production deployment) — or, at minimum, rotate its `DATABASE_URL` credentials in Atlas so it can no longer reach the DB.
2. Force a password reset for every account that existed while it was live; delete/rotate the seeded `password123` accounts and every admin created by `create-admin.js`. Rotate `JWT_SECRET` / `ADMIN_JWT_SECRET` on every environment (the old code had hardcoded fallback secrets — SEC-006).
3. Audit the database for tampering: users whose `role` became `admin`, unexpected users, edited/deleted opportunities. Check Atlas access logs for the exposure window.
4. Decide on **one** backend host (see OPS-3) and repoint the admin app to it.

---

## 1. Deploy blockers (nothing new can ship until these are fixed)

| ID | Finding | Evidence | Fix |
|---|---|---|---|
| **OPS-1** | Backend `package-lock.json` on `main` is out of sync with `package.json` — `npm ci` fails (`Missing: ioredis@5.11.1, rate-limit-redis@6.0.1 …`). The Dockerfile (`npm ci --omit=dev`), CI backend job, and Render deploy all fail at install. | Reproduced from a clean `git archive HEAD` copy. (The `devops/ci-cd-green` work in progress appears to be addressing lockfiles — verify it covers this.) | Regenerate the lockfile inside the backend dir with the Node/npm version CI uses; add `npm ci` to the PR gate so drift fails fast. |
| **OPS-2** | Admin `next build` fails on a type error, so the admin cannot deploy. | `kredibble-admin/src/app/(dashboard)/opportunities/page.tsx:47` — `data as Opportunity[]` from `Record<string, unknown>[]` | Type `getOpportunities()` properly (or `as unknown as`, then validate). Add `npm run build` to admin CI (it currently runs lint + Playwright only). |
| **OPS-3** | Production config refuses to boot with the env `render.yaml` provides: `CRITICAL ERROR: the configured openai API key is missing.` It also requires Resend. The AI assistant route is **not even mounted** (see SEC-045). | `kredibble-backend/src/config/env.js:93-99`; reproduced with `render.yaml`'s variables | Only require a provider key when the feature is enabled (`AI_ENABLED`, `EMAIL_ENABLED`), or mount the feature. Add the real required vars to `render.yaml` (`REDIS_URL`, `RESEND_*`, `CLOUDINARY_*`). |
| **OPS-4** | Two divergent backends: admin → Vercel (`kredibble-backend.vercel.app`, old code), mobile → Render (`kredibble-api.onrender.com`, newer code, `/api-docs` Swagger publicly reachable). Vercel is serverless, so **Socket.io cannot work there** and in-memory rate-limit/lockout state is per-invocation. Render `plan: free` sleeps after 15 min — measured **21.6 s** cold start, which will time out mobile requests. | `eas.json`, `kredibble-admin/.env.production`, `render.yaml`, live probes | Pick one always-on host (Render paid / Railway / Fly) for the API + sockets, put it on a custom domain (`api.kredibble.app`), retire the Vercel backend project. |
| **OPS-5** | CI doesn't actually gate: the mobile job runs `npm run lint \|\| echo "No lint script yet"` (lint has **45 errors**, masked); no mobile `tsc` (5 errors); admin Playwright runs with no backend/admin server (`webServer` commented out in `playwright.config.ts:74`), so it cannot pass; no admin `build` step; backend job has no lint/typecheck. | `.github/workflows/ci.yml` | Make every job fail on lint/typecheck/build/test; start servers for e2e or move e2e to a separate workflow against a preview env; require CI on PRs to `main`. |
| **OPS-6** | Backend suite is red: **10 of 102 tests fail** (task log says "all 90 pass"). Failures expect features that the merge of PR #18 dropped or never mounted: public vetted-opportunity feed, `/api/admin/*` portal, opportunity view/referral tracking, socket channel join for test fixtures, upload error copy. | `npm test` in `kredibble-backend` | Decide which design wins (see SEC-045), then make the suite green and keep it green. |

---

## 2. Broken core functionality (verified live)

| ID | Finding | Evidence (probe result) | Fix |
|---|---|---|---|
| **SEC-042** | **Applying to any opportunity returns HTTP 500** (`logger is not defined`). The application *is* saved, so users retry and create duplicates (2 rows after one retry). Same failure for **grant applications** and **verification-document uploads**. Root cause: `src/lib/audit.js` uses `logger` without importing it, and the mounted router passes `AUDIT_ACTIONS.CREATE`, which doesn't exist, so `AuditLog.create` fails and the catch block throws. | `audit.js:~86`, `routes/index.js:774,798,821` | Import the logger in `audit.js`; add the missing action constant; make audit failures truly non-fatal; add a test that asserts 201 on these three routes. |
| **SEC-043** | **Community posting is 404.** `POST/GET /community/channels/:id/posts` exist only on the dead module-level `apiRouter`; `createApiRouter()` (the one mounted) omits them. The mobile feed calls them. | `routes/index.js:492-520` vs `662-966` | Delete the dead `apiRouter` copy (~300 duplicated lines) and add the posts routes to the factory, with a test. |
| **SEC-044** | **Notifications are always empty for users.** The list filter forces `userId = req.auth.sub` for non-admins, but the `Notification` schema has no `userId` (they're broadcast by `audience`). | Admin creates notification → 201; seeker `GET /notifications` → 0 items | Filter by `audience in ['all', role]`, or add per-user delivery records. |
| **SEC-045** | **Admin-portal API, AI assistant, and news routers are never mounted** (`adminRouter` ~600 lines, `assistantRouter`, `newsRouter`). All return 404. | `/api/v1/admin/*`, `/assistant/chat`, `/news` → 404 | Mount them (with the right auth) or delete them and the env requirements that depend on them. |
| **SEC-046** | **Admin dashboard shows zeros**: the mounted `/dashboard/summary` returns `{users, seekers, hirers, …}`; the admin UI reads `pendingVerifications, activeSeekers, activeHirers, openReports`. | `routes/index.js:841-872` vs `admin/src/app/(dashboard)/page.tsx:36-94` | Return the shape the UI uses (the dead router's version already does). |
| **SEC-047** | **Opportunities never show their company.** Ownership writes `hirerId = <User id>`, but the schema ref is `HirerAccount`, so populate returns `null`. Seeded data that uses real `HirerAccount` ids can't be edited by its own hirer. | `models/Platform.js:14`, `routes/index.js:247-249,725-726` | Pick one meaning for `hirerId` (recommend `createdBy: User` for ownership plus `hirerId: HirerAccount` for display) and migrate. |
| **SEC-048** | **Moderation is bypassed**: `GET /opportunities` returns pending/rejected listings to everyone; there is no default `moderationStatus: 'approved'` filter. A hirer's new posting is visible instantly. | Probe: pending listing visible to seeker | Default the read filter to approved (and vetted, per the failing test) for non-admins. |
| **PROD-1** | Seekers can't see their own applications (`GET /applicants` → 403; no "my applications" endpoint). Mobile `profile/applications.tsx` is mock data. | Probe | Add `GET /users/me/applications`. |

---

## 3. Security & privacy findings (code bugs in `main`)

| ID | Sev | Finding | Evidence | Fix |
|---|---|---|---|---|
| **SEC-049** | High | **Rate limiting is ineffective.** `keyGenerator: keyGenerator \|\| ipKeyGenerator` passes `express-rate-limit`'s `ipKeyGenerator(ip: string)` straight in as a request-level key generator, so it's called with `(req, res)` and returns the request object. In-memory: every request gets its own bucket (probe: 25 bad logins from one IP → **0×429**, header always `remaining=19`). With `REDIS_URL` set, the key would stringify to `rl:auth:[object Object]` — one **global** bucket, so 20 logins site-wide would lock everyone out. Affects global, auth, registration, search, verification-code, strict, AI, and upload limiters. | `lib/rate-limiters.js:200,241,274` | `keyGenerator: (req) => ipKeyGenerator(req.ip)`; for per-user limiters `req.auth?.sub ?? ipKeyGenerator(req.ip, 56)`. Add an integration test that expects a 429. |
| **SEC-050** | High | **Account lockout never persists.** On the 5th failure the handler sets `lockUntil` and throws *before* `user.save()`. Probe: 7 wrong passwords → DB `failedLoginAttempts=4, lockUntil=null`; the correct password then logs in (200). Combined with SEC-049, online brute force is unthrottled. | `routes/auth.js:167-184` | Save before throwing (atomic `$inc` + `$set`); also apply lockout to `/auth/admin/login`, which has none. |
| **SEC-051** | Med | **Account enumeration**: an existing email returns "…N attempt(s) remaining before lockout", an unknown email doesn't; bcrypt only runs for existing users (timing). | `auth.js:142,201` | One generic message; always run a dummy bcrypt compare. |
| **SEC-052** | High | **Token revocation is a no-op.** `requireAuth` compares `payload.tv` with `req.auth?.tokenVersion` *before* `req.auth` is set, so the check never runs. Probe: after `tokenVersion++`, the old token still works; after **account deletion**, the deleted user's token still returns 200 (`role: deleted`). | `middleware/auth.js:57-60` | Load the user's `tokenVersion` (cache it) and compare; reject `role: 'deleted'`. |
| **SEC-053** | Med | **Single refresh token per user**: logging in on a second device invalidates the first device's refresh token (probe: phone refresh → 401). A non-string `refreshToken` → 500. | `models/User.js:27`, `auth.js:239-242` | A `RefreshToken` collection (one row per device/session, rotation + reuse detection); validate the body with Zod. |
| **SEC-054** | High | **Any signed-in user can harvest every user's email.** `/users` is readable by all authenticated users; PII stripping removes `email` but not `emailNormalized` (also leaks `failedLoginAttempts`, `role`, admin identities). | Probe: seeker sees `emailNormalized` of admins | Make `/users` admin-only; give `emailNormalized` `select: false`; strip with an allowlist, not a denylist. |
| **SEC-055** | Med | `/api/v1/seekers/:id` and `/hirers/:id` **populate `userId` with `email`** for any viewer. `/seekers/search` returns **phone numbers** (no PII stripping) and is **unpaginated** (SEC-011 bypass); same for `/candidates/search`. | Probe | Don't select `email` in populate; route search results through `stripPiiIfNeeded` + `parsePagination`. |
| **SEC-056** | High | **Applicant IDOR**: any hirer can list applicants (incl. CV `resumeUrl`) of any company's opportunity, and **change status / delete another company's applicants** (probe: hirer B rejects and deletes hirer A's applicant → 200/204). Applicants also choose their own `seekerId`/`name` (impersonation), the opportunity isn't checked to exist, and there's no dedupe when `seekerId` is absent. | `policies.js:163-170`; `routes/index.js:765-791,835` | Check opportunity ownership on read/update/delete; set `seekerId` from the token; unique `(opportunityId, applicantUserId)`; 404 for unknown opportunity. |
| **SEC-057** | High | **Community IDOR + impersonation**: any user can rename/archive anyone's channel; any hirer can delete any channel; any user can edit/delete anyone's posts; `authorName` is client-supplied (probe: post as "Kredibble Official" → 201). | `policies.js:207-224` | Set `createdBy`/`authorId` server-side and enforce ownership (the schema already has `authorId`; this resolves Open Question 6). |
| **SEC-058** | High | **Verification documents readable by every hirer** (business-registration file URLs of competitors); a hirer can attach docs to another company's case. | `policies.js:279-287`, `routes/index.js:816-837`; probe | Scope reads to owner + admin; verify `companyId` belongs to the caller. |
| **SEC-059** | Med | **Event bookings ignore capacity** (probe: capacity 2 → `attendeesCount=20`); any hirer can read every event's attendee emails; nonexistent event ids accepted. | `routes/index.js:918-940` | Atomic `findOneAndUpdate` with `$expr` capacity guard; restrict attendee reads to event owner/admin. |
| **SEC-060** | Med | **SEC-036 is not implemented**: grant applications don't touch `allocated` and accept any `requestedAmount` (probe: 999,999,999 against a 1,000 pool → saved). No applicant identity is stored, so GDPR export/delete (which query `applicantEmail`) never find them. | `routes/index.js:793-804`, `models/Platform.js:113-118` | Implement the conditional increment the task log describes; store `applicantUserId`. |
| **SEC-061** | Med | **NoSQL operator injection** in list filters: `?status[$ne]=approved` is passed through to Mongo (probe: 200). Low impact today but bypasses intended filters. | `routes/index.js:183-189` | Coerce query params to strings (or `mongoose.set('sanitizeFilter', true)`). |
| **SEC-062** | Med | **Email verification code** uses `Math.random`, and `attempts` is never incremented, so a 6-digit code can be brute-forced (only throttled by the broken limiter). | `lib/email.js:97-100`, `auth.js:429-457` | `crypto.randomInt`; max 5 attempts per code. |
| **SEC-063** | Low | Authorization **fails open** for missing policy actions (`allowedRoles` returns `AUTHENTICATED` when a key is absent); `'saved-items'` has no policy entry. | `policies.js:291-295` | Fail closed; add explicit entries. |
| **SEC-064** | Low | 500 responses send raw `err.message` in production (e.g. `logger is not defined`, Mongo cast details, DB connection errors in the 503). | `app.js:51,144-150` | Generic message for 5xx; log details server-side with the request id. |
| **SEC-065** | Med | **GDPR deletion is incomplete**: tombstone object is built but never persisted; Cloudinary files (CVs, avatars) are not deleted; opportunities/channels created by the user stay; no transaction. App Store/Play require in-app deletion, which the mobile app doesn't wire up (PROD-5). | `auth.js:550-673` | Persist tombstone, delete media, handle owned content, run in a transaction. |

---

## 4. Admin dashboard (`kredibble-admin`)

| ID | Finding | Fix |
|---|---|---|
| **ADM-1** | **CSP blocks every API call**: `connect-src 'self'`, but the API is a different origin. Login will fail in any browser that enforces CSP. (`next.config.ts`) | Add the API origin to `connect-src`. |
| **ADM-2** | **Cookie auth can't work in the current topology**: the admin cookie is `SameSite=Strict`; admin on `*.vercel.app` → API on another `*.vercel.app`/`onrender.com` is cross-site (`vercel.app` is a public suffix), so the cookie is never sent. | Serve admin + API under one registrable domain (`admin.kredibble.app` / `api.kredibble.app`), or proxy `/api` through Next.js. |
| **ADM-3** | **Even with the cookie, admins can't reach data**: only `/dashboard/summary` accepts the admin cookie (`requireAdminAuth`). Every collection route uses `requireAuth` (Bearer, user secret) → probe: `/verification/companies` and `/opportunities` with the admin cookie → **401**. | Let `requireAuth` accept a valid admin token, or route admin traffic through a dedicated admin router. |
| **ADM-4** | **No session refresh**: admin token + cookie expire in 15 min; there's no admin refresh route; the UI decides "logged in" from `localStorage` so it keeps rendering and silently fails. | Add admin refresh; on 401 clear session and redirect. |
| **ADM-5** | **20 of ~25 pages run on `src/lib/mock-*.ts` data** (seekers, hirers, reports, community, events, grants, articles, staff, analytics, verification detail…). Actions like "approve"/"suspend" only mutate in-memory mocks. | Wire to real endpoints (many exist; admin-portal endpoints need SEC-045). |
| **ADM-6** | `next@16.2.10` has **critical** advisories (RCE in image optimisation / `next/og`, middleware bypass, SSRF), plus high `postcss`/`sharp`. | Upgrade to ≥ 16.3.8 (a supported patched release). |
| **ADM-7** | CSP allows `'unsafe-inline' 'unsafe-eval'` for scripts, which weakens the XSS defence that SEC-010 relies on. | Nonce-based CSP; drop `unsafe-eval` in production. |

---

## 5. Mobile app (`kredibble-app`)

| ID | Finding | Fix |
|---|---|---|
| **MOB-1** | **Sessions die after 15 minutes**: the backend issues 15-min access tokens + refresh tokens, but the app discards `refreshToken`, never calls `/auth/refresh`, and has no 401 handling. Every screen starts failing mid-session; the socket's handshake token goes stale too. (`src/lib/api.ts:48-93`, `src/lib/socket.ts`) | Store the refresh token in SecureStore; refresh on 401 with a single in-flight lock; on failure clear the session and route to login; refresh the socket `auth` on reconnect. |
| **MOB-2** | **Detail screens are hardcoded**: `jobs/[id]`, `internships/[id]`, `events/[id]`, `grants/[id]` read from local `*_DATA` arrays; a real job id falls back to `JOBS_DATA[0]` (a fake "Wave" job). The jobs "Apply" button only flips local state. Lists silently fall back to fake data when the API fails (`jobs/index.tsx:225`). | Fetch by id; wire Apply to the API; show error/empty states, never fake listings. |
| **MOB-3** | **AI assistant is canned** (`setTimeout` replies in `assistant/index.tsx`). | Call the backend once SEC-045 mounts it, or hide the feature for v1. |
| **MOB-4** | **Forgot password is fake**: the sheet advances `email → verify → reset → success` with no backend call, and the backend has no reset endpoint. Users are told their password was reset when it wasn't. (`(auth)/login.tsx:471-601`) | Backend: reset-request + reset-confirm (reuse verification codes). App: wire it. |
| **MOB-5** | **Change password and delete account are UI-only** (`profile/security.tsx` doesn't call the API; no backend change-password route). In-app account deletion is **required by Apple (5.1.1(v)) and Google Play**. | Add `POST /auth/password` (bumps `tokenVersion`); wire `DELETE /auth/me`. |
| **MOB-6** | Notifications, saved items, applications, hirer postings/channels screens are partially or fully mock. | Wire up after PROD-1 / SEC-044. |
| **MOB-7** | `tsc --noEmit`: **5 errors** (`events/index.tsx`, `grants/index.tsx` — real-vs-mock data shape mismatch); `expo lint`: **45 errors**, 123 warnings. Jest: 20/20 pass. | Fix; gate in CI. |
| **MOB-8** | Store readiness: display name is `kredibble-app`; no iOS `bundleIdentifier`/`buildNumber` (EAS iOS build will stop to ask); splash/icons look like Expo template defaults; no privacy policy/ToS link; no push notifications (`expo-notifications` not installed); `npm start` scripts use Windows-only `set`. | Set app identity + store metadata; add privacy policy/ToS; decide on push for v1. |
| **MOB-9** | `npm audit`: 4 high, 12 moderate (Expo config tooling chain). | Update within the Expo SDK line. |

---

## 6. Tracker accuracy — `task.md` claims vs. code

These are marked ✅ Done but are not true of `main`:

| Task | Claim | Reality |
|---|---|---|
| SEC-009 | "`requireAuth` checks `tokenVersion`" | Check is dead code (SEC-052) |
| SEC-024 | Limiters fixed & tested | Key generator is wrong, so limits don't apply (SEC-049); tests skip limiters in `NODE_ENV=test` |
| SEC-025 | Lockout with progressive backoff | Lock is never saved (SEC-050) |
| SEC-029 | "7-year tombstone" | Never persisted (SEC-065) |
| SEC-036 | Grant allocation atomic with `$expr` guard | No allocation code exists (SEC-060) |
| SEC-037 | List fields migrated to `String[]`; parse helpers removed | Still `String` with `'[]'` default; helpers still in use |
| SEC-023 | PII stripped for non-owners | Bypassed via `emailNormalized`, populate, search routes (SEC-054/055) |
| PR #18 log | "All 90 backend tests pass. Vercel deployment SUCCESS." | 10/102 failing; Vercel serves pre-`/api/v1` code |
| README | Prisma, `db:generate`, `db:push`, `db:seed`, `password123` accounts | Project is Mongoose; scripts don't exist; seeded weak passwords |

Recommendation: add a "verified by" column to `task.md` (test name or probe command) and only tick a box when a test proves it.

---

## 7. What works (verified)

- Register/login happy path; admin role cannot be self-registered (400); password policy enforced.
- Socket.io rejects anonymous handshakes; `join_user` pinned to the caller; `send_message` limited to joined rooms.
- Ownership on seeker/hirer profiles and opportunities (PATCH/DELETE by non-owner → 403).
- Upload: MIME allowlist + magic bytes + `file-type`, server-derived folder, 5 MB cap.
- 1 MB JSON limit (413), malformed JSON → 400, bad ObjectId → 400.
- Helmet headers, HSTS, request IDs, production CORS allowlist, secrets fail-closed in production.
- Backend `npm audit`: 0 vulnerabilities.

---

## 8. What's left to get to market — suggested sequence

**Phase 0 — today (incident)**
SEC-041 actions in Section 0. Nothing else matters until that deployment is off the production DB.

**Phase 1 — make it deployable and correct (≈1 week)**
OPS-1…6 (lockfile, admin build, boot config, single always-on host + custom domain, real CI gates, green suite) → SEC-042…048 (apply 500, posts 404, notifications, unmounted routers, dashboard shape, hirerId, moderation filter) → SEC-049/050/052 (rate limit key, lockout save, token revocation).

**Phase 2 — close access-control and privacy holes (≈1 week)**
SEC-053…065: per-device refresh tokens, `/users` lockdown, PII allowlists, applicant/community/verification/event IDORs, grant allocation, operator-injection hardening, verification-code hardening, error-message hygiene, complete GDPR deletion.

**Phase 3 — finish the product surface (≈2–3 weeks)**
MOB-1…7 (refresh flow, real detail screens + apply, forgot/change password, in-app deletion, my applications, notifications) and ADM-1…7 (CSP, same-site domains, admin auth on data routes, refresh, replace mock pages, Next.js upgrade). Decide v1 scope for AI assistant, news, and the admin portal — mount and finish, or cut.

**Phase 4 — launch operations (≈1 week, overlaps Phase 3)**
- Redis for rate limits/lockout (required once >1 instance), paid always-on hosting, Atlas backups + restore drill.
- Error tracking (Sentry for API, admin, and mobile), uptime check on `/api/health`, log retention.
- Transactional email domain verified (Resend SPF/DKIM).
- Privacy policy + Terms (Ghana Data Protection Act 2012 registration with the Data Protection Commission if you process Ghanaian users' data at scale; GDPR if you target EU users), store listings, app identity/icons, EAS production builds.
- Load test (AGENTS.md target: 1,000 concurrent users, p99 < 500 ms) and a short external pen test.
- Re-run this probe + the full suite against staging before the store submission.

Rough total for one experienced full-stack developer: **about 5–7 weeks** to a defensible public v1, assuming the v1 scope is trimmed (AI assistant / admin portal deferred). The incident in Section 0 is hours, not weeks.

---

## Appendix — commands and evidence

```bash
# Backend tests (10 failing)
cd kredibble-backend && npm test

# Admin (lint OK, build FAILS)
cd kredibble-admin && npm run lint && npm run build

# Mobile (tsc 5 errors, lint 45 errors, jest 20/20)
cd kredibble-app && npx tsc --noEmit && npm run lint && npx jest

# Lockfile drift (fails on main)
git archive HEAD kredibble-backend | tar -x -C /tmp/kb && cd /tmp/kb/kredibble-backend && npm ci
```

The live-behaviour probe ran the real `src/app.js` + `src/socket.js` against `mongodb-memory-server` (`NODE_ENV=development`, no `.env`, no real database). Every "probe" result above comes from that run.
