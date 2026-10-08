# Disaster Recovery Runbook & Playbook (SEC-089)

**Global Opportunity Desk (GOD) / Kredibble Platform**  
**Document Classification:** Confidential — Internal Operational Runbook  
**Last Verified:** October 2026  
**RTO Objective:** 4 Hours  
**RPO Objective:** 24 Hours  

---

## 1. Executive Summary & Recovery Objectives

This document establishes the official Disaster Recovery (DR) procedures for the Global Opportunity Desk application platform in accordance with the Company IT Application Infrastructure Plan (Phase 5). 

A disaster is defined as an event causing catastrophic loss or prolonged unavailability of platform services, including:
- Total loss of the primary host (Hostinger VPS termination or hardware failure)
- Database corruption or inadvertent bulk deletion across MongoDB Atlas clusters
- Loss or compromise of third-party SaaS providers (Cloudinary, Cloudflare, GitHub, Vercel)
- Compromise of server credentials or root signing certificates

### Platform Targets
- **Recovery Point Objective (RPO):** Maximum 24 hours of data loss (nightly automated encrypted backups).
- **Recovery Time Objective (RTO):** Maximum 4 hours to return the platform to full operational service from cold failure.

---

## 2. The Seven Recovery Questions Across All Platform Assets

| Asset | 1. What is Backed Up | 2. Frequency | 3. Retention Period | 4. Where Stored | 5. Who Can Restore | 6. Recovery Procedure | 7. Expected Recovery Time |
|---|---|---|---|---|---|---|---|
| **MongoDB Database** | All collections (`users`, `opportunities`, `seekers`, `hirers`, `auditlogs`, indexes, etc.) | Nightly at 02:00 UTC + automated monthly archive | 35 daily snapshots, 12 monthly archives | Cloudflare R2 bucket (`god-db-backups`) encrypted via `age` (public key on VPS, private key in password manager) + Atlas managed snapshots | DevOps Engineer, DBA, IT Administrator | Section 3.1 below (`deploy/bin/god-restore`) | RTO: 30–60 min<br>RPO: < 24 h |
| **Cloudinary Media** | Profile pictures, identity documents, CVs, company banners | Continuous (managed multi-region SaaS storage) | Indefinite until GDPR erasure | Multi-cloud Cloudinary storage across AWS/GCP regions | DevOps Engineer | Re-bind credentials or replay user re-uploads | RTO: 15 min<br>RPO: 0 h |
| **WordPress Marketing Site** | MySQL database, wp-content uploads, themes, core files | Weekly automated + before core updates | 30 days rolling on Hostinger | Hostinger cloud backup snapshots + off-site tarball in R2 | IT Administrator, Webmaster | Section 3.3 below | RTO: 60 min<br>RPO: < 7 days |
| **Configuration & Secrets** | Production `api.env` files, JWT secrets, third-party API keys | On modification (persisted in GitHub Environments & Password Manager) | Indefinite version history in GitHub Environment audit log | Company Password Manager (Bitwarden/1Password) + GitHub Environment `production` | IT Administrator, Lead Engineer | Section 3.4 below | RTO: 10 min<br>RPO: 0 h |
| **VPS Host Infrastructure** | Ubuntu 24.04 OS, Docker, Caddy edge proxy, systemd units | Version-controlled as code in `platform/vps/` | Git commit history | GitHub repository (`Aeomar999/Global-Opportunities`) | DevOps Engineer, IT Administrator | Section 3.2 below (`platform/vps/bootstrap.sh`) | RTO: 30–45 min<br>RPO: 0 h |
| **Code & Documentation** | Git repository history, runbooks, schemas, tests | Continuous on every push to `main` | Indefinite git history | GitHub + local clones of active maintainers | DevOps Engineer, Backend Lead | Restore from local git clone or push to new remote | RTO: 15 min<br>RPO: 0 h |

---

## 3. Step-by-Step Restoration Runbooks

### 3.1 MongoDB Database Disaster Recovery

#### Scenario A: Restore from Encrypted Off-Site Backup (Cloudflare R2)

When MongoDB Atlas cluster or data is corrupted, use the asymmetric encrypted archive stored in Cloudflare R2:

1. **Retrieve the `age` Identity Key:**
   Fetch the private decryption key (`AGE-SECRET-KEY-1...`) from the Company Password Manager (stored under `Infra/GOD/Backups/Age_Private_Key`).
   Save it to a secure, temporary file on the recovery machine:
   ```bash
   install -m 600 /dev/null /tmp/god-age-identity.txt
   echo "AGE-SECRET-KEY-1..." > /tmp/god-age-identity.txt
   ```

2. **Locate the Latest Backup in Cloudflare R2:**
   ```bash
   aws s3 ls s3://god-db-backups/daily/ --endpoint-url "$R2_ENDPOINT_URL" | sort | tail -n 1
   ```

3. **Restore into Target Database:**
   > [!WARNING]
   > Direct restoration to production requires the explicit safety flag `--i-understand-this-overwrites-production`.
   
   To restore into a fresh recovery cluster or isolated staging environment:
   ```bash
   deploy/bin/god-restore \
     --archive "s3://god-db-backups/daily/god-production-YYYYMMDDTHHMMSSZ.archive.gz.age" \
     --identity /tmp/god-age-identity.txt \
     --target-uri "mongodb+srv://admin:pass@recovery-cluster.mongodb.net/kredibble"
   ```

   To overwrite a corrupted production cluster:
   ```bash
   deploy/bin/god-restore \
     --archive "s3://god-db-backups/daily/god-production-YYYYMMDDTHHMMSSZ.archive.gz.age" \
     --identity /tmp/god-age-identity.txt \
     --target-uri "mongodb+srv://admin:pass@production-cluster.mongodb.net/kredibble" \
     --i-understand-this-overwrites-production
   ```

4. **Verify Restored Database Integrity:**
   Run the automated restore verification script to validate collections, document counts, and record timestamps:
   ```bash
   node kredibble-backend/scripts/verify-restore.js \
     --uri "mongodb+srv://admin:pass@production-cluster.mongodb.net/kredibble" \
     --max-age-hours 26 \
     --min-users 1 \
     --min-opportunities 1
   ```

5. **Clean Up Identity Key:**
   ```bash
   rm -f /tmp/god-age-identity.txt
   ```

#### Scenario B: Restore from MongoDB Atlas Point-In-Time Snapshot
1. Log into the MongoDB Atlas Console.
2. Select the `god-production` cluster -> **Backup** tab.
3. Select the desired restore snapshot -> Click **Restore**.
4. Choose **Restore to a New Cluster** (recommended to verify before repointing DNS).
5. Once complete, copy the connection string and update `DATABASE_URL` in the GitHub Environment `production`.

---

### 3.2 Total VPS Loss & Rebuild Procedure

When the Hostinger VPS is destroyed or irrecoverable:

1. **Order or Re-provision Ubuntu 24.04 VPS on Hostinger:**
   - Hostinger Console -> Deploy VPS (KVM 2: 2 vCPU, 8 GB RAM, Ubuntu 24.04).
   - Set VPS hostname to `vps.globalopportunitydesk.com`.
   - Record the new public IPv4 address (`$NEW_VPS_IP`).

2. **Bootstrap VPS with Baseline Infrastructure:**
   Log into the new VPS as `root`:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/Aeomar999/Global-Opportunities/main/platform/vps/bootstrap.sh | bash
   ```
   This automatically provisions:
   - Docker CE & compose plugin
   - Security hardening: SSH key-only access, fail2ban, unattended security upgrades
   - Restricted `deploy` system user
   - Edge reverse proxy Docker network (`edge`)
   - Directory hierarchy under `/opt/god/`

3. **Install Edge TLS Certificates:**
   Copy Cloudflare Origin CA certificate and private key:
   ```bash
   scp origin.crt root@$NEW_VPS_IP:/etc/ssl/cloudflare/origin.crt
   scp origin.key root@$NEW_VPS_IP:/etc/ssl/cloudflare/origin.key
   ssh root@$NEW_VPS_IP "chmod 600 /etc/ssl/cloudflare/origin.key"
   ```

4. **Install Deployment Scripts & Compose Configuration:**
   ```bash
   git clone https://github.com/Aeomar999/Global-Opportunities.git /tmp/god-repo
   cp /tmp/god-repo/deploy/bin/god-* /opt/god/bin/
   chmod 755 /opt/god/bin/god-*
   cp /tmp/god-repo/deploy/compose.yml /opt/god/deploy/compose.yml
   cp -r /tmp/god-repo/platform/vps/edge /opt/platform/
   cp /tmp/god-repo/platform/vps/systemd/god-backup-production.* /etc/systemd/system/
   systemctl daemon-reload && systemctl enable --now god-backup-production.timer
   rm -rf /tmp/god-repo
   ```

5. **Launch Edge Reverse Proxy (Caddy):**
   ```bash
   docker compose -f /opt/platform/edge/compose.yml up -d
   ```

6. **Deploy Production API Container:**
   Retrieve `API_ENV_FILE` from the Password Manager / GitHub Environment `production` and save to `/opt/god/production/api.env` (chmod 600, owner `deploy`).
   Deploy the latest release:
   ```bash
   su - deploy -c "/opt/god/bin/god-deploy deploy production <LATEST_RELEASE_SHA>"
   ```

7. **Update Cloudflare DNS:**
   In Cloudflare DNS management, update the `A` record for:
   - `api.globalopportunitydesk.com` -> `$NEW_VPS_IP`
   - `staging-api.globalopportunitydesk.com` -> `$NEW_VPS_IP`
   Ensure proxy status is set to **Proxied (Orange Cloud)**.

---

### 3.3 WordPress Marketing Site Recovery
1. Log into Hostinger Control Panel (hPanel).
2. Navigate to **Websites** -> `globalopportunitydesk.com` -> **Backups**.
3. Select the latest clean snapshot and choose **Restore files and database**.
4. Test website accessibility via browser and verify backend job sync connectivity.

---

### 3.4 Configuration and Secrets Recovery
1. If GitHub repository secrets are lost, open the Company Password Manager.
2. Locate folder `Infra / Environments / Production`.
3. Copy the canonical environment block and paste into GitHub Environment `production` as `API_ENV_FILE`.
4. Re-run deployment workflow from GitHub Actions.

---

## 4. Disaster Recovery Testing & Verification

### 4.1 Automated Monthly Restore Drill
- Runs automatically on the 1st of every month via GitHub Actions (`.github/workflows/restore-drill.yml`).
- Decrypts the latest daily backup from Cloudflare R2 into an isolated ephemeral `mongo:7` container.
- Executes `verify-restore.js` testing schema integrity, collection non-emptiness, and timestamp freshness (< 26 h).
- Pings Better Stack Heartbeat on completion. If a monthly drill does not succeed, an on-call alert is raised automatically.

### 4.2 Annual Cold-Site Simulation
- Once per calendar year, the DevOps lead provisions a disposable VPS in an alternative cloud region (e.g., Hetzner or DigitalOcean).
- Executes the full recovery playbook from cold start using only passwords and keys stored in the company password manager.
- Verifies that RTO is under 4 hours and documents lessons learned.
