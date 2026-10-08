# PLAN-4e — Backups and Disaster Recovery (SEC-089)

**Status:** ✅ Done  
**Branch:** `security/SEC-089-backups-dr`  
**Dependencies:** Plan 4a (CI guardrails), Plan 4b (VPS deployment & filesystem conventions), Plan 4c (build-once promotion).  
**Covers:** SEC-089 (Automated encrypted off-site database backups, verified restore drills, RPO 24 h, RTO 4 h, and comprehensive disaster recovery procedures).

---

## 1. Context & Objectives

During the infrastructure review, SEC-089 highlighted:
> *No automated off-site database backups exist. Database relies solely on host/provider snapshots, without tested restore procedures or disaster recovery playbook for catastrophic failure.*

In addition, the initial PR #30 committed a preliminary `DISASTER_RECOVERY.md` that was outdated, referenced deleted scripts (`db-dump.sh`), lacked asymmetric encryption, and did not address the 7 infrastructure recovery questions.

This plan delivers production-grade backup automation and verifiable disaster recovery:

1. **Automated Asymmetric Encrypted Backups (`deploy/bin/god-backup`):**
   - Dump MongoDB using `mongodump --archive --gzip` with credentials passed via a mounted `--config` file (never via command-line arguments to prevent `ps aux` credential leakage).
   - Asymmetrically encrypt dump streams using `age -r <public-key>`. The VPS holds only the public encryption key; a compromised VPS host cannot decrypt historical backups.
   - Upload encrypted archives to Cloudflare R2 bucket (`s3://god-db-backups/daily/`).
   - On the 1st of each calendar month, archive an additional copy to `s3://god-db-backups/monthly/` with indefinite retention.
   - On successful upload, ping Better Stack backup heartbeat.
   - Provide `--dry-run` and environment configuration for testing.

2. **Safe-by-Default Restoration Tool (`deploy/bin/god-restore`):**
   - Refuse to overwrite an active production database by default.
   - Requires explicit `--i-understand-this-overwrites-production` CLI flag to target production clusters.
   - Restores into an isolated database or service container by default.
   - Decrypts archives with `age -d -i <private-key-file>`.
   - Streams decrypted data directly into `mongorestore --archive --gzip --drop`.

3. **Systemd Service & Timer (`platform/vps/systemd/`):**
   - Provide `god-backup-production.service` and `god-backup-production.timer`.
   - Schedule execution nightly at 02:00 UTC with randomized delay (jitter).
   - Run under restricted system user with `ProtectSystem=strict`, `NoNewPrivileges=true`, and private temporary directories.

4. **Automated Monthly Restore Drill (`.github/workflows/restore-drill.yml`):**
   - Scheduled monthly (`0 4 1 * *`) and triggerable via `workflow_dispatch`.
   - Spins up a clean `mongo:7` service container.
   - Fetches the latest backup using read-only R2 credentials.
   - Decrypts using `BACKUP_AGE_SECRET_KEY` from GitHub Environment `backup-drill`.
   - Restores data and runs `kredibble-backend/scripts/verify-restore.js`.
   - Measures and outputs actual RTO (Recovery Time Objective).
   - Pings Better Stack drill heartbeat on verified success.

5. **Data Integrity & Schema Verification (`kredibble-backend/scripts/verify-restore.js`):**
   - Validates that core collections exist (`users`, `opportunities`, `seekers`, `hirers`, `auditlogs`).
   - Asserts non-zero document counts in primary tables.
   - Verifies record freshness (newest record `createdAt` or `updatedAt` within expected window).
   - Emits structured JSON summary and exits with non-zero code on integrity faults.

6. **Comprehensive Disaster Recovery Runbook (`docs/infrastructure/DISASTER_RECOVERY.md`):**
   - Replaces and removes root draft `DISASTER_RECOVERY.md`.
   - Answers the 7 required recovery questions across all 6 core assets:
     1. MongoDB Atlas database
     2. Cloudinary media assets
     3. WordPress on Hostinger
     4. Configuration & secrets (GitHub Environments & Password Manager)
     5. VPS host infrastructure (`platform/vps/bootstrap.sh` & `god-deploy`)
     6. Code & documentation (GitHub)
   - Defines RPO (24 h) and RTO (4 h) with recovery escalations.

---

## 2. Implementation Checklist

- [x] **Task 1: Backup Script (`deploy/bin/god-backup`)**
  - Implement POSIX shell script with `set -euo pipefail`.
  - Credentials via `--config` file / environment; credentials never in argv.
  - Asymmetric encryption via `age`.
  - Upload to Cloudflare R2 / S3-compatible storage.
  - Monthly archive branching on day 1.
  - Heartbeat ping on completion.
- [x] **Task 2: Restore Script (`deploy/bin/god-restore`)**
  - Implement safe-by-default restore utility.
  - Guard production destination behind `--i-understand-this-overwrites-production`.
  - Support decryption and streaming directly into `mongorestore`.
- [x] **Task 3: Systemd Automation (`platform/vps/systemd/`)**
  - Create `god-backup-production.service` with security hardening.
  - Create `god-backup-production.timer` with calendar scheduling.
- [x] **Task 4: Restore Verification Script (`kredibble-backend/scripts/verify-restore.js`)**
  - Implement automated collection, count, and freshness checks.
  - Add test suite in `kredibble-backend/tests/verify-restore.test.js`.
- [x] **Task 5: GitHub Actions Monthly Drill (`.github/workflows/restore-drill.yml`)**
  - Configure scheduled and on-demand workflow with `mongo:7` service container.
  - Execute restore and verification, recording duration/RTO.
- [x] **Task 6: Disaster Recovery Documentation (`docs/infrastructure/DISASTER_RECOVERY.md`)**
  - Author complete DR playbook answering 7 questions for all 6 assets.
  - Remove root draft `DISASTER_RECOVERY.md`.
- [x] **Task 7: System Design Lesson in `SYSTEM_DESIGN_LESSONS.md`**
  - Record architectural decisions around asymmetric encryption, safe restore defaults, and automated drills.
- [x] **Task 8: Verification & CI**
  - Run `npm run check:encoding`, linting, and tests.
  - Push branch, open PR, verify CI green, and merge.
