# PLAN-4f — Cutover from Render, Domain Migration and Decommission

**Status:** 🟡 In Execution (Live Cutover Ready)  
**Branch:** `infra/track-m-live-cutover-and-plan-4f`  
**Dependencies:** Plan 4b (VPS deployment & edge proxy), Plan 4c (promotion pipeline), Plan 4d (observability), Plan 4e (backups & DR), Track M (Cloudflare, Atlas, Vercel, Expo consoles).  
**Covers:** SEC-111 (Production mobile & API DNS alignment), SEC-091 (Transactional mail domain), SEC-094 (Infrastructure documentation update), SEC-114 (Personal to company ownership), SEC-117 (Atlas test account purging).

---

## 1. Context & Objectives

In the initial architecture:
- The backend API ran on Render free/starter (`kredibble-api.onrender.com`), with dynamically generated JWT secrets (`generateValue: true`) that rotated on container redeployment or restart if not synced.
- The admin dashboard ran on Vercel under personal scope (`jerry-amoahs-projects`) proxying to Render.
- The mobile app pointed at Render for production, but was at risk of pointing to unresolvable domains (`SEC-111`).
- The corporate WordPress site and business email for `globalopportunitydesk.com` ran on Hostinger nameservers (`ns1.dns-parking.com` / `ns2.dns-parking.com`).

**Plan 4f executes the live transition to the company infrastructure platform with zero user downtime:**
1. Pre-stage all DNS records in Cloudflare so WordPress web traffic and Titan email routing are 100% unaffected.
2. Replicate Render's `JWT_SECRET` and `ADMIN_JWT_SECRET` into the VPS production environment (`/opt/god/production/api.env`), ensuring that all existing mobile app users and admin sessions remain authenticated.
3. Migrate the production API hostname `api.globalopportunitydesk.com` to the Hostinger VPS behind Cloudflare Full (strict) TLS and Authenticated Origin Pulls (AOP).
4. Update the Vercel production proxy `API_PROXY_TARGET` to point to `https://api.globalopportunitydesk.com/api`.
5. Release a production EAS OTA update repointing the mobile client to `https://api.globalopportunitydesk.com/api/v1`.
6. Enforce a 4-week dual-run window for legacy mobile installations before decommissioning Render.

---

## 2. Decision Matrix & Topology Mapping

| Decision | Policy Enforced | Implementation |
|---|---|---|
| **D1: Domain & Hostnames** | `globalopportunitydesk.com` single-level subdomains | `api.`, `staging-api.`, `dev-api.`, `admin.`, `staging-admin.` covered by Cloudflare Universal SSL. |
| **D2: Promotion Flow** | Build once, promote SHA | Same image SHA promoted from staging to production after manual gate. |
| **D3: Secrets Management** | GitHub Environments & Password Manager | Root secrets in 1Password/Bitwarden; injected via `API_ENV_FILE` with mode `0600`. |
| **D5: Edge & TLS** | Full (strict) + Authenticated Origin Pulls | Caddy on VPS verifies Cloudflare client certificate (`origin_pull_ca.pem`); host firewall allows 80/443 only. |
| **D7: Database Isolation** | MongoDB Atlas separate projects | `god-production` and `god-staging` on Atlas; VPS IP whitelisted; test accounts pruned (SEC-117). |
| **Session Continuity** | Preserve JWT signing keys | Exact `JWT_SECRET` and `ADMIN_JWT_SECRET` strings copied from Render to VPS production `api.env`. |

---

## 3. Step-by-Step Execution Plan

### Task 1: Pre-Stage Cloudflare DNS & Nameserver Delegation (Track M3)
- Generate RFC 1035 / BIND format zone export: `docs/infrastructure/CLOUDFLARE_ZONE_RECORDS.bind`.
- Import zone into Cloudflare dashboard.
- Verify active WordPress `A` (`147.79.116.134`, `77.37.50.148`) and `www` `CNAME`.
- Verify Titan Email `MX` (`mx1.titan.email`, `mx2.titan.email`) and `TXT` (SPF `v=spf1 include:spf.titan.email ~all`, DKIM `titan1._domainkey`).
- Switch nameservers at Hostinger registrar to Cloudflare assigned servers.
- Turn on Cloudflare Authenticated Origin Pulls (AOP) and generate 15-year Origin CA certificate.

### Task 2: Hostinger VPS Edge Proxy & Staging Verification (Track M4, Plan 4b)
- Run `platform/vps/bootstrap.sh` on Ubuntu 24.04 LTS host.
- Install Origin CA certificate and private key at `/etc/ssl/cloudflare/origin.{crt,key}`.
- Deploy edge Caddy container (`platform/vps/edge/compose.yml`).
- Deploy staging API at current release SHA using `god-deploy staging <SHA>`.
- Run smoke test: `node scripts/smoke.mjs https://staging-api.globalopportunitydesk.com <SHA> staging`.

### Task 3: Production Secret Extraction & Deployment (Plan 4f)
- Copy `JWT_SECRET` and `ADMIN_JWT_SECRET` from Render dashboard to `/opt/god/production/api.env`.
- Deploy production API on VPS using `god-deploy production <SHA>`.
- Verify local container health: `docker exec god-production-api node -e "fetch('http://127.0.0.1:4000/api/v1/health').then(r => r.json()).then(console.log)"`.
- Point Cloudflare DNS record `api.globalopportunitydesk.com` to VPS IPv4 (Proxied: ON).
- Run production smoke test: `node scripts/smoke.mjs https://api.globalopportunitydesk.com <SHA> production`.

### Task 4: Admin Dashboard & Mobile Client Repoint
- Update Vercel production environment variable `API_PROXY_TARGET=https://api.globalopportunitydesk.com/api` and redeploy.
- Verify admin login and session persistence at `https://admin.globalopportunitydesk.com`.
- Update `kredibble-app/eas.json` production profile to `https://api.globalopportunitydesk.com/api/v1`.
- Publish production EAS OTA update: `eas update --channel production --message "Cutover to api.globalopportunitydesk.com"`.
- Verify installed mobile app refreshes token successfully and loads opportunities.

### Task 5: 4-Week Dual-Run & Render Decommissioning
- Keep Render `kredibble-api` active on the same commit SHA for 28 days to support mobile clients with delayed OTA update downloads.
- Monitor traffic volume on Render dashboard until request count drops below 1 req/hour.
- Suspend Render service for 48 hours; if no errors or regressions are reported, permanently delete Render service.
- Remove `render.yaml` and decommission Render deploy step in `.github/workflows/cd-backend.yml`.
- Remove legacy origins from CORS allowlist in `api.env`.

---

## 4. Verification & Testing Evidence

```bash
# 1. DNS Resolution Verification
nslookup -type=NS globalopportunitydesk.com 8.8.8.8
nslookup -type=MX globalopportunitydesk.com 8.8.8.8
nslookup api.globalopportunitydesk.com 8.8.8.8

# 2. Production API Health Check
curl -s https://api.globalopportunitydesk.com/api/v1/health | jq .
# Expected output:
# {
#   "status": "ok",
#   "environment": "production",
#   "release": "<RELEASE_SHA>",
#   "database": "connected"
# }

# 3. Direct Origin Request Blocked (Authenticated Origin Pulls)
curl -k -I https://<VPS_IP>/api/v1/health
# Expected: TLS handshake failure / 400 Bad Request (No client certificate)

# 4. Deployment Smoke Suite
node scripts/smoke.mjs https://api.globalopportunitydesk.com <RELEASE_SHA> production
```
