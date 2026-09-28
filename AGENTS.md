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
| Auth flow | ✅ Works | Register / login / me, bcrypt cost 12, role-based access |
| Validation | ✅ Works | Zod schemas on all auth routes, shared `validate` middleware |
| Rate limiting | ✅ Works | Auth 20 req/15 min; global API 100 req/15 min |
| Security headers | ✅ Works | Helmet.js enabled |
| CORS | ⚠️ Partial | Dynamic allowlist works, but tenant wildcards over-broad (SEC-022) |
| Database | ✅ Works | Mongoose models with indexes, virtuals, proper refs |
| Real-time | ⚠️ Partial | Socket.io rooms function, but transport is unauthenticated (SEC-004) |
| File upload | ⚠️ Partial | Multer memory → Cloudinary, 5 MB cap, auth required; MIME unvalidated (SEC-013) |
| API design | ✅ Works | RESTful `collectionRoutes` factory, nested relational routes |
| Health check | ✅ Works | `/api/health` with DB connection status |
| Admin auth | ⚠️ Partial | Role check on login works, but `signupAdmin` bypass exists (SEC-005) |
| Mobile token storage | ✅ Works | `expo-secure-store` is correct for mobile; keep it |

**Rules for agents working in this repo:**
- Never replace `expo-secure-store` with `AsyncStorage` in the mobile app — it is already the correct primitive. (Only the *admin web* app has the localStorage problem, SEC-010.)
- Never lower the bcrypt cost below 12.
- Never remove the `validate` middleware from a route to "fix" a failing request — fix the schema or the client.
- Never widen CORS, rate limits, or upload caps to make something work.

---

## API Auth Baseline

Current authorization state per endpoint. `❌` = currently unguarded (tracked in `task.md`). This table is the contract the SEC-002 route-manifest test must eventually enforce.

| Endpoint | Auth | Roles | Notes |
|----------|------|-------|-------|
| `POST /api/auth/register` | ❌ | — | Allows `admin` role (SEC-001) |
| `POST /api/auth/login` | ❌ | — | Rate limited — correct, login is public |
| `GET /api/auth/me` | ✅ | all | Returns profile |
| `GET /api/health` | ❌ | — | Public by design |
| `GET /api/dashboard/summary` | ❌ | — | Leaks platform counts (SEC-003) |
| `CRUD /api/users` | ❌ | — | Full anonymous access (SEC-002) |
| `CRUD /api/seekers` | ❌ | — | Anonymous (SEC-002) |
| `CRUD /api/hirers` | ❌ | — | Anonymous (SEC-002) |
| `CRUD /api/opportunities` | ❌ | — | Anonymous (SEC-002) |
| `POST /api/upload` | ✅ | all | Cloudinary — auth is correctly present |
| `WS /socket.io` | ❌ | — | No auth, `cors: "*"` (SEC-004) |

---

## Deployment Baseline

| Surface | Location | Status |
|---------|----------|--------|
| Vercel config | `kredibble-backend/vercel.json` (tracked); `.vercel/` (root) | Present — `.vercel/` **is** correctly gitignored (`git check-ignore` confirms) |
| Docker Compose | `docker-compose.yml` (root) | Present — use for local MongoDB |
| Render | allowed in CORS | Present — wildcard `*.onrender.com` is over-broad (SEC-022) |
| Env files | `kredibble-backend/.env`, `.env.production` | Verified **ignored** and untracked — nothing to rotate |
| Env file leak | `kredibble-app/.env` | **Tracked and committed** (SEC-020) — value is non-secret, but the file should not be tracked |

**Verified during the audit (do not re-litigate):**
- `.vercel/`, `kredibble-backend/.env`, and `kredibble-backend/.env.production` are all correctly gitignored and untracked. There is no committed credential to rotate.
- `kredibble-app/.env` is the one tracked env file. `EXPO_PUBLIC_*` values are inlined into the client bundle by design and are **not** secrets — never put a real credential behind that prefix.
- The test-credential seed script is gitignored and its accounts are `@test.com` fixtures.

**Deploy-target consequences:**
- If the backend runs on a serverless/ephemeral platform, the in-memory rate-limit counters in SEC-024 are per-instance and will not hold. Move to a shared store before relying on them.
- The `ADMIN_JWT_SECRET` required below does not exist yet. Until SEC-006 and SEC-040 land, admin and user tokens share one signing key.

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

```yaml
# .github/workflows/ci.yml
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm', cache-dependency-path: 'kredibble-backend/package-lock.json' }
      - run: cd kredibble-backend && npm ci
      - run: cd kredibble-backend && npm run lint
      - run: cd kredibble-backend && npm run typecheck || true
      - run: cd kredibble-backend && npm test -- --coverage
  mobile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm', cache-dependency-path: 'kredibble-app/package-lock.json' }
      - run: cd kredibble-app && npm ci
      - run: cd kredibble-app && npm run lint
      - run: cd kredibble-app && npx tsc --noEmit
  admin:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm', cache-dependency-path: 'kredibble-admin/package-lock.json' }
      - run: cd kredibble-admin && npm ci
      - run: cd kredibble-admin && npm run lint
      - run: cd kredibble-admin && npm run build
```

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