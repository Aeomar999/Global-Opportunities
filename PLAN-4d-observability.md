# PLAN-4d — Observability & Error Tracking (SEC-090, SEC-095)

**Status:** ✅ Done  
**Branch:** `security/SEC-090-observability`  
**Dependencies:** Plan 4a (CI guardrails & release identity), Plan 4b (VPS deployment), Plan 4c (build-once promotion pipeline).  
**Covers:** SEC-090 (error tracking & uptime monitoring), SEC-095 (structured request logging).

---

## 1. Context & Objectives

During the 2026-10-02 audit, SEC-090 noted:
> *None of the apps has Sentry, Datadog or similar. Failures like SEC-042 are only visible to users.*

PR #30 attempted to mark SEC-090 as Done, but only added broken VPS deploy scaffolding without installing or configuring any error tracker or uptime monitoring. This plan implements the true scope of SEC-090 and SEC-095:

1. **Backend Error Tracking:**
   - Instrument `@sentry/node` via `node --import ./src/instrument.js`.
   - Configure Sentry in `src/lib/error-tracking.js` with `environment = env.appEnv`, `release = env.release`, and `sendDefaultPii = false`.
   - Implement `beforeSend` sanitization: strip cookies, `Authorization` headers, sensitive tokens/passwords, and request bodies.
   - Tag all reported errors with `requestId` (from `auditContext` / `X-Request-Id`).
   - Sentry express error handler installed before application 5xx handler. Client 5xx responses remain generic in production (SEC-064) while Sentry captures stack traces and breadcrumbs.

2. **Structured Request Logging (SEC-095):**
   - Replace `morgan` with `pino-http` in `src/app.js`.
   - Emit single-line structured JSON logs with:
     - `service: 'kredibble-backend'`
     - `environment: env.appEnv`
     - `release: env.release`
     - `requestId: req.id`
   - Redact sensitive query parameters, headers (`authorization`, `cookie`), and passwords.
   - Retain rate-limited deprecation warning for legacy `/api` routes (SEC-095).

3. **Admin Error Tracking:**
   - Instrument `@sentry/nextjs` in `kredibble-admin`.
   - Configure `tunnelRoute: "/monitoring-tunnel"` in `next.config.ts` so CSP `connect-src 'self'` remains strictly intact without external CDN domains.
   - Redact user PII, cookies, and tokens before event submission.

4. **Mobile Error Tracking:**
   - Configure `@sentry/react-native` in `kredibble-app` with Expo config plugin in `app.json`.
   - Set environment from EAS channel (`development`, `staging`, `production`) and release from app version + build number.
   - Strip authorization tokens and PII before capture.

5. **Vector Log & Metrics Shipping (VPS):**
   - Provide `platform/vps/vector/vector.yaml` to ingest Docker container logs (`god-*-api`) and host metrics.
   - Parse JSON logs, enrich with metadata, and forward to Better Stack Logtail / HTTP sink with backpressure and local disk buffer.

6. **Uptime & Heartbeat Monitoring:**
   - Provide monitoring runbook in `docs/infrastructure/MONITORING.md`.
   - Better Stack uptime checks for `/api/v1/health` (asserting `status == "ok"` and environment), admin sign-in, SSL/domain expiry, and heartbeats for backup and restore drills.

---

## 2. Implementation Tasks

- [x] **Task 1: Backend Error Tracking (`src/instrument.js` & `src/lib/error-tracking.js`)**
  - Implement Sentry initialization in `src/instrument.js` and `src/lib/error-tracking.js`.
  - Wire Sentry `beforeSend` filter redacting cookies, auth headers, and sensitive fields.
  - Export `captureException`, `captureMessage`, and `withScope` helpers with request ID tagging.
- [x] **Task 2: Structured Access Logging with `pino-http` (`src/app.js`)**
  - Replace morgan with `pino-http`.
  - Ensure every request log outputs `service`, `environment`, `release`, and `requestId`.
  - Redact sensitive headers (`authorization`, `cookie`, `set-cookie`).
- [x] **Task 3: Backend Error Handler & Server Startup Wiring**
  - Wire Sentry error handler in `src/app.js`.
  - Update `package.json` scripts (`start`, `dev`, `e2e:server`) and `Dockerfile` to include `--import ./src/instrument.js`.
- [x] **Task 4: Admin Sentry Integration (`kredibble-admin`)**
  - Install `@sentry/nextjs` and configure Sentry config files.
  - Set `tunnelRoute: "/monitoring-tunnel"` in `next.config.ts`.
  - Verify CSP compliance with `'self'`.
- [x] **Task 5: Mobile Sentry Integration (`kredibble-app`)**
  - Add `@sentry/react-native` plugin to `app.json`.
  - Add Sentry client initialization in app entry point.
- [x] **Task 6: Vector Log Shipping Configuration (`platform/vps/vector/vector.yaml`)**
  - Create Vector configuration collecting Docker container logs and host metrics.
  - Configure JSON log parsing and Better Stack sink.
- [x] **Task 7: Monitoring & Alerting Documentation (`docs/infrastructure/MONITORING.md`)**
  - Create runbook for Better Stack uptime checks, alert routing (P0/P1/P2), and on-call escalation.
- [x] **Task 8: Test Suite, Verification & System Design Lesson**
  - Create Jest unit tests for backend error tracking and logging sanitization.
  - Verify repo encoding with `npm run check:encoding`.
  - Update `SYSTEM_DESIGN_LESSONS.md`, `PLAN-4-infrastructure-roadmap.md`, and `task.md`.

---

## 3. Acceptance Criteria

- [x] A forced 500 error in staging or production reports to Sentry tagged with `requestId`.
- [x] The `beforeSend` filter strips cookies, `authorization` headers, and request bodies from Sentry events (verified by automated tests).
- [x] Production request logs emit structured JSON with `service`, `environment`, `release`, and `requestId`.
- [x] Admin CSP `connect-src 'self'` is not widened; Sentry events tunnel through `/monitoring-tunnel`.
- [x] All tests pass and repository encoding check reports 0 failing files.
