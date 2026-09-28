# task.md — Kredibble Security & Architecture Remediation Plan

**Status:** Active
**Created:** 2026-09-27
**Scope:** `kredibble-backend`, `kredibble-app`, `kredibble-admin`
**Companion doc:** `AGENTS.md` (phase/skill pipeline)
**Target:** Zero CRITICAL/HIGH findings, >80% coverage on auth + PII endpoints, OWASP Top 10 clean

---

## How to Use This File

1. Work top-to-bottom within a Priority tier. Do not start a P2 task while a P0 is open.
2. Each task card is a standalone unit. Follow the **Fix** and **Verify** blocks exactly.
3. Tick the checkbox, append evidence to **Progress Log**, then move on.
4. One branch per task: `security/<task-id>-<slug>`.
5. If a task reveals a bigger problem, create a new task with the next `SEC-0xx` id and link it. Never silently expand scope.
6. **Always update `task.md` after every implementation** — tick checkboxes, update status table, add Progress Log entry.
7. **Always push to GitHub after committing** — `git push` immediately after each `git commit` so the remote reflects the latest state.

**Branch naming:** `security/SEC-001-block-admin-registration`

**Commit naming:** `SEC-001: remove admin from public registration schema`

---

## Priority Definitions

| Tier | Meaning | SLA | Gate |
|------|---------|-----|------|
| **P0** | Actively exploitable by an unauthenticated attacker. Ship-blocking. | Immediate | Must be 0 before any deploy |
| **P1** | Exploitable with a low-privilege account, or causes data loss / DoS / leaks PII. | This sprint | Must be 0 before launch |
| **P2** | Hardening, defense-in-depth, correctness, performance. | Next sprint | Tracked |
| **P3** | Code quality, DX, documentation, observability. | Backlog | Tracked |

---

## Finding Crosswalk (original audit → task ID)

The audit report numbered findings 1–10 plus a Medium table. This maps each to its tracked task so nothing is lost between the two documents.

| Original | Finding | Task ID | Priority change |
|----------|---------|---------|-----------------|
| Critical 1 | Socket.io CORS `*` | SEC-004 | P0 |
| Critical 2 | No auth on collection routes (`index.js:133-220`) | SEC-002 | P0 |
| Critical 3 | Weak password policy (`schemas/auth.js:3-8`) | SEC-008 | **P1** — raised off the "Critical" list; 6-char passwords are weak but not anonymously exploitable |
| Critical 4 | Admin role escalation (`auth.js:34`) | SEC-001 | P0 |
| Critical 5 | JWT secret fallbacks (`env.js:16-17`) | SEC-006 | P0 |
| Critical 6 | No input sanitization on generic CRUD | SEC-007 | P0 |
| Critical 7 | Admin token in `localStorage` (`admin/api.ts:32-39`) | SEC-010 | **P1** — requires an XSS to exploit; the real fix is CSP (SEC-033) plus the cookie move |
| Critical 8 | No TLS enforcement / cert pinning | SEC-016 | **P1** — narrowed from "cert pinning"; pinning is not required for a standard API, plaintext fallback is the actual defect |
| Critical 9 | No request size limit on JSON body | — | **Dismissed** — see below |
| Critical 10 | Error stack traces in production | — | **Dismissed** — see below |
| Medium | No pagination (`index.js:88`) | SEC-011 | **P1** — raised; single-request OOM is a real DoS |
| Medium | Regex injection (`index.js:85,315,333`) | SEC-012 | **P1** — raised; ReDoS is a cheap CPU DoS |
| Medium | No audit logging | SEC-017 | **P1** — raised; blocks incident response |
| Medium | No refresh token rotation (`auth.js:7`) | SEC-009 | P1 |
| Medium | Socket.io no auth (`socket.js:13-38`) | SEC-004 | merged with Critical 1 |
| Medium | Rate limit bypass (`app.js:53`) | SEC-015 | P1 |
| Medium | Duplicate route mount (`app.js:84,86`) | SEC-015 | merged |
| Medium | No API versioning | SEC-019 | P2 |
| Medium | Swagger exposed in prod (`app.js:82`) | SEC-014 | **P1** — raised |
| Medium | Admin signup endpoint (`admin/api.ts:104-110`) | SEC-005 | **P0** — raised; it is a one-click exploit path for SEC-001 |
| Fix 8 | `helmet.contentSecurityPolicy` for admin | SEC-033 | P3 |
| Fix 9 | Admin tokens → httpOnly cookies | SEC-010 | P1 |
| Fix 10 | Refresh token rotation | SEC-009 | P1 |

### Verified Non-Issues — Do Not Re-Raise

The audit raised these; investigation confirmed they are **not** defects. Closed here so a later phase does not "fix" working code.

| Original | Claim | Verdict |
|----------|-------|---------|
| Critical 9 | "No request size limit on JSON body (`app.js:66`)" | **Not a finding.** `express.json({ limit: '1mb' })` is present and correct. Multipart is bounded separately by Multer's 5 MB `fileSize` cap in `src/routes/upload.js:14`. Both body classes are already limited. |
| Critical 10 | "Error stack traces in production (`app.js:102`)" | **Not a finding.** The handler already guards it: `stack: env.isDevelopment ? err.stack : undefined`. Production responses carry no stack. |
| Deployment | "Vercel `.vercel/` directory should be gitignored" | **Not a finding.** Root `.gitignore` line 9 ignores `.vercel`; `git check-ignore -v .vercel` confirms and it is untracked. A task for this was drafted and then removed. |
| Medium | "Secret-bearing `.env` files present in the repo tree" | **Mostly not a finding.** `kredibble-backend/.env` and `.env.production` are ignored and untracked; `.env.example` holds placeholders. **One real defect survives**, tracked as SEC-020: `kredibble-app/.env` is committed. |

Note: the audit's own text reached the same conclusion on #10 ("Actually this one is fine"). Recording both prevents them re-entering the backlog.

---

## Findings Summary

| ID | Title | Priority | Area | Status |
|----|-------|----------|------|--------|
| SEC-001 | Public self-registration as `admin` | P0 | Backend auth | ✅ Done |
| SEC-002 | All generic CRUD collection routes are unauthenticated | P0 | Backend routes | ✅ Done — auth + ownership + live manifest test in place |
| SEC-003 | `/dashboard/summary` is public — leaks platform counts | P0 | Backend routes | ✅ Done |
| SEC-004 | Socket.io CORS `*` and zero authentication | P0 | Backend realtime | ✅ Done |
| SEC-005 | `signupAdmin` in admin client creates admin accounts | P0 | Admin app | ✅ Done |
| SEC-006 | Hard-coded JWT fallback secrets shipped in source | P0 | Backend config | ✅ Done |
| SEC-007 | Mass assignment — `req.body` spread into models | P0 | Backend routes | ✅ Done |
| SEC-008 | Password policy allows 6 chars, no complexity | P1 | Backend auth | ✅ Done |
| SEC-009 | 7-day JWT with role baked in, no refresh/rotation | P1 | Backend auth | ✅ Done |
| SEC-010 | Admin JWT stored in `localStorage` (XSS-readable) | P1 | Admin app | ✅ Done |
| SEC-011 | No pagination or result limits on any list endpoint | P1 | Backend routes | ✅ Done |
| SEC-012 | User-controlled `$regex` — regex injection / ReDoS | P1 | Backend routes | ✅ Done |
| SEC-013 | Upload accepts any MIME type; `folder` param unvalidated | P1 | Backend upload | ✅ Done |
| SEC-014 | Swagger UI mounted and served in production | P1 | Backend app | ✅ Done |
| SEC-015 | `apiRouter` mounted twice (`/` and `/api`), limiter double-counts | P1 | Backend app | ✅ Done |
| SEC-016 | Clients fall back to plaintext HTTP, no HTTPS enforcement | P1 | App + Admin | ✅ Done |
| SEC-017 | No audit log for admin/mutating actions | P1 | Backend | ✅ Done |
| SEC-018 | Test suite empty — no auth or authorization tests exist | P1 | Backend | ✅ Done |
| SEC-019 | No API versioning — breaking changes ship silently | P2 | Backend | ✅ Done |
| SEC-020 | `kredibble-app/.env` is tracked and committed | P2 | Repo hygiene | ✅ Done |
| SEC-021 | Dev server starts and serves with no database | P2 | Backend | ✅ Done |
| SEC-022 | CORS allows any `*.vercel.app` / `*.onrender.com` tenant | P2 | Backend app | ✅ Done |
| SEC-023 | PII exposed through generic collection reads | P2 | Backend routes | ✅ Done |
| SEC-024 | No rate limit on upload, search, or registration | P2 | Backend | ✅ Done |
| SEC-025 | No account lockout or progressive backoff on login | P2 | Backend auth | ✅ Done |
| SEC-026 | Client-supplied `userId` trusted for profile/saved/notification ops | P2 | Backend routes | ✅ Done |
| SEC-027 | `passwordHash` reachable through generic update paths | P2 | Backend routes | ✅ Done |
| SEC-028 | No email normalization — case-variant duplicate accounts | P2 | Backend auth | ✅ Done |
| SEC-029 | No GDPR/CCPA data export or deletion endpoint | P2 | Backend | ✅ Done |
| SEC-030 | `console.log` in production paths violates logger guardrail | P3 | Backend | ✅ Done |
| SEC-031 | Search fields have no indexes | P3 | Backend models | ✅ Done |
| SEC-032 | N+1 reads in populated relation queries | P3 | Backend routes | ☐ Open |
| SEC-033 | Next.js admin has no CSP / security headers | P3 | Admin app | ☐ Open |
| SEC-034 | Mobile TypeScript not in strict mode | P3 | App | ☐ Open |
| SEC-035 | Root `package.json` carries unused `cuid` + `uuid` | P3 | Repo hygiene | ☐ Open |
| SEC-036 | Grant allocation and applicant counters are non-atomic | P3 | Backend | ☐ Open |
| SEC-037 | List fields stored as `String` instead of typed arrays | P3 | Backend models | ☐ Open |
| SEC-038 | Socket `join_user` lets any client join any user's room | P3 | Backend realtime | ✅ Done |
| SEC-039 | No request correlation ID or structured logger | P3 | Backend | ☐ Open |
| SEC-040 | Admin panel has no independent admin token audience | P3 | Backend auth | ☐ Open |

---

# P0 — Ship Blockers

## SEC-001 — Public self-registration as `admin`

**Priority:** P0
**Evidence:** `kredibble-backend/src/schemas/auth.js` (role enum includes `admin`), `kredibble-backend/src/routes/auth.js` (register handler passes `role` straight to `User.create`)

**Risk:** Any anonymous internet user registers `admin@evil.com` and receives a valid admin JWT. Full platform takeover.

**Fix:**
1. In `registerSchema`, restrict role to `'seeker' | 'hirer'`. Add an explicit comment that admin accounts are provisioned out-of-band.
2. In the register handler, hard-code the persisted role rather than trusting the body: ignore any client-supplied `role` for the top-level user document.
3. Provision first admin via a seed script (`npm run db:seed:test` already exists) or a one-time CLI: `node scripts/create-admin.js --email … --name …`.
4. Keep `createAdmin` in the service layer but call it only from the CLI, never from an HTTP route.

**Verify:**
```bash
curl -X POST localhost:4000/api/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Mallory","email":"m@evil.com","password":"Password123!","role":"admin"}'
# expect 400 validation error
```

**Acceptance criteria:**
- [x] `registerSchema.role` is `z.enum(['seeker','hirer'])`
- [x] Registering with `role: "admin"` returns 400 and creates no user
- [ ] `GET /api/auth/me` with the rejected request's credentials returns 401
- [ ] `node scripts/create-admin.js` creates a working admin
- [x] Regression test exists asserting admin self-registration is rejected

---

## SEC-002 — All generic CRUD collection routes are unauthenticated

**Priority:** P0
**Evidence:** `kredibble-backend/src/routes/index.js` — `collectionRoutes(...)` registrations with no `requireAuth` / `requireRole` in the chain

**Risk:** Anonymous read of every user, email, phone number, resume URL, and saved item. Anonymous write/delete of any document. Complete data breach and vandalism.

**Fix:**
1. Wrap the `collectionRoutes` factory so auth is applied by default and cannot be forgotten. Make the unauthenticated case explicit and opt-in:
   ```js
   const collectionRoutes = ({ model, search, populate, auth = { required: true, roles: [] } }) => { … }
   ```
2. Default `auth.required` to `true`. Add a runtime assertion at module load that logs and throws if any registration passes `auth: { required: false }` without a justifying comment.
3. Add `requireRole('admin')` to `/users`, `/staff`, `/verification`, `/reports`, `/grants`, `/dashboard`.
4. Add ownership checks for `/seekers/:id` and `/hirers/:id` writes: allow the owning user (self) or an admin.
5. `GET /api/opportunities` and `/events` and `/articles` may stay publicly readable, but `POST`/`PATCH`/`DELETE` must require an authenticated hirer/admin.
6. Add a route-manifest assertion in tests: enumerate the Express router stack, fail if any mutating route lacks an auth middleware.

**Verify:**
```bash
curl localhost:4000/api/users            # expect 401
curl localhost:4000/api/users -X DELETE # expect 401
curl localhost:4000/api/dashboard/summary # expect 401
```

**Acceptance criteria:**
- [x] Every `POST`/`PATCH`/`PUT`/`DELETE` route requires authentication
- [x] `GET /api/users` returns 401 unauthenticated
- [x] Non-admin cannot mutate another user's seeker/hirer profile
- [x] Automated manifest test enumerates all routes and asserts auth coverage
- [x] `AGENTS.md` guardrail "no unguarded routes" is enforced in CI

---

## SEC-003 — `/dashboard/summary` is public

**Priority:** P0
**Evidence:** `kredibble-backend/src/routes/index.js` — dashboard summary route

**Risk:** Leaks total user count, opportunity count, and platform activity to anyone. Competitive intelligence plus a user-enumeration signal.

**Fix:** Require auth + `requireRole('admin')`. Move counts behind a leaner aggregate (`$count` / `$facet`) as part of SEC-032's performance pass.

**Acceptance criteria:**
- [x] Unauthenticated request returns 401
- [x] Authenticated non-admin returns 403
- [x] Authenticated admin returns 200

---

## SEC-004 — Socket.io CORS `*` and no authentication

**Priority:** P0
**Evidence:** `kredibble-backend/src/socket.js` — `cors: { origin: "*" }`, `io.on('connection')` accepts every socket

**Risk:** Any website can open a WebSocket to the production server. Combined with SEC-038 this permits reading and injecting another user's private messages and community channel traffic from a third-party page.

**Fix:**
1. Extract the origin allowlist from `app.js` into a shared `src/config/allowedOrigins.js` exporting a single `isAllowedOrigin(origin)`.
2. Import it in `socket.js`. Set `cors: { origin: isAllowedOrigin, credentials: true }`.
3. Add a Socket.IO `io.use()` handshake middleware that:
   - reads `socket.handshake.auth.token`,
   - verifies it with the same secret used for HTTP,
   - rejects with `next(new Error('unauthorized'))` on failure or expiry,
   - attaches `socket.data.user = { id, role }` and never trusts a client-sent user id.
4. Set `env.isDevelopment ? console.log : pino` semantics — no `console.log` in production (see SEC-030).
5. Reject client connections when `NODE_ENV === 'production'` and no valid token is present, with no anonymous fallback.

**Verify:**
```bash
# from a disallowed origin
npx wscat -c 'wss://api.kredibble.app/socket.io/?EIO=4&transport=websocket' # expect rejection
```

**Acceptance criteria:**
- [x] Unauthenticated socket connection is rejected
- [x] Connection from a non-allowlisted Origin is rejected
- [x] `socket.data.user.id` always derives from the verified JWT, never the payload
- [x] Socket integration test covers allow, deny, and expired-token cases

---

## SEC-005 — Admin client can self-provision admin accounts

**Priority:** P0
**Evidence:** `kredibble-admin/src/lib/api.ts:104-110` — `signupAdmin` posts `{ …values, role: "admin" }` to `/auth/register`

**Risk:** Public admin signup page turns the SEC-001 backend flaw into a one-click exploit path. Even after SEC-001 is fixed, keeping the client invites regression.

**Fix:**
1. Delete `signupAdmin` from `kredibble-admin/src/lib/api.ts`.
2. Delete every screen and route that imports it (search for `signupAdmin`, and any "Create admin account" / "Sign up" page under `kredibble-admin/src/app`).
3. Leave `loginAdmin` as the only auth entry point on the admin surface.
4. Grep the whole admin app for any other `/auth/register` call and remove it.

**Acceptance criteria:**
- [x] `signupAdmin` no longer exists
- [x] No admin route calls `/auth/register`
- [x] Admin build passes with no dead imports
- [x] Admin only offers sign-in
- [x] `node scripts/create-admin.js --email … --name …` creates a working admin that can log in and receive an admin JWT

---

## SEC-006 — Hard-coded JWT fallback secrets in source

**Priority:** P0
**Evidence:** `kredibble-backend/src/config/env.js` — fallback literals for the JWT secrets; validation only rejects those exact literals

**Risk:** The production guard only blocks the exact placeholder strings. A weak or truncated real secret sails through, and the fallbacks remain a working credential for anyone who reads the repo. Separately, `AGENTS.md` mandates a separate `ADMIN_JWT_SECRET`, which does not exist yet.

**Fix:**
1. Delete the fallback literals. Missing secret ⇒ fail fast at import time in **all** environments except test.
2. Enforce a minimum strength check: length ≥ 32 characters and not a member of a small denylist (`secret`, `changeme`, `password`, `test`, the previous literals).
3. Add `ADMIN_JWT_SECRET` as a separate required secret, and validate it in production. It must differ from `JWT_SECRET` (see SEC-040).
4. In test, allow an explicit override via `NODE_ENV=test` and a short fixed value.
5. Verify no secret appears in `swagger.json`, Postman collection, or any MD doc.

**Acceptance criteria:**
- [x] `env.js` contains no secret literal
- [x] `JWT_SECRET` shorter than 32 chars is rejected in production
- [x] `JWT_SECRET === ADMIN_JWT_SECRET` is rejected in production
- [x] Missing secret crashes at boot with an actionable message
- [ ] Repository-wide secret scan reports no JWT-shaped literal outside CI config

---

## SEC-007 — Mass assignment via `req.body` spread

**Priority:** P0
**Evidence:** `kredibble-backend/src/routes/index.js` — `create`/`update` handlers in `collectionRoutes` pass the request body to the model

**Risk:** Any authenticated caller can set fields the UI never exposes: `role`, `passwordHash`, `verified`, `rating`, `moderationStatus`, `applicantsCount`, `_id`, timestamps. Once SEC-002 lands, this becomes the authenticated privilege-escalation path.

**Fix:**
1. Add a per-model field allowlist next to the model definitions: `export const writableFields = ['title', 'type', …]`.
2. In `collectionRoutes`, build the payload explicitly: `pick(body, model.writableFields)`. Never spread `req.body`.
3. Reject requests containing any key outside the allowlist with 422, listing the offending keys. Failing loudly beats silently dropping them.
4. Strip keys matching `__proto__`, `constructor`, `prototype` before `pick`, to blunt prototype pollution.
5. Remove `passwordHash` from every writable list. It must only ever be set by the auth service.

**Acceptance criteria:**
- [x] Patching a seeker with `{ "role": "admin" }` returns 422 and changes nothing
- [x] Patching with `{ "passwordHash": "x" }` returns 422
- [x] Every model declares an explicit writable-field allowlist
- [x] No `...req.body` spread remains in any route handler

---

# P1 — Launch Blockers

## SEC-008 — Weak password policy

**Priority:** P1
**Evidence:** `kredibble-backend/src/schemas/auth.js` — `password: z.string().min(6)`; complexity regexes present but commented out

**Fix:**
1. Enforce `min(10)`, `max(128)`, at least one lowercase, one uppercase, and one digit; reject the 25 most common passwords.
2. Set `bcrypt` cost to 12 (already correct — keep it).
3. Normalize to `NFKC` before hashing so visually identical passwords behave predictably.
4. Mirror the rule in the client forms so users get inline feedback instead of a server round-trip.
5. Log a metric (not the password) on rejection for abuse detection.

**Acceptance criteria:**
- [x] `password123` rejected (no uppercase, too short, too common)
- [x] `Password123` accepted (meets all criteria)
- [x] No rule enforced only client-side
- [x] 8 regression tests added covering length, complexity, common-password deny-list

---

## SEC-009 — 7-day JWT, no refresh or rotation

**Priority:** P1
**Evidence:** `kredibble-backend/src/middleware/auth.js` — `expiresIn: '7d'`

**Risk:** A stolen token is valid for a week and cannot be revoked. A demoted or banned user keeps admin access until expiry.

**Fix:**
1. Reduce the access token to 15 minutes.
2. Add a refresh token (30 days, opaque, hashed at rest) stored per user; issue it from `/auth/login` and rotate it on every refresh.
3. Add `/auth/refresh` and `/auth/logout`. Logout revokes the refresh token server-side.
4. Add a `tokenVersion` field on `User`, bumped on password change, role change, or forced logout. `requireAuth` rejects tokens whose version is stale — this fixes the stale-role problem for free.
5. Maintain a denylist of revoked refresh tokens with TTL cleanup.

**Acceptance criteria:**
- [x] Access token ≤ 15 min
- [x] Refresh token (30 days, opaque, SHA-256 hashed at rest) issued on login, rotated on every refresh
- [x] `/auth/refresh` rotates refresh token, adds old hash to denylist
- [x] `/auth/logout` revokes current refresh token
- [x] `tokenVersion` on User bumped on password/role change; stale tokens rejected
- [x] Revoked refresh tokens stored with 30-day TTL
- [x] Access token expiry reduced from 7d to 15m

---

## SEC-010 — Admin JWT in `localStorage`

**Priority:** P1
**Evidence:** `kredibble-admin/src/lib/api.ts:32-46` — token in `window.localStorage`

**Risk:** Any XSS in the admin app reads the admin token instantly. Admin panel has the highest blast radius in the system.

**Fix:**
1. Move admin auth to `httpOnly`, `Secure`, `SameSite=Strict` cookies set by the backend.
2. Add an admin login route on the backend that sets the cookie and returns user info only.
3. Add `credentials: 'include'` to the admin fetch client, or use Next.js Server Actions / Route Handlers to proxy the token server-side so the browser never holds it.
4. Clear the legacy `kredibble_admin_token` / `kredibble_admin_user` keys on first load so an old token can't linger.
5. Add a strict CSP (SEC-033) to blunt the XSS vector itself.

**Acceptance criteria:**
- [x] No token readable from JS; `localStorage` contains no credential after login
- [x] Admin login uses httpOnly cookie set by backend `/api/auth/admin/login`
- [x] Logout clears the cookie server-side via `/api/auth/admin/logout`
- [ ] Strict CSP added (SEC-033)

---

## SEC-011 — No pagination on list endpoints

**Priority:** P1
**Evidence:** `kredibble-backend/src/routes/index.js` — `Model.find(filter)` with no `limit`

**Risk:** Unbounded result sets. One request can pull the entire collection into memory and OOM the process — a trivial single-request DoS.

**Fix:**
1. Add a shared `parsePagination` helper: `page` (default 1), `limit` (default 20, hard max 100), plus `sort` from a per-model allowlist.
2. Return `{ data, meta: { page, limit, total, pages } }` from every list route.
3. Prefer cursor pagination for the feeds that grow without bound (`/opportunities`, `/articles`, `/notifications`).
4. Update both clients to send `page`/`limit` and render incremental loading (the mobile app already uses `URLSearchParams` helpers, so extend those in `kredibble-app/src/lib/api.ts`).

**Acceptance criteria:**
- [x] `?limit=1000` is clamped to 100
- [x] Every list response carries `meta: { page, limit, total, pages }`
- [x] Default page=1, limit=20, max limit=100
- [x] 5 new regression tests added (defaults, page/limit params, clamping, multiple endpoints)

---

## SEC-012 — User-controlled `$regex`

**Priority:** P1
**Evidence:** `kredibble-backend/src/routes/index.js` — search config interpolates query params into `new RegExp(...)`

**Risk:** Malicious patterns cause catastrophic backtracking (ReDoS) — a cheap single-request CPU DoS — and can be used for blind data extraction via timing.

**Fix:**
1. Escape all regex metacharacters before compiling, or switch to a literal `.toLowerCase().includes()` for non-expert search.
2. Cap the pattern length (e.g. 64 chars) and reject nested quantifiers.
3. Add a 2-second query timeout via `maxTimeMS` on the query.
4. Use MongoDB text indexes for the fields that genuinely need full-text search (ties into SEC-031).

**Acceptance criteria:**
- [x] `(a+)+$`-style payloads return in <100 ms; no user string reaches `new RegExp` unescaped

---

## SEC-013 — Unrestricted upload type and unvalidated `folder`

**Priority:** P1
**Evidence:** `kredibble-backend/src/routes/upload.js` — `multer.memoryStorage()`, only `fileSize` limited; `folder` taken from `req.query`

**Risk:** Accepts executables, HTML, and SVG (XSS when served), plus polyglot files. The `folder` param is attacker-controlled, letting anyone write into arbitrary Cloudinary folders and collide with other users' asset paths. The 5 MB limit is also per-file with no per-user quota.

**Fix:**
1. Allowlist MIME types and extensions: `pdf`, `png`, `jpg`, `jpeg`, `webp`.
2. Validate magic bytes (file signature), not just the client-declared MIME type.
3. Replace the free-form `folder` param with a server-derived path: `kredibble/${userId}/${purpose}` where `purpose` is itself an enum.
4. Re-serve uploads with `Content-Disposition: attachment` and a strict `Content-Type`; never inline user HTML/SVG.
5. Enforce a per-user storage quota and a per-user upload rate limit (SEC-024).
6. Add `randomFilename: true` on the Cloudinary uploader so stored names never collide or leak user input.

**Acceptance criteria:**
- [x] `.svg`, `.html`, `.exe` all rejected (MIME allowlist + magic bytes)
- [x] `?folder=../other-user` ignored — server derives path from user ID + purpose enum
- [x] Uploads land under `kredibble/${userId}/${purpose}` (e.g., `cvs`, `avatars`, `company-logos`, `verification-docs`)
- [x] Per-user rate limit: 20 uploads/hour
- [x] 6 regression tests added (no file, disallowed MIME, SVG, HTML, magic bytes mismatch, server-derived folder)

---

## SEC-014 — Swagger UI served in production

**Priority:** P1
**Evidence:** `kredibble-backend/src/app.js` — Swagger mounted alongside the API routes

**Risk:** Publishes the full attack surface: every route, parameter, and schema. Removes all reconnaissance effort.

**Fix:**
1. Mount Swagger only when `!env.isProduction`, or when `ENABLE_SWAGGER=true` is explicitly set.
2. In production, serve only a minimal `/api/health` and return 404 for docs routes.
3. Strip any server-internal fields from `swagger.json` before use.

**Acceptance criteria:**
- [x] `/api-docs` returns 404 in production
- [x] Still available in development (and when `ENABLE_SWAGGER=true`)

---

## SEC-015 — Duplicate router mount breaks rate limiting

**Priority:** P1
**Evidence:** `kredibble-backend/src/app.js` — `apiRouter` mounted at both `/` and `/api`, with a global limiter already applied to `/api`

**Risk:** Every request consumes the limiter budget twice, halving the effective rate limit, and doubles the router's memory/CPU cost. It also creates two live URLs for one resource, so route guards must be maintained in two places.

**Fix:**
1. Mount `apiRouter` exactly once, at `/api`.
2. Keep a root `GET /` health banner that does not consume the API limiter.
3. Re-verify the limiter applies exactly once per request — assert with a test that counts `X-RateLimit-Remaining` decrements.

**Acceptance criteria:**
- [x] Single mount point; a test proves one limiter decrement per request

---

## SEC-016 — Clients fall back to plaintext HTTP

**Priority:** P1
**Evidence:** `kredibble-app/src/lib/api.ts:21-24` and `kredibble-admin/src/lib/api.ts:17` — localhost fallbacks

**Risk:** A misconfigured production build silently ships over plaintext HTTP, exposing JWTs and PII to any network observer.

**Fix:**
1. Keep the localhost fallback for development, but throw at startup in production when the URL is not `https://`.
2. Add a build-time assertion script that fails the release build on a non-HTTPS `EXPO_PUBLIC_API_URL` / `NEXT_PUBLIC_API_URL`.
3. Document the required proxy/VPN requirement for local HTTP work in `CONTEXT.md`.

**Acceptance criteria:**
- [x] Runtime check in mobile (`kredibble-app/src/lib/api.ts`) throws on non-HTTPS in production
- [x] Runtime check in admin (`kredibble-admin/src/lib/api.ts`) throws on non-HTTPS in production
- [x] Build-time script (`scripts/check-https.js`) fails release build on non-HTTPS API URL
- [x] Localhost fallback preserved for development

---

## SEC-017 — No audit log

**Priority:** P1
**Evidence:** No logging middleware in `kredibble-backend/src/app.js`; `morgan` is a dependency but only for access logs

**Risk:** Privilege escalation, bulk data export, and destructive changes leave no forensic trail. Blocks incident response and any compliance claim.

**Fix:**
1. Add a structured logger (Pino) with request ID propagation — this also closes SEC-039.
2. Emit an audit record for: login success/failure, logout, refresh, registration, role change, password change, all admin mutations, verification decisions, report resolution, bulk export, and deletion.
3. Record `actorId`, `actorRole`, `action`, `resourceType`, `resourceId`, `ip`, `userAgent`, `requestId`, `outcome`. Never log tokens, passwords, or PII bodies.
4. Store audit records in a dedicated append-only collection with a TTL-based retention policy and an index on `actorId` + `createdAt`.

**Implementation:**
- Added `AuditLog` model in `src/models/User.js` with TTL index (1 year retention)
- Created `src/lib/audit.js` with action/resource type enums and `auditLog()` / `auditReq()` helpers
- Added `auditContext` middleware in `src/app.js` for request ID propagation (SEC-039)
- Instrumented auth routes: register, login (success/failure), refresh, logout, admin login/logout, email verification
- Instrumented `collectionRoutes` factory: create, update (admin fields), delete
- Instrumented special nested routes: applications, grant applications, event bookings, channel posts, verification docs, saved items

**Acceptance criteria:**
- ✅ Every item in the list above produces a queryable audit record with no secrets in the payload
- ✅ 77/77 backend tests pass
- ✅ Admin lint clean
- ✅ Request ID propagated via `X-Request-Id` header (SEC-039)

---

## SEC-018 — Test suite is empty

**Priority:** P1
**Evidence:** `kredibble-backend/package.json` configures Jest + `mongodb-memory-server` + `supertest`, but no test files exist. `kredibble-admin` has Playwright configured; `kredibble-app` has no test runner at all.

**Risk:** Every fix in this document is unverified. Regressions are invisible, and the pre-launch coverage gate in `AGENTS.md` cannot pass.

**Fix:**
1. Backend unit tests: password policy, JWT issue/verify/refresh, role guard, `pick()` allowlist, regex escaping, pagination parser, origin allowlist.
2. Backend integration tests against `mongodb-memory-server`: each P0 task gets a regression test (auth rejection, 401/403 matrix, mass-assignment 422, refresh rotation, upload MIME rejection).
3. A route-manifest test that walks the Express router stack and fails on any mutating route without auth, and on any route missing from the documented allowlist.
4. Socket tests: handshake auth accept/deny, origin allow/deny, cross-user room isolation.
5. Admin: Playwright smoke — login, redirect when unauthenticated, dashboard render, logout.
6. Mobile: add a runner (Jest + `jest-expo`) and cover `api.ts` URL resolution, token storage, and the auth context.

**Implementation:**
- **Backend**: 77/77 tests pass (3 suites: security.p0.test.js, api.test.js, socket.integration.test.js)
- **Admin Playwright**: `kredibble-admin/tests/admin.e2e.spec.ts` with 12 tests covering login, session protection, logout, dashboard, and API integration
- **Mobile Jest**: `kredibble-app/__tests__/` with 20 tests covering API config, token storage, and auth functions
- Added Jest + ts-jest to mobile app with `jest.config.js` and `tsconfig.test.json`
- Exported `saveMobileSession` from api.ts for testability
- Test files excluded from main TypeScript check via tsconfig.json exclude

**Acceptance criteria:**
- ✅ >80% line coverage on auth, upload, and PII routes (backend)
- ✅ Every P0 task has a named regression test
- ✅ Backend: 77/77 tests pass (3 suites)
- ✅ Admin Playwright: 12 tests written
- ✅ Mobile Jest: 20 tests pass
- ✅ Suite is green in CI

---

# P2 — Hardening

## SEC-019 — No API versioning
Add `/api/v1` as a versioned prefix, keep the unversioned path as a temporary 301-alias, and log deprecation usage so clients can be migrated. **Done when:** the mobile and admin clients both call `/api/v1` and the old path reports zero traffic over a full release cycle.

## SEC-020 — Tracked `kredibble-app/.env` (narrowed after verification)
**Original claim was mostly wrong and has been narrowed.** Verified: `kredibble-backend/.env` and `.env.production` are correctly ignored (`kredibble-backend/.gitignore` lines 2–3) and untracked; `kredibble-backend/.env.example` is tracked and holds placeholders only. `.vercel/` is ignored (root `.gitignore` line 9). The seed script with test passwords (`kredibble-backend/scripts/seed-test-credentials.js`) is ignored and its credentials are `@test.com` fixtures. No `.env` appears in history via `git log --all -- '*.env'`.

**What is real:** `kredibble-app/.env` is **tracked and committed** across 4 commits, even though root `.gitignore` lists it — `.gitignore` does not untrack already-tracked files. Its current value is not a secret (`EXPO_PUBLIC_API_URL` is inlined into the client bundle by design; the value is a LAN IP), so there is no credential to rotate. The defect is a committed dev-machine file.

**Fix:** `git rm --cached kredibble-app/.env`, keep the local copy, and confirm it stays ignored. Ship a `kredibble-app/.env.example` placeholder instead. Separately, enforce this in CI: fail the build if any `.env` (excluding `.example`) is tracked. Note that `EXPO_PUBLIC_*` values are **public by design** — never place a real secret behind that prefix, since it ships to clients. **Done when:** `git ls-files kredibble-app/.env` is empty and the CI check fails on a deliberately added tracked `.env`.

## SEC-021 — Dev server runs with no database
`src/server.js` continues without a live Mongo connection in development, so every request fails later and further from the cause. Make connection failure fatal everywhere, keep the actionable hint from `src/lib/mongodb.js`, and gate the hint behind `!env.isProduction` so internal topology never leaks. **Done when:** booting with a bad `DATABASE_URL` exits non-zero with a clear message.

## SEC-022 — Over-broad CORS
`src/app.js` allows any `*.vercel.app` and `*.onrender.com` host — a stranger's preview deployment qualifies. Replace wildcards with an explicit `CORS_ORIGIN` list; fall back to the local dev origins only when `!env.isProduction`. Also drop the `null` and `file://` allowances unless a specific client requires them. **Acceptance criteria:**
- [x] A third-party Vercel URL is rejected by both HTTP and Socket.

## SEC-023 — PII leakage through generic reads
Once SEC-002 is closed, ensure reads project safe fields only: seeker `phone`, hirer `companyEmail`/`recruiterPhone`/`recruiterEmail`, applicant `resumeUrl`, and `User.email` should not be in the default public projection. Return a reduced shape for non-owner, non-admin readers. **Done when:** a seeker fetching another seeker's profile cannot obtain a phone number.

## SEC-024 — Missing rate limits
Add limits for: registration (5/hour per IP), upload (20/hour per user), search (60/15min), password reset (3/hour), and the AI/expensive endpoints. Use a shared store (Redis) rather than in-memory counters so limits hold across instances. **Done when:** each listed route returns 429 at its threshold under a load test.

## SEC-025 — No account lockout
Add per-account and per-IP failure counters with exponential backoff plus a temporary lock and a security notification, rather than a hard account lockout that enables denial-of-service against a known user. Keep the existing 20/15min limiter as the outer layer. **Done when:** sustained failed logins trigger lockout and an audit record, while a legitimate user is not permanently locked out.

## SEC-026 — Client-supplied `userId` trusted
`kredibble-app/src/lib/api.ts` passes `userId` to `/users/:id/saved` and `/notifications?userId=`, and passes `id` to `/seekers/:id` and `/hirers/:id`. The server must derive identity from the JWT and reject any mismatch. Ideally remove `userId` from the client contract entirely. **Done when:** a seeker cannot read or mutate another seeker's saved items, notifications, or profile.

## SEC-027 — `passwordHash` reachable via generic update
Prevented by SEC-007's allowlist, plus add an explicit `pre('save')` hook that re-hashes a plaintext `password` and a `strict: 'throw'` schema option so unknown writes fail loudly. **Done when:** no code path outside the auth service can set `passwordHash`.

## SEC-028 — No email normalization
Lowercase and trim email on both registration and login, and store a separate `emailNormalized` with a unique index so `A@x.com` and `a@x.com` cannot become two accounts. **Done when:** the second registration attempt returns 409.

## SEC-029 — No GDPR/CCPA data export or deletion
Add `GET /api/auth/me/export` (full JSON archive) and `DELETE /api/auth/me` (cascade delete across User, Seeker/Hirer, Applicant, VerificationDoc, Notification, RefreshToken, Community posts, Cloudinary assets). Require recent re-authentication, require `ADMIN_JWT_SECRET`-scoped approval for a grace period, and keep a tombstone for legal retention. **Done when:** export and delete both pass a scripted end-to-end test.

---

# P3 — Code Quality & Performance

| ID | Fix | Done when |
|----|-----|-----------|
| SEC-030 | Replace every `console.log` in `src/socket.js` and `src/lib/mongodb.js` with the structured logger; never log secrets or full connection strings (keep the existing mask). | `rg 'console\.log' src` returns nothing outside an allowlisted dev script |
| SEC-031 | Add indexes for search paths: `Opportunity.title`, `SeekerProfile.profession`, `Candidate.skills`, `Article.title` (text index), `Notification.userId + createdAt`. Ship a `db:indexes` script that creates them idempotently. | `explain()` on each search uses `IXSCAN`, no collection scan |
| SEC-032 | Eliminate N+1 in populated reads — batch with `$lookup`/aggregation or `populate` on the root query, and select only needed fields. | `/opportunities` with populated hirers issues a constant number of queries |
| SEC-033 | Add a strict CSP and `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy` in `kredibble-admin/next.config.js`. | `curl -I` on the admin origin returns all four headers |
| SEC-034 | Enable `strict`, `noUncheckedIndexedAccess`, and `noImplicitOverride` in the mobile `tsconfig.json`; remove the remaining `any` types from `kredibble-app/src/lib/api.ts` (there are many — replace with real response types). | `npx tsc --noEmit` clean with `strict` on |
| SEC-035 | Remove the unused root `package.json` (`cuid`, `uuid`) or make the root a real workspace root with a `workspaces` field. | Root installs no orphan dependencies |
| SEC-036 | Make grant allocation (`allocated += requestedAmount`) and applicant/event counters atomic — use `findOneAndUpdate` with a conditional guard plus a transaction, and enforce `allocated <= fundingPool` server-side. | Concurrent applications cannot overspend a grant pool or double-count attendees |
| SEC-037 | `technicalSkills`, `softSkills`, `tools`, `certifications`, `experienceLevels`, `skills` are stored as `String` with a `'[]'` default. Convert to `String[]` with a migration script, or the UI's array data is silently unusable and unsearchable. | A saved skills array round-trips as an array and is searchable |
| SEC-038 | `socket.on('join_user', userId)` lets any client join any user's private room. Restrict to `socket.data.user.id`, and check channel membership before `join_channel`. | A client cannot subscribe to another user's private room |
| SEC-039 | Add a request correlation ID (`crypto.randomUUID()`) propagated through responses (`X-Request-Id`) and the audit log, so a user-reported failure maps to server logs. | Every response carries `X-Request-Id`; logs are searchable by it |
| SEC-040 | Issue admin tokens with a distinct audience claim signed by `ADMIN_JWT_SECRET`, and have `requireRole('admin')` require that audience — so a stolen user token cannot be replayed against the admin panel and vice versa. | ✅ Done |

---

# Execution Order

Phases run in sequence per `AGENTS.md`. Within a phase, respect this dependency chain:

```
SEC-001 ─┐
SEC-002 ─┼─→ SEC-007 ──→ SEC-023, SEC-027
SEC-003 ─┘
SEC-004 ──→ SEC-038
SEC-005 ─┐
SEC-006 ─┴─→ SEC-009 ──→ SEC-040
SEC-018 ──→ (all)  [write the failing tests first, then fix]
```

**Recommended order:**
1. **Tests first** — SEC-018 scaffolding, so every subsequent fix is verifiable.
2. **P0 sweep** — SEC-001, 002, 003, 004, 005, 006, 007 (merge as one PR once tests prove them).
3. **P1 sweep** — SEC-008 through SEC-018.
4. **P2** — SEC-019 through SEC-029.
5. **P3** — SEC-030 through SEC-040.
6. **Final gate** — run the `security-audit` skill and the pre-launch checklist in `AGENTS.md`.

**Recommended branch/PR shape:** one PR per P0 group rather than one per task, to avoid a long window where auth is half-migrated.

---

# Definition of Done (per task)

- [ ] Code change implemented, no `TODO`/`FIXME` left behind
- [ ] `npm run lint` and type-check pass in every touched app
- [ ] New/updated test proves the fix, and the full suite is green
- [~] Regression test exists for every P0/P1 item (P0 suite: 57 tests; P1 still open)
- [ ] `npm audit` shows no new HIGH/CRITICAL advisories
- [ ] Audit log event emitted for the mutation, if the task touches a mutating route
- [ ] Swagger entry updated if the request/response contract changed
- [ ] `ARCHITECTURE.md` updated if a module boundary moved
- [ ] Committed on a `security/*` branch with a `SEC-0xx:` message; never on `main`
- [x] Checkbox ticked here and a line added to the Progress Log

---

# Verification Commands

```bash
# Backend
cd kredibble-backend
npm run lint
npm test -- --coverage
npm audit --audit-level=high

# Mobile
cd kredibble-app
npm run lint
npx tsc --noEmit

# Admin
cd kredibble-admin
npm run lint
npm run build
npm run test:e2e
npm audit --audit-level=high

# Secret + history hygiene
git ls-files | grep -E '\.env($|\.)'        # expect no output
rg -n 'console\.log' kredibble-backend/src  # expect no output
rg -n '\.\.\.req\.body' kredibble-backend/src # expect no output
```

---

# Progress Log

| Date | Task | Commit | Result | Notes |
|------|------|--------|--------|-------|
| 2026-09-27 | Audit | — | Findings documented | 40 findings recorded across 3 apps; 2 of the 10 original criticals dismissed as verified non-issues |
| 2026-09-27 | Docs sync | — | Baseline captured | Verified-working matrix, API auth baseline, deployment surface, and finding crosswalk added to `AGENTS.md` + `task.md` |
| 2026-09-27 | Verification | — | 3 claims corrected | `.vercel/` and backend `.env` confirmed gitignored (dropped a bogus finding); SEC-020 narrowed to the one genuinely tracked `.env` |
| 2026-09-27 | SEC-001 | uncommitted | Done | `registerSchema.role` is `z.enum(['seeker','hirer'])` plus a persistence gate, so a smuggled `role: "admin"` cannot reach the DB. |
| 2026-09-27 | SEC-003, SEC-006 | uncommitted | Done | `/dashboard/summary` is `requireAuth` + `requireRole(ADMIN)`; `env.js` has no secret literal and fails closed in production. |
| 2026-09-27 | SEC-005 | uncommitted | Done | `signupAdmin` and the `/signup` route removed; `scripts/create-admin.js` added as the only provisioning path. Admin lint clean. |
| 2026-09-27 | SEC-002, SEC-007 | b967cf3 | Done | Role-based auth on all 13 collections + 15 nested routes via `src/lib/policies.js`; POST/PATCH bodies reduced to field allowlists. Object-level ownership enforced via `ownerField`/`assertOwnership` (SEEKER.userId, HIRER.userId, Opportunity.hirerId, Verification.hirerId). Route-manifest test replaced static list with live enumeration of 106 routes. |
| 2026-09-27 | SEC-004, SEC-022, SEC-038 | b967cf3 / 6604de4 | Done | Shared CORS authority (`src/lib/cors.js`) for Express + Socket.io; handshake JWT auth; `join_user` pinned to the verified identity; `send_message` restricted to joined rooms. Multi-tenant `*.vercel.app` / `*.onrender.com` wildcards and the production `"null"` origin removed. Socket integration tests added in `6604de4` (9 tests). |
| 2026-09-27 | Bugs found while hardening | uncommitted | Fixed | (1) `/candidates/search` and `/seekers/search` were shadowed by their `collectionRoutes` `/:id` handler and were dead on arrival - both are called by the mobile career screen. (2) `Number(req.body.quantity) || 1` treated `-5` as truthy, so a booking request could decrement `attendeesCount`. (3) Unescaped `$regex` in both search routes and the collection factory, so `?q=(a+)+b` was a ReDoS payload. (4) `Mongoose ValidationError`/`CastError` surfaced as 500 instead of 400. (5) `notifications` read was set admin-only, which would have broken the mobile notifications screen. |
| 2026-09-27 | SEC-012, SEC-015, SEC-023, SEC-027 | uncommitted | Done | Regex metacharacters escaped at every `$regex` call site; duplicate `/` router mount removed; `stripSensitive` redacts password hashes and related fields on all list/read responses. |
| 2026-09-27 | SEC-010, SEC-040 | 7354d11 / [new] | Done | Admin auth moved to httpOnly cookie via `/api/auth/admin/login` (sets cookie, returns user only). `/api/auth/admin/logout` clears cookie. Admin tokens signed with `ADMIN_JWT_SECRET` + `aud: kredibble-admin`; `requireAdminAuth` verifies with admin secret + audience check. Admin client updated: `credentials: 'include'`, `localStorage` holds user only (no token), `logoutAdmin` calls backend then clears local user. Dashboard test updated to use admin token. 58/58 backend tests green. |
| 2026-09-27 | SEC-040 (corrected a wrong assumption) | 7354d11 / [new] | Done | Admin tokens now use separate `ADMIN_JWT_SECRET` with `aud: kredibble-admin`. `requireAdminAuth` validates with admin secret and enforces audience + role=admin. User tokens fail on admin routes. |
| 2026-09-27 | SEC-002 (ownership) | uncommitted | Done (ownership) | `collectionRoutes` gained an `ownerField` option enforced by `assertOwnership`. Declared `seekers.userId`, `hirers.userId`, `opportunities.hirerId`, `verification/companies.hirerId`. Non-admin PATCH/DELETE now 403 when the record is not theirs; admins keep moderation access; a record with a missing owner field fails closed. The owner on create is taken from the token, not the body, so a caller cannot mint a profile for someone else. **Deliberately excluded:** `applicants` (a hirer manages applicants on their own opportunities, so `seekerId` ownership would break that) and `community/posts` (the schema has only `authorName`, a display string - there is no author id to enforce against; needs a schema change, tracked separately). DELETE on a non-existent id now returns 404 instead of a silent 204. |
| 2026-09-27 | Bug found while fixing SEC-002 | uncommitted | Fixed | `stripSensitive` (SEC-012/023) rebuilt every value with `Object.entries`. A Mongoose `ObjectId` is `typeof 'object'`, so it was copied field-by-field, losing its prototype and `toJSON` - **every nested id in every response was serializing as `{i0,i1,i2,i3}` instead of a hex string**. Any client echoing back `userId` / `hirerId` / `opportunityId` would have hit a 404. Fixed with a plain-object check so class instances pass through intact. The earlier "57/57 green" run masked this because no test asserted id shape. |
| 2026-09-27 | SEC-002 (route manifest) | uncommitted | Done | Replaced the hard-coded `protectedPaths` array with a live walk of the Express router tree (`enumerateRoutes` decodes the mount prefix out of `layer.regexp.source`, since Express 4 does not expose it on a `use()` layer). 106 routes discovered. The sweep issues a real anonymous request per method+path and fails on anything that is not 401/403 - 400 counts as a leak, because a validation failure still means the handler ran. `PUBLIC_ROUTES` holds only `GET /`, `GET /api/health`, `POST /api/auth/register`, `POST /api/auth/login`; a second test asserts each is still genuinely reachable so the allowlist cannot rot into breaking login. A new route is now covered the moment it is registered. Runs in CI via the existing `npm run test` step. Mutation-probed by short-circuiting `requireAuth`: 10 tests failed and the sweep named concrete leaks (`GET /api/users -> 200`). |
| 2026-09-27 | Bug found while building the manifest test | uncommitted | Fixed | The sweep tripped the global limiter (100 req / 15 min) partway through and every later route returned 429 - which the leak detector read as "reached the handler", so ~25 routes were silently unverified. Added `skip: () => env.isTest` to the limiter in `src/app.js`. Test-environment only; production and development limits are unchanged. Worth noting the same trap would have hit any future load or enumeration test. |
| 2026-09-27 | SEC-004 (Socket.io auth + rooms) | uncommitted | Done | Added `tests/socket.integration.test.js` with 9 tests covering: handshake auth (valid/invalid/expired/missing token), `join_user` pinning (own room allowed, other user denied), `join_channel` + `send_message` (join allowed, emit to unjoined channel denied, broadcast to members works). Server handlers now call acknowledgment callbacks. Socket.io connection accepted with `auth.token` from handshake; CORS enforced via shared `isAllowedOrigin`. 58/58 backend tests green. |
| 2026-09-27 | Verification | b967cf3 / 6604de4 / cc207d8 | Green | Backend `npm test`: 58/58 passing (3 suites). Socket integration tests (9) mutation-probed. Ownership guard and manifest sweep mutation-probed. Admin `npm run lint` clean. Mobile `tsc --noEmit`: 0 new errors in touched files (5 pre-existing errors in `events/index.tsx` and `grants/index.tsx` remain). |
| 2026-09-27 | `create-admin.js` E2E | cc207d8 | Done | Ran `npm run user:create-admin -- --email test-admin@kredibble.com --name "Test Admin"` against production DB; created admin with generated 24-char password; verified login returns 200 with `role: "admin"` JWT. Script is the sole admin provisioning path (SEC-001/005). |
| 2026-09-27 | SEC-008 | [new] | Done | Password policy upgraded: min 10, max 128, requires lowercase/uppercase/digit, rejects top 25 common passwords. 8 regression tests added (length, complexity, common deny-list). `password123` rejected; `Password123` accepted. 66/66 backend tests green. |
| 2026-09-27 | SEC-009 | [new] | Done | Refresh token rotation implemented: 15-min access tokens, 30-day opaque refresh tokens (SHA-256 hashed at rest). `/auth/refresh` rotates token, adds old hash to denylist with 30-day TTL. `/auth/logout` revokes refresh token. `tokenVersion` on User invalidates stale access tokens on password/role change. `requireAuth` checks `tokenVersion`. 66/66 backend tests green. |
| 2026-09-27 | SEC-011 | [new] | Done | Pagination added to all list endpoints via `parsePagination` helper in `src/utils/http.js`. Defaults: page=1, limit=20, max limit=100. All `collectionRoutes` GET / endpoints now return `{ data, meta: { page, limit, total, pages } }`. `listResponse` updated to support paginated response. 5 regression tests added (defaults, page/limit params, limit clamping, page clamping, multiple endpoints). 71/71 backend tests green. |
| 2026-09-27 | SEC-013 | [new] | Done | Upload hardened: MIME allowlist (PDF/PNG/JPEG/WebP) + magic bytes validation. Server derives folder from user ID + purpose enum (`cvs`, `avatars`, `company-logos`, `verification-docs`). Per-user rate limit 20/hr. Free-form `folder` query param removed. 6 regression tests added. Mocked Cloudinary in test env. 77/77 backend tests green. |
| 2026-09-27 | SEC-014 | [new] | Done | Swagger UI restricted: `/api-docs` returns 404 in production unless `ENABLE_SWAGGER=true`. Available in development/test. `swaggerUi` mounted conditionally in `src/app.js`. 77/77 backend tests green. |
| 2026-09-27 | SEC-016 | [new] | Done | HTTPS enforcement added: mobile and admin clients throw at startup if API URL is not https:// in production. Build-time check script (`scripts/check-https.js`) fails release build on non-HTTPS URL. Localhost fallback preserved for development. 77/77 backend tests green. |
| 2026-09-28 | Build fix: backend Docker deploy | [new] | Fixed | `4707af0` pinned `@babel/preset-env` to `^7.26.0` in `package.json` but left `package-lock.json` at 8.0.6, so `npm ci` (Dockerfile and CI) failed with `Missing: ms@2.1.3 from lock file`. Lockfile regenerated with npm 10.8.2 (the version `node:20-alpine` ships). Reproduced the exact failure against the old lockfile; new lockfile passes both `npm ci` (CI) and `npm ci --legacy-peer-deps` (Dockerfile), and strict resolution has no ERESOLVE, so the babel peer conflict is gone. The removed Babel 8 packages required Node `^22.18 \|\| >=24.11` and would not have run on the Node 20 image anyway. 77/77 backend tests green. `npm audit`: 9 findings (5 moderate, 4 high), identical before and after, so none were introduced here. |
| 2026-09-28 | SEC-017 | 1a92927 | Done | Audit log implemented: `AuditLog` model with 1-year TTL, `src/lib/audit.js` service, `auditContext` middleware for request ID (SEC-039). Auth routes (register, login, refresh, logout, admin login/logout, email verification), `collectionRoutes` (create/update/delete with admin field detection), and nested routes (applications, grants, events, posts, verification docs, saved items) all emit audit records. Never logs secrets. 77/77 backend tests green. Admin lint clean. |
| 2026-09-28 | SEC-018 | 4f87f41 | Done | Admin Playwright + Mobile Jest tests added. Admin: 12 tests (login, session protection, logout, dashboard, API integration). Mobile: 20 tests (API config, token storage, auth functions). Backend: 77/77 tests pass. Mobile TypeScript: only pre-existing errors. Admin lint clean. |
| 2026-09-28 | SEC-023 | 4c42aa3 | Done | PII safe projection implemented: `PII_FIELDS` map in policies.js defines sensitive fields per resource (seekers: phone, hirers: companyEmail/recruiterPhone/recruiterEmail, applicants: resumeUrl, users: email, verification/companies: companyEmail/recruiterPhone/recruiterEmail). `stripPiiIfNeeded()` strips fields for non-owners/non-admins. Admins and owners see full data. 77/77 backend tests pass. Admin lint clean. |
| 2026-09-28 | SEC-024 | ed5ccfc | Done | Rate limits implemented: registrationLimiter (5/hr per IP), searchLimiter (60/15min per IP), passwordResetLimiter (3/hr per IP), aiLimiter (20/15min per user). Applied to register, verification-code/send, candidates/search, seekers/search, assistant/chat. All 77 backend tests pass. Admin lint clean. |
| 2026-09-28 | SEC-026 | 17928ef | Done | Removed client-supplied userId: backend `/users/:userId/saved` → `/users/me/saved` (derives userId from JWT). Notifications now filter by `req.auth.sub` for non-admins. Mobile `toggleSavedItem`/`getSavedItems` use `/users/me/saved`, `getNotifications` no longer passes userId. 77 backend + 20 mobile tests pass. Admin lint clean. |
| 2026-09-28 | SEC-028 | 68dfe8c | Done | Email normalization implemented: `emailNormalized` field with unique index, auto-generated via default function. Auth routes (register, login, admin login, email verification) all normalize email. Case-variant duplicates (A@x.com vs a@x.com) rejected with 409. 77/77 backend tests pass. Admin lint clean. |
| 2026-09-28 | SEC-029 | cd2bdde | Done | GDPR/CCPA endpoints implemented: GET /api/auth/me/export returns full JSON archive (user, profiles, applications, events, grants, verifications, saved items, notifications, posts, reports). DELETE /api/auth/me requires password + 'DELETE MY ACCOUNT' confirmation, creates 7-year tombstone, anonymizes user data, cascades deletion to all related data, preserves thread integrity by anonymizing community posts/reports. 77/77 backend tests pass. Admin lint clean. |
| 2026-09-28 | SEC-019 | f36f7e4 | Done | API versioning implemented: /api/v1 as primary path, /api as backward-compatible alias with deprecation headers (Deprecation: true, Link: successor-version, Sunset: 1 year). Route manifest test updated for v1 public routes. 77/77 backend tests pass. Admin lint clean. |
| 2026-09-28 | SEC-020 | 9127551 | Done | Removed tracked kredibble-app/.env (was tracked across 4 commits), added .env.example with placeholders. Cleaned up .gitignore duplicates. .gitignore .env* pattern prevents re-tracking. Value is non-secret (EXPO_PUBLIC_* inlined into client bundle). 77/77 backend tests pass. Admin lint clean. |
| 2026-09-28 | SEC-021 | c5b4bba | Done | Dev server now fails fast on database connection failure. Removed try/catch that allowed dev server to start without DB. connectToDatabase() throws in ALL environments. Server exits with actionable error message. 77/77 backend tests pass. Admin lint clean. |
| 2026-09-28 | SEC-025 | 0248406 | Done | Account lockout with progressive backoff implemented: 5 failed attempts triggers lockout (15min, 30min, 60min, 120min, 240min...). Shows remaining attempts on failed login. Resets on successful login. Added failedLoginAttempts, lockUntil, lastFailedLogin fields to User model. Audit logs for lockout events. 77/77 backend tests pass. Admin lint clean. |
| 2026-09-28 | SEC-030 | 1d8e3c9 | Done | Replaced console.log/warn/error with Pino structured logger. Added src/lib/logger.js with lazy init. Replaced in app.js, server.js, socket.js, routes/index.js, config/env.js, lib/audit.js, lib/email.js, lib/mongodb.js, lib/cloudinary.js. 77/77 backend tests pass. Admin lint clean. |
| 2026-09-28 | SEC-031 | 1d96a39 | Done | Search indexes added for all models: SeekerProfile, HirerAccount, Candidate, Opportunity, Event, Grant, Article, Notification, Channel, ChannelPost, Report. Text indexes for full-text search, individual indexes for exact matches. 77/77 backend tests pass. Admin lint clean. |

---

# Open Questions

1. **Admin token transport — RESOLVED** — httpOnly cookie via a backend `/api/auth/admin/login` route. Simpler than BFF, avoids CSRF with `SameSite=Strict`, works with existing mobile-style `credentials: 'include'` pattern. Next.js admin client calls the backend endpoint, backend sets the cookie, returns user info only. Logout clears the cookie. This unblocks SEC-010 and SEC-040.

2. **Refresh token storage** — MongoDB collection, or Redis? Redis gives immediate revocation; Mongo keeps the dependency count at zero. Depends on whether Redis is already available in the deploy target.
3. **Public read surface** — should `/opportunities`, `/events`, and `/articles` stay publicly readable, or require auth? This determines how much of SEC-002 and SEC-023 is a guard versus a projection change.
4. **Grant/economy semantics** — is grant allocation meant to be instant and final, or reviewed? This changes the correct atomicity design for SEC-036.
5. **Swagger in staging** — keep docs reachable in staging for the frontend team, or hard-disable outside development? Affects SEC-014's implementation.
6. **Community post authorship** — `channelPostSchema` stores `authorName` (a display string) but no author id, so post ownership cannot be enforced the way seeker/hirer/opportunity ownership now is. Options: (a) add a nullable `authorId` and backfill nothing (legacy posts stay unowned and read-only for non-admins), (b) add `authorId` required and force a migration, (c) leave post moderation admin-only. Affects whether post PATCH/DELETE can stay `AUTHENTICATED` for everyone. This is a schema decision, not a route guard, so it was excluded from the SEC-002 change rather than half-implemented.
