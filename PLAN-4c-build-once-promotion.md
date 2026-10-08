# PLAN-4c: Build-Once Promotion Pipeline

This document is the execution plan for **Plan 4c** of [PLAN-4-infrastructure-roadmap.md](PLAN-4-infrastructure-roadmap.md). It establishes an immutable build-once promotion pipeline across backend, admin, and mobile services, enforces automated database migrations with expand/contract rules, implements end-to-end deployment smoke testing, and configures environment approval gates.

---

## 1. Context & Architectural Decisions

- **Build Once, Promote Many (D2):** Docker container images are built exactly once per commit SHA, tagged with `:<sha>`, and pushed to GHCR. Staging and production deploy the identical image artifact digest.
- **Health-Gated SSH Deployment (D6):** GitHub Actions communicates with the VPS via OpenSSH executing restricted commands through `deploy/bin/god-deploy-gate`.
- **Zero-Downtime Expand/Contract Migrations:** Schema changes must never break running instances of older API versions or mobile app clients currently in circulation. Migrations run before container switching and are tracked in MongoDB.
- **Automated Smoke Testing:** Following container deployment, automated smoke tests verify liveness, release SHA identification, public read endpoints, and cross-origin preflights.
- **Single-Level Hostnames (SEC-111):** Staging and dev environments use single-level hostnames (`staging-api.globalopportunitydesk.com`, `dev-api.globalopportunitydesk.com`) to remain within Cloudflare Universal SSL wildcard coverage.
- **Mobile Native Platform Scoping (SEC-118):** EAS Updates publish exclusively to iOS and Android native platforms, bypassing unneeded web bundle generation that causes NativeWind cache issues.

---

## 2. Implementation Tasks

- [x] **Task 1: Smoke Test Runner & Tests**
  - [x] Implement `scripts/smoke.mjs <baseUrl> <sha> [env]` verifying health, release SHA, public endpoint read, and CORS preflight.
  - [x] Implement unit test suite `scripts/smoke.test.mjs` with mock server scenarios (passing, SHA mismatch, HTTP error, CORS error).
  - [x] Add `"test:smoke"` and `"smoke"` scripts to root `package.json`.

- [x] **Task 2: Database Migration Harness & Tests**
  - [x] Implement `kredibble-backend/scripts/migrate.js` to run ordered, idempotent migrations recorded in a `_migrations` collection.
  - [x] Create initial idempotent migration `kredibble-backend/migrations/001_ensure_indexes.js`.
  - [x] Implement test suite `kredibble-backend/tests/migrate.test.js` validating that migrations execute once and skip safely on re-runs.
  - [x] Add `"db:migrate"` script to `kredibble-backend/package.json`.

- [x] **Task 3: Wire Migrations into VPS Deployment Controller**
  - [x] Update `deploy/bin/god-deploy` to run `node scripts/migrate.js` inside the target container/image before switching containers.
  - [x] Add migration dry-run support to `god-deploy`.
  - [x] Ensure any migration failure aborts the deployment prior to container switching.

- [x] **Task 4: Rewrite Backend CD Workflow (`.github/workflows/cd-backend.yml`)**
  - [x] Build Docker image once with `RELEASE_SHA=${{ github.sha }}` and tag with `latest` and long/short SHA.
  - [x] Automatically deploy to staging via SSH executing `god-deploy deploy staging <sha>`.
  - [x] Execute `scripts/smoke.mjs https://staging-api.globalopportunitydesk.com <sha> staging`.
  - [x] Add `deploy-production` job with GitHub Environment `production` (approval gate).
  - [x] Add `workflow_dispatch` input allowing manual deployment or rollback to any specified SHA.

- [x] **Task 5: Rewrite Admin CD Workflow (`.github/workflows/cd-admin.yml`)**
  - [x] Deploy to Vercel custom environment `staging` automatically on merge to `main`.
  - [x] Require manual approval via GitHub Environment `Production` before deploying to Vercel production.
  - [x] Preserve same-origin `/api` proxying with correct `API_PROXY_TARGET`.

- [x] **Task 6: Rewrite Mobile App CD (`.github/workflows/cd-app.yml`) & EAS Configuration**
  - [x] Update `kredibble-app/eas.json` with single-level hostnames (`staging-api.globalopportunitydesk.com`, `dev-api.globalopportunitydesk.com`).
  - [x] Update `kredibble-app/app.json` with `"platforms": ["ios", "android"]` resolving SEC-118 web bundle conflict.
  - [x] Automatically publish EAS update to `staging` channel on merge to `main`.
  - [x] Gate production EAS update to `production` channel behind GitHub Environment `Production` approval.

- [x] **Task 7: Deployment Documentation (`docs/infrastructure/DEPLOYMENT.md`)**
  - [x] Document build-once promotion architecture, rollback procedure, migration guidelines, and environment promotion sequence.

- [x] **Task 8: Repo Hygiene, System Design Lesson & Tracking Updates**
  - [x] Run `npm run check:encoding`, test suites, and linters.
  - [x] Append lesson to `C:\Users\Jerry\Desktop\PROJECT 2026\SYSTEM_DESIGN_LESSONS.md`.
  - [x] Update `task.md` (SEC-115, SEC-118, SEC-112).
  - [x] Update `PLAN-4-infrastructure-roadmap.md`.
