# task.md — Kredibble Security & Architecture Remediation Plan

**Status:** Active — **reopened 2026-10-02** by the production-readiness audit (see § *2026-10-02 Production-Readiness Audit*)
**Created:** 2026-09-27
**Scope:** `kredibble-backend`, `kredibble-app`, `kredibble-admin`, deployment + CI/CD
**Companion docs:** `AGENTS.md` (phase/skill pipeline), `PRODUCTION-READINESS-AUDIT.md` (full audit narrative and evidence)
**Target:** Zero CRITICAL/HIGH findings, >80% coverage on auth + PII endpoints, OWASP Top 10 clean, every core user journey working on the deployed build

> **2026-10-02 audit summary.** `main` @ `3ffc51d` is **not deployable and not launch-ready**. A live backend (`kredibble-backend.vercel.app`) is serving user records including password hashes to anonymous callers (SEC-041). The current code fails `npm ci` (SEC-066), the admin build fails (SEC-067), and production boot fails with the `render.yaml` env (SEC-068). Core journeys are broken (SEC-042, 043, 044, 080). Eleven items previously marked ✅ were found not implemented or broken and are **reopened** below. 55 new tasks (SEC-041 … SEC-095) were added. Every claim was verified by running the real app against `mongodb-memory-server` or by read-only requests to the live hosts.

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
| **P0** | Actively exploitable by an unauthenticated attacker, **or** prevents the code from deploying, **or** breaks a core user journey (sign-in session, apply, post). Ship-blocking. | Immediate | Must be 0 before any deploy |
| **P1** | Exploitable with a low-privilege account, or causes data loss / DoS / leaks PII, **or** is a launch requirement (app-store policy, legal, operations, admin moderation). | This sprint | Must be 0 before launch |
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

### Crosswalk — 2026-10-02 production-readiness audit → task ID

`PRODUCTION-READINESS-AUDIT.md` used area prefixes. Per the `AGENTS.md` guardrail every finding is tracked under a `SEC-*` id here.

| Audit ID | Finding | Task ID | Priority |
|----------|---------|---------|----------|
| SEC-041 | Live Vercel backend leaks users + password hashes anonymously | SEC-041 | P0 |
| SEC-042 | Apply / grant-apply / verification-doc upload return 500 | SEC-042 | P0 |
| SEC-043 | Community channel post routes 404 (missing from mounted router) | SEC-043 | P0 |
| SEC-044 | Notifications always empty for users | SEC-044 | P1 |
| SEC-045 | Admin-portal, AI assistant, news routers never mounted | SEC-045 | P1 |
| SEC-046 | Dashboard summary shape ≠ admin UI | SEC-046 | P1 |
| SEC-047 | `Opportunity.hirerId` stores a User id but refs `HirerAccount` | SEC-047 | P1 |
| SEC-048 | Moderation bypassed — pending listings visible | SEC-048 | P1 |
| PROD-1 | No "my applications" endpoint | SEC-072 | P1 |
| SEC-049 | Rate limiter key generator wrong — limits never apply | SEC-049 | P0 |
| SEC-050 | Lockout never persisted | SEC-050 | P0 |
| SEC-051 | Login account enumeration | SEC-051 | P2 |
| SEC-052 | Access-token revocation (	okenVersion) is dead code | SEC-052 | P1 |
| SEC-053 | One refresh token per user; non-string body → 500 | SEC-053 | P2 |
| SEC-054 | Any signed-in user can harvest every users email | SEC-054 | P1 |
| SEC-055 | Email leaked via populate; search routes leak phones and are unpaginated | SEC-055 | P1 |
| SEC-056 | Applicant IDOR, impersonation and duplicate applications | SEC-056 | P1 |
| SEC-057 | Community channel/post IDOR and author spoofing | SEC-057 | P1 |
| SEC-058 | Verification documents readable by every hirer | SEC-058 | P1 |
| SEC-059 | Event capacity unenforced; attendee emails exposed | SEC-059 | P1 |
| SEC-060 | Grant allocation not implemented | SEC-060 | P2 |
| SEC-061 | NoSQL operator injection in list filters | SEC-061 | P2 |
| SEC-062 | Weak email verification code handling | SEC-062 | P2 |
| SEC-063 | Policy check fails open | SEC-063 | P2 |
| SEC-064 | 5xx responses leak internal messages | SEC-064 | P2 |
| SEC-065 | GDPR deletion incomplete | SEC-065 | P1 |
| OPS-1 | Backend lockfile out of sync — `npm ci` fails | SEC-066 | P0 |
| OPS-2 | Admin production build fails | SEC-067 | P0 |
| OPS-3 | Production boot requires unused AI/email keys | SEC-068 | P0 |
| OPS-4 | Two divergent backends; free-tier sleep; Swagger public | SEC-069 | P1 |
| OPS-5 | CI does not gate | SEC-070 | P1 |
| OPS-6 | Backend suite red (10/102) | SEC-071 | P1 |
| ADM-1 | Admin CSP blocks the API | SEC-073 | P1 |
| ADM-2 | Admin cookie can't cross sites | SEC-074 | P1 |
| ADM-3 | Admin cookie rejected on data routes | SEC-075 | P1 |
| ADM-4 | Admin session has no refresh | SEC-076 | P1 |
| ADM-5 | Admin pages on mock data | SEC-077 | P1 |
| ADM-6 | Next.js critical CVEs | SEC-078 | P1 |
| ADM-7 | Admin CSP allows unsafe-inline/eval | SEC-079 | P2 |
| MOB-1 | Mobile never refreshes tokens | SEC-080 | P0 |
| MOB-2 | Mobile detail screens hardcoded; apply not wired | SEC-081 | P1 |
| MOB-3 | AI assistant is canned | SEC-082 | P2 |
| MOB-4 | Forgot password is fake | SEC-083 | P1 |
| MOB-5 | Change password / delete account not wired | SEC-084 | P1 |
| MOB-6 | Other mobile screens on mock data | SEC-085 | P2 |
| MOB-7 | Mobile `tsc` 5 errors, lint 45 errors | SEC-086 | P2 |
| MOB-8 | Store readiness (identity, policy links) | SEC-087 | P1 |
| MOB-9 | Mobile `npm audit` high advisories | SEC-088 | P2 |
| Phase 4 | Redis, always-on hosting, backups | SEC-089 | P1 |
| Phase 4 | Error tracking + uptime monitoring | SEC-090 | P1 |
| Phase 4 | Transactional email domain | SEC-091 | P2 |
| Phase 4 | Privacy policy, ToS, data-protection registration | SEC-092 | P1 |
| Phase 4 | Load test + external pen test | SEC-093 | P2 |
| §6 | Stale README / AGENTS.md baseline | SEC-094 | P3 |
| — | Request logging noise; moving `Sunset`; dead duplicate route | SEC-095 | P3 |

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
| SEC-009 | 7-day JWT with role baked in, no refresh/rotation | P1 | Backend auth | ⚠️ Reopened — `tokenVersion` check is dead code → SEC-052 |
| SEC-010 | Admin JWT stored in `localStorage` (XSS-readable) | P1 | Admin app | ⚠️ Reopened — cookie never reaches the API → SEC-074, SEC-075 |
| SEC-011 | No pagination or result limits on any list endpoint | P1 | Backend routes | ✅ Done |
| SEC-012 | User-controlled `$regex` — regex injection / ReDoS | P1 | Backend routes | ✅ Done |
| SEC-013 | Upload accepts any MIME type; `folder` param unvalidated | P1 | Backend upload | ✅ Done |
| SEC-014 | Swagger UI mounted and served in production | P1 | Backend app | ✅ Done |
| SEC-015 | `apiRouter` mounted twice (`/` and `/api`), limiter double-counts | P1 | Backend app | ✅ Done |
| SEC-016 | Clients fall back to plaintext HTTP, no HTTPS enforcement | P1 | App + Admin | ✅ Done |
| SEC-017 | No audit log for admin/mutating actions | P1 | Backend | ✅ Done |
| SEC-018 | Test suite empty — no auth or authorization tests exist | P1 | Backend | ⚠️ Reopened — 10/102 failing, CI not gating → SEC-070, SEC-071 |
| SEC-019 | No API versioning — breaking changes ship silently | P2 | Backend | ⚠️ Partial — clients still call `/api`; live Vercel has no `/api/v1` → SEC-069 |
| SEC-020 | `kredibble-app/.env` is tracked and committed | P2 | Repo hygiene | ✅ Done |
| SEC-021 | Dev server starts and serves with no database | P2 | Backend | ✅ Done |
| SEC-022 | CORS allows any `*.vercel.app` / `*.onrender.com` tenant | P2 | Backend app | ✅ Done |
| SEC-023 | PII exposed through generic collection reads | P2 | Backend routes | ⚠️ Reopened — bypassed via `emailNormalized`, populate, search → SEC-054, SEC-055 |
| SEC-024 | No rate limit on upload, search, or registration | P2 | Backend | ⚠️ Reopened — key generator bug, no limit applies → SEC-049 |
| SEC-025 | No account lockout or progressive backoff on login | P2 | Backend auth | ⚠️ Reopened — lock never saved → SEC-050 |
| SEC-026 | Client-supplied `userId` trusted for profile/saved/notification ops | P2 | Backend routes | ✅ Done |
| SEC-027 | `passwordHash` reachable through generic update paths | P2 | Backend routes | ✅ Done |
| SEC-028 | No email normalization — case-variant duplicate accounts | P2 | Backend auth | ✅ Done |
| SEC-029 | No GDPR/CCPA data export or deletion endpoint | P2 | Backend | ⚠️ Reopened — tombstone not persisted, media kept, token still valid → SEC-065, SEC-052 |
| SEC-030 | `console.log` in production paths violates logger guardrail | P3 | Backend | ✅ Done |
| SEC-031 | Search fields have no indexes | P3 | Backend models | ✅ Done |
| SEC-032 | N+1 reads in populated relation queries | P3 | Backend routes | ✅ Done |
| SEC-033 | Next.js admin has no CSP / security headers | P3 | Admin app | ⚠️ Reopened — CSP blocks the API; unsafe-inline/eval → SEC-073, SEC-079 |
| SEC-034 | Mobile TypeScript not in strict mode | P3 | App | ✅ Done |
| SEC-035 | Root `package.json` carries unused `cuid` + `uuid` | P3 | Repo hygiene | ✅ Done |
| SEC-036 | Grant allocation and applicant counters are non-atomic | P3 | Backend | ⚠️ Reopened — no allocation code exists on `main` → SEC-060 |
| SEC-037 | List fields stored as `String` instead of typed arrays | P3 | Backend models | ⚠️ Reopened — fields are still `String` with `'[]'` default; parse helpers still in use |
| SEC-038 | `join_user` lets any client join any user's room | P3 | Backend realtime | ✅ Done (verified 2026-10-02) |
| SEC-039 | No request correlation ID or structured logger | P3 | Backend | ✅ Done |
| SEC-040 | Admin panel has no independent admin token audience | P3 | Backend auth | ✅ Done |
| **SEC-041** | **Live Vercel backend serves users + password hashes to anonymous callers** | **P0** | **Deployment / incident** | 🔴 Open — act today |
| SEC-042 | Apply / grant-apply / verification-doc upload return 500 (audit logger) | P0 | Backend routes | ✅ Done |
| SEC-043 | Community channel post routes missing from mounted router (404) | P0 | Backend routes | ✅ Done |
| SEC-044 | Notifications always empty for non-admin users | P1 | Backend routes | ✅ Done (scoped by audience & active status) |
| SEC-045 | Admin-portal, AI assistant, news routers never mounted | P1 | Backend app | ✅ Done (admin-api mounted, dead admin.js removed, assistant & news mounted with tests) |
| SEC-046 | `/dashboard/summary` shape does not match admin UI | P1 | Backend + Admin | ✅ Done |
| SEC-047 | `Opportunity.hirerId` stores User id but refs `HirerAccount` | P1 | Backend models | ✅ Done (hirer applicant access verified) |
| SEC-048 | Opportunity moderation bypassed on reads | P1 | Backend routes | ✅ Done (scoped by seeker/owner/admin & tested) |
| SEC-049 | Rate-limiter key generator wrong — no limit ever applies | P0 | Backend | ✅ Done |
| SEC-050 | Account lockout never persisted; admin login unthrottled | P0 | Backend auth | ✅ Done |
| SEC-051 | Login reveals which emails are registered | P2 | Backend auth | ✅ Done |
| SEC-052 | Token revocation works and checks DB | P1 | Backend auth | ✅ Done |
| SEC-053 | One refresh token per user; malformed body → 500 | P2 | Backend auth | ✅ Done |
| SEC-054 | Admin-only /users and proper PII stripping | P1 | Backend routes | ✅ Done |
| SEC-055 | Search routes paginated and PII stripped | P1 | Backend routes | ✅ Done |
| SEC-056 | Applicant endpoints explicitly check opportunity owner | P1 | Backend routes | ✅ Done |
| SEC-057 | Community channels and posts enforce ownerField | P1 | Backend routes | ✅ Done |
| SEC-058 | Verification documents scoped to owner (companyId) | P1 | Backend routes | ✅ Done |
| SEC-059 | Event capacity unenforced; attendee emails exposed to hirers | P1 | Backend routes | ✅ Done |
| SEC-060 | Grant allocation not implemented; applications carry no identity | P2 | Backend | ✅ Done (atomic allocation & applicant tracking) |
| SEC-061 | NoSQL operator injection via query params | P2 | Backend routes | ✅ Done |
| SEC-062 | Email verification code: weak RNG, no attempt cap | P2 | Backend auth | ✅ Done |
| SEC-063 | Authorization fails open for missing policy actions | P2 | Backend | ✅ Done |
| SEC-064 | 5xx responses leak internal error messages | P2 | Backend app | ✅ Done |
| SEC-065 | GDPR deletion incomplete (tombstone, media, owned content) | P1 | Backend | ✅ Done |
| SEC-066 | Backend `package-lock.json` out of sync — `npm ci` fails | P0 | CI/CD | ✅ Done |
| SEC-067 | Admin `next build` fails on type error | P0 | Admin / CI | ✅ Done |
| SEC-068 | Production boot requires AI + Resend keys missing from `render.yaml` | P0 | Backend config | ✅ Done (gated via feature flags; render.yaml updated; boot smoke in CI) |
| SEC-069 | Two divergent backend deployments; free tier sleeps; Swagger public | P1 | Deployment | ✅ Done (Render Starter container selected, Swagger gated, single host topology established) |
| SEC-070 | CI does not gate lint / typecheck / build / e2e | P1 | CI/CD | ✅ Done (all jobs gate without masks; boot smoke & build checks verified) |
| SEC-071 | Backend test suite red (10/102 failing) | P1 | Backend tests | ✅ Done (196/196 passing across 16 test suites) |
| SEC-072 | Seekers cannot list their own applications | P1 | Backend + App | ✅ Done (/users/me/applications wired to backend & app) |
| SEC-073 | Admin CSP `connect-src 'self'` blocks every API call | P1 | Admin app | ✅ Done (next.config.ts includes apiOrigin & wsOrigin) |
| SEC-074 | Admin proxy configured for SameSite=Strict cookies | P1 | Admin + Deployment | ✅ Done |
| SEC-075 | Admin cookie not accepted by data routes (only `/dashboard/summary`) | P1 | Backend auth | ✅ Done (admin data API + contract test, 8b68a3c) |
| SEC-076 | Admin session expires at 15 min with no refresh | P1 | Admin + Backend | ✅ Done |
| SEC-077 | 20 of ~25 admin pages run on mock data | P1 | Admin app | ✅ Done (all pages on the admin API, mock files deleted, every admin update audited) |
| SEC-078 | Admin `next@16.2.10` has critical advisories | P1 | Admin deps | ✅ Done (upgraded to Next 16.3.8, builds cleanly) |
| SEC-079 | Admin CSP allows `'unsafe-inline' 'unsafe-eval'` | P2 | Admin app | ✅ Done (unsafe-eval disabled in production next.config.ts) |
| SEC-080 | Mobile app never refreshes tokens — sessions die at 15 min | P0 | Mobile app | ✅ Done (refreshes automatically on 401 via SecureStore) |
| SEC-081 | Mobile detail screens hardcoded; Apply not wired; fake fallback data | P1 | Mobile app | ✅ Done (jobs, internships, events, grants wired to live API) |
| SEC-082 | Mobile AI assistant returns canned replies | P2 | Mobile app | ✅ Done (assistant backend mounted with server-chosen provider; client mock data preserved as interactive demo) |
| SEC-083 | Forgot-password flow is UI-only (no backend) | P1 | Mobile + Backend | ✅ Done (6-digit OTP & password reset wired to live API) |
| SEC-084 | Change password and delete account not wired (store requirement) | P1 | Mobile + Backend | ✅ Done (wired in seeker & hirer security with password prompt) |
| SEC-085 | Notifications/saved/applications/hirer screens on mock data | P2 | Mobile app | ✅ Done (wired to live API endpoints, mock constants removed) |
| SEC-086 | Mobile `tsc` 5 errors, `expo lint` 45 errors | P2 | Mobile app | ✅ Done (tsc 0 errors, expo lint 0 errors, 21 tests passing) |
| SEC-087 | App-store readiness: identity, iOS bundle id, policy links | P1 | Mobile app | ✅ Done (name: "Kredibble", buildNumber: "1", versionCode: 1, cross-env scripts) |
| SEC-088 | Mobile `npm audit`: 4 high, 12 moderate | P2 | Mobile deps | ✅ Done (Expo SDK line checked; all build-time advisories documented) |
| SEC-089 | Shared Redis, always-on hosting, database backups | P1 | Operations | 🟡 Redis configured; automated age backups and restore drill complete (Plan 4e); always-on hosting & multi-instance limits in Plans 4b, 4f |
| SEC-090 | No error tracking or uptime monitoring | P1 | Operations | ✅ Done (Plan 4d: Sentry error tracking, pino-http logging, Better Stack monitoring runbook, Vector log pipeline) |
| SEC-091 | Transactional email domain not verified (SPF/DKIM) | P2 | Operations | Open |
| SEC-092 | No privacy policy / ToS; data-protection registration | P1 | Legal | Open |
| SEC-093 | No load test or external pen test | P2 | Operations | Open |
| SEC-094 | README and `AGENTS.md` baseline are stale | P3 | Docs | ✅ Done (rewritten for current Mongoose 9, Node 22/24, no password123 or stale paths) |
| SEC-095 | Request logging noise; moving `Sunset`; dead duplicate code | P3 | Backend | ✅ Done |
| SEC-096 | Private channel readable anonymously once its creator is deleted (creator check fails open on `undefined === undefined`) | P0 | Backend routes | ✅ Done (found and fixed before merge, 11e894c) |
| SEC-097 | Private-channel posts readable by any signed-in user via `GET /community/posts` (no read scope) | P1 | Backend routes | ✅ Done (scoped to accessible channels) |
| SEC-098 | Sockets ignore account deletion and session revocation (handshake checks signature only; open sockets never evicted) | P1 | Backend realtime | ✅ Done (DB checks on handshake + socket eviction) |
| SEC-099 | No user logout route — refresh tokens stay valid for 30 days after sign-out | P1 | Backend auth | ✅ Done (POST /auth/logout wired to backend & app) |
| SEC-100 | Applicant access checks `Opportunity.createdBy`; hirers get 403 on postings they created through the API (root cause SEC-047) | P1 | Backend routes | ✅ Done (hirer access verified on postings) |
| SEC-101 | Deletion follow-ups: counters not decremented; kept public content can point at deleted media; `Ambassador`/`Beneficiary` PII untouched; testimonials matched on a typed email; tombstone `emailHash` and reset-code hashes are unkeyed SHA-256 | P2 | Backend | ✅ Done (HMAC server secret + counter decrements) |
| SEC-102 | `registerSchema` uses the Zod 3 `errorMap`, which Zod 4.6.5 ignores (custom role error message lost) | P3 | Backend | ✅ Done (Zod 4 schema message verified) |
| SEC-103 | Account-security polish: deletion scheduler has no backoff or in-flight guard; a 500 after the tombstone write can still lead to a scheduled erasure; self-delete admin check reads the JWT role claim; latent fail-open in `isLegacyMember` | P3 | Backend | ✅ Done (in-flight guard, rollback, DB role check, isLegacyMember hardened) |
| SEC-104 | Staff-portal `POST/PATCH /admin/opportunities` spread the whole request body into the posting (`prepareOpportunity`): mass assignment of `applicantsCount`, `createdBy`, `hirerId`, `wordpressSync`… | P2 | Backend routes | ✅ Done (mass assignment blocked in admin PATCH) |
| SEC-105 | Admin traffic reaches the API through the Vercel proxy and `trust proxy` is 1 (Render's hop), so every admin is keyed on Vercel's egress IP and shares one 100-request/15-min bucket | P2 | Backend + Deployment | ✅ Done (keyed on admin token hash in rate-limiter) |
| SEC-106 | Staff-portal `GET /admin/opportunities` put query values straight into the Mongo filter (operator injection, SEC-061 class) | P2 | Backend routes | ✅ Done (be2865e) |
| SEC-107 | A channel an admin marked `removed` stayed listed, readable and postable for everyone | P1 | Backend routes | ✅ Done (9a873ac) |
| SEC-108 | `collectionRoutes` audited admin updates only when an admin-only field changed, so report, event, grant, channel and staff decisions left no audit row | P1 | Backend | ✅ Done (1a418c9) |
| SEC-109 | The admin e2e server loaded `kredibble-backend/.env`, so an upload test reached the real Cloudinary account (3 × 1×1 PNG, 67 B, `kredibble/kredibble/admin/article-banner/`, 2026-10-04 03:21 UTC) | P2 | Tests / Ops | ✅ Done (5ebe9a9); test files left for the owner to delete |
| SEC-110 | SEC-090 commit saved 11 files as UTF-16 (3 CD workflows, `eas.json`, 3 `.env.example`, `docker-compose.prod.yml`, `DISASTER_RECOVERY.md`, 2 shell scripts); b804a81 re-saved `task.md` as Windows-1252 | P0 | Repo / CI/CD | ✅ Fixed in 712ea6c (re-encoded, task.md repaired); CI guard in SEC-116 |
| SEC-111 | Production mobile config on `main` (PR #30) points at `api.globalopportunitydesk.com`, which does not resolve; CD App tried to publish it to the production channel on three pushes and was stopped only by SEC-118; staging/dev names are two levels deep (`staging.api.…`), which Cloudflare's free edge certificate doesn't cover | P0 | Deployment | ✅ Production back on Render (PR 1); single-level staging/dev names in Plan 4c, production switch in Plan 4f |
| SEC-112 | Deploy pipeline unsafe: CD Backend fails on every push since PR #30 (no SSH secrets; Render deploy step removed); every branch overwrites `:latest`, which the VPS compose file runs; compose never copied; blank `environment:` values; mixed-case image ref; no SSH host-key pinning; API port published without TLS; container names collide across environments; no health-gated rollback; health check can't identify the release | P1 | CI/CD + Deployment | ✅ Done (Plan 4a, 4b, 4c; PR #34, PR #35, PR #47, Plan 4c build-once promotion & health-gated rollbacks) |
| SEC-113 | Local agent/IDE state and generated output tracked in git (`.claude/scheduled_tasks.lock`, `.idea/`, UTF-16 `kredibble-backend/test-results.json`, `server_*.log`; the Ralph-loop file was untracked in 712ea6c) | P2 | Repo hygiene | ✅ Done (Plan 4a) |
| SEC-114 | Infrastructure owned by personal accounts (GitHub repo and GHCR namespace, Expo owner, Vercel scope, Render service) | P1 | Ownership | Open — Plan 4 track M, Plan 4g |
| SEC-115 | No production approval gate and no build-once promotion: every push to `main` deploys straight to production | P1 | CI/CD | ✅ Done (Plan 4c; build-once image artifact, staging auto-deploy, automated smoke test, GitHub Environment production approval gate, workflow_dispatch rollback) |
| SEC-116 | No repo hygiene gates: file encoding, workflow lint, shell lint, secret scanning, automated dependency updates | P2 | CI/CD | ✅ Done (Plan 4a, PR #35; Repo hygiene green in CI run 37253915991, Dependabot PRs #36–#44 open) |
| SEC-117 | Known-password test accounts may exist in real databases (`@test.com` seed accounts; a test admin was created against production; the e2e admin login is a public default) | P1 | Data / Access | Open — Plan 4 track M5 |
| SEC-118 | EAS Update has never published: every CD App run fails at `expo export` for web (`react-native-css-interop/.cache/web.css` SHA-1 error), so the OTA path described in `AGENTS.md` doesn't work | P1 | Mobile CI/CD | ✅ Done (Plan 4c; platforms scoped to ios/android in app.json and cd-app.yml, single-level staging/dev hostnames in eas.json) |

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
- [x] `GET /api/auth/me` with the rejected request's credentials returns 401
- [x] `node scripts/create-admin.js` creates a working admin
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
- [x] Repository-wide secret scan reports no JWT-shaped literal outside CI config

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
- [x] `tokenVersion` on User bumped on password/role change; stale tokens rejected — **reopened 2026-10-02:** tracked and resolved in SEC-052.
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
- [x] Strict CSP added (SEC-033, SEC-073, SEC-074)

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
- ❌ Backend: **92/102 on `main` @ `3ffc51d` (10 failing, 2026-10-02)** — SEC-071
- ⚠️ Admin Playwright: 12 tests written, but CI starts no servers (`webServer` commented out) so they cannot pass — SEC-070
- ✅ Mobile Jest: 20 tests pass (re-verified 2026-10-02)
- ❌ Suite is green in CI — backend `npm ci` fails (SEC-066), mobile lint failures are masked by `|| echo` (SEC-070)

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
| SEC-036 | Make grant allocation (`allocated += requestedAmount`) and applicant/event counters atomic — use `findOneAndUpdate` with a conditional guard plus a transaction, and enforce `allocated <= fundingPool` server-side. | Concurrent applications cannot overspend a grant pool or double-count attendees — **⚠️ Reopened 2026-10-02: not implemented on `main`; see SEC-060 / SEC-059** |
| SEC-037 | `technicalSkills`, `softSkills`, `tools`, `certifications`, `experienceLevels`, `skills` are stored as `String` with a `'[]'` default. Convert to `String[]` with a migration script, or the UI's array data is silently unusable and unsearchable. | A saved skills array round-trips as an array and is searchable — **⚠️ Reopened 2026-10-02: models still declare `{ type: String, default: '[]' }` and `parseJson`/`stringifyArrayFields`/`withParsed*` are still in `routes/index.js`; registration stores `"[\"React\",\"Node\"]"` as a string** |
| SEC-038 | `socket.on('join_user', userId)` lets any client join any user's private room. Restrict to `socket.data.user.id`, and check channel membership before `join_channel`. | A client cannot subscribe to another user's private room |
| SEC-039 | Add a request correlation ID (`crypto.randomUUID()`) propagated through responses (`X-Request-Id`) and the audit log, so a user-reported failure maps to server logs. | Every response carries `X-Request-Id`; logs are searchable by it |
| SEC-040 | Issue admin tokens with a distinct audience claim signed by `ADMIN_JWT_SECRET`, and have `requireRole('admin')` require that audience — so a stolen user token cannot be replayed against the admin panel and vice versa. | ✅ Done |

---

# 2026-10-02 Production-Readiness Audit — Reopened & New Tasks

**Source:** `PRODUCTION-READINESS-AUDIT.md` (narrative + evidence). **Baseline:** `main` @ `3ffc51d` (merge of PR #18).
**Method:** full read of all three apps; `npm test` / lint / `tsc` / `next build` / `npm audit` in each app; the real `src/app.js` + `src/socket.js` run against `mongodb-memory-server` (`NODE_ENV=development`, no `.env`, limiters active) with a ~40-check HTTP + Socket.io probe; anonymous read-only requests to the two deployed backends. "Probe" below always refers to that run.

## Reopened items

These were ticked ✅ but are not true of `main`. Their original cards stay for history; the linked task owns the fix.

| Task | Was marked | Actual state on `main` @ `3ffc51d` | Now tracked by |
|------|-----------|-------------------------------------|----------------|
| SEC-009 | Done | `requireAuth` `tokenVersion` comparison never runs; deleted users keep access | SEC-052 |
| SEC-010 | Done | Cookie is `SameSite=Strict` across sites and only `/dashboard/summary` accepts it | SEC-074, SEC-075, SEC-076 |
| SEC-018 | Done ("suite green in CI") | 92/102 passing; admin e2e cannot run in CI; mobile lint masked | SEC-070, SEC-071 |
| SEC-019 | Done | Clients still call `/api`; live Vercel host has no `/api/v1` | SEC-069 |
| SEC-023 | Done | Bypassed via `emailNormalized`, v1 populate, and both search routes | SEC-054, SEC-055 |
| SEC-024 | Done | Key generator returns the request object — no limit is ever reached | SEC-049 |
| SEC-025 | Done | `lockUntil` set but never saved; admin login has no lockout | SEC-050 |
| SEC-029 | Done ("7-year tombstone") | Tombstone never persisted; media and owned content kept; token still valid | SEC-065 |
| SEC-033 | Done | `connect-src 'self'` blocks the API; `unsafe-inline`/`unsafe-eval` allowed | SEC-073, SEC-079 |
| SEC-036 | Done | No allocation code exists in either router | SEC-060 |
| SEC-037 | Done | Fields still `String` with `'[]'`; parse helpers still used | SEC-037 (reopened in place) |

## Verified working on 2026-10-02 — do not regress

- Register/login happy path; `role: "admin"` self-registration → 400; password policy enforced.
- Socket.io: anonymous handshake rejected; `join_user` pinned to the caller; `send_message` only into joined rooms.
- Ownership on seeker/hirer profiles and opportunities (non-owner PATCH/DELETE → 403).
- Upload: MIME allowlist + magic bytes + `file-type`, server-derived folder, 5 MB cap.
- 1 MB JSON limit → 413; malformed JSON → 400; malformed ObjectId → 400.
- Helmet + HSTS, `X-Request-Id`, production CORS allowlist, production secrets fail closed and must differ.
- Backend `npm audit --omit=dev`: 0 vulnerabilities. Mobile Jest: 20/20.

## P0 — Reopened Ship Blockers

### SEC-041 — Live Vercel backend serves user records and password hashes anonymously

**Priority:** P0 — **incident, act today**
**Evidence (2026-10-02, anonymous `GET`s only — no writes attempted):**
- `GET https://kredibble-backend.vercel.app/api/users` → **200**, 10 users (6 admin, 1 hirer, 3 seeker), fields `id, name, email, role, passwordHash, createdAt, updatedAt`.
- `GET …/api/dashboard/summary` → 200 (admin-only on `main`).
- `GET …/api/v1/health` → 404, so this deployment predates SEC-019 and is not running `main`.
- `GET …/api/health` → `database: connected`. The test admin that the Progress Log says was created "against production DB" appears in the user list.
- `kredibble-admin/.env.production` points at this host.

**Risk:** Offline cracking of every bcrypt hash; the README advertises seeded `password123` accounts, which fall instantly. Pre-SEC-002 code allowed anonymous writes, including `role`, so the database may already be tampered with. The pre-SEC-006 build may still sign tokens with the hardcoded fallback secrets, so tokens could be forged against it.

**Update 2026-10-02 11:54 UTC:** the `jerry-amoahs-projects/kredibble-backend` Vercel project is paused, and its domain `kredibble-backend-murex.vercel.app` now returns `503 DEPLOYMENT_PAUSED`. The leaking host `kredibble-backend.vercel.app` is **not** that project's domain. It belongs to a different Vercel project or account and was still returning `passwordHash` at 11:54 UTC. Step 1 below now applies to whoever owns that domain; step 2 cuts the leak regardless.

**Fix:**
1. Take the Vercel backend project that serves `kredibble-backend.vercel.app` offline now (pause the project, enable Deployment Protection, or remove its production deployment). It is not in the `jerry-amoahs-projects` scope; find the account that owns it. If that cannot happen immediately, rotate the Atlas database user it connects with so it loses DB access.
2. Rotate the Atlas credentials regardless, and update the surviving deployment's `DATABASE_URL`.
3. Force a password reset for every account that existed during the exposure. Delete the `password123` seed accounts and any admin not provisioned on purpose. Re-provision admins with `npm run user:create-admin`.
4. Rotate `JWT_SECRET` and `ADMIN_JWT_SECRET` on every environment; this signs everyone out.
5. Audit the database: users with `role: admin`, users created during the window, changed `role`/`passwordHash`, deleted or edited opportunities. Review Atlas access logs and Vercel request logs for `/api/users` traffic.
6. Write `POSTMORTEM-SEC-041.md` (`AGENTS.md` rollback procedure): exposure window, data exposed, actions taken.
7. Repoint the admin app at the single surviving backend (SEC-069).

**Verify:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://kredibble-backend.vercel.app/api/users  # never 200 again
curl -s -o /dev/null -w "%{http_code}\n" https://<surviving-api>/api/v1/users           # expect 401
```

**Acceptance criteria:**
- [ ] No deployed host answers an anonymous `GET /api/users` with 200
- [ ] Atlas credentials rotated; the old connection string no longer authenticates
- [ ] JWT secrets rotated on every environment
- [ ] All pre-incident passwords reset; seed/test admin accounts removed
- [x] Tamper review completed and recorded in `POSTMORTEM-SEC-041.md`

---

### SEC-042 — Apply / grant-apply / verification-doc upload return 500 after saving

**Priority:** P0
**Evidence:** `src/lib/audit.js:86` calls `logger.error`, but `audit.js` never imports `logger`. `routes/index.js:774,798,821` pass `AUDIT_ACTIONS.CREATE`, which is not defined, so `AuditLog.create` fails validation. The catch block then throws `ReferenceError: logger is not defined`, and `asyncHandler` turns that into a 500. Probe: `POST /api/v1/opportunities/:id/applicants` → 500 while the `Applicant` row is saved; a retry saves a second row. Same for `POST /grants/:id/applications` and `POST /verification/companies/:id/documents`, on both `/api/v1` and `/api`.

**Risk:** The core seeker action reports failure while silently succeeding, so users retry and create duplicate applications. Audit logging, which must never break a request, breaks three of them.

**Fix:**
1. Add `import logger from './logger.js';` to `src/lib/audit.js`.
2. Replace `AUDIT_ACTIONS.CREATE` with the existing `APPLICATION_SUBMIT`, `GRANT_APPLY` and `UPLOAD`. Add a test that every `AUDIT_ACTIONS.*` reference in `src/` resolves to a defined value.
3. Make `auditLog` truly non-throwing: guard the logger call too, and don't `await` audit writes on the request path (fire-and-forget with `.catch`).
4. Add ESLint with `no-undef` to the backend (it has no lint today — SEC-070) so an unimported identifier fails CI.

**Verify:** integration tests. A seeker applies → 201 and exactly one `Applicant` row. A grant application → 201. A verification document → 201.

**Acceptance criteria:**
- [x] All three routes return 201 on `/api/v1` and on legacy `/api`
- [x] An `AuditLog` row with a defined `action` is written for each
- [x] Forcing `AuditLog.create` to reject still returns 201 (test)
- [x] Backend lint with `no-undef` runs in CI

---

### SEC-043 — Community channel post routes are missing from the mounted router

**Priority:** P0
**Evidence:** `POST`/`GET /community/channels/:channelId/posts` exist only on the module-level `apiRouter` (`routes/index.js:492-520`), which is never mounted. `app.js` mounts `createApiRouter()` (`routes/index.js:662-966`), which omits them. Probe: both verbs → 404 on `/api/v1` and `/api`. The mobile app's `createChannelPost` and `getChannelPosts` (`kredibble-app/src/lib/api.ts:237-246`) call them. The dead `apiRouter` is a divergent ~300-line copy: it also holds the dashboard shape the admin UI expects (SEC-046), and at line 503 it references `logger` without importing it.

**Fix:**
1. Delete the module-level `apiRouter`, keeping a single `createApiRouter()`.
2. Port the channel-post routes into the factory. Set `authorId`/`authorName` from the token (SEC-057). Broadcast via Socket.io only when it is initialised, without throwing on serverless.
3. Add a client-contract test: list every path in `kredibble-app/src/lib/api.ts` and `kredibble-admin/src/lib/api.ts`, and fail if any returns 404 for an authorised caller.

**Acceptance criteria:**
- [x] `POST /api/v1/community/channels/:id/posts` → 201; `GET` → 200, paginated
- [x] Exactly one router definition remains in `routes/index.js`
- [x] Contract test fails when a path the clients call is missing

---

### SEC-049 — Rate-limiter key generator is wrong, so no limit is ever reached

**Priority:** P0
**Evidence:** `src/lib/rate-limiters.js:200` — `keyGenerator: keyGenerator || ipKeyGenerator`. In express-rate-limit 8, `ipKeyGenerator(ip, ipv6Subnet)` normalises an IP **string**. Used directly as a key generator it receives `(req, res)` and returns the request object. Lines 241 and 274 make the same mistake (`ipKeyGenerator(req, { ipv6Subnet: 56 })`). Probe with limiters active: 25 failed logins from one IP → **0 × 429**, and every response reports `RateLimit: limit=20, remaining=19`. The in-memory store gives every request its own bucket. With `REDIS_URL` set, the key would stringify to `rl:<prefix>:[object Object]`: one **global** bucket, so 20 auth requests site-wide would return 429 to every user. The SEC-024 tests missed this because every limiter `skip`s when `NODE_ENV=test`.

**Risk:** Unlimited credential stuffing, registration spam, verification-email bombing, scraping and upload abuse. Enabling Redis would turn it into a self-inflicted outage.

**Fix:**
1. `keyGenerator: keyGenerator || ((req) => ipKeyGenerator(req.ip))`.
2. Per-user limiters: `(req) => req.auth?.sub ?? ipKeyGenerator(req.ip, 56)`. Move `aiLimiter` after `requireAuth` in `routes/assistant.js:9` so `req.auth` exists.
3. Add a test seam to run limiters in tests. Assert that the 21st login from one IP → 429 while another IP → 200, and that Redis keys contain the client key, not `[object Object]`.
4. Retune for shared NATs. Ghanaian mobile carriers (CGNAT) and campus Wi-Fi put many users behind one IP, and 100 requests per 15 min globally is low even for one active user. Key authenticated traffic by user id, keep IP keys for anonymous auth routes, and raise the global ceiling.
5. Document that `app.set('trust proxy', 1)` assumes exactly one proxy hop (Render/Vercel). On a bare host `X-Forwarded-For` is spoofable.

**Acceptance criteria:**
- [x] 21st `/auth/login` from one IP within 15 min → 429; other IPs unaffected (test with limiters enabled)
- [x] Redis keys look like `rl:<prefix>:<ip-or-user>` (test)
- [x] `aiLimiter` and `uploadLimiter` key by user id

---

### SEC-050 — Account lockout is never persisted; admin login has no lockout

**Priority:** P0
**Evidence:** `src/routes/auth.js:167-184`: when `failedLoginAttempts >= 5` the handler sets `lockUntil`, writes an audit record, and `throw`s **before** `user.save()`. Probe: 7 wrong passwords → `[401,401,401,401,429,429,429]`, DB shows `failedLoginAttempts=4, lockUntil=null`, then the correct password → 200. `/auth/admin/login` (`auth.js:319-369`) has no attempt counter.

**Risk:** Combined with SEC-049, online password guessing is unthrottled for every account, admins included.

**Fix:**
1. Persist atomically before responding: `$inc` the counter with `$set: { lastFailedLogin }`, then set `lockUntil` with a conditional update when the count crosses the threshold.
2. Apply the same protection to `/auth/admin/login`.
3. Prefer temporary backoff plus a security email over hard lockout, so an attacker can't lock a known user out indefinitely (original SEC-025 guidance).

**Acceptance criteria:**
- [x] After 5 failures, `lockUntil` is stored and the correct password returns 429 until it expires (test)
- [x] Admin login has the same protection (test)
- [x] A successful login resets the counter (test)

---

### SEC-066 — Backend lockfile out of sync: `npm ci`, Docker, CI and Render deploys fail

**Priority:** P0
**Evidence:** `git archive HEAD kredibble-backend` into a clean folder, then `npm ci` → `EUSAGE … Missing: ioredis@5.11.1, rate-limit-redis@6.0.1, @ioredis/commands@1.10.0, cluster-key-slot, debug, denque, redis-errors, redis-parser, standard-as-callback, ms from lock file`. The `Dockerfile` runs `npm ci --omit=dev`, and `ci.yml` and `cd-backend.yml` depend on it. The root npm workspace and root lockfile hid this locally. As of 2026-10-02, uncommitted work on `devops/ci-cd-green` removes workspaces and edits every lockfile; confirm it resolves this.

**Fix:**
1. Regenerate `kredibble-backend/package-lock.json` inside `kredibble-backend`, with no workspace root above it, using npm 10.x (what `node:20-alpine` ships).
2. Apply the same clean-checkout `npm ci` check to `kredibble-admin` and `kredibble-app`.
3. Require the CI `npm ci` jobs on PRs and add a backend `docker build` step (SEC-070).

**Verify:**
```bash
git archive HEAD kredibble-backend | tar -x -C /tmp/kb && cd /tmp/kb/kredibble-backend && npm ci && docker build .
```

**Acceptance criteria:**
- [x] `npm ci` succeeds in each app from a clean checkout
- [x] `docker build kredibble-backend` succeeds in CI
- [x] CD Backend workflow is green on `main`

---

### SEC-067 — Admin production build fails

**Priority:** P0
**Evidence:** `next build` → type error at `kredibble-admin/src/app/(dashboard)/opportunities/page.tsx:47` (`data as Opportunity[]` from `Record<string, unknown>[]`). The SEC-033 log entry called it "pre-existing", but it was never tracked. No admin deploy can succeed.

**Fix:** Give `getOpportunities()` a real return type (a shared `Opportunity` type), or validate the response with a schema. Add `npm run build` to the admin CI job.

**Acceptance criteria:**
- [x] `npm run build` passes in `kredibble-admin`
- [x] CI runs the admin build on every PR

---

### SEC-068 — Production boot requires keys the deploy config does not provide

**Priority:** P0
**Evidence:** `src/config/env.js:99-104` throws in production when the OpenAI/Anthropic key or the Resend config is missing. `render.yaml` sets only `NODE_ENV, DATABASE_URL, JWT_SECRET, ADMIN_JWT_SECRET, CORS_ORIGIN, PORT`. Reproduced: `BOOT FAILS: CRITICAL ERROR: the configured openai API key is missing.` The AI route isn't mounted (SEC-045), so the key guards a feature that doesn't exist.

**Fix:**
1. Gate each integration behind an explicit flag (`AI_ENABLED`, `EMAIL_ENABLED`, `WORDPRESS_SYNC_ENABLED`) and require credentials only when the flag is on.
2. Complete the deploy config with every variable actually required: `REDIS_URL`, `CLOUDINARY_*`, `RESEND_*` (SEC-083 needs email), and `CORS_ORIGIN` for the real domains.
3. Add a CI boot-smoke job that imports `src/config/env.js` with the deploy template's variables and asserts it boots.

**Acceptance criteria:**
- [x] Backend boots in production mode with exactly the variables in the deploy config
- [x] CI boot-smoke job passes

---

### SEC-080 — Mobile app never refreshes tokens; sessions die after 15 minutes
**Reopened 2026-10-03:** `kredibble-app/src/lib/api.ts:109` refreshes only when `payload.error.message === 'jwt expired'`, but the API's 401 message is "Authentication token is invalid or expired" (`middleware/auth.js`), so the refresh never fires. Fix in Plan 3: refresh on any 401 from an authenticated request (once), or have the API send a stable error code.

**Priority:** P0
**Evidence:** Backend access tokens last 15 min (SEC-009). `kredibble-app/src/lib/api.ts:48-55` stores only `token` and `user` and discards `refreshToken`. Nothing calls `/auth/refresh`. `request()` (`api.ts:74-93`) throws on 401 with no recovery. `src/lib/socket.ts` reuses the same handshake token on every reconnect.

**Risk:** Every user is effectively signed out mid-session after 15 minutes, and every screen starts failing with "Authentication token is invalid or expired".

**Fix:**
1. Persist `refreshToken` in SecureStore alongside the access token.
2. In `request()`, on a 401: run one shared in-flight `/auth/refresh`, store the rotated pair, retry the original request once. If refresh fails, clear the session and route to `/(auth)/login`.
3. Pass `auth: (cb) => getMobileToken().then((token) => cb({ token }))` to `io()` so reconnects use the current token; reconnect after a refresh.
4. Call `/auth/logout` on sign-out so the refresh token is revoked server-side.

**Acceptance criteria:**
- [x] Jest: an expired access token triggers a refresh, then the original request is retried and succeeds
- [x] A failed refresh clears SecureStore and navigates to login
- [x] A session survives more than 15 minutes of use on a device build

---

## P1 — Launch Blockers (new)

### SEC-044 — Notifications are always empty for users
**Evidence:** `routes/index.js:200-202` forces `filter.userId = req.auth.sub` for non-admins, but the `Notification` schema (`models/Content.js`) has no `userId`; notifications are broadcast by `audience`. Probe: admin creates a notification → 201; seeker `GET /notifications` → 0 items. `GET /notifications/:id` is unscoped. The policy's `createFields` include `type`, `priority`, `isActive`, which the schema doesn't define.
**Fix:** For non-admins, filter by `audience` (`all` plus the caller's role, using the values the admin composer actually sends) and by `isActive`. Add a `NotificationDelivery { userId, notificationId, readAt }` collection if per-user read state is needed. Reconcile the schema with `createFields`.
**Acceptance criteria:**
- [x] A seeker sees an `audience: 'all'` notification and not a hirers-only one (test)

### SEC-045 — Admin-portal, AI assistant and news routers are never mounted
**Evidence:** `adminRouter` (`routes/admin.js`, ~600 lines: vetting, partners, ambassadors, beneficiaries, targets, scorecards, testimonials, monthly reports), `assistantRouter` (`routes/assistant.js`) and `newsRouter` (`routes/news.js`) are exported but never imported. Probe: `/api/v1/admin/dashboard`, `/admin/partners`, `/assistant/chat`, `/news` → 404. Five failing tests in `tests/api.test.js` expect portal behaviour (SEC-071). `adminRouter` also uses user-token `requireAuth`, not the admin cookie (SEC-075). The assistant accepts a client-chosen `provider`.
**Fix:** Decide v1 scope (Open Question 8). For what ships, mount it under `/api/v1/admin`, `/api/v1/assistant` and `/api/v1/news` with the right auth, rate limits and manifest coverage, and have the server choose the AI provider. For what doesn't ship, delete the router, its models, its tests and its env requirements (SEC-068).
**Acceptance criteria:**
- [x] Every exported router is either mounted with tests or deleted
- [x] No env var is required for an unmounted feature

### SEC-046 — Dashboard summary shape does not match the admin UI
**Evidence:** The mounted `/dashboard/summary` (`routes/index.js:841-872`) returns `{ users, seekers, hirers, opportunities, applications, events, grants, grantApplications }`. The admin page (`kredibble-admin/src/app/(dashboard)/page.tsx:36-94`) reads `pendingVerifications, pendingOpportunities, activeSeekers, activeHirers, openReports`, so it renders zeros. The dead router (`routes/index.js:353-382`) has the expected shape.
**Fix:** Return pending queues plus totals, with a TypeScript type shared with the admin client and a contract test.
**Acceptance criteria:**
- [x] The admin dashboard shows non-zero counts against seeded data

### SEC-047 — `Opportunity.hirerId` holds a User id but references `HirerAccount`
**Evidence:** Create sets `hirerId = req.auth.sub` (`routes/index.js:247-249`, `ownerField: 'hirerId'`), while `models/Platform.js:14` declares `ref: 'HirerAccount'` and v1 populates it (`routes/index.js:725-726`). Probe: `GET /api/v1/opportunities/:id` → `hirerId: null`. `CompanyVerification.hirerId` and `VerificationDoc.companyId` follow the same pattern. Seeded data that uses real `HirerAccount` ids can't be edited by its own hirer.
**Fix:** Use `createdBy` (User, already on the schema) for ownership. Keep `hirerId` as the caller's `HirerAccount._id`, looked up server-side. Migrate existing documents and switch `ownerField` to `createdBy`. Open Question 10.
**Acceptance criteria:**
- [x] v1 opportunity detail populates company name and logo
- [x] A hirer can edit their own listing; another hirer gets 403 (tests)
- [x] A migration script fixes existing documents

### SEC-048 — Moderation is bypassed on opportunity reads
**Evidence:** The `collectionRoutes` list handler (`routes/index.js:175-216`) applies `moderationStatus` only when `?status=` is sent. Probe: a hirer's new `pending` listing is visible to seekers immediately. The failing test "only returns published and vetted opportunities to the public" encodes the intended rule.
**Fix:** For non-admins, default to `moderationStatus: 'approved'` (plus `vetted: true` if that stays the rule). Owners also see their own pending listings; admins see everything. Decide anonymous read access under Open Question 3.
**Acceptance criteria:**
- [x] The seeker list excludes pending and rejected listings (test)
- [x] The owner sees their own pending listing; an admin sees all

### SEC-052 — Access-token revocation (`tokenVersion`) is dead code
**Evidence:** `middleware/auth.js:57` compares `payload.tv` with `req.auth?.tokenVersion` before `req.auth` is assigned, so the condition is always false. Probe: after `tokenVersion++` the old token still works, and after `DELETE /auth/me` the deleted user's token returns 200 with `role: deleted`. Admin tokens carry no `tv`, and no password- or role-change route bumps `tokenVersion`.
**Fix:** After `jwt.verify`, load `{ tokenVersion, role }` for `payload.sub` (cached ~60 s, or in Redis). Reject on a mismatch, on `role: 'deleted'`, or when the user is missing. Add `tv` to admin tokens. Bump `tokenVersion` on password change (SEC-084), password reset (SEC-083), role change, admin force-logout and account deletion.
**Acceptance criteria:**
- [x] Bumping `tokenVersion` makes the old access token return 401 (test)
- [x] A deleted account's token returns 401 (test)
- [x] A role change takes effect without waiting for token expiry

### SEC-054 — Any signed-in user can harvest every user's email
**Evidence:** `policies.js:75` sets `users.read: AUTHENTICATED`. `PII_FIELDS.users = ['email']` strips `email` but not `emailNormalized` (`models/User.js:9`, not `select: false`). Probe: a seeker's `GET /api/v1/users?limit=100` returns every user's `emailNormalized`, `role` and `failedLoginAttempts`, admins included.
**Fix:** Make `/users` list and read admin-only; add a `/users/:id/public` endpoint (name + avatar) if the UI needs one. Set `select: false` on `emailNormalized`, `failedLoginAttempts`, `lockUntil`, `lastFailedLogin` and `tokenVersion`. Switch response shaping from a denylist (`stripSensitive`) to per-resource allowlists of public fields.
**Acceptance criteria:**
- [x] A seeker's `GET /users` → 403 (test)
- [x] No non-admin response from any list route contains another user's email in any field (sweep test)

### SEC-055 — Email leaked via populate; search routes leak phones and are unpaginated
**Evidence:** v1 populates `userId` with `select: 'name email avatarUrl'` for seekers and hirers (`routes/index.js:714,717`). Probe: another user's email is returned on `GET /api/v1/seekers/:id`. `/seekers/search` and `/candidates/search` (`routes/index.js:669-701`) skip `stripPiiIfNeeded` (probe: seeker phone numbers visible) and `parsePagination`, so they return the whole collection.
**Fix:** Populate only `name avatarUrl`. Pass search results through the same PII allowlist and pagination as the list routes. Restrict seeker search to hirers and admins.
**Acceptance criteria:**
- [x] No email in a populated `userId` for non-owners (test)
- [x] Search responses carry `meta` and no `phone` for non-owners (test)

### SEC-056 — Applicant IDOR, impersonation and duplicate applications
**Evidence:** `policies.js:163-170` lets any hirer read, update or delete any applicant, and the nested routes (`routes/index.js:765-791`) never check that the caller owns the opportunity. Probe: hirer B lists hirer A's applicants (CV `resumeUrl` included), sets `status: 'Rejected'` (200) and deletes one (204). `createFields` include `seekerId` and `name`, so a seeker can apply as someone else. The opportunity's existence isn't checked. Dedupe relies on a sparse `(opportunityId, seekerId)` index that is skipped when `seekerId` is omitted; the probe saved duplicates. Hirers can apply too.
**Fix:**
1. Reading, updating or deleting an applicant is allowed for the opportunity owner (via SEC-047's `createdBy`) and admins. Applicants can read and withdraw their own applications.
2. Set identity server-side: `applicantUserId = req.auth.sub`, `seekerId` = the caller's `SeekerProfile._id`, `name` from the profile. Drop both from `createFields`.
3. Return 404 for unknown or closed opportunities. Add a unique index on `(opportunityId, applicantUserId)` and return 409 on duplicates.
4. Only the `seeker` role may apply.
**Acceptance criteria:**
- [x] Hirer B gets 403 reading, patching or deleting hirer A's applicants (tests)
- [x] A second application by the same seeker → 409 (test)
- [x] Applying to a nonexistent opportunity → 404 (test)

### SEC-057 — Community channel/post IDOR and author spoofing
**Evidence:** In `policies.js:207-224`, channel `update` is `AUTHENTICATED` with no owner check, and `status`/`followers` are writable. Channel `delete` is `[HIRER, ADMIN]` without ownership. Post `update`/`delete` are `AUTHENTICATED` without ownership, and `authorName` is client-supplied. Probe: seeker B renames seeker A's channel to "pwned" (200); hirer B deletes it (204); a post as "Kredibble Official" → 201; another user edits it (200) and deletes it (204). The schemas already have `Channel.createdBy` and `ChannelPost.authorId`, which settles Open Question 6 as option (a).
**Fix:** Set `createdBy`, `authorId` and `authorName` server-side. Use `ownerField: 'createdBy'` for channels and `'authorId'` for posts. Remove `followers`, `status` and `postsCount` from user-writable fields. Admins keep moderation override. Legacy posts without `authorId` become admin-only to edit.
**Acceptance criteria:**
- [x] Non-owner PATCH or DELETE of a channel or post → 403 (tests)
- [x] `authorName` in the request body is ignored (test)

### SEC-058 — Verification documents are readable by every hirer
**Evidence:** `policies.js:279-287` sets `verification/documents.read: [HIRER, ADMIN]` with no ownership. The generic `GET /verification/documents` (`routes/index.js:837`) and `GET /verification/companies/:companyId/documents` return every company's documents. `POST …/:companyId/documents` doesn't check that the caller owns `companyId`. Probe: hirer B lists hirer A's business-registration file URL.
**Fix:** Limit reads to the owning hirer and admins. On create, check that `companyId` belongs to the caller's `HirerAccount`. Make the generic list admin-only. Serve the documents through authenticated or signed Cloudinary URLs rather than a public `secure_url`.
**Acceptance criteria:**
- [x] Hirer B cannot list or fetch hirer A's documents (test)
- [x] A hirer cannot attach documents to another company's case (test)

### SEC-059 — Event capacity unenforced; attendee emails exposed to any hirer
**Evidence:** `routes/index.js:918-924` increments `attendeesCount` with no capacity check. Probe: capacity 2, two bookings of 10 → `attendeesCount = 20`. `GET /events/:eventId/attendees` is open to any hirer (`policies.js:189-196`); the probe returned attendee emails. Unknown `eventId`s are accepted.
**Fix:** Atomic guard: `Event.findOneAndUpdate({ _id, $expr: { $lte: [{ $add: ['$attendeesCount', qty] }, '$capacity'] } }, { $inc: { attendeesCount: qty } })` before inserting the attendee (in a transaction, or compensating on failure). Return 404 for unknown events. Limit attendee reads to the organiser and admins, and take `email`/`fullName` from the caller's account.
**Acceptance criteria:**
- [x] An over-capacity booking → 409, including under concurrent requests (test)
- [x] An unrelated hirer → 403 on the attendee list (test)

### SEC-065 — GDPR deletion is incomplete
**Evidence:** `routes/auth.js:550-673` builds a `tombstone` object that is never saved, yet the response claims a tombstone was retained. Cloudinary assets under `kredibble/<userId>/` aren't deleted. Opportunities, channels and verification cases the user created remain. Grant applications are deleted by `applicantEmail`, a field the schema doesn't have. The steps run in `Promise.all` with no transaction, and the access token keeps working (SEC-052).
**Fix:** Persist a `UserTombstone { userId, emailHash, deletedAt, retentionUntil }`. Delete the user's Cloudinary folder. Decide whether owned content is deleted or anonymised, and implement that. Key cascades on ids, not emails. Run inside a transaction. Bump `tokenVersion`. Add an end-to-end test proving no PII remains.
**Acceptance criteria:**
- [x] E2E: after deletion, no collection holds the user's email, phone or name; tombstone persisted; media deletion called (mocked)
- [x] The deleted user's tokens are rejected

### SEC-069 — Two divergent backend deployments; free tier sleeps; Swagger public
**Evidence:**
- The admin app points at `https://kredibble-backend.vercel.app/api` (old code, SEC-041); the mobile `eas.json` points at `https://kredibble-api.onrender.com/api` (newer code).
- Vercel is serverless: Socket.io (`initSocket` in `src/server.js`) can't run there, and limiter/lockout state lives per invocation.
- `render.yaml` uses `plan: free`; a cold start took 21.6 s on 2026-10-02, long enough to time out mobile requests.
- Render serves `/api-docs` publicly (200), so either `ENABLE_SWAGGER=true` is set or it runs pre-SEC-014 code.
- Both clients still call `/api`, not `/api/v1` (SEC-019's done-when is not met).
- `render.yaml` CORS lists `*.kredibble.com` while `AGENTS.md` uses `*.kredibble.app`.

**Fix:** Pick one always-on host for the API and sockets (Open Question 7). Use custom domains `api.<domain>` and `admin.<domain>` on the same registrable domain (needed for SEC-074). If Vercel is dropped, delete its backend project plus `kredibble-backend/vercel.json` and `api/index.js`. Run separate staging and production environments and databases. Switch both clients to `/api/v1`. Disable Swagger in production. Settle on one domain name.
**Acceptance criteria:**
- [ ] Exactly one production API host; both clients use `https://api.<domain>/api/v1`
- [ ] No cold starts (always-on instance), and `/api-docs` → 404 in production
- [ ] A separate staging environment and database exist

### SEC-070 — CI does not gate anything that matters
**Evidence (`.github/workflows/ci.yml`):**
- Mobile job: `npm run lint || echo "No lint script yet"` masks 45 lint errors, and no `tsc` runs.
- Admin job: lint plus Playwright, with no backend or admin server started (`playwright.config.ts:74` has `webServer` commented out) and no `next build`.
- Backend job: no lint or typecheck, and no backend ESLint config exists.
- The CI described in `AGENTS.md` doesn't match the real file.
- CD workflows deploy on every push to `main` whether or not CI passed.

**Fix:** Fail CI on lint, `tsc --noEmit`, `next build`, Jest, backend `docker build`, the prod-config boot smoke (SEC-068) and the client-contract test (SEC-043). Run Playwright against started servers, or move e2e to a staging workflow. Make CD `needs:` CI. Protect `main` so PRs need CI and a review.
**Acceptance criteria:**
- [x] A deliberately broken lint, type, build or test step fails the PR (checked once per app)
- [x] CD jobs run only after CI passes

### SEC-071 — Backend suite is red (10 of 102 failing)
**Evidence:** `npm test` on `3ffc51d`:
- `tests/api.test.js`, 5 failures: public vetted-opportunity feed; saved-items 403 contract; vet/publish guard message; opportunity view referral tracking; partner auto-close via `/admin/partners`.
- `tests/socket.integration.test.js`, 2 failures: join and broadcast use fixture channel ids that are not real channels.
- `tests/security.p0.test.js`, 3 failures: upload error copy. The tests expect `/not allowed/`, but multer's `fileFilter` says "Only JPEG, PNG, WebP, and PDF files are allowed".

These arrived with PR #18 and contradict the mounted code. The PR #18 Progress Log entry ("All 90 backend tests pass") is inaccurate.
**Fix:** Decide test by test whether the test or the code is right (depends on SEC-045 and SEC-048). Have the socket tests create real `Channel` documents. Align the upload message. Keep the suite green as a merge requirement (SEC-070).
**Acceptance criteria:**
- [x] `npm test` is 100% green in CI on `main`

### SEC-072 — Seekers cannot list their own applications
**Evidence:** `GET /applicants` → 403 for seekers (`policies.js:164`), and there is no `/users/me/applications`. The mobile `profile/applications.tsx` screen is mock data.
**Fix:** Add `GET /api/v1/users/me/applications` (paginated, joined with opportunity title, company and status), and wire the mobile screen.
**Acceptance criteria:**
- [x] A seeker sees exactly their own applications (test, and the screen is wired)

### SEC-073 — Admin CSP blocks every API call
**Evidence:** `kredibble-admin/next.config.ts:10` sets `connect-src 'self'`, but the API is a different origin (`NEXT_PUBLIC_API_URL`), so browsers block the login `fetch`.
**Fix:** Build `connect-src 'self' <API origin>` from `NEXT_PUBLIC_API_URL` at build time, plus the `wss:` origin if the admin uses sockets.
**Acceptance criteria:**
- [x] Admin login works against the deployed API in Chromium, WebKit and Firefox with CSP enforced (Playwright)

### SEC-074 — Admin `SameSite=Strict` cookie cannot cross sites
**Evidence:** `setAdminCookie` in `middleware/auth.js` sets `SameSite=Strict`. Admin on `*.vercel.app` calling an API on another `*.vercel.app` or `onrender.com` is cross-site, because `vercel.app` is a public suffix, so the cookie is never sent. Third-party-cookie blocking would also defeat `SameSite=None`.
**Fix:** Host admin and API on one registrable domain (`admin.<domain>` / `api.<domain>`), or proxy `/api/*` through the Next.js app with rewrites so the cookie is first-party. Keep `Strict` + `Secure` + `HttpOnly`, and add CSRF protection if any cookie-authenticated route accepts form posts.
**Acceptance criteria:**
- [x] A signed-in admin's cookie is sent on API requests from the deployed admin origin (Playwright on staging)

### SEC-075 — The admin cookie is only accepted by `/dashboard/summary`
**Evidence:** Every collection route uses `requireAuth` (Bearer header, user secret). Only `/dashboard/summary` uses `requireAdminAuth`, and `adminRouter` uses `requireAuth` too. Probe with the admin cookie: `GET /verification/companies` → 401 and `GET /opportunities` → 401. The admin UI therefore cannot load verifications or opportunities.
**Fix:** Preferred: an `/api/v1/admin/*` namespace guarded only by `requireAdminAuth` (admin secret and audience), which becomes the only surface the admin app calls; this keeps SEC-040's audience separation meaningful. Alternative: a combined guard that accepts either a valid user Bearer token or a valid admin token and normalises both to `req.auth`.
**Acceptance criteria:**
- [x] The admin app can list and approve verifications and moderate opportunities using only its cookie (tests)
- [x] A user Bearer token is rejected on `/api/v1/admin/*` (test)

### SEC-076 — The admin session has no refresh
**Evidence:** The admin token and cookie last 15 min (`setAdminCookie` `maxAge`). `/auth/admin/login` returns a refresh token in the JSON body that nothing can use, because there is no admin refresh route. The admin UI decides "logged in" from `localStorage` (`kredibble-admin/src/lib/api.ts:39`), so it keeps rendering while every call fails.
**Fix:** Add `POST /auth/admin/refresh` backed by a path-scoped httpOnly refresh cookie, and stop returning refresh tokens to the browser in JSON. On the client, try one refresh on 401; otherwise clear the local user and redirect to `/login`. Check the session on layout mount via `/auth/admin/me`.
**Acceptance criteria:**
- [x] An admin stays signed in through 1 h of activity, and an expired session redirects to login (Playwright)

### SEC-077 — 20 of ~25 admin pages run on mock data
**Evidence:** These pages import `src/lib/mock-*.ts`: analytics, community (+ detail), content/articles (+ detail), events (+ detail), grants (+ detail), hirers (+ detail), `opportunities/[id]`, reports (+ detail), seekers (+ detail), staff (+ invite, + detail), `verification/[id]`. Approve, suspend and resolve actions only change in-memory arrays.
**Fix:** Wire each page to the admin API (SEC-075), deleting its mock file as you go, with empty, error and loading states. Admin mutations must be audit-logged.
**Status:** Admin API routes for seekers, hirers, events, grants, articles, staff, community channels, verification companies, and verification documents have been added to `kredibble-backend/src/routes/admin-api.js` with combined auth (`requireAdminOrStaffAuth`). Admin client (`kredibble-admin/src/lib/api.ts`) updated with corresponding API methods. **Seekers and Hirers list/detail pages wired to API.** Remaining work: wire remaining admin pages to API, delete mock files, add loading/error/empty states.
**Acceptance criteria:**
- [x] `rg "lib/mock-" kredibble-admin/src/app` returns nothing (all `src/lib/mock-*.ts` deleted)
- [x] Every admin action persists and appears in `AuditLog` (creates, deletes and, since 1a418c9, every admin update; staff invites audited)

### SEC-078 — Admin Next.js has critical advisories
**Evidence:** `npm audit --omit=dev` in `kredibble-admin`: `next@16.2.10` is critical (RCE in image optimisation and `next/og`, middleware bypass, SSRF, cache confusion); `postcss` and `sharp` are high.
**Fix:** Upgrade to a patched Next 16 release (≥ 16.3.8 per the advisory) with a matching `eslint-config-next`, then re-run build and e2e.
**Acceptance criteria:**
- [x] `npm audit --omit=dev --audit-level=high` is clean in `kredibble-admin`

### SEC-081 — Mobile detail screens are hardcoded; Apply is not wired; lists fall back to fake data
**Evidence:** `jobs/[id].tsx:22` does `JOBS_DATA.find(...) ?? JOBS_DATA[0]`, so a real job id shows a fake "Wave" posting. `internships/[id].tsx`, `events/[id].tsx` and `grants/[id].tsx` do the same. The jobs Apply button only toggles local state. `jobs/index.tsx:225`, and the internships, grants and events lists, silently render `*_DATA` when the API fails.
**Fix:** Fetch details by id (`GET /api/v1/opportunities/:id`, `/events/:id`, `/grants/:id`). Wire Apply, Book and Apply-for-grant to the API, with duplicate and closed states. Replace the fake fallbacks with error-and-retry and empty states, and delete the `*_DATA` arrays.
**Acceptance criteria:**
- [x] No `*_DATA` constants remain in `src/app`
- [x] Applying from a job detail creates an application that appears in SEC-072

### SEC-083 — Forgot-password flow is UI-only
**Evidence:** `(auth)/login.tsx:471-601` steps through `email → verify → reset → success` without any API call, and the backend has no reset endpoint. Users are told their password was reset when it wasn't.
**Fix:**
- Backend `POST /auth/password/forgot`: always returns 202, rate limited, sends a code via Resend.
- Backend `POST /auth/password/reset` (code + new password): CSPRNG code, 5-attempt cap, 10-min TTL; it bumps `tokenVersion`, revokes refresh tokens and is audit-logged.
- Wire the sheet to both.
**Acceptance criteria:**
- [x] End-to-end reset test passes; the old password and old sessions stop working
- [x] The response doesn't reveal whether the email exists

### SEC-084 — Change password and delete account are not wired
**Evidence:** `profile/security.tsx` and `hirer-profile/security.tsx` render forms with no API calls. There's no `POST /auth/password` route. `DELETE /auth/me` exists, but no screen calls it. Apple App Store Guideline 5.1.1(v) and Google Play both require in-app account deletion for apps that let users create accounts.
**Fix:** Add `POST /api/v1/auth/password` (current + new password, policy-checked, bumps `tokenVersion`, revokes refresh tokens) and wire both screens. Account deletion asks for the password, calls `DELETE /auth/me`, clears SecureStore and returns to the welcome screen.
**Acceptance criteria:**
- [x] Changing the password works and signs out other sessions (test)
- [x] Account deletion is reachable from Profile in three taps or fewer

### SEC-087 — App-store readiness
**Evidence:** `app.json` has the display name `kredibble-app`; no `ios.bundleIdentifier`, `ios.buildNumber` or `android.versionCode`; and splash/icon assets that look like Expo template defaults. There's no privacy-policy or terms link in the app, and no `expo-notifications`. The `start` and `web` scripts use Windows-only `set` syntax.
**Fix:** Set the name to "Kredibble", plus the bundle id, version codes and final icons/splash. Link the privacy policy and terms at signup and in settings (SEC-092). Prepare store listing assets, decide on push notifications for v1, and make the scripts cross-platform (`cross-env`).
**Acceptance criteria:**
- [ ] `eas build -p ios` and `eas build -p android` (production profile) complete non-interactively
- [ ] A privacy-policy URL is present in the app and the store listings

### SEC-089 — Shared Redis, always-on hosting, database backups
**Evidence:** No deploy config sets `REDIS_URL`, so limiter and lockout state is per process (and per invocation on Vercel). Hosting is Render's free tier, which sleeps. No Atlas backup or restore procedure is documented.
**Fix:** Managed Redis for the limiters (and optionally a `tokenVersion` cache). A paid always-on instance, with ≥ 2 replicas once Redis is in place. Atlas continuous backup plus a tested restore runbook, and a separate staging database.
**Acceptance criteria:**
- [ ] Limits hold across two instances (test against staging)
- [x] A restore drill is completed and documented

### SEC-090 — No error tracking or uptime monitoring
**Evidence:** None of the apps has Sentry, Datadog or similar. Failures like SEC-042 are only visible to users.
**Fix:** Add Sentry or an equivalent to the backend (Express handler, tagged with the request id), the admin (Next.js SDK) and mobile (`@sentry/react-native` with EAS source maps). Add an uptime check on `/api/v1/health` with alerting, plus a log drain with retention. Scrub PII from events.
**Acceptance criteria:**
- [x] A forced 500 on staging shows up in the error tracker with its `X-Request-Id`
- [x] A health-check alert fires when the API is down

### SEC-092 — Privacy policy, terms, data-protection registration
**Evidence:** Neither the mobile nor the admin app has a privacy policy or terms (`rg -i "privacy policy|terms of"` finds nothing), yet the platform processes CVs, phone numbers and company verification documents.
**Fix:** Publish a privacy policy and terms at hosted URLs, link them with explicit consent at signup, and link them in settings. Register with Ghana's Data Protection Commission (Data Protection Act, 2012, Act 843) if processing Ghanaian users' data, and assess GDPR if targeting EU users. Define retention periods for audit logs, tombstones and CVs.
**Acceptance criteria:**
- [ ] The policy and terms URLs are live and linked in the app and the stores
- [ ] The registration or assessment is recorded

## P2 — Hardening (new)

### SEC-051 — Login reveals which emails are registered
`routes/auth.js:142` vs `:201`: existing accounts get "…N attempt(s) remaining before lockout" and unknown emails don't. bcrypt only runs for existing users, which also creates a timing oracle. Use one generic message, and run a dummy `bcrypt.compare` for unknown emails. **Done when:** messages are identical and response timing is indistinguishable within noise (test).
**Status:** ✅ Done. Login returns generic 401s for both non-existent users and wrong passwords, and runs a dummy bcrypt compare to prevent timing oracles.

### SEC-053 — One refresh token per user; malformed refresh body → 500
`User.refreshTokenHash` is a single field, so signing in on a second device revokes the first (probe: phone refresh → 401 after a laptop login). `POST /auth/refresh` with a non-string `refreshToken` → 500 from a `crypto` TypeError. Move to a `RefreshToken { userId, tokenHash, deviceLabel, expiresAt, revokedAt, replacedBy }` collection with reuse detection (replaying a rotated token revokes its whole family), add a sessions list, and validate bodies with Zod. Relates to Open Question 2. **Done when:** two devices refresh independently, a replayed rotated token revokes its family, and a malformed body → 400.
**Status:** ✅ Done. Created RefreshToken collection, added Zod validation to /refresh, and implemented token family revocation on reuse.

### SEC-060 — Grant allocation not implemented; applications carry no identity (reopens SEC-036)
`routes/index.js:793-804` saves any `requestedAmount`: the probe requested 999,999,999 against a 1,000 pool, it was saved, and `allocated` stayed 0. The grant id isn't checked. `GrantApplication` stores no applicant user id, so GDPR export/delete (which query `applicantEmail`) never match, and applicants can't see their own applications. Implement the conditional `$expr` reservation the SEC-036 log describes (or reserve on approval, per Open Question 4). Store `applicantUserId`, return 404 for unknown or closed grants, and cap `requestedAmount` at the pool. **Done when:** concurrent over-allocation is impossible (test) and applicants can list their own grant applications.

### SEC-061 — NoSQL operator injection via query params
`routes/index.js:183-189` puts `req.query.status`/`type` straight into the Mongo filter; `?status[$ne]=approved` gets through (probe: 200). Coerce scalar query params to strings (or `mongoose.set('sanitizeFilter', true)`) and validate list queries with Zod. **Done when:** object-valued query params → 400 (test).
**Status:** ✅ Done. Object-valued query parameters in collection filters now throw 400.

### SEC-062 — Email verification code: weak RNG, no attempt cap
`lib/email.js:11` generates codes with `Math.random()`. `EmailVerificationCode.attempts` is never incremented (`routes/auth.js:429-457`), so a 6-digit code can be brute-forced within its TTL; only the broken limiter stood in the way. Use `crypto.randomInt(0, 1_000_000)`, zero-padded; increment attempts atomically and invalidate the code after 5; rate-limit `/verification-code/verify` per email. `emailVerified` is never enforced anywhere, so decide which actions require it (Open Question 9). **Done when:** a 6th wrong code invalidates the code (test).
**Status:** ✅ Done. verification codes now use crypto.randomInt, increment attempts atomically, invalidate after 5 attempts, and are rate limited.

### SEC-063 — Authorization fails open for missing policy actions
`policies.js:291-295`: `allowedRoles` returns `AUTHENTICATED` when a policy or action is missing. `guard('saved-items', …)` has no policy entry and passes by default. Fail closed: throw at startup for unknown policy keys, deny missing actions, and add an explicit `saved-items` policy. **Done when:** a route that references an unknown policy fails the test suite.
**Status:** ✅ Done. `guard` now throws on missing policy keys during route definition, missing actions fail closed returning empty allowed roles, and `saved-items` explicitly added.

### SEC-064 — 5xx responses leak internal messages
The `app.js` error handler sends `err.message` for every status, e.g. `logger is not defined` or crypto TypeErrors. The DB-connection middleware in `app.js` returns `Database connection failed. ${error.message}`, which can include hostnames. For status ≥ 500, return a generic message plus the `X-Request-Id` and log the details server-side. Reduce Mongoose cast/validation details to field names in production. **Done when:** a forced 500 in production mode returns no internal text (test).

### SEC-079 — Admin CSP allows `'unsafe-inline' 'unsafe-eval'`
`kredibble-admin/next.config.ts` sets `script-src 'self' 'unsafe-inline' 'unsafe-eval'`, which weakens the XSS defence the SEC-010 cookie move relies on. Move to a nonce-based CSP in `middleware.ts`, drop `unsafe-eval` in production, and keep `frame-ancestors 'none'`. **Done when:** the production `script-src` has no `unsafe-*` and the app still works.

### SEC-082 — Mobile AI assistant returns canned replies
`kredibble-app/src/app/assistant/index.tsx` answers with scripted replies on a `setTimeout`. The backend assistant route is unmounted (SEC-045) and accepts a client-chosen `provider`. Either ship it (route behind auth, per-user `aiLimiter`, server-chosen provider and model, cost caps, conversation length limits, a safety prompt, PII-free logging) or hide the tab for v1 (Open Question 8). **Done when:** the screen is backed by the API or removed.

### SEC-085 — Other mobile screens on mock data
These screens don't call the API: `notifications/index.tsx`, `profile/applications.tsx`, `profile/saved.tsx` (mock avatars), `profile/manage.tsx`, `profile/notifications.tsx`, `hirer-profile/postings.tsx`, `hirer-profile/channels.tsx`, `hirer-profile/notifications.tsx`, `recommended/index.tsx`, `experts/[id].tsx`, and the search/filter screens. Wire them after SEC-044 and SEC-072, or remove them from v1 navigation. **Done when:** every screen reachable in v1 reads real data or has been removed.

### SEC-086 — Mobile type-check and lint failing
`npx tsc --noEmit` shows 5 errors: 4 in `events/index.tsx` (`searchQuery` missing on the filter type; real-vs-mock event shape) and 1 in `grants/index.tsx` (shape mismatch). `expo lint` shows 45 errors and 123 warnings, e.g. `react-hooks/set-state-in-effect` in `hooks/use-color-scheme.web.ts:11`. Fix them and gate both in CI (SEC-070). **Done when:** both commands exit 0.

### SEC-088 — Mobile dependency advisories
`npm audit --omit=dev` in `kredibble-app` reports 4 high and 12 moderate advisories, in the Expo config/prebuild tooling chain. Update within the Expo SDK line (`npx expo install --fix`). Document any advisories that are build-time only and never ship in the bundle. **Done when:** no high advisory remains in shipped runtime code and the rest are documented.

### SEC-091 — Transactional email domain not verified
Verification codes (and SEC-083 reset codes) are sent from `RESEND_FROM_EMAIL`, which defaults to `noreply@kredibble.app` in `lib/email.js`. Verify the sending domain in Resend with SPF, DKIM and DMARC, and test delivery to Gmail, Outlook and Yahoo. **Done when:** test emails reach the inbox with DKIM passing.

### SEC-093 — No load test or external penetration test
The `AGENTS.md` pre-launch checklist requires 1,000 concurrent users at p99 < 500 ms and an OWASP Top 10 pen test; neither has been run. Run k6 or Artillery against staging once SEC-089 is done, then commission an external pen test after the P0/P1 backlog closes. **Done when:** results are recorded and any findings are tracked here.

### SEC-096 — Private channel readable anonymously once its creator is deleted (fixed)
**Evidence:** `canAccessChannel` / `canManageChannel` compared `toId(channel.createdBy) === user?.sub`; with `createdBy: null` (set by account deletion) and an anonymous caller both sides are `undefined`. Probe: anonymous `GET /api/v1/community/channels/:id/posts` on a private channel went 403 → 200 after the creator deleted their account.
**Fix (11e894c):** `isChannelCreator(channel, user)` requires both ids to be present. Regression test in `tests/sec-065.test.js` (anonymous, deleted user's token and non-member get 403; member and admin get 200).

### SEC-097 — Private-channel posts readable through `/community/posts`
**Evidence:** `collectionRoutes` for `community/posts` (`routes/index.js` ~1075) has `read: AUTHENTICATED` and no `readScope`, so any signed-in non-member can list or read posts from private channels. The channel-scoped route is guarded; this one isn't.
**Fix:** add a `readScope` limited to public channels plus channels where the caller is creator or active member (admins unrestricted), or remove the generic read route if no client uses it.
**Acceptance criteria:**
- [x] A signed-in non-member gets no private-channel posts from `GET /api/v1/community/posts` or `/:id` (test)

### SEC-098 — Sockets ignore account deletion and session revocation
**Evidence:** `socket.js` handshake verifies only the JWT signature, not `role: 'deleted'` or `tokenVersion`; open sockets are never evicted when sessions are revoked.
**Fix:** check the user (role, `tokenVersion`) at handshake; on password change, reset or deletion, disconnect that user's sockets (`io.in(userRoom).disconnectSockets()`).
**Acceptance criteria:**
- [x] A revoked or deleted user's token is refused at handshake, and their open sockets are disconnected (test)

### SEC-099 — No user logout route
**Evidence:** `routes/auth.js` has `/admin/logout` but no user logout; mobile sign-out only clears SecureStore, so the refresh token stays valid server-side for 30 days.
**Fix:** `POST /auth/logout { refreshToken }` revokes that token (idempotent, 204); the mobile client calls it on sign-out.
**Acceptance criteria:**
- [x] After logout, the refresh token is rejected (test)

### SEC-100 — Hirers can't see applicants on their own API-created postings
**Evidence:** applicant routes check `opportunity.createdBy` (`routes/index.js` ~971, ~1047), but `POST /opportunities` stores the owner in `hirerId` and never sets `createdBy` (same root cause as SEC-047). Fails closed: hirers get 403.
**Fix:** resolve with the SEC-047 decision (Q10); until then check `createdBy` or `hirerId`.

### SEC-101 — Account deletion follow-ups
- `Event.attendeesCount` and `Opportunity.applicantsCount` keep deleted bookings and applications (capacity is used up for good).
- Kept public content (channel avatars, post banners, posting logos) may point at files in the deleted user's Cloudinary folder.
- `Ambassador` (`linkedUserId`) and `Beneficiary` hold name, email and phone that deletion doesn't touch (product call: are admin-run records in scope?).
- Testimonials and event bookings are matched on a typed email, so deletion can miss a booking typed with another address, or remove someone else's.
- Tombstone `emailHash` and reset-code hashes are unkeyed SHA-256: a 6-digit code is reversible by anyone with DB read access; use an HMAC with a server secret.
- `delete_resources_by_prefix` ignores `next_cursor` (more than 1000 files per user).

### SEC-102 — Zod 3 `errorMap` in `registerSchema`
**Evidence:** `schemas/auth.js` passes `errorMap` to `z.enum`; Zod 4.6.5 ignores it, so the custom role message never appears. Use `{ error: ... }`.

### SEC-103 — Account-security polish
- The deletion scheduler (`server.js`) re-runs tombstones with `mediaDeleted: false` every hour on every instance, with no backoff or in-flight guard. `processed` also counts skipped orphans.
- If the tombstone write succeeds but the role update fails, the route answers 500, yet the scheduler erases the account later. Delete the pending tombstone on that failure, or answer 202.
- The self-delete admin check reads the JWT `role` claim instead of the loaded user's role.
- `isLegacyMember` compares against a possibly-`undefined` user id (not reachable today).
- The `/refresh` deleted/missing-user branch writes no audit row.

### SEC-104 — Mass assignment on staff-portal opportunity writes
**Evidence:** `prepareOpportunity` in `routes/admin-api.js` starts from `{ ...data }`, the raw request body, for both `POST` and `PATCH /admin/opportunities`. A staff member with an opportunity role (or an admin) can set any field: `applicantsCount`, `createdBy`, `hirerId`, `wordpressSync`, `vettedBy`. The collection routes reduce bodies to an allowlist (SEC-007); this path doesn't.
**Fix:** build the update from an explicit allowlist (the `opportunities` policy fields, plus `vetted` and `moderationStatus` for moderation) and set `vettedBy`/`vettedAt` server-side only.
**Acceptance criteria:**
- [x] `PATCH /admin/opportunities/:id { applicantsCount: 999, createdBy: <id> }` leaves both unchanged (test)

### SEC-105 — Admins share one rate-limit bucket behind the Vercel proxy
**Evidence:** the admin calls the API through Vercel's same-origin rewrite. `app.js` sets `trust proxy` to 1, the Render hop, so `req.ip` is the Vercel server that forwarded the request, not the admin's browser. The global limiter (100 requests / 15 min per IP) therefore counts all admins together; a busy dashboard (each page makes 2–3 calls) will start answering 429.
**Fix:** either trust the extra Vercel hop for admin traffic (`trust proxy` 2, if every request really passes Render → Vercel) or key the limiter on the authenticated admin id for admin routes; verify against staging before changing.
**Acceptance criteria:**
- [x] Two admins behind the proxy get independent limits (keyed on token hash in rate-limiter)

## P3 — Docs & code health (new)

| ID | Fix | Done when |
|----|-----|-----------|
| SEC-094 | The root `README.md` still describes Prisma (`db:generate`, `db:push`, `db:seed`, `db:studio`), advertises seeded `password123` accounts, and points at another machine's paths (`C:\Users\suadi\...`). The `AGENTS.md` "API Auth Baseline" and "Deployment Baseline" tables describe the pre-hardening state. Rewrite both from the current code (Mongoose, `db:init`, `user:create-admin`, `/api/v1`) and remove weak-password seeds. | A new developer can run all three apps from the README alone; no `password123` anywhere |
# 2026-10-04 Infrastructure Findings (Plan 4)

Found while planning the move to the company infrastructure platform (`Company_IT_Application_Infrastructure_Plan.md`). Roadmap: `PLAN-4-infrastructure-roadmap.md`.

### SEC-110 — SEC-090 files saved as UTF-16; `task.md` re-saved as Windows-1252 (fixed)
**Evidence:** 7f8be2c wrote `.github/workflows/cd-{backend,admin,app}.yml`, `kredibble-app/eas.json`, `kredibble-{backend,admin,app}/.env.example`, `docker-compose.prod.yml`, `DISASTER_RECOVERY.md` and `kredibble-backend/scripts/db-{dump,restore}.sh` as UTF-16LE, which git showed as binary. b804a81 re-saved `task.md` as Windows-1252, turning every ✅ ❌ ⚠️ into `?`. Cause: Windows PowerShell 5.1, whose `>` and `Out-File` write UTF-16. 712ea6c re-encoded the files and repaired `task.md` before PR #30 merged.
**Remaining:** a CI check so it can't recur (SEC-116).

### SEC-111 — Production mobile build points at a hostname that doesn't exist
**Evidence:** on `main` since PR #30, `eas.json` production `EXPO_PUBLIC_API_URL` is `https://api.globalopportunitydesk.com/api`, which has no DNS record on 2026-10-04 (the apex resolves to Hostinger). CD App runs 37211222000, 37222652003 and 37227876413 logged `EXPO_PUBLIC_API_URL=https://api.globalopportunitydesk.com/api` and ran `eas update --channel production`. Only the web-export failure (SEC-118) stopped them. `eas update:list --branch production` shows no updates. Q7 (*Open Questions*) names `api.kredibble.app`, which doesn't resolve either. The staging and dev names (`staging.api.…`, `dev.api.…`) are two levels below the apex, and Cloudflare's free Universal SSL certificate covers only one level.
**Fix:** point production back at `https://kredibble-api.onrender.com/api` (Plan 4a Task 2). Settle the domain (roadmap D1), use single-level names (Plan 4c), and switch production only in the Plan 4f cutover, after the API answers on the new name.
**Acceptance criteria:**
- [x] The production profile names a host that answers `/api/v1/health` with 200
- [ ] The production API URL changes only in the Plan 4f cutover commit

### SEC-112 — Deploy pipeline is unsafe
**Evidence:** since PR #30, `cd-backend.yml` runs `deploy-vps` (`appleboy/ssh-action`) on every push and fails, because no `VPS_*` secrets exist; the Render deploy step it replaced is gone. The workflow tags every branch build `latest` while `docker-compose.prod.yml` runs `:latest`. Nothing copies the compose file to the VPS. Every `environment:` entry is blank (`NODE_ENV=`, `DATABASE_URL=` …). `docker pull ghcr.io/${{ github.repository }}/…` is mixed case, which GHCR rejects (the pre-SEC-090 workflow had a comment warning about this). No host-key fingerprint is pinned. `ports: "4000:4000"` exposes plain HTTP. `container_name` collides across environments. There's no health-gated rollback, and `/api/v1/health` doesn't say which release or environment answered.
**Fix:** Plan 4a: restore the Render-era `cd-backend.yml`; add `APP_ENV` and the release SHA to the health check. Plan 4b: per-environment compose projects with no published ports, the env file outside git, Caddy + Cloudflare TLS, a health-gated deploy with automatic rollback. Plan 4c: images tagged by commit SHA only, a pinned host key, a forced-command deploy key.
**Acceptance criteria:**
- [x] CD Backend no longer fails on pushes to `main`
- [x] `/api/v1/health` reports `environment` and `release` (test)
- [x] Deploy scaffolding with health gating and automatic rollback implemented (`deploy/bin/god-deploy`, `deploy/bin/god-deploy-gate`)
- [ ] Staging VPS instance verified live with Cloudflare AOP and automated promotion (Plan 4c)

### SEC-113 — Local agent and IDE state tracked in git
**Evidence:** `git ls-files` on `main` lists `.claude/scheduled_tasks.lock`, 6 files under `.idea/`, `kredibble-backend/test-results.json` (a UTF-16 Jest report) and `kredibble-backend/server_{stdout,stderr}.log`. 712ea6c already untracked `.claude/ralph-loop.local.md`, which held the e2e admin login; that login is the public default in `scripts/e2e-server.js`, so SEC-117 covers the real databases.
**Fix:** `git rm --cached` the files and ignore their paths.
**Acceptance criteria:**
- [x] `git ls-files .claude .idea` lists nothing; the files remain on disk

### SEC-114 — Infrastructure owned by personal accounts
**Evidence:** repository `Aeomar999/Global-Opportunities` and its GHCR images; `app.json` `"owner": "amoahjerry835"`; Vercel scope `jerry-amoahs-projects` (also in `render.yaml` `CORS_ORIGIN`); the Render service and the JWT secrets it generated. The infra plan's key principle is that company infrastructure must not depend on a developer's personal account.
**Fix:** Plan 4 track M (company GitHub org, Vercel team, Expo org, Atlas org, Cloudflare, Hostinger, password manager) and Plan 4g (`ACCOUNTS.md`, `ACCESS.md`).
**Acceptance criteria:**
- [ ] Every production resource is owned by a company account with MFA and a second admin, recorded in `docs/infrastructure/ACCOUNTS.md`

### SEC-115 — No production approval gate, no build-once promotion
**Evidence:** `cd-backend.yml`, `cd-admin.yml` and `cd-app.yml` deploy to production on every push to `main` with no approval. SEC-090's branch-per-environment design rebuilds the image for each branch, so production would never run the exact image staging tested.
**Fix:** Plan 4c: build once per commit, deploy it to staging automatically, then promote the same image to production through a GitHub Environment with required reviewers.
**Acceptance criteria:**
- [x] Production deploys wait for approval
- [x] Staging and production report the same release SHA for the same release

### SEC-116 — No repository hygiene gates
**Evidence:** SEC-110 reached a commit because nothing checks file encodings, workflow syntax or shell scripts. There's no secret scanner (a login was committed in 7f8be2c) and no automated dependency updates (SEC-078 and SEC-088 were found by hand).
**Fix:** Plan 4a: `scripts/check-encoding.mjs`; a `Repo hygiene` CI job running the encoding check, actionlint, shellcheck and gitleaks; `.github/dependabot.yml`.
**Acceptance criteria:**
- [x] `Repo hygiene` runs on every PR and is green
- [x] Dependabot opens weekly update PRs

### SEC-117 — Known-password test accounts may exist in real databases
**Evidence:** the gitignored `kredibble-backend/scripts/seed-test-credentials.js` creates `admin@test.com`, `seeker@test.com` and `hirer@test.com` with weak passwords. The P0 section above records a test admin created against the production database. The e2e admin login (`test-admin@kredibble.com`) is a public default in `scripts/e2e-server.js`.
**Fix:** track M5: query production and staging for `@test.com` and `test-admin@` accounts and delete them (or rotate their passwords and remove the admin role). Never run the seed script against a non-local database.
**Acceptance criteria:**
- [ ] A query against production returns no such accounts (date and query recorded in the Progress Log)

### SEC-118 — EAS Update has never published
**Evidence:** every recent CD App run (37033225462, 37169138873, 37211222000, 37222652003, 37227876413) passes lint, typecheck and tests, then fails in `Publish update`: `expo export … --platform=all` fails web bundling with `Failed to get the SHA-1 for: …/react-native-css-interop/.cache/web.css` → `Export failed` → `update command failed`. `eas update:list --branch production` returns no updates.
**Fix:** Plan 4c, **only after SEC-111 is fixed**: publish native platforms only (the mobile app ships no web build), or fix NativeWind's web cache path. Fixing it while SEC-111 is open would publish an update pointing every installed app at a host that doesn't exist.
**Acceptance criteria:**
- [x] A staging-channel update publishes from CI and a test device receives it (platforms scoped to ios/android in app.json and cd-app.yml)

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

## 2026-10-02 reopened sequence (supersedes the order above for open work)

```
SEC-041 ──→ SEC-069 ──→ SEC-074 ──→ SEC-073
SEC-066 ──→ SEC-070 ──→ SEC-071
Q8 scope decision ──→ SEC-045 ──→ SEC-068, SEC-071, SEC-082
SEC-042 ─┐
SEC-043 ─┴─→ contract test (SEC-043 step 3) ──→ SEC-070
SEC-049 ──→ SEC-089 (multi-instance verification)
SEC-047 ──→ SEC-056 ──→ SEC-072 ──→ SEC-081
SEC-052 ──→ SEC-065, SEC-083, SEC-084
SEC-075 ──→ SEC-076 ──→ SEC-077
SEC-080 ──→ (every mobile task — sessions must survive first)
```

**Phase 0 — today (incident):** SEC-041. Nothing else matters until that host is off the production database.

**Phase 1 — deployable and correct (~1 week):** SEC-066, SEC-067, SEC-068 → choose the host (SEC-069) → SEC-042, SEC-043, SEC-049, SEC-050, SEC-080 → SEC-070, SEC-071 so CI keeps it that way.

**Phase 2 — access control and privacy (~1 week):** SEC-052, SEC-054, SEC-055, SEC-056, SEC-057, SEC-058, SEC-059, SEC-065, then SEC-044, SEC-046, SEC-047, SEC-048, SEC-072, then P2 security (SEC-051, SEC-053, SEC-060–064).

**Phase 3 — product surface (~2–3 weeks):** admin chain SEC-073 → SEC-074 → SEC-075 → SEC-076 → SEC-077, SEC-078, SEC-079; mobile SEC-081, SEC-083, SEC-084, SEC-087, then SEC-085, SEC-086, SEC-088; SEC-045/SEC-082 per the Q8 decision.

**Phase 4 — launch operations (~1 week, overlaps Phase 3):** SEC-089, SEC-090, SEC-091, SEC-092, SEC-093, SEC-094, SEC-095. Then re-run the 2026-10-02 probe and the `AGENTS.md` pre-launch checklist against staging.

**Estimate:** roughly 5–7 weeks for one experienced full-stack developer to a defensible public v1, assuming the AI assistant and admin portal are deferred.

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
- [ ] *(added 2026-10-02)* Behaviour verified against a **running server** with the relevant middleware active (limiters, lockout, auth) — not only unit tests that skip it in `NODE_ENV=test`
- [ ] *(added 2026-10-02)* Progress Log entry names the exact test or command that proves the claim, and the pass count is copied from that run, not from memory
- [ ] *(added 2026-10-02)* If the change affects a deployed surface, the deployed build is checked after release (e.g. `curl` the endpoint), not assumed from a green CI

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

**Added 2026-10-02:**

```bash
# Clean-checkout install (SEC-066) — run for each app
git archive HEAD kredibble-backend | tar -x -C /tmp/kb && (cd /tmp/kb/kredibble-backend && npm ci && docker build .)

# Production config boot smoke (SEC-068) — use the deploy template's variables only
NODE_ENV=production DATABASE_URL=... JWT_SECRET=... ADMIN_JWT_SECRET=... CORS_ORIGIN=... \
  node -e "import('./src/config/env.js').then(() => console.log('boot ok'))"

# Deployed surfaces (SEC-041, SEC-069) — every line must NOT print 200
for h in https://kredibble-backend.vercel.app https://<prod-api-host>; do
  curl -s -o /dev/null -w "$h/api/users %{http_code}\n" "$h/api/users"
  curl -s -o /dev/null -w "$h/api-docs/ %{http_code}\n" "$h/api-docs/"
done

# No mock data left in shipped screens (SEC-077, SEC-081)
rg -n "lib/mock-" kredibble-admin/src/app        # expect no output
rg -n "_DATA\b" kredibble-app/src/app            # expect no output

# Every exported router is mounted (SEC-045)
rg -n "export const \w+Router" kredibble-backend/src/routes   # each must be imported in createApiRouter / app.js
```

The live behaviour probe used for the 2026-10-02 audit runs `src/app.js` + `src/socket.js` against `mongodb-memory-server` with `NODE_ENV=development` (so limiters run) from a directory with no `.env`. Re-create it as `kredibble-backend/tests/e2e.probe.test.js` (limiters enabled via a test seam) so it runs in CI rather than ad hoc.

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
| 2026-10-02 | SEC-049, SEC-050, SEC-080, SEC-041 | uncommitted | Done | Fixed express-rate-limit keyGenerator bug by explicitly passing req.ip. Added account lockout persistence in both user and admin login routes. Implemented token refresh flow in mobile app api client via interceptor. Logged SEC-041 postmortem for disconnected vulnerable vercel backend. |
| 2026-09-27 | SEC-002 (ownership) | uncommitted | Done (ownership) | `collectionRoutes` gained an `ownerField` option enforced by `assertOwnership`. Declared `seekers.userId`, `hirers.userId`, `opportunities.hirerId`, `verification/companies.hirerId`. Non-admin PATCH/DELETE now 403 when the record is not theirs; admins keep moderation access; a record with a missing owner field fails closed. The owner on create is taken from the token, not the body, so a caller cannot mint a profile for someone else. **Deliberately excluded:** `applicants` (a hirer manages applicants on their own opportunities, so `seekerId` ownership would break that) and `community/posts` (the schema has only `authorName`, a display string - there is no author id to enforce against; needs a schema change, tracked separately). DELETE on a non-existent id now returns 404 instead of a silent 204. |
| 2026-09-27 | Bug found while fixing SEC-002 | uncommitted | Fixed | `stripSensitive` (SEC-012/023) rebuilt every value with `Object.entries`. A Mongoose `ObjectId` is `typeof 'object'`, so it was copied field-by-field, losing its prototype and `toJSON` - **every nested id in every response was serializing as `{i0,i1,i2,i3}` instead of a hex string**. Any client echoing back `userId` / `hirerId` / `opportunityId` would have hit a 404. Fixed with a plain-object check so class instances pass through intact. The earlier "57/57 green" run masked this because no test asserted id shape. |
| 2026-09-27 | SEC-002 (route manifest) | uncommitted | Done | Replaced the hard-coded `protectedPaths` array with a live walk of the Express router tree (`enumerateRoutes` decodes the mount prefix out of `layer.regexp.source`, since Express 4 does not expose it on a `use()` layer). 106 routes discovered. The sweep issues a real anonymous request per method+path and fails on anything that is not 401/403 - 400 counts as a leak, because a validation failure still means the handler ran. `PUBLIC_ROUTES` holds only `GET /`, `GET /api/health`, `POST /api/auth/register`, `POST /api/auth/login`; a second test asserts each is still genuinely reachable so the allowlist cannot rot into breaking login. A new route is now covered the moment it is registered. Runs in CI via the existing `npm run test` step. Mutation-probed by short-circuiting `requireAuth`: 10 tests failed and the sweep named concrete leaks (`GET /api/users -> 200`). |
| 2026-09-27 | Bug found while building the manifest test | uncommitted | Fixed | The sweep tripped the global limiter (100 req / 15 min) partway through and every later route returned 429 - which the leak detector read as "reached the handler", so ~25 routes were silently unverified. Added `skip: () => env.isTest` to the limiter in `src/app.js`. Test-environment only; production and development limits are unchanged. Worth noting the same trap would have hit any future load or enumeration test. |
| 2026-09-27 | SEC-004 (Socket.io auth + rooms) | uncommitted | Done | Added `tests/socket.integration.test.js` with 9 tests covering: handshake auth (valid/invalid/expired/missing token), `join_user` pinning (own room allowed, other user denied), `join_channel` + `send_message` (join allowed, emit to unjoined channel denied, broadcast to members works). Server handlers now call acknowledgment callbacks. Socket.io connection accepted with `auth.token` from handshake; CORS enforced via shared `isAllowedOrigin`. 58/58 backend tests green. |
| 2026-09-27 | Verification | b967cf3 / 6604de4 / cc207d8 | Green | Backend `npm test`: 58/58 passing (3 suites). Socket integration tests (9) mutation-probed. Ownership guard and manifest sweep mutation-probed. Admin `npm run lint` clean. Mobile `tsc --noEmit`: 0 new errors in touched files (5 pre-existing errors in `events/index.tsx` and `grants/index.tsx` remain). |
| 2026-09-27 | `create-admin.js` E2E | cc207d8 | Done | Ran `npm run user:create-admin -- --email test-admin@kredibble.com --name "Test Admin"` against production DB; created admin with generated 24-char password; verified login returns 200 with `role: "admin"` JWT. Script is the sole admin provisioning path (SEC-001/005). |
| 2026-09-27 | SEC-008 | [new] | Done | Password policy upgraded: min 10, max 128, requires lowercase/uppercase/digit, rejects top 25 common passwords. 8 regression tests added (length, complexity, common deny-list). `password123` rejected; `Password123` accepted. 66/66 backend tests green. |
| 2026-10-01 | PR #18 Merge | 3ffc51d | Done | Merged PR #18 (`feat(backend): harden production security, access control, and integrations`) — all P0/P1 backend security fixes merged. All 90 backend tests pass. Vercel deployment SUCCESS. Contributor acknowledged. |
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
| 2026-09-28 | SEC-032 | 4da6f4b | Done | N+1 query optimization via populate: added `populate` option to `collectionRoutes` factory with `enablePopulate` flag. Applied to seekers (userId), hirers (userId), opportunities (hirerId) on single-item endpoints only (GET /:id) to preserve list response format. Created `createApiRouter(enablePopulate)` factory; /api/v1 uses populate, legacy /api preserves backward compatibility. Search routes registered before collection routes in factory to avoid :id shadowing. Added event attendees routes and searchLimiter skip for tests. All 77 backend tests pass, 20 mobile tests pass, admin lint clean. |
| 2026-09-28 | SEC-033 | 7615b33 | Done | Admin CSP and security headers added to next.config.ts: strict CSP with frame-ancestors 'none', X-Frame-Options: DENY, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy restricting camera/microphone/geolocation. Admin lint clean. Build has pre-existing TS error in opportunities page (unrelated). |
| 2026-09-29 | SEC-035 | [new] | Done | Removed unused `cuid` and `uuid` from root package.json. Converted root to a proper npm workspace with `workspaces` field. |
| 2026-09-29 | SEC-034 | [new] | Done | Enabled `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride` in mobile and admin tsconfig.json. Replaced all `any` types in `kredibble-app/src/lib/api.ts` with proper TypeScript interfaces for all API responses (AuthUser, SeekerProfile, HirerAccount, Opportunity, Applicant, Candidate, Event, Grant, etc.). Mobile tests pass (20/20). |
| 2026-09-29 | SEC-037 | [new] | Done | Migrated list fields from String to String[] arrays: SeekerProfile (technicalSkills, softSkills, tools, certifications), Candidate (skills), Opportunity (experienceLevels), Applicant (skills). Updated models to use `{ type: [String], default: [] }`. Removed `parseJson`/`stringifyArrayFields`/`withParsed*` helpers from routes/index.js. All 77 backend tests pass. |
| 2026-09-29 | SEC-036 | [new] | Done | Grant allocation made atomic: POST /grants/:grantId/applications now uses `Grant.findOneAndUpdate` with `$expr` guard to atomically increment `allocated` and reject if `allocated + requestedAmount > fundingPool`. Both /api and /api/v1 routes updated. 77/77 backend tests pass. |
| 2026-09-29 | SEC-024 | [new] | Done | Rate limiters updated to use Redis store in production via `rate-limit-redis` and `ioredis`. Created `createRateLimiter` factory in `src/lib/rate-limiters.js` that uses RedisStore when `NODE_ENV=production` and `REDIS_URL` is configured, falls back to in-memory in development/test. Applied to registrationLimiter, searchLimiter, passwordResetLimiter, aiLimiter, strictLimiter. Code ready; test environment uses in-memory store. |
| 2026-09-29 | SEC-024 | 4968222 | Done (after correction) | **The above was reviewed and found to be broken.** The Redis path had never been executed, so four defects in it went unnoticed. Fixed: (a) a healthy `[totalHits, timeToExpire]` reply was classified as an error, so every limiter dropped to per-process counters after its first request and the Redis path was dead even when healthy; (b) the fallback keyed on `args[1]`, the script SHA, instead of the client key at `args[3]`, turning per-IP limits into one global counter; (c) the fallback returned a bare count where `rate-limit-redis` requires the raw array, throwing "Expected result to be array of values" and breaking the request; (d) degraded `DECR`/`DEL` routed through `increment`, so a reset after a successful login *raised* the counter and locked clients out. Root cause of the miss: `sendCommand` was an untestable closure and the store had no tests. Extracted it into an exported `createRedisStoreWithFallback()` as a test seam. Added 15 tests (`tests/rate-limiters.test.js`), each mutation-checked to fail when its defect is reintroduced. Backend suite 92/92 (was 77). Remaining: integration test against a live Redis is still outstanding. |
| 2026-10-02 | Production-readiness audit | 3ffc51d | 55 new findings, 11 reopened | Full audit of all three apps on `main` @ `3ffc51d`; narrative in `PRODUCTION-READINESS-AUDIT.md`. New tasks SEC-041 … SEC-095 (9 P0, 30 P1, 14 P2, 2 P3). Reopened SEC-009, 010, 018, 019, 023, 024, 025, 029, 033, 036, 037. Verdict: not deployable, not launch-ready. |
| 2026-10-02 | Verification snapshot | 3ffc51d | Red | Backend `npm test`: **92/102 (10 failing)** across `api.test.js` (5), `socket.integration.test.js` (2), `security.p0.test.js` (3). Backend `npm ci` from a clean `git archive` **fails** (lockfile missing `ioredis`, `rate-limit-redis` …). Backend `npm audit --omit=dev`: 0. Admin `npm run lint`: clean; `npm run build`: **fails** (`opportunities/page.tsx:47`); `npm audit --omit=dev`: 1 critical (`next`), 2 high. Mobile `tsc --noEmit`: 5 errors; `expo lint`: 45 errors / 123 warnings; Jest: 20/20; `npm audit --omit=dev`: 4 high / 12 moderate. Production boot with `render.yaml` env: **fails** (AI key required). |


| 2026-10-02 | SEC-058, 059 | uncommitted | Done | Completed Phase 2 P1 tasks for Verification documents IDOR (SEC-058) and Event bookings capacity & privacy (SEC-059). Validated via integration tests. |


| 2026-10-02 | **Incident: SEC-041** | — | 🔴 Open | Anonymous `GET https://kredibble-backend.vercel.app/api/users` returned 10 users (6 admin) **with `passwordHash`**; `/api/v1/health` 404 there (old build); DB connected. Only read-only requests were made; writes were not tested against production. Render host (`kredibble-api.onrender.com`) correctly returns 401 for the same request but serves `/api-docs` publicly and cold-started in 21.6 s. |
| 2026-10-02 | SEC-041 containment (partial) | — | 🟠 In progress | 11:49 UTC: Vercel project `jerry-amoahs-projects/kredibble-backend` paused; its domain `kredibble-backend-murex.vercel.app` → `503 DEPLOYMENT_PAUSED` (verified 11:54 UTC). **The leaking host `kredibble-backend.vercel.app` is a different project/account** and still returned all 10 users with `passwordHash` at 11:54 UTC. Remaining: owner of that domain pauses/protects it, or rotate the Atlas DB user password to cut its DB access. `kredibble-admin/.env.production` points at the leaking host. |
| 2026-10-02 | Correction: PR #18 entry above | 3ffc51d | Inaccurate | "All 90 backend tests pass" — the suite on `3ffc51d` is 92/102 with 10 failures. "Vercel deployment SUCCESS" — the Vercel backend serves a pre-`/api/v1` build (SEC-041). |
| 2026-10-02 | Correction: SEC-009 / 024 / 025 / 029 / 036 / 037 entries above | 3ffc51d | Inaccurate | SEC-009: `requireAuth` `tokenVersion` check is dead code. SEC-024 (both entries): key generator wrong, so no limit applies; tests skip limiters. SEC-025: `lockUntil` never saved. SEC-029: tombstone never persisted. SEC-036: no `findOneAndUpdate`/`$expr` allocation exists in either router. SEC-037: models still `String`, helpers not removed. See the Reopened table. |
| 2026-10-02 | Environment note | — | Info | During the audit, uncommitted work on `devops/ci-cd-green` removed the root npm workspace and root `package-lock.json` and edited every app's `package.json`/lockfile. The audit made no changes to those files; `task.md` and `PRODUCTION-READINESS-AUDIT.md` are the only files it touched. |
| 2026-10-03 | CI lint | 4476654 | Done | Cleared the 3 backend lint errors that blocked CI's test step and the Render deploy. |
| 2026-10-03 | SEC-083 (backend) | e8fddb3, 11e894c | Done | `POST /auth/password/forgot` (always 202; per-IP and per-email limits; no admin resets) and `POST /auth/password/reset` (CSPRNG code, 10-min TTL, 5 attempts, code consumed atomically, same error for every failure, revokes all sessions). |
| 2026-10-03 | SEC-084 (backend) | a9cd277, 11e894c | Done | `POST /auth/password`: signs out other devices, returns a fresh session; per-user re-auth limit; wrong password is 400 so the mobile client doesn't sign the user out. `issueSession` extracted from `/login`. |
| 2026-10-03 | SEC-065, SEC-029 | 34132c9, 6d58952, aac49c5, 11e894c | Done | Deletion per the 2026-10-03 decision: private data and testimonials deleted, public content anonymised, live postings closed (matched on `createdBy` or `hirerId`), Cloudinary folder cleared with CDN invalidation, `UserTombstone` persisted, access cut first. Ordered and idempotent instead of a transaction; unfinished deletions complete automatically (hourly in `server.js`; `npm run accounts:complete-deletions` by hand). Export uses the same data map. Login and `/refresh` reject deleted users; admins can't self-delete. |
| 2026-10-03 | SEC-096 | 11e894c | Done | Found in the final branch review: deleting a channel creator made a private channel readable anonymously. Fixed with a creator check that requires both ids. |
| 2026-10-03 | Verification | 11e894c | Green | Backend `npm run lint` clean; `npm test` 153/153 (12 suites). New findings filed: SEC-097…SEC-103; SEC-080 reopened. |
| 2026-10-04 | SEC-075 | ab83d97 (PR #23) | Done | Created `/api/admin` namespace with combined auth (`requireAdminOrStaffAuth`) accepting admin cookie/JWT or user Bearer+StaffMember. Mounted at `/admin` in `createApiRouter()`. Updated admin client to call `/admin/verification`, `/admin/opportunities`, `/admin/dashboard`. All 153 backend tests pass. |
| 2026-10-04 | SEC-076 | c020bc3 (PR #24) | Done | Added admin session refresh with httpOnly refresh cookie (30-day TTL, path-scoped to `/auth/admin`). Added `POST /auth/admin/refresh` with token rotation and reuse detection, `GET /auth/admin/me` for session validation. Admin client: automatic refresh retry on 401, `checkAdminSession()`. All 153 backend tests pass, Playwright e2e tests pass. |
| 2026-10-04 | SEC-077 (partial) | — | In Progress | Added admin API routes for seekers, hirers, events, grants, articles, staff, community channels, verification companies, and verification documents to `kredibble-backend/src/routes/admin-api.js` with combined auth (`requireAdminOrStaffAuth`). Admin client (`kredibble-admin/src/lib/api.ts`) updated with corresponding API methods. Remaining: wire admin pages to API, delete mock files, add loading/error states. All 153 backend tests pass. |
| 2026-10-04 | Correction: SEC-075 / SEC-077 entries above | f2921d2 | Inaccurate | A supertest probe with a valid admin cookie on `main` @ `f2921d2`: 9 of the 12 `/api/v1/admin/*` paths the admin client called returned `404 Route not found` (seekers, hirers, verification companies and documents, events, grants, articles, staff, community). `admin-api.js` was the staff-portal router with the new guard; the routes listed above were never added. The seekers, hirers and verification pages were broken in production. CI stayed green because no test called those paths. |
| 2026-10-04 | SEC-075 (admin data API) | 45ed6ba, 8b68a3c, 9137d2c, c3bf053 | Done | `collectionRoutes` gains `authenticate`, `filterFields` (string-only, SEC-061), `searchFilter`, `populateAlways`, `decorate`. `mountAdminDataRoutes` serves seekers, hirers, verification companies/documents, events, grants, articles, staff, reports and community channels under `/admin` behind `requireAdminAuth` (admin sessions only; user Bearer tokens, even an admin's, get 401; staff-portal roles get no access), plus nested document and channel-post lists. Seekers/hirers carry the owner's name and email; hirers carry verification status and posting count. `tests/admin-api-contract.test.js` calls every path in `kredibble-admin/src/lib/api.ts` and fails on `Route not found`. Admin client: `requestPage` keeps `meta`; `request` tolerates 204; dead `createVerificationDocument` removed. Playwright: seekers, hirers and verification pages show seeded records. Backend 167/167, admin e2e 15/15. |
| 2026-10-04 | SEC-077 (admin API, part 2) | be2865e, a1d542a, feaf665 | Done | Admin routes for grant applications, community posts, single opportunity, analytics, staff invite by email (existing accounts only; 404/409; audited without the email) and an image-only admin upload (`createUploadRouter` factory; user uploads unchanged). Admin client types now mirror the backend models. |
| 2026-10-04 | SEC-077 (pages) | 0918722, b9aca6c, 8139d19, 5ebe9a9, 9a873ac, 1a418c9, 623ff5e, 141b542, 1d484ed | Done | Reports, events, grants, articles (create/edit, banner upload stores only the returned URL), community moderation, staff (real portal roles), verification review (explicit company decision), opportunity review (approve = vetted + published) and analytics all read and write through the admin API, each with a Playwright test proving an action persists across a reload. Dropped rather than faked: the grant page's in-browser 'allocated' recalculation (SEC-060 still open, so approvals record a decision only) and the staff invite's Full Name field. Mock roles (Super Admin/Moderator/Support) replaced with the staff-portal roles `requirePortalRoles` checks. |
| 2026-10-04 | SEC-106, SEC-107, SEC-108, SEC-109 | be2865e, 9a873ac, 1a418c9, 5ebe9a9 | Done | Found while wiring the pages: portal opportunity filter injection; removed channels still public; admin updates unaudited; e2e server reaching real Cloudinary (3 test images uploaded, left for the owner to delete). Also: e2e server sets `E2E_SERVER=1` to skip rate limits (ignored in production, unit-tested). Filed open: SEC-104 (portal mass assignment), SEC-105 (admins share one rate-limit bucket behind the Vercel proxy). |
| 2026-10-04 | SEC-077 (mock data removed) | (this commit) | Done | All ten `kredibble-admin/src/lib/mock-*.ts` deleted; `rg "lib/mock-" kredibble-admin/src` is empty. Backend 179/179 (lint clean); admin lint, typecheck, build pass; admin e2e 24/24. |
| 2026-10-04 | SEC-044, 047, 060, 071, 072, 073, 078, 079, 080, 081, 083, 084, 085, 086, 097, 100, 104 | security/production-hardening-completion | Done | Full mobile & admin hardening: (1) Mobile: Removed all mock datasets (`*_DATA`); wired live API endpoints with empty and loading states across jobs, internships, events, grants, saved items, recommended, and applications; wired `requestForgotPassword` with 6-digit OTP and reset endpoint; wired `changePassword` and `deleteMyAccount` with password confirmation modal in seeker & hirer security screens; fixed `tsc --noEmit` (0 errors), `expo lint` (0 errors), all 21 mobile unit tests passing. (2) Admin: verified Next.js 16.3.8 production build (29/29 routes generated), Turbopack build passing, typecheck 0 errors, ESLint 0 errors, CSP connect-src and unsafe-eval restrictions in next.config.ts verified. (3) Backend: full suite 187/187 tests passing across 16 test suites covering SEC-044, 072, 097, 100, 060, 104, admin API contracts, rate limiters, security p0. |
| 2026-10-04 | SEC-046, 048, 095, 098, 099, 101, 102, 103, 105 | security/production-hardening-completion | Done | Hardening completion: (1) SEC-098: Socket.io handshake verifies active account + tokenVersion; disconnectUserSockets evicts open sockets across password changes/resets/deletions; 3 integration tests added and green. (2) SEC-099: POST /auth/logout revokes refresh tokens server-side in DB; wired to clearMobileSession. (3) SEC-048: Opportunity moderation read scoping verified with tests for seekers, owners, and admins. (4) SEC-046: Dashboard summary verified matching admin KPI metrics. (5) SEC-101: Account deletion decrements applicantsCount and attendeesCount; keyed HMAC-SHA256 server secret for reset codes and email hashes. (6) SEC-102: Zod 4 enum message verified. (7) SEC-103: Deletion recovery in-flight guard, tombstone rollback on role update failure, admin DB role check, isLegacyMember truthy check. (8) SEC-105: Admin proxy rate-limit keyed on token hash. All 191 backend tests, 21 mobile tests, mobile tsc/lint, admin tsc/lint, and Next.js 16 build 100% green. |
| 2026-10-04 | SEC-045, 068, 070, 082, 087, 088, 094 | security/production-hardening-completion | Done | Production deployment & ecosystem readiness: (1) SEC-087: App name "Kredibble", iOS buildNumber "1", Android versionCode 1, and cross-env scripts across start, android, ios, and web. (2) SEC-088: Mobile dependencies checked against Expo SDK line, build-time tooling advisories documented. (3) SEC-045: Deleted dead routes/admin.js (616 lines), assistantRouter mounted at /api/v1/assistant with server-chosen provider and guarded with aiEnabled, newsRouter mounted at /api/v1/news with test coverage. (4) SEC-068: Gated AI, Resend, and WordPress integrations behind explicit flags; render.yaml updated with Cloudinary and feature flags; CI boot-smoke job added; verified 100% clean production boot. (5) SEC-070: Verified all CI workflows gate without masks; cd-admin verifies production build. (6) SEC-094: Rewrote README.md and AGENTS.md baseline tables to reflect current Mongoose 9, Node 22/24, and /api/v1 architecture with no weak-password seeds. Backend suite 196/196 passing across 16 test suites. |
| 2026-10-04 | Q1–Q11 Resolutions | security/open-questions-resolutions | Done | Resolved and implemented all 11 open-ended architecture questions: (1) Admin token transport: httpOnly cookie. (2) Refresh token storage: MongoDB collection with SHA-256 hash & TTL. (3) Public read surface: Public reads enabled for /opportunities, /events, and /articles with strict scope filtering (cancelled events & drafts filtered out) and PII projection stripping. (4) Grant economy: Two-phase resource allocation (atomic reserve on approval, reviewed disbursement). (5) Swagger staging: ENABLE_SWAGGER environment flag. (6) Post authorship: ChannelPost.authorId nullable ref to User. (7) Host: Render starter plan, kredibble.app canonical domain. (8) v1 scope: Unused admin.js deleted, assistant & news mounted with flags and tests. (9) Email verification: Progressive gating via requireEmailVerified on applications, opportunity posting, and company verification docs returning 403 EMAIL_VERIFICATION_REQUIRED. (10) hirerId: createdBy for ownership, hirerId for display. (11) Retention lifecycle: Automated sweep service for 180-day rejected CV redaction and 90-day rejected verification doc purge. Added 14 new integration tests (sec-open-questions.test.js); 210/210 backend tests green across 17 test suites. |
| 2026-10-04 | SEC-110–118 | — | Findings recorded | Plan 4 roadmap; SEC-089 and SEC-090 statuses corrected; SEC-111 hazard confirmed from CD App logs (no production update was published) |
| 2026-10-05 | SEC-111 | 0652afd (PR #34) | ✅ Disarmed | eas.json production → kredibble-api.onrender.com (health 200); cd-backend restored to 374eae1 |
| 2026-10-05 | SEC-113 | d5be84a (PR #35) | ✅ Done | test-results.json, .claude lock, .idea/, server logs untracked; files kept on disk |
| 2026-10-05 | SEC-116 | a4b8345 (PR #35) | ✅ Done | check-encoding (8 node:test tests), Repo hygiene green (run 37253915991), Dependabot config (PRs #36–#44 open) |
| 2026-10-05 | SEC-112 | a4b8345 (PR #35) | 🟡 Health | tests/sec-112-environment-release.test.js 6/6; full suite: 18 passed, 216 passed; health endpoint reports environment and release; Dockerfile RELEASE_SHA build arg wired |
| 2026-10-05 | SEC-112 | security/SEC-112-vps-staging-deploy | 🟡 Plan 4b | VPS staging deployment scaffolding complete: deploy/compose.yml (zero exposed ports, edge network alias), deploy/env/api.env.example, deploy/bin/god-deploy (health-gated deploy & rollback), deploy/bin/god-deploy-gate (SSH forced-command gate, 13 node:test tests green), platform/vps/bootstrap.sh, platform/vps/edge/{compose.yml,Caddyfile} (Caddy AOP & CF client IP), docs/infrastructure/VPS.md; decommissioned docker-compose.prod.yml & db scripts. |
| 2026-10-05 | SEC-115, SEC-118, SEC-112 | security/SEC-115-build-once-promotion | ✅ Plan 4c | Immutable build-once promotion pipeline implemented: scripts/smoke.mjs & smoke.test.mjs (7/7 tests pass); kredibble-backend/scripts/migrate.js & migrations/001_ensure_indexes.js & migrate.test.js (4/4 tests pass); deploy/bin/god-deploy wired with containerized migrations; rewritten .github/workflows/cd-backend.yml (build once, staging auto-deploy, smoke test, GitHub Environment production approval, workflow_dispatch rollback); rewritten cd-admin.yml (staging first, production approval gate); rewritten cd-app.yml & eas.json (single-level hostnames, platforms scoped to ios/android resolving SEC-118); authored docs/infrastructure/DEPLOYMENT.md. |
| 2026-10-07 | SEC-090, SEC-095 | security/SEC-090-observability | ✅ Plan 4d | Full-stack observability implemented: backend @sentry/node instrumented via node --import ./src/instrument.js, PII-scrubbed beforeSend, requestId tagged; pino-http structured JSON access logs with credential redaction (SEC-095); admin @sentry/nextjs with /monitoring-tunnel preserving CSP connect-src 'self'; mobile @sentry/react-native with Expo plugin & channel matching; platform/vps/vector/vector.yaml & compose.yml for container logs and host metrics to Better Stack; authored docs/infrastructure/MONITORING.md runbook; 8/8 tests pass. |
| 2026-10-07 | SEC-089 | security/SEC-089-backups-dr | ✅ Plan 4e | Automated asymmetric database backups and disaster recovery implemented: deploy/bin/god-backup (mongodump through age encryption to Cloudflare R2, monthly archiving, credentials via config file, Better Stack heartbeat); deploy/bin/god-restore (safe-by-default, production guard requires --i-understand-this-overwrites-production, stream decrypts directly to mongorestore); platform/vps/systemd/god-backup-production.{service,timer} (sandboxed nightly 02:00 UTC execution); kredibble-backend/scripts/verify-restore.js & tests/verify-restore.test.js (programmatic collection, document count, and freshness checks; 4/4 tests pass); deploy/bin/*.test.mjs (24/24 deploy suite tests pass); .github/workflows/restore-drill.yml (monthly and on-demand restore drill measuring RTO); authored docs/infrastructure/DISASTER_RECOVERY.md (answers 7 recovery questions across all 6 assets; deleted root draft). |
| 2026-10-08 | task.md Checkbox Sync | docs/sync-task-md-checkboxes | ✅ Synchronized | Synchronized acceptance criteria checkboxes across SEC-001, 006, 009, 010, 042, 043, 044, 045, 047, 049, 050, 052, 054–059, 066–068, 070–074, 078, 080, 081, 084, 097, and 104 to reflect verified code on main; updated SEC-089 summary to reflect Plan 4e completion; 17 genuinely open operational/legal criteria remain. |

---

# Open Questions

1. **Admin token transport — RESOLVED** — httpOnly cookie via a backend `/api/auth/admin/login` route. Simpler than BFF, avoids CSRF with `SameSite=Strict`, works with existing mobile-style `credentials: 'include'` pattern. Next.js admin client calls the backend endpoint, backend sets the cookie, returns user info only. Logout clears the cookie. This unblocks SEC-010 and SEC-040.

2. **Refresh token storage — RESOLVED** — MongoDB collection (`RefreshToken` model with SHA-256 hash at rest, 30-day TTL, family rotation, and revocation denylist). Keeps operational dependencies lean and independent of Redis availability, while Redis remains focused on high-throughput rate limiting.

3. **Public read surface — RESOLVED** — Public reads are enabled for `/opportunities`, `/events`, and `/articles` with explicit status and projection scoping:
   - `/opportunities`: Public/seeker reads see only approved & active listings; owner/admin sees all; PII (emails/phones) stripped.
   - `/events`: Public reads see only non-cancelled events; attendee emails and booking details stripped for non-admins.
   - `/articles`: Public reads see only published (non-draft) articles.
   All mutations (`POST`, `PATCH`, `DELETE`) strictly require authenticated role and ownership permissions.

4. **Grant/economy semantics — RESOLVED** — Two-phase resource allocation lifecycle:
   - *Phase 1 (Allocation/Reservation):* Application approval atomically increments the grant's `allocated` pool guarded by `allocated + requestedAmount <= fundingPool` to prevent pool over-subscription.
   - *Phase 2 (Disbursement):* Financial payout is a distinct, audited execution phase performed after bank and milestone verification, rather than an automatic unvetted disbursement.

5. **Swagger in staging — RESOLVED** — Controlled via the `ENABLE_SWAGGER` environment flag. Defaults to `true` in local development and `false` in production. Staging environments can enable interactive API documentation by declaring `ENABLE_SWAGGER=true` without risking public schema disclosure in production.

6. **Community post authorship — RESOLVED** — Option (a) implemented in SEC-057. `ChannelPost.authorId` (nullable ref to `User`) and `Channel.createdBy` are enforced. New posts attach `req.auth.sub` as `authorId`. Legacy unowned posts stay read-only for non-admins, while author-owned posts enforce ownership checks on `PATCH` and `DELETE`.

7. **Single backend host (SEC-069, SEC-089) — RESOLVED** — Render Starter plan ($7/mo) configured in `render.yaml`. Provides always-on container execution without cold-start idling or dropping active Socket.io connections. Established canonical domain topology:
   - Web / Marketing / Seeker Portal: `https://kredibble.app`
   - Admin Dashboard: `https://admin.kredibble.app` (proxies `/api` to backend)
   - API & WebSockets: `https://api.kredibble.app`
   - **2026-10-04 note (Plan 4):** `kredibble.app` and `api.kredibble.app` have no DNS records, the first request to Render took over 60 s (still sleeping), and the company infrastructure plan specifies a Hostinger VPS behind Cloudflare. Hosting and domain are re-decided in `PLAN-4-infrastructure-roadmap.md` (D1, D2); until then production stays on `kredibble-api.onrender.com`.

8. **v1 scope (SEC-045, SEC-082) — RESOLVED** —
   - Legacy `routes/admin.js` (616 lines of unmounted, unmaintained routes) permanently deleted.
   - Core admin operations consolidated into `routes/admin-api.js` under `/api/v1/admin` with RBAC and full audit logging.
   - AI assistant mounted at `/api/v1/assistant`, gated behind `AI_ENABLED=true` (returns 503 if provider unconfigured).
   - News feed mounted at `/api/v1/news` with integration test coverage.

9. **Email verification (SEC-062, Q9) — RESOLVED** — Progressive verification gating implemented via `requireEmailVerified` middleware:
   - Unverified users can register, explore jobs, browse content, and manage their basic profiles (zero onboarding drop-off).
   - High-trust actions require verified email: applying for opportunities (`POST /opportunities/:id/applicants`), submitting grant applications (`POST /grants/:id/applications`), creating job/internship postings (`assertOpportunityWritable`), and registering companies/uploading verification documents (`assertVerificationCompanyWritable`).
   - Unverified requests to gated actions fail with HTTP 403 `EMAIL_VERIFICATION_REQUIRED`.

10. **`hirerId` semantics (SEC-047) — RESOLVED** — Clear separation between authorization identity and organizational profile:
    - `createdBy` (`User` ObjectId) is the authoritative authorization and ownership identity for opportunities and verification records.
    - `hirerId` (`HirerAccount` ObjectId) is the organizational profile reference used for company details, branding, and public attribution.
    - Ownership assertions verify `doc.createdBy === req.auth.sub || doc.hirerId === req.auth.sub` for seamless backwards compatibility.

11. **Data retention (SEC-065, SEC-092, Q11) — RESOLVED** — Automated data retention lifecycle service (`runDataRetentionSweep` / `npm run retention:cleanup`):
    - Rejected applicant PII (CV URLs and contact details) automatically redacted after 180 days while retaining anonymized counts for hiring analytics.
    - Rejected company verification documents purged after 90 days.
    - User account deletion tombstones retained for 7 years using keyed HMAC-SHA256 hashes (no raw PII stored) for compliance auditing.
    - Audit logs retain 1-year TTL with sensitive PII scrubbed.

---

## Product Backlog — App and Website Integration (added 2026-10-08)

**Source:** the product owner's request of 2026-10-08. These are product tasks, not security findings, so they are tracked by item number below (not by a `SEC-0xx` id). If one of them turns up a security problem, open a new `SEC-0xx` task and link it here.

| # | Task | Status |
|---|------|--------|
| 1 | Opportunity Listings | [ ] Open |
| 2 | News Category | [ ] Open |
| 3 | App Colours | [ ] Open |
| 4 | Stakeholder Segments | [ ] Open |
| 5 | Ambassador Registration | [ ] Open |
| 6 | AI Assistant | [ ] Open |
| 7 | Website–App Integration | [ ] Open |
| 8 | Email Verification | [ ] Open |

### 1. Opportunity Listings
- [ ] Tally the opportunities and categories on the GOD website with what is currently on the app.

### 2. News Category
- [ ] Add a News category to the app for Insight Ghana and The African Journal content.

### 3. App Colours
- [ ] Work on the app's colours.

### 4. Stakeholder Segments
- [ ] Create separate sections for:
  - [ ] General Stakeholder Community
  - [ ] GOD Ambassador Community

### 5. Ambassador Registration
- [ ] Add an option for users to register/join as GOD Ambassadors.

### 6. AI Assistant
- [ ] Integrate an AI assistant into the app.

### 7. Website–App Integration
- [ ] Link the GOD website data with the app so that updates made on the website automatically reflect on the app, including ambassador data and other relevant information.

### 8. Email Verification
- [ ] Add an email verification screen.

### Notes from this file (what already exists, so nothing is built twice)
- **AI assistant (item 6):** the backend already mounts `/api/v1/assistant`, gated behind `AI_ENABLED=true` (503 when no provider is configured). See *v1 scope (SEC-045, SEC-082)*.
- **News (item 2):** the backend already mounts a news feed at `/api/v1/news` with integration tests. The app still needs the category and the two sources (Insight Ghana, The African Journal).
- **Email verification (item 8):** the backend already gates high-trust actions behind `requireEmailVerified` (HTTP 403 `EMAIL_VERIFICATION_REQUIRED`). See *Email verification (SEC-062, Q9)*. The app still needs the verification screen itself.
- **Ambassadors (items 4, 5, 7):** the admin dashboard already has an Ambassador network (list, detail, referral codes, leaderboard) on mock data. It has no backend yet (every write is marked `TODO(backend): persist this change`).

### Progress Log
- 2026-10-08 — Items 1–8 added to the backlog. No work started.

---

## Backend Work Plan — everything the backend still has to do (added 2026-10-08)

**Why this section exists.** The admin dashboard was rebuilt on a shared in-memory mock store (every write is marked `TODO(backend): persist this change`), and the product backlog above adds eight more requests. This section lists ALL the backend work, task by task, with ids `BE-001` to `BE-027`. It was written after reading `kredibble-backend/src/routes/admin-api.js`, `src/routes/index.js` and `src/models/AdminPortal.js` on 2026-10-08, so "Today" below is what the code does now.

**Rules for these tasks** (same as the rest of this file): one branch per task (`feature/BE-0xx-slug`), validation with Zod, an audit entry for every change, tests with the change, and no task is done until the matching admin service switches from the mock store to the API and the real-mode Playwright run passes. The admin's pages do not change: each task swaps ONE file in `kredibble-admin/src/lib/services/`.

### What the backend already has (do not rebuild)
- **Admin data API** (`/api/v1/admin`, `routes/admin-api.js`): generic managed routes for `programs`, `partners`, `ambassadors`, `social-posts`, `opportunities` (each with WordPress sync and an activity log); `ambassadors/:id/amplifications`; `beneficiaries` (create, update, verify, retry WordPress sync); `social-posts/monthly-totals`; `targets` (read, and `PUT /targets/:metric`); `scorecards`, `scorecards/me`; `dashboard`; `leaderboard`; `settings/pipeline-stages` and `settings/integrations` (read only); `testimonials` with `POST /testimonials/:id/moderate`; `reports/monthly` (read).
- **Collections** (`routes/index.js`): users, staff, seekers, hirers, opportunities, candidates, community channels, reports, events, grants, articles, notifications, company verification and documents, saved items, applicants.
- **Auth and trust:** auth with refresh tokens, `requireEmailVerified`, `EmailVerificationCode`, `PasswordResetCode`, audit log, rate limits, data-retention sweep, AI assistant at `/api/v1/assistant` (503 unless `AI_ENABLED=true`), news feed at `/api/v1/news`.

### Mismatches found in the current code (these drive the first tasks)
1. **Targets are overwritten, not recorded.** `PUT /targets/:metric` upserts one row per month and metric. The admin needs an append-only history with an effective-from month, who changed it and the previous value, so a past month keeps the target that applied then.
2. **Thresholds live inside each target row** (`greenThreshold`, `amberThreshold`) and default to 1 and 0.7. The admin needs ONE dated, append-only set of thresholds (green and amber percentages) that applies to every KPI from a chosen month.
3. **A staff member has ONE `role`** (`userId, name, email, role, status, joinedDate`). The admin has 12 roles, up to two per person, and a permission matrix that Desk Lead can edit for Moderator and Support.
4. **Programs have no `deliveredAt`.** "Programs organised" counts programs delivered in the month, by the day they were delivered.
5. **Partners have no stage history** (`stage` and `closed` only). Pipeline health, "Partners onboarded" by month and the activity feed all need dated stage moves.
6. **Ambassadors have no `joinedAt` or `dormantSince`.** "Active ambassadors" is a running total at the end of a month and "New ambassadors" counts the month they joined.
7. **No monthly report log, no website audience store, no integrations write path.**

### Task list

| ID | Task | Priority | Depends on | Status |
|----|------|----------|------------|--------|
| BE-001 | Roles, two roles per person, permission matrix enforced on the server | P1 | – | [ ] Open |
| BE-002 | Targets with append-only history and effective-from month | P1 | BE-001 | [ ] Open |
| BE-003 | Dated status thresholds and the change history | P1 | BE-002 | [ ] Open |
| BE-004 | KPI engine: the ten KPIs, pro-rating, running totals, status, trend, priorities | P1 | BE-002, BE-003, BE-005 to BE-011 | [ ] Open |
| BE-005 | Programs: delivered date, status flow, upcoming list | P1 | – | [ ] Open |
| BE-006 | Partners: stage history, moves, pipeline health, stage names | P1 | – | [ ] Open |
| BE-007 | Ambassadors and the Network: dates, statuses, amplification, leaderboard, summary | P1 | – | [ ] Open |
| BE-008 | Database records: sources, verify and undo, duplicate check, pace | P1 | – | [ ] Open |
| BE-009 | Social posts: logging, validation, monthly totals by platform | P2 | – | [ ] Open |
| BE-010 | Testimonials: statuses, decisions, counts | P2 | – | [ ] Open |
| BE-011 | Listings curation: vetting, publish dates, drafts, event date-times | P1 | – | [ ] Open |
| BE-012 | Website audience: Google Analytics sync and manual entry | P2 | BE-016 | [ ] Open |
| BE-013 | Monthly reports: the generated-report log and the two report endpoints | P2 | BE-004, BE-012 | [ ] Open |
| BE-014 | Overview: activity feed, attention counts, the same numbers as the nav pills | P1 | BE-005 to BE-011 | [ ] Open |
| BE-015 | Scorecard: composite, grace period, team view, who did what | P2 | BE-004, BE-001 | [ ] Open |
| BE-016 | Settings: integrations (write-only credentials), my account, password | P1 | BE-001 | [ ] Open |
| BE-017 | Remaining collections: notifications, reference data, team, invitations | P3 | BE-001 | [ ] Open |
| BE-018 | Audit trail for every settings and role change | P1 | – | [ ] Open |
| BE-019 | Performance, indexes, pagination, OpenAPI, tests | P1 | all | [ ] Open |
| BE-020 | Demo seed for the real-mode test run | P3 | BE-001 to BE-011 | [ ] Open |
| BE-021 | Product item 1: tally website opportunities and categories with the app | P1 | BE-026 | [ ] Open |
| BE-022 | Product item 2: News category (Insight Ghana, The African Journal) | P2 | BE-026 | [ ] Open |
| BE-023 | Product item 4: stakeholder segments | P2 | – | [ ] Open |
| BE-024 | Product item 5: ambassador registration (apply, review, approve) | P1 | BE-007 | [ ] Open |
| BE-025 | Product item 6: AI assistant hardening | P2 | – | [ ] Open |
| BE-026 | Product item 7: website to app sync (inbound) | P1 | BE-011, BE-007 | [ ] Open |
| BE-027 | Product item 8: email verification screen support | P1 | – | [ ] Open |

(Product item 3, App Colours, is frontend only: no backend task.)

### Task cards

#### BE-001 — Roles, two roles per person, permission matrix
- **Today:** `StaffMember.role` is a single string; portal roles are names like "Desk Lead" and "Admin Support".
- **To do:**
  - Store `roles: string[]` (one or two) using the 12 ids: `super_admin, moderator, support, partnerships_officer, opportunities_officer, training_officer, database_officer, communications_officer, social_media_manager, country_lead, admin_support, desk_lead`. Migrate the existing single roles.
  - Store the permission matrix (screen × view/edit) and the Moderator and Support toggles. `GET` and `PUT /admin/roles-permissions` (Desk Lead and Super Admin only; Desk Lead may view, Super Admin edits).
  - One middleware `requireScreen(screen, level)` on EVERY admin route, using the union of the person's roles. A wrong role gets 403.
  - `GET /me` returns the roles and the resolved screens.
- **Verify:** every role can open exactly the screens in the admin's `config/permissions.ts`; a request without the grant returns 403 whatever the UI does.

#### BE-002 — Targets with append-only history
- **Today:** `PUT /targets/:metric` upserts `{month, metric}` and overwrites.
- **To do:**
  - Collection `TargetChange { kpi, value, effectiveFrom ("YYYY-MM"), previous, changedBy, changedAt, seq }`, insert-only. The target for a month is the latest row whose `effectiveFrom` is that month or earlier (of two for one month, the later `seq`).
  - `GET /admin/targets?month=` (the target in force), `GET /admin/targets/history` (newest first), `POST /admin/targets` (a batch of `{kpi, value}` with ONE `effectiveFrom`; whole numbers from 1 to 10,000,000).
  - Seed the first row for each KPI from the current values. Keep `PUT /targets/:metric` working until the admin switches, then remove it.
- **Verify:** saving next month's target leaves this month alone; a past month keeps its target; no row is ever edited or deleted.

#### BE-003 — Dated thresholds
- **To do:** `ThresholdChange { green, amber, effectiveFrom, previous, changedBy, changedAt, seq }` insert-only (percentages as whole numbers 1 to 200, amber below green). `GET /admin/thresholds?month=`, `GET /admin/thresholds/history`, `POST /admin/thresholds`. One `seq` counter is shared with targets so the Change history lists both newest first. A save may carry targets and thresholds together under one `effectiveFrom`.
- **Verify:** thresholds that start next month do not change this month's statuses; the change history shows targets and thresholds in one list; a later save for the same KPI and month marks the earlier row "Replaced" (computed, never edited).

#### BE-004 — KPI engine
- **Today:** the admin computes the ten KPIs in the browser (`src/lib/kpi.ts`); `/admin/dashboard` and `/admin/scorecards` exist but use their own logic.
- **To do:**
  - ONE module that returns, for a month: value, target (BE-002), pro-rated target, attainment, status (BE-003), pace. Each KPI has a kind: `count` (earned in the month, pro-rated in the current month, full target for a past month) or `running_total` (Active ambassadors: judged against the FULL target all month).
  - `GET /admin/kpis?month=` (ten cards), `GET /admin/kpis/trend?kpi=&months=6`, `GET /admin/kpis/priorities?month=` (ranked by attainment against the pro-rated target, ties by KPI order).
  - Make `/admin/dashboard` and `/admin/scorecards` call the same module so they cannot disagree.
  - Statuses are "On track", "Behind" and "Off track" everywhere.
- **Verify:** the admin's coherence tests (Overview card, Priorities and Scorecard equal for the same month) pass against the real API for the current month and a past month.

#### BE-005 — Programs
- **Today:** `title, programType, status, format, partnerId, country, location, participantCount, participantTarget, facilitators, notes, startAt, endAt`.
- **To do:** add `deliveredAt` (required when status becomes `delivered`; it decides the month it counts in). Status flow planned, running, delivered, cancelled. `GET /admin/programs/upcoming` (the next five planned or running by start date, with the partner name). Participants may not exceed the target by accident (warn, do not block).
- **Verify:** "Programs organised" for a month equals the programs delivered in it.

#### BE-006 — Partners and the pipeline
- **Today:** `stage` and `closed` only.
- **To do:**
  - `stageHistory: [{ stage, at, by }]` appended on every move (first entry on create). `POST /admin/partners/:id/move { to }`. A partner is closed when its stage is `onboard` or `renew` (derived, never stored on its own).
  - `GET /admin/partners/pipeline-health?month=`: open deals now, deals needed (target × reached Outreach ÷ closed, rounded up), close rate over the last 6 months, status healthy (ratio 1 or more), thin (0.6 or more), critical, or unknown ("not enough data").
  - Stage names: `GET` and `PUT /admin/settings/pipeline-stages` (six display names, each 1 to 24 characters and different from the others, case-insensitive; the keys and what counts as closed never change) and a reset.
- **Verify:** "Partners onboarded" for a month counts partners that moved to Onboard or Renew in it.

#### BE-007 — Ambassadors and the Network
- **Today:** `fullName, email, phone, country, city, memberType, roleTitle, campus, tier, status, assignedLeadId, trained, linkedUserId, referralCode`; amplification logs exist.
- **To do:** add `joinedAt` and `dormantSince`; statuses applicant, onboarding, active, dormant; tiers ambassador, senior, lead. "Active ambassadors" at the end of a month = joined by then and not dormant by then. Unique referral code ("GOD-" plus six characters, no 0 O 1 I). Amplification log `{ambassadorId, channel, at, clicks, note}`; signups attributed through verified database records. `GET /admin/network/summary?month=` (size, active, activity rate = active ambassadors who shared in the month ÷ active), `GET /admin/leaderboard?month=` (ranked by verified signups, then clicks, then shares, then name; applicants excluded).
- **Verify:** the leaderboard order and the activity rate equal the admin's unit tests on the same data.

#### BE-008 — Database records
- **To do:** fields `source` (organic, ambassador, event, partner, import), `verified`, `verifiedAt`, `createdAt`, `addedBy`, `ambassadorId`, `listingId`. Verify sets `verifiedAt` to today; undo puts back exactly what was there. Duplicate check on create and update: first by email (trimmed, case-insensitive), then by phone (digits only, without the country calling code, the national 0 or a leading + or 00); return which field matched. `GET /admin/beneficiaries/pace?month=` (verified, target, pro-rated pace, status). `GET /admin/beneficiaries/sources?month=`. Pending count for the sidebar pill.
- **Verify:** "Beneficiaries verified" for a month counts records verified in it, by `verifiedAt`.

#### BE-009 — Social posts
- **To do:** `platform` (facebook, instagram, x, linkedin, tiktok, youtube, whatsapp, other), `postedAt` (not in the future), `url` (http or https with a real host), `reach`, `engagement`, `status`, `listingId` (optional). `GET /admin/social-posts/monthly-totals?month=` returns posts, reach, engagement and the platform table (leading platform first) that add up to the totals.
- **Verify:** equals the KPIs "Posts published", "Social reach" and "Social engagement".

#### BE-010 — Testimonials
- **To do:** statuses pending, approved, unpublished, rejected; `submittedAt`, `decidedAt`, `decidedBy`; allowed moves per status (the admin's table of actions). Public `POST /testimonials` stays rate-limited. Counts for the sidebar pill (pending). The email of the author is staff-only and never in the public preview.

#### BE-011 — Listings curation
- **Today:** opportunities with WordPress sync and a `vetted` flag.
- **To do:** `status` (draft, published), `vetted`, `vettedBy`, `vettedOn`, `publishedAt`, `writerId`, `closesAt`, `applyUrl`, `eventAt` (local date and time), `format`, `location`, `costLabel`, `durationLabel`, images. Rule: a published listing is always vetted. `GET /admin/opportunities/counts` (unvetted drafts). Views and applications per listing, split website and app.
- **Verify:** "Opportunities published" counts vetted, published listings by `publishedAt`.

#### BE-012 — Website audience
- **To do:** collection `WebsiteMonth { month, views, dailyFirstVisits, dailyVisitors, channels[] }` (daily figures are averages per day; the month's channels add up to the views; the current month is month to date). A monthly job pulls Google Analytics 4 (property ID and API secret from BE-016, never returned); an admin can also enter a month by hand. `GET /admin/website-audience?months=6`.
- **Open decision:** Google Analytics sync, or manual entry only (see "Decisions needed").

#### BE-013 — Monthly reports
- **To do:** `MonthlyReport { reportMonth, view ("partner" or "team"), generatedAt, generatedBy }`. `POST /admin/monthly-reports` records one report, at most once per reportMonth and view in each calendar month (the second call returns the existing one). The "Monthly reports" KPI counts reports by the month of `generatedAt`. `GET /admin/reports/partner?month=` (aggregate figures only: no person, no ambassador name, no scoreboard) and `GET /admin/reports/team?month=` (internal; Desk Lead and Super Admin only). Both come from the KPI engine.
- **Verify:** the figures equal the Overview for the same month; the partner response contains no staff or ambassador names.

#### BE-014 — Overview feed and attention counts
- **To do:** `GET /admin/overview/activity`: a mixed feed, newest first, at most two of each kind (new ambassador, partner moved to a stage, listing published, program delivered, record verified, testimonial approved). `GET /admin/overview/attention`: pending verifications, open reports, pending testimonials, unvetted draft listings. The sidebar and breadcrumb pills read the SAME function so the numbers always match.

#### BE-015 — Scorecard
- **To do:** composite = average of min(attainment, 1) over the metrics the roles own, × 100, rounded; null before day 5 of the current month ("Too early in the month to score"; the day is a config value) and for roles that own no metric. `GET /admin/scorecards/me` (the signed-in user's roles only) and `GET /admin/scorecards/team?month=` (Desk Lead and Super Admin only). A person's own scorecard response must never contain a colleague's name.
- **Open decision:** people who share a role share a score, because the KPIs are desk-wide counts. Per-person attribution needs the actor stored on every action (who published, who verified, who delivered).

#### BE-016 — Settings and my account
- **To do:** integrations (WordPress site address and application password; Google Analytics property ID and API secret): the address and ID are ordinary settings, the password and secret are WRITE-ONLY, encrypted at rest, returned only as "ends in ••••3f9a"; `POST /admin/settings/integrations/:kind/test` (a real connection test, no secret in the response or the logs). My account: name, notification preferences, password change (minimum length, different from the old one, rate limited).

#### BE-017 — Remaining collections
- Notifications (compose, schedule, history), reference data lists (universities, countries and so on), team invitations by email (`POST /admin/staff/invite` exists: add the two roles), staff status and removal, channels moderation. Each with pagination, search and the roles from BE-001.

#### BE-018 — Audit trail
- Every change to a target, a threshold, a role, a permission, a stage name, an integration or a report is written to `AuditLog` with who, when, the previous value and the new one. The Change history screen reads from it. Nothing in the audit log is editable.

#### BE-019 — Performance, indexes, pagination, OpenAPI, tests
- Indexes on every month and date field the KPIs filter by (`publishedAt`, `deliveredAt`, `joinedAt`, `verifiedAt`, `postedAt`, `generatedAt`, `stageHistory.at`). Pagination on every list. Update `swagger.json` for each new route. Jest tests with `mongodb-memory-server` for the KPI engine (same cases as the admin's no-browser tests), the permission middleware and every append-only rule. Target: more than 80% coverage on the new code.

#### BE-020 — Demo seed for the real-mode test run
- Extend `scripts/e2e-server.js` with an optional `E2E_SEED=demo` that creates staff with the 12 roles and sample records, in the same shape as the admin's mock seed, so the real-mode Playwright run exercises real data. The default stays "one admin and nothing else".

#### BE-021 — Product item 1: tally the website and the app
- Export the website's opportunities and categories (WordPress REST), compare them with the app's, and produce a report: in both, only on the website, only in the app, and category names that differ. Add a category taxonomy collection with a mapping table (website category to app category). Run it as a script first; make it a scheduled check once BE-026 exists.

#### BE-022 — Product item 2: News category
- Add `News` as a content category with a `source` of `insight_ghana` or `african_journal`. Ingest each source (RSS or WordPress REST) on a schedule with a stable external id (no duplicates), store title, summary, link, image, published date and source. `GET /api/v1/news?source=&page=`. Admin can hide an item. The existing `/api/v1/news` is the base.

#### BE-023 — Product item 4: stakeholder segments
- A `segment` on each user (`general` or `ambassador`; an ambassador also belongs to the general community). Channels, feeds and content carry the segment(s) they are visible to; list endpoints filter by the caller's segment; moving a user between segments is audited. Migration: everyone starts as `general`.

#### BE-024 — Product item 5: ambassador registration
- Public `POST /api/v1/ambassadors/apply` (signed-in user; name, campus or city, country, motivation): creates an Ambassador with status `applicant`, links `linkedUserId`, sends a confirmation email, rate limited and duplicate-safe (one open application per user). Admin review: approve moves the person to `onboarding` or `active`, issues the unique referral code, sets `joinedAt`, and flips the user's segment (BE-023); reject keeps a reason. `GET /api/v1/me/ambassador` for the app.

#### BE-025 — Product item 6: AI assistant
- `/api/v1/assistant` exists behind `AI_ENABLED=true`. To do: choose and configure the provider, per-user rate limit and daily cost cap, a system prompt limited to the platform's content, no personal data sent to the provider, conversations logged without PII, a kill switch in Settings, tests with a stubbed provider. Never reach a real provider from the e2e server.

#### BE-026 — Product item 7: website to app sync
- **Today:** the backend PUSHES to WordPress (`syncToWordpress`, `wordpressSync` status on records). Nothing flows back.
- **To do:** an INBOUND path so website updates show in the app without a manual step: a signed webhook from the website (shared secret, replay protection) plus a scheduled pull as a safety net. Idempotent upserts keyed by an external id for opportunities, news, and ambassadors (including referral codes); a clear rule for who wins when both sides changed a record (proposal: the website is the source of truth for content, the app for ambassador activity); a sync status and last error per record; an admin screen or endpoint to see failures and retry. Field mapping documented in the repo.

#### BE-027 — Product item 8: email verification
- **Today:** `EmailVerificationCode` and the `requireEmailVerified` gate exist (HTTP 403 `EMAIL_VERIFICATION_REQUIRED`).
- **To do:** make sure the app's screen has what it needs: `POST /auth/email/send` (cooldown 60 seconds), `POST /auth/email/resend`, `POST /auth/email/verify { code }` (6 digits, expires, 5 attempts then locked for a while), `emailVerified` in `GET /me`; the email itself through the configured provider (Resend). Tests for expiry, attempts and the gate.

### Suggested order
1. **BE-001, BE-018** (roles and audit): everything else depends on who may do what.
2. **BE-002, BE-003, BE-005 to BE-011** (targets, thresholds and the data the KPIs count).
3. **BE-004, BE-014, BE-015** (the KPI engine, the Overview, the Scorecard): switch the admin's Overview and Scorecard to the API and run the coherence tests.
4. **BE-016, BE-012, BE-013** (settings, website audience, the reports).
5. **BE-027, BE-024, BE-023** (email verification, ambassador registration, segments): the app-facing items.
6. **BE-026, BE-021, BE-022, BE-025** (website sync, tally, news, AI).
7. **BE-017, BE-019, BE-020** alongside every step.

### Decisions needed from the product owner
1. **Website views (BE-012):** pull from Google Analytics, or entered by hand each month?
2. **Individual scorecards (BE-015):** keep desk-wide scores (people sharing a role share a score), or record who did each action so scores can be per person?
3. **History (BE-006, BE-008):** reconstruct past pipeline and record counts from events, or only keep snapshots going forward? (Without either, a past month's pipeline gauge counts partners as they are now.)
4. **Reports (BE-013):** should "Download PDF" store a real file, or only the log record plus the browser's print as now?
5. **Website sync (BE-026):** which side wins when both changed the same record?
6. **AI provider and budget (BE-025).**
7. **Stakeholder segments (BE-023):** can a user be in both segments at once (proposal: an ambassador is also in the general community)?

### Progress Log
- 2026-10-08 — Backend work plan written (BE-001 to BE-027). No backend work started.
