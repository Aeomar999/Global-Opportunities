# AGENTS.md — Kredibble Security & Architecture Hardening

This file configures the opencode agent pipeline for the Kredibble monorepo. It defines the specialist skills, phases, and guardrails for systematically closing every security and architecture gap identified in the audit.

---

## Project Context

**Monorepo Structure:**
```
Global-Opportunities/
├── kredibble-backend/   # Express + Mongoose + Socket.io (port 4000)
├── kredibble-app/       # Expo 57 + React Native + NativeWind (mobile)
├── kredibble-admin/     # Next.js 16 + React 19 + Tailwind v4 (admin dashboard)
```

**Tech Stack:**
- Backend: Node 20+, Express 4.19, Mongoose 9, JWT (jsonwebtoken), bcryptjs, Zod, Helmet, express-rate-limit, Socket.io, Cloudinary, Swagger
- Mobile: Expo Router 57, React 19, NativeWind v4, expo-secure-store, socket.io-client
- Admin: Next.js 16 App Router, React 19, Tailwind v4, localStorage auth

---

## Baseline: Verified Working — Do Not Regress

Audited and confirmed functional. Every task in `task.md` must leave these intact. If a change breaks one, that is a regression, not a trade-off.

| Area | Status | Notes |
|------|--------|-------|
| Auth flow | ✅ Works | Register / login / me, bcrypt cost 12, role-based access, tokenVersion revocation |
| Validation | ✅ Works | Zod schemas on all auth routes, shared `validate` middleware |
| Rate limiting | ✅ Works | Auth 20 req/15 min; global API 100 req/15 min; Redis store supported |
| Security headers | ✅ Works | Helmet.js enabled |
| CORS | ✅ Works | Strict allowlist with no wildcard tenant domains (SEC-022) |
| Database | ✅ Works | Mongoose 9 models with indexes, virtuals, proper refs, and transactions |
| Real-time | ✅ Works | Handshake JWT auth, tokenVersion check, room pinning, active eviction (SEC-004, SEC-098) |
| File upload | ✅ Works | Multer memory → Cloudinary, 5 MB cap, MIME & magic bytes validated, rate limited (SEC-013) |
| API design | ✅ Works | RESTful `collectionRoutes` factory, nested relational routes, /api/v1 versioned |
| Health check | ✅ Works | `/api/health` and `/api/v1/health` with DB connection status |
| Admin auth | ✅ Works | Separate ADMIN_JWT_SECRET, httpOnly session & refresh cookies, no signup bypass (SEC-005, SEC-040) |
| Mobile token storage | ✅ Works | `expo-secure-store` used for access and refresh tokens; automatic 401 refresh recovery |

**Rules for agents working in this repo:**
- Never replace `expo-secure-store` with `AsyncStorage` in the mobile app — it is already the correct primitive.
- Never lower the bcrypt cost below 12.
- Never remove the `validate` middleware from a route to "fix" a failing request — fix the schema or the client.
- Never widen CORS, rate limits, or upload caps to make something work.

---

## API Auth Baseline

Verified authorization state per endpoint enforced by live route manifest testing:

| Endpoint | Auth | Roles | Notes |
|----------|------|-------|-------|
| `POST /api/v1/auth/register` | Rate limited | Public | Rejects `admin` role at schema and model layers (SEC-001) |
| `POST /api/v1/auth/login` | Rate limited | Public | Lockout persistence (SEC-025, SEC-050), timing-safe (SEC-051) |
| `GET /api/v1/auth/me` | ✅ Bearer | all | Returns caller profile with PII protection |
| `GET /api/v1/health` | Public | — | Public liveness & database status check |
| `GET /api/v1/dashboard/summary` | ✅ Admin | admin | Platform totals & pending moderation queues (SEC-003, SEC-046) |
| `CRUD /api/v1/users` | ✅ Admin | admin | Admin-only access; non-admin requests receive 403 (SEC-054) |
| `CRUD /api/v1/seekers` | ✅ Bearer | seeker, hirer, admin | Scoped by role policy and ownerField ownership (SEC-002) |
| `CRUD /api/v1/hirers` | ✅ Bearer | hirer, admin | Scoped by role policy and ownerField ownership (SEC-002) |
| `CRUD /api/v1/opportunities` | ✅ / Scoped | all / hirer / admin | Reads scoped to approved listings; writes owner/admin scoped (SEC-002, SEC-048) |
| `POST /api/v1/upload` | ✅ Bearer / Admin | all | Cloudinary with magic byte & MIME validation, server-derived folder (SEC-013) |
| `WS /socket.io` | ✅ Handshake | all | Handshake JWT verified with tokenVersion; room pinned; evictions on logout (SEC-004, SEC-098) |

---

## Deployment Baseline

| Surface | Location | Status |
|---------|----------|--------|
| Docker config | `Dockerfile`, `docker-compose.yml`, `render.yaml` | Present — containerised backend with Redis & MongoDB |
| Render config | `render.yaml` | Production API deployment with health check and declared secrets |
| Env files | `kredibble-backend/.env`, `kredibble-app/.env.example` | Gitignored and untracked — secrets configured via deployment variables |
| Admin proxy | `kredibble-admin/next.config.ts` | Same-origin rewrite `/api` proxying to `API_PROXY_TARGET` for SameSite=Strict cookies |
| Token secrets | `JWT_SECRET`, `ADMIN_JWT_SECRET` | Distinct secrets required at boot in production (SEC-006, SEC-040) |

---

## Specialist Skills to Activate

Run these skills in sequence for each phase. Each skill produces artifacts that feed the next.

| Phase | Skill | Purpose | Output |
|-------|-------|---------|--------|
| 0 | `vibe-coding` | Initialize project pipeline, create MD stack | `PRD.md`, `CONTEXT.md`, `ARCHITECTURE.md` |
| 1 | `prism` | Write detailed PRD for security hardening | `PRD-security-hardening.md` |
| 2 | `kill-critic` | Adversarial review of current auth/architecture | `CRITIQUE-security.md` |
| 3 | `revival-engine` | Convert critique into fix plan with sequencing | `FIX-PLAN-security.md` |
| 4 | `vega` | Lock design tokens for auth/error UI states | `DESIGN-TOKENS.md` |
| 5 | `architecture-map` | Map backend coupling, identify risk hotspots | `ARCHITECTURE-HEATMAP.md` |
| 6 | `rate-guard` | Implement production-grade rate limiting | Hardened middleware |
| 7 | `input-validator` | Universal input validation guard | Zod schemas + sanitization |
| 8 | `security-audit` | Full security review + pen-test checklist | `SECURITY-AUDIT-REPORT.md` |
| 9 | `slop-detector` | Clean AI-generated code patterns | Cleaned codebase |
| 10 | `velocity` | Performance audit (N+1, bundle, DB indexes) | `PERFORMANCE-REPORT.md` |
| 11 | `test-master` | Generate missing test suite | Unit/integration/E2E tests |
| 12 | `impeccable` | Polish auth/error UI, loading states | Production-ready UI |

---

## Agent Invocation Rules

1. **Never run skills in parallel** — each phase depends on the previous phase's output
2. **Always read the skill's SKILL.md first** — use `skill` tool to load instructions
3. **Write artifacts to repo root** — `Global-Opportunities/*.md` for cross-project docs
4. **Commit after each phase** — use descriptive messages: `phase-3: revival-engine fix plan`
5. **Run lint/typecheck after each code change** — `npm run lint && npm run typecheck` in each app
6. **Always update `task.md` after every implementation** — tick checkboxes, update status table, add Progress Log entry
7. **Always push to GitHub after committing** — `git push` immediately after each `git commit` so the remote reflects the latest state

---

## Guardrails

- **No direct commits to `main`** — all work on feature branches: `security/phase-{n}-{skill}`
- **No secrets in code** — use `.env.local` (gitignored) for local; CI injects production secrets
- **Text files are UTF-8** — never write repo files with Windows PowerShell 5.1: `>`, `Out-File` and `Set-Content` produce UTF-16 or ANSI (SEC-110). Use the editor tools, Git Bash or Node. `npm run check:encoding` at the repo root must report 0 failing files; CI enforces it.
- **No `console.log` in production code** — use structured logger (Pino/Winston)
- **No `any` types** — strict TypeScript across all apps
- **No unguarded routes** — every route must declare `auth: 'public' | 'user' | 'admin'`
- **Do not re-open the dismissed findings** — `task.md` § *Verified Non-Issues* records two audit items (JSON body size limit, production stack traces) that were investigated and closed. Do not "fix" them.
- **Map every audit claim to a `SEC-*` id** — if a new issue appears, add a finding row before writing a fix. The crosswalk in `task.md` maps the original report numbering to tracked ids.

---

## Environment Variables (Required)

### Backend (`kredibble-backend/.env`)
```bash
NODE_ENV=production
PORT=4000
CORS_ORIGIN=https://kredibble.app,https://admin.kredibble.app
DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/kredibble
JWT_SECRET=<64-char-base64>          # Generate: openssl rand -base64 48
ADMIN_JWT_SECRET=<64-char-base64>    # Separate secret for admin tokens
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
```

### Mobile (`kredibble-app/.env`)
```bash
EXPO_PUBLIC_API_URL=https://api.kredibble.app
```

### Admin (`kredibble-admin/.env`)
```bash
NEXT_PUBLIC_API_URL=https://api.kredibble.app
```

---

## CI/CD Pipeline (GitHub Actions)

The workflows in `.github/workflows/` are the source of truth; this is a summary. All jobs use Node from `.nvmrc` (24) and install each app with `npm ci` from **its own** `package-lock.json` — there are no npm workspaces (Docker, Vercel and EAS all build each app from its own directory).

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `ci.yml` | PR to `main`, push to `main` | **Backend:** `lint`, `test` (Jest + mongodb-memory-server). **Backend image:** Docker build. **Admin:** `lint`, `typecheck`, `next build`. **Admin E2E:** Playwright against the real API (`npm run e2e:server`, in-memory Mongo with a seeded admin) and the admin dev server. **App:** `lint`, `typecheck`, `test`, Metro bundle export. **Hygiene:** text files are UTF-8, actionlint (with shellcheck on `run:` blocks), shellcheck on `*.sh`, gitleaks on the working tree. |
| `cd-backend.yml` | push to `main` touching `kredibble-backend/` | Re-verifies, pushes `ghcr.io/aeomar999/global-opportunities/kredibble-backend:{latest,sha}`, calls `RENDER_DEPLOY_HOOK_URL` if set. |
| `cd-admin.yml` | push to `main` touching `kredibble-admin/` | Re-verifies, then `vercel pull/build/deploy --prebuilt --prod`. Skips with a notice until `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` are set. |
| `cd-app.yml` | push to `main` touching `kredibble-app/` | Re-verifies, then `eas update --channel production` with `EXPO_PUBLIC_API_URL` from `eas.json`. Skips without `EXPO_TOKEN`. |

Rules for changing CI:
- Never mask a failing step (`|| true`, `|| echo`) — fix the cause.
- Every job keeps a `timeout-minutes`; a hung test must fail fast, not burn six hours.
- Run the same commands locally before pushing: `npm run lint && npm run typecheck && npm test` in the app you touched (`npm run test:e2e` in `kredibble-admin` starts both servers itself).

**Deployment topology:** the API runs on Render (`kredibble-api.onrender.com`, Docker, long-running so Socket.io works). The admin runs on Vercel (`kredibble-admin` project) and reaches the API through a same-origin proxy (`NEXT_PUBLIC_API_URL=/api`, `API_PROXY_TARGET=https://kredibble-api.onrender.com/api`) because the admin session cookie is `SameSite=Strict`; the admin origin must be listed in the API's `CORS_ORIGIN`. The mobile app gets OTA updates through EAS Update (`runtimeVersion` policy `appVersion`).

---

## Pre-Launch Checklist (Run Before Every Release)

- [ ] All 13 phases (0–12) complete with artifacts committed
- [ ] `security-audit` skill reports zero CRITICAL/HIGH findings
- [ ] `velocity` skill reports no N+1 queries, bundle < 250KB gzipped (admin), < 50MB (mobile)
- [ ] `test-master` skill reports >80% coverage on auth, payments, PII endpoints
- [ ] `rate-guard` verified on all auth/payment/AI endpoints
- [ ] `input-validator` verified on all public endpoints
- [ ] Penetration test passed (OWASP Top 10)
- [ ] Load test: 1000 concurrent users, p99 < 500ms
- [ ] GDPR/CCPA data deletion endpoint tested
- [ ] Incident response runbook documented
- [ ] Dependency audit: `npm audit` zero HIGH/CRITICAL
- [ ] SBOM generated and stored

---

## Rollback Procedure

If any phase introduces regressions:
1. `git revert <commit-sha>` for that phase
2. Re-run `test-master` suite
3. Re-run `security-audit` on reverted code
4. Document lesson in `POSTMORTEM-<phase>.md`

---

## 📚 System Design Learning Journal

This project participates in Jerry's system design learning program.

**The learning journal lives at:**
```
C:\Users\Jerry\Desktop\PROJECT 2026\SYSTEM_DESIGN_LESSONS.md
```

Whenever you make — or help make — a decision that illustrates a system design concept, you MUST:

1. **Append a lesson entry** to `SYSTEM_DESIGN_LESSONS.md` under `## Lessons Learned Per Project`.
2. **Update the concepts table** at the bottom of that file if you introduce a concept not yet listed.
3. Follow the exact format in the `<!-- AGENT INSTRUCTIONS -->` comment block inside that file.

**What counts as a lesson-worthy decision:**
- Choosing SQL vs. NoSQL and why
- Adding a cache layer
- Using a background job/queue instead of inline processing
- Picking JWT vs. sessions for auth
- Structuring an API (REST vs. webhook vs. WebSocket)
- Deciding to split or keep a service together
- Handling failure/retry scenarios
- Adding rate limiting or scaling decisions

**Tone:** Plain English. No jargon without a definition. Write as if Jerry is reading with fresh eyes.
