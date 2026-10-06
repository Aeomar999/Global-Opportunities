# Global Opportunity Desk (GOD) Deployment Guide

This document details the deployment architecture, promotion pipeline, rollback procedures, and database migration rules for the Global Opportunity Desk ecosystem (Backend API, Admin Dashboard, and Mobile App).

---

## 1. Core Principles

### Build Once, Promote Many (D2)
- Container images and build bundles are created **exactly once per git commit SHA** during CI/CD.
- Staging and production deploy the **identical image artifact digest** (`ghcr.io/aeomar999/global-opportunities/kredibble-backend:<sha>`).
- We never rebuild from source for production; we promote the artifact that already succeeded in staging and passed all smoke tests.

### Health-Gated Zero Downtime (SEC-112, D6)
- Container deployments use Docker Compose project namespaces (`god-staging`, `god-production`).
- The VPS deploy controller (`deploy/bin/god-deploy`) polls `/api/v1/health` for up to 60 seconds after launching containers.
- If the container fails to report healthy status with matching `release` SHA and `environment`, `god-deploy` immediately reverts to the previous recorded release (`previous_release`) and exits with code 1.

### Expand/Contract Database Evolution
- **Never perform destructive database schema changes in a single release.**
- Old API versions and older mobile app builds in user devices run concurrently against the database alongside new versions.
- Schema changes must strictly follow the **Expand/Contract** pattern described in Section 4.

---

## 2. Release & Promotion Pipeline

```text
┌────────────────┐     ┌──────────────────────────────────────────────────────────────┐
│  PR to `main`  │ ──▶ │ CI: Backend Tests · Admin Tests & E2E · App Tests · Hygiene │
└────────────────┘     └──────────────────────────────────────────────────────────────┘
                                      │
                               (Merge to main)
                                      ▼
                       ┌──────────────────────────────┐
                       │   Build Docker Image :<sha>  │
                       │   Push to GitHub GHCR        │
                       └──────────────────────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │      Deploy to Staging       │
                       │   SSH: god-deploy staging    │
                       └──────────────────────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │     Automated Smoke Test     │
                       │   node scripts/smoke.mjs     │
                       └──────────────────────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │  GitHub Environment Approval │
                       │    (Production Reviewers)    │
                       └──────────────────────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │     Deploy to Production     │
                       │  SSH: god-deploy production  │
                       └──────────────────────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │     Production Smoke Test    │
                       │   node scripts/smoke.mjs     │
                       └──────────────────────────────┘
```

---

## 3. Deployment Controller (`deploy/bin/god-deploy`)

The VPS deploy controller is triggered remotely via SSH forced command (`deploy/bin/god-deploy-gate`).

### Operations:
```bash
# Deploy a specific commit SHA to an environment
god-deploy deploy staging <sha>
god-deploy deploy production <sha>

# Rollback to the previously active commit SHA
god-deploy rollback staging
god-deploy rollback production

# Check current and previous releases and running containers
god-deploy status staging
god-deploy status production
```

### Execution Sequence on Deploy:
1. Validates presence of target environment configuration (`/opt/god/<env>/api.env`).
2. Pulls target Docker image from GHCR: `${API_IMAGE}:${TARGET_SHA}`.
3. Executes pending database migrations via one-off container:
   ```bash
   docker compose -f deploy/compose.yml --project-name god-<env> run --rm --no-deps api node scripts/migrate.js
   ```
   *If migrations fail, the deployment halts immediately before touching running containers.*
4. Starts new containers with zero-downtime rolling replacement:
   ```bash
   docker compose -f deploy/compose.yml --project-name god-<env> up -d --remove-orphans
   ```
5. Polls `/api/v1/health` every 3 seconds for 60 seconds verifying:
   - HTTP 200 response
   - `body.status` in `['ok', 'degraded']`
   - `body.release === TARGET_SHA`
   - `body.environment === TARGET_ENV`
6. On success: records `previous_release` and `current_release` in `/opt/god/<env>/`.
7. On failure: dumps container logs and automatically re-deploys `previous_release`.

---

## 4. Database Migrations & The Expand/Contract Pattern

Database migrations live in `kredibble-backend/migrations/` and are managed by `kredibble-backend/scripts/migrate.js`.

### Why Expand/Contract is Mandatory
In mobile ecosystems and distributed web services:
- Mobile app updates (EAS Update or App Store) are installed asynchronously by users over days or weeks.
- The new API version, old API version, and multiple mobile client versions run side-by-side against MongoDB.
- Dropping a field, renaming a field, or adding a required field with no default immediately crashes active clients.

### Three-Phase Migration Lifecycle:

#### Phase 1: Expand
- Add new collections, optional fields, or indexes non-destructively.
- Any new field must be optional in validation schemas (or have a default value).
- Example: Adding `emailNormalized` while keeping `email` functional.

#### Phase 2: Transition (Dual-Write / Dual-Read)
- Backend code writes to both old and new fields, but reads preferentially from new fields with fallbacks.
- Background backfill scripts populate legacy records with the new field structure.
- Both old mobile versions and new mobile versions function seamlessly.

#### Phase 3: Contract (Prune)
- Executed only after telemetry confirms all mobile clients and API instances are upgraded past the minimum supported version.
- Remove deprecated fields and legacy read paths.
- Drop obsolete indexes.

### Writing a Migration File
Each migration file exports an `id`, an `up(db, mongoose)` function, and an optional `down(db, mongoose)` function:

```javascript
// kredibble-backend/migrations/002_add_user_preferences.js
export const id = '002_add_user_preferences';

export async function up(db, _mongoose) {
  // Idempotent operations only
  await db.collection('users').updateMany(
    { preferences: { $exists: false } },
    { $set: { preferences: { notificationsEnabled: true } } }
  );
  await db.collection('users').createIndex({ 'preferences.notificationsEnabled': 1 });
  return { success: true };
}

export async function down(_db, _mongoose) {
  return { success: true };
}
```

### Tracking:
Applied migrations are recorded in the `_migrations` collection with execution duration, timestamp, batch number, and SHA256 content checksum. Re-running `node scripts/migrate.js` is completely idempotent and skips previously executed files.

---

## 5. Automated Smoke Testing (`scripts/smoke.mjs`)

Following every container deployment, the CI/CD pipeline runs `scripts/smoke.mjs`:
```bash
node scripts/smoke.mjs <baseUrl> <expectedSha> [expectedEnv]
```

### Verified Checks:
1. **Liveness & Integrity:** `GET <baseUrl>/api/v1/health` returns HTTP 200 with status `ok` or `degraded`, database connected, environment matching target, and release matching commit SHA.
2. **Public Data Endpoint:** `GET <baseUrl>/api/v1/opportunities?limit=1` returns HTTP 200 confirming routing, database query layer, and serialization operate for unauthenticated traffic.
3. **CORS Preflight:** `OPTIONS <baseUrl>/api/v1/auth/me` with `Origin` and `Access-Control-Request-Method: GET` returns 200/204 with `Access-Control-Allow-Origin` matching the allowed admin origin.

---

## 6. Rollback Procedures (< 5 Minutes)

When an issue occurs in production, three rollback options are available in order of preference:

### Method 1: GitHub Actions Workflow Dispatch (Recommended)
1. Go to **Actions** → **CD Backend**.
2. Click **Run workflow**.
3. In **Commit SHA to deploy or rollback to**, enter the previous known-good commit SHA (e.g. `ba9c64e`).
4. In **Target environment**, select `production`.
5. Click **Run workflow**.
6. The pipeline pulls the existing immutable image `:<sha>` and deploys it in under 2 minutes.

### Method 2: Emergency VPS CLI Rollback
If GitHub Actions is unavailable:
```bash
ssh deploy@<vps-ip> "rollback production"
```
The controller immediately pulls the release stored in `/opt/god/production/previous_release`, deploys containers, and validates health.

### Method 3: Mobile OTA Rollback
If a regression affects the mobile application:
```bash
cd kredibble-app
eas update:rollback --channel production
```
Or publish an update from the previous known-good commit.

---

## 7. Environment Topology & Hostnames

| Environment | API Hostname | Admin Hostname | Mobile API URL |
|---|---|---|---|
| **Production** | `https://api.globalopportunitydesk.com` | `https://admin.globalopportunitydesk.com` | `https://kredibble-api.onrender.com/api` (Render until Plan 4f) |
| **Staging** | `https://staging-api.globalopportunitydesk.com` | `https://staging.admin.globalopportunitydesk.com` | `https://staging-api.globalopportunitydesk.com/api` |
| **Development** | `https://dev-api.globalopportunitydesk.com` | `http://localhost:3000` | `https://dev-api.globalopportunitydesk.com/api` |

*Note: All staging and development hostnames use single-level subdomains (`staging-api.*`, not `staging.api.*`) to remain within Cloudflare Universal SSL wildcard certificate boundaries (SEC-111).*
