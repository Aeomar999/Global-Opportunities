# Plan 4b: GOD API on the VPS (Staging First) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the production-grade deployment scaffolding for running the GOD API on a Hostinger VPS behind Cloudflare, deploying to a staging environment first without exposing raw container ports to the public internet.

**Architecture:**
- **Zero Exposed Container Ports:** The API and Redis run inside isolated Docker compose networks. No ports (4000 or 6379) are published to the host interfaces.
- **Edge Reverse Proxy:** Caddy 2.11 runs on the VPS connected to the shared Docker `edge` network, terminating TLS using Cloudflare Origin CA certificates and enforcing Authenticated Origin Pulls (AOP).
- **Client IP & Rate Limiting Preservation:** Caddy trusts Cloudflare proxy IP ranges, extracts `CF-Connecting-IP`, and forwards `X-Forwarded-For`, enabling Express rate limiters (`trust proxy 1`) to accurately track distinct client IPs.
- **Namespaced Environments:** Environments (`staging`, `production`, `development`) use dynamic compose project names `god-${APP_ENV}`, eliminating fixed container name collisions.
- **Safe Automated Deployment & Rollback:** `deploy/bin/god-deploy` pulls the release image, spins up containers, polls `/api/v1/health` for matching `release` and `environment`, and automatically reverts to the previous SHA if unhealthy.
- **Restricted SSH Deployment Gate:** `deploy/bin/god-deploy-gate` serves as an SSH forced-command gate, accepting only whitelisted commands (`deploy`, `rollback`, `status`) and preventing interactive shell or injection vulnerabilities.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `deploy/compose.yml` | Create | Multi-environment Compose project for API + Redis; memory limits; logging; edge network |
| `deploy/env/api.env.example` | Create | Canonical reference environment template for VPS deployments |
| `deploy/bin/god-deploy` | Create | Health-gated zero-downtime deployment script with automatic rollback |
| `deploy/bin/god-deploy-gate` | Create | SSH forced-command parser enforcing restricted deployment operations |
| `deploy/bin/god-deploy-gate.test.mjs` | Create | Automated unit tests for deploy-gate command parsing and injection safety |
| `platform/vps/bootstrap.sh` | Create | Idempotent Ubuntu 24.04 provisioning script (Docker, deploy user, fail2ban, UFW, edge network) |
| `platform/vps/edge/compose.yml` | Create | Edge proxy service definition running Caddy 2 |
| `platform/vps/edge/Caddyfile` | Create | Caddy configuration: Cloudflare Origin CA TLS, Authenticated Origin Pulls, proxy headers, WebSockets |
| `docs/infrastructure/VPS.md` | Create | Infrastructure documentation for VPS setup, operations, deployment, and troubleshooting |
| `docker-compose.prod.yml` | Delete | Obsolete insecure compose file (published HTTP port 4000, blank env vars, collision hazards) |
| `kredibble-backend/scripts/db-dump.sh` | Delete | Obsolete unencrypted database script (superseded in Plan 4e) |
| `kredibble-backend/scripts/db-restore.sh` | Delete | Obsolete unencrypted database script (superseded in Plan 4e) |
| `package.json` | Modify | Add `test:deploy` script to run deploy gate unit tests |
| `task.md` | Modify | Update SEC-112 status and progress logs |
| `PLAN-4-infrastructure-roadmap.md` | Modify | Update Plan 4b status |

---

## Implementation Tasks

### Task 1: Scaffolding `deploy/compose.yml` and `deploy/env/api.env.example`
- [x] **Step 1: Create `deploy/compose.yml`**
- [x] **Step 2: Create `deploy/env/api.env.example`**
- [x] **Step 3: Validate Compose syntax and structure**

### Task 2: Deployment and Gate Scripts
- [x] **Step 1: Write unit tests in `deploy/bin/god-deploy-gate.test.mjs`**
- [x] **Step 2: Create `deploy/bin/god-deploy-gate`**
- [x] **Step 3: Verify gate tests pass (`node --test deploy/bin/god-deploy-gate.test.mjs`)**
- [x] **Step 4: Create `deploy/bin/god-deploy`**
- [x] **Step 5: Verify executable permissions and LF line endings**

### Task 3: Edge Reverse Proxy Configuration (Caddy & AOP)
- [x] **Step 1: Create `platform/vps/edge/compose.yml`**
- [x] **Step 2: Create `platform/vps/edge/Caddyfile`**
- [x] **Step 3: Validate Caddyfile syntax and Cloudflare proxy headers**

### Task 4: VPS Provisioning Script (`platform/vps/bootstrap.sh`)
- [x] **Step 1: Create `platform/vps/bootstrap.sh`**
- [x] **Step 2: Verify idempotency, security hardening flags, and LF line endings**

### Task 5: Operations Documentation (`docs/infrastructure/VPS.md`)
- [x] **Step 1: Create `docs/infrastructure/VPS.md`**

### Task 6: Decommission Obsolete Files
- [x] **Step 1: Remove `docker-compose.prod.yml`**
- [x] **Step 2: Remove `kredibble-backend/scripts/db-dump.sh` and `db-restore.sh`**

### Task 7: Repo Hygiene, Testing, System Design Lesson & Records
- [x] **Step 1: Add `test:deploy` script to root `package.json`**
- [x] **Step 2: Run repo encoding check (`npm run check:encoding`)**
- [x] **Step 3: Run all unit & integration tests**
- [x] **Step 4: Append lesson to `SYSTEM_DESIGN_LESSONS.md`**
- [x] **Step 5: Update `task.md` and `PLAN-4-infrastructure-roadmap.md`**
- [x] **Step 6: Commit and push feature branch**
