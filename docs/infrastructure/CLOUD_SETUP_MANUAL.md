# Cloud Infrastructure Setup Manual & Variable Configuration Guide

**Project:** Global Opportunity Desk (GOD) / Kredibble  
**Document:** `docs/infrastructure/CLOUD_SETUP_MANUAL.md`  
**Audience:** IT Administrator, DevOps Engineer, Backend Engineer  
**Scope:** Complete provisioning guide for all cloud providers and retrieval instructions for every environment variable across Backend, Admin, and Mobile.

---

## 1. System Architecture & Traffic Flow

The following topology connects external providers to our single-level subdomain architecture under `globalopportunitydesk.com`:

```mermaid
flowchart TD
    subgraph Clients["Clients"]
        Mobile["Mobile App (Expo)"]
        WebAdmin["Admin Dashboard (Next.js on Vercel)"]
        PublicUser["Public Web (WordPress on Hostinger)"]
    end

    subgraph Edge["Cloudflare (Company Zone: globalopportunitydesk.com)"]
        CF_DNS["Cloudflare DNS & Proxy (Full strict TLS)"]
        CF_AOP["Authenticated Origin Pulls (AOP)"]
        CF_R2["Cloudflare R2 (god-db-backups)"]
    end

    subgraph VPS["Hostinger VPS (Ubuntu 24.04 LTS)"]
        Caddy["Caddy 2 Edge Reverse Proxy (:443/:80)"]
        subgraph DockerNet["Internal Docker Network: edge"]
            API_Prod["god-production-api (:4000)"]
            Redis_Prod["god-production-redis (:6379)"]
            API_Stg["god-staging-api (:4000)"]
            Redis_Stg["god-staging-redis (:6379)"]
        end
        BackupCron["Systemd Timer: god-backup (mongodump -> age -> R2)"]
    end

    subgraph DataCloud["Managed Cloud Services"]
        Atlas["MongoDB Atlas (god-production & god-staging)"]
        Cloudinary["Cloudinary (Media Assets)"]
        Resend["Resend (Transactional Email)"]
        Sentry["Sentry (Error Tracking)"]
        AI["OpenAI / Anthropic (Assistant)"]
    end

    PublicUser -->|globalopportunitydesk.com| CF_DNS
    WebAdmin -->|admin.globalopportunitydesk.com| CF_DNS
    Mobile -->|api.globalopportunitydesk.com/api/v1| CF_DNS

    CF_DNS -->|Strict Origin Pull| Caddy
    Caddy --> API_Prod
    Caddy --> API_Stg

    API_Prod --> Redis_Prod
    API_Prod --> Atlas
    API_Prod --> Cloudinary
    API_Prod --> Resend
    API_Prod --> AI
    API_Prod --> Sentry

    BackupCron -->|Nightly Dump| Atlas
    BackupCron -->|Encrypted Upload| CF_R2
```

---

## 2. Cloud Providers: Step-by-Step Setup

Follow providers in this exact sequence to ensure zero disruption to live domains and business email.

---

### Provider 1: Hostinger (VPS & Registrar)

#### Step 1.1: Provision Hostinger VPS
1. Log in to [Hostinger hPanel](https://hpanel.hostinger.com).
2. Navigate to **VPS** -> **Create VPS / Add Plan**.
3. Select **KVM 2** (or higher: 2 vCPU, 8 GB RAM, Ubuntu 24.04 64-bit).
4. Choose the primary server location nearest to core users (e.g., France, UK, or US).
5. Set the root password and store it in your company password manager.
6. Note the **Public IPv4 Address** of the VPS (e.g. `194.164.X.X`).

#### Step 1.2: Bootstrap VPS OS & Security
1. SSH into the server as root:
   ```bash
   ssh root@<VPS_IP>
   ```
2. Download and run the repository bootstrap script:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/Aeomar999/Global-Opportunities/main/platform/vps/bootstrap.sh -o /tmp/bootstrap.sh
   bash /tmp/bootstrap.sh
   ```
   *This creates the `deploy` user, configures UFW firewall (only ports 22, 80, 443 open), installs Docker Engine, creates the internal `edge` network, and downloads Cloudflare's Authenticated Origin Pull CA.*

#### Step 1.3: Retrieve WordPress Sync Keys
1. In Hostinger hPanel -> **Websites** -> `globalopportunitydesk.com` -> **WordPress Overview**.
2. If WordPress sync is enabled, retrieve the application password / API token from WP Admin:
   - Go to `https://globalopportunitydesk.com/wp-admin` -> **Users** -> **Profile**.
   - Under **Application Passwords**, add a new key named `GOD_API_SYNC`.
   - Copy the generated password.
   - Variable values:
     - `WORDPRESS_SYNC_BASE_URL=https://globalopportunitydesk.com/wp-json`
     - `WORDPRESS_API_KEY=<generated_application_password>`
     - `INSIGHT_GHANA_WORDPRESS_URL=https://insightghana.com/wp-json` (if applicable)
     - `AFRICAN_JOURNAL_WORDPRESS_URL=https://africanjournal.com/wp-json` (if applicable)

---

### Provider 2: Cloudflare (DNS, Edge TLS, AOP & R2)

#### Step 2.1: Add Domain & Pre-Stage Active Records (Zero-Downtime Guard)
> [!IMPORTANT]
> Do NOT change nameservers at the registrar until all existing WordPress and Titan Mail records are imported into Cloudflare.

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Click **Add a domain** -> enter `globalopportunitydesk.com` -> Select the **Free** plan.
3. Open **DNS** -> **Records** -> **Manage** -> **Import and Export**.
4. Upload `docs/infrastructure/CLOUDFLARE_ZONE_RECORDS.bind` from the repo.
5. Verify the following imported records:
   * **Root A records:** `147.79.116.134` and `77.37.50.148` (DNS only / Proxied: Off for initial test).
   * **www CNAME:** `www.globalopportunitydesk.com.cdn.hstgr.net`.
   * **Titan Mail MX:** `mx1.titan.email` (priority 10), `mx2.titan.email` (priority 20).
   * **Titan Mail SPF TXT:** `v=spf1 include:spf.titan.email ~all`.
   * **Titan DKIM TXT:** `titan1._domainkey`.

#### Step 2.2: Add Subdomains for GOD Infrastructure
In Cloudflare DNS, add `A` records pointing to your **Hostinger VPS IP**:
* `api.globalopportunitydesk.com` -> `<VPS_IP>` (Proxied: ON / Orange Cloud)
* `staging-api.globalopportunitydesk.com` -> `<VPS_IP>` (Proxied: ON)
* `dev-api.globalopportunitydesk.com` -> `<VPS_IP>` (Proxied: ON)

For Admin Dashboard (managed on Vercel):
* `admin.globalopportunitydesk.com` -> `cname.vercel-dns.com` (DNS only / Proxied: OFF)
* `staging-admin.globalopportunitydesk.com` -> `cname.vercel-dns.com` (DNS only / Proxied: OFF)

#### Step 2.3: Configure Edge TLS & Authenticated Origin Pulls (AOP)
1. Navigate to **SSL/TLS** -> **Overview**:
   - Set encryption mode to **Full (strict)**.
2. Navigate to **SSL/TLS** -> **Origin Server**:
   - Enable **Authenticated Origin Pulls** (Toggle ON).
   - Click **Create Certificate**:
     - Key type: RSA (2048).
     - Hostnames: `globalopportunitydesk.com`, `*.globalopportunitydesk.com`.
     - Certificate Validity: 15 years.
   - Save the certificate body as `origin.crt`.
   - Save the private key as `origin.key`.
3. Install the certificate on the VPS:
   ```bash
   sudo mkdir -p /etc/ssl/cloudflare
   sudo chmod 700 /etc/ssl/cloudflare
   sudo nano /etc/ssl/cloudflare/origin.crt # paste origin.crt
   sudo nano /etc/ssl/cloudflare/origin.key # paste origin.key
   sudo chmod 600 /etc/ssl/cloudflare/origin.key
   sudo chmod 644 /etc/ssl/cloudflare/origin.crt
   ```
4. In Cloudflare -> **Network**:
   - Enable **WebSockets** (required for Socket.io).
   - Enable **HTTP/3 (with QUIC)**.

#### Step 2.4: Switch Nameservers at Hostinger
1. In Hostinger hPanel -> **Domains** -> `globalopportunitydesk.com` -> **Nameservers**.
2. Change nameservers to Cloudflare's assigned servers (e.g., `aria.ns.cloudflare.com` and `gabe.ns.cloudflare.com`).
3. Verify via terminal:
   ```bash
   nslookup -type=NS globalopportunitydesk.com 8.8.8.8
   nslookup -type=MX globalopportunitydesk.com 8.8.8.8
   ```

#### Step 2.5: Cloudflare R2 Bucket for Database Backups
1. In Cloudflare Dashboard -> **R2** -> **Create bucket**.
2. Bucket name: `god-db-backups`.
3. Location: Automatic or close to VPS.
4. Click **Manage R2 API Tokens** -> **Create API Token**:
   - Permissions: **Object Read & Write** for `god-db-backups`.
   - Copy:
     - Account ID (from R2 overview URL)
     - Access Key ID -> `STORAGE_ACCESS_KEY`
     - Secret Access Key -> `STORAGE_SECRET_KEY`
     - Bucket Name -> `STORAGE_BUCKET=god-db-backups`

---

### Provider 3: MongoDB Atlas

#### Step 3.1: Create Company Organization & Projects
1. Sign in to [MongoDB Atlas](https://cloud.mongodb.com).
2. Create or verify company organization with MFA enforced.
3. Create two separate Atlas projects:
   - `god-production`
   - `god-staging`

#### Step 3.2: Create Database Clusters
* **Staging:** M0 Sandbox or M2 Flex cluster. Cluster name: `god-staging-cluster`.
* **Production:** M10 Dedicated cluster (enables automated daily backups & point-in-time restore). Cluster name: `god-production-cluster`.

#### Step 3.3: Configure Database Users
1. In each project -> **Security** -> **Database Access** -> **Add New Database User**:
   - Authentication: Username/Password.
   - User 1: `god_backend_user` -> Role: `readWriteAnyDatabase` (or readWrite on `kredibble`).
   - User 2 (Production only): `god_backup_user` -> Role: `backup` (used by nightly mongodump cron).
   - Generate strong 32+ character passwords and record them in your password manager.

#### Step 3.4: Whitelist Network IP Addresses
In each project -> **Security** -> **Network Access** -> **Add IP Address**:
* Add the **Hostinger VPS IPv4** with comment `Hostinger VPS Origin`.
* (During the 28-day transition window, also whitelist Render's outbound IP ranges or `0.0.0.0/0` temporarily with strict authentication).

#### Step 3.5: Obtain `DATABASE_URL`
In Atlas -> **Database** -> **Connect** -> **Drivers** (Node.js):
* Staging string format:
  ```text
  DATABASE_URL=mongodb+srv://god_staging_user:<PASSWORD>@god-staging-cluster.xxxx.mongodb.net/god-staging?retryWrites=true&w=majority
  ```
* Production string format:
  ```text
  DATABASE_URL=mongodb+srv://god_prod_user:<PASSWORD>@god-production-cluster.xxxx.mongodb.net/god-production?retryWrites=true&w=majority
  ```

---

### Provider 4: Cloudinary (Media Assets)

#### Step 4.1: Cloudinary Account & Sub-Accounts
1. Sign in to [Cloudinary Console](https://cloudinary.com/console).
2. On your main Dashboard, locate the **Product Environment Credentials**:
   - **Cloud name** -> `CLOUDINARY_CLOUD_NAME`
   - **API Key** -> `CLOUDINARY_API_KEY`
   - **API Secret** -> `CLOUDINARY_API_SECRET`
3. In **Settings** -> **Upload**, ensure the default upload preset is set or standard API uploads are enabled.

---

### Provider 5: Resend (Transactional Email)

#### Step 5.1: Add Domain & Verify DNS
1. Sign in to [Resend Dashboard](https://resend.com).
2. Navigate to **Domains** -> **Add Domain**.
3. Domain: `globalopportunitydesk.com` (Region: Ireland or US).
4. Resend displays 3 DNS records:
   - `MX` feedback record
   - `TXT` SPF record
   - `TXT` DKIM record (`resend._domainkey`)
5. Add these 3 records into **Cloudflare DNS** (Proxied: OFF / DNS only).
6. Click **Verify Domain** in Resend until status is **Verified**.

#### Step 5.2: Create API Key
1. In Resend -> **API Keys** -> **Create API Key**.
2. Name: `GOD Backend Production`.
3. Permissions: **Full Access** or **Sending Access**.
4. Copy key:
   - `RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx`
   - `RESEND_FROM_EMAIL=Global Opportunities <verify@globalopportunitydesk.com>`

---

### Provider 6: AI Assistant Providers (OpenAI & Anthropic)

#### Step 6.1: OpenAI
1. Sign in to [OpenAI Platform](https://platform.openai.com/api-keys).
2. Click **Create new secret key** -> Name: `god-backend`.
3. Set monthly usage limits under **Settings** -> **Limits**.
4. Values:
   - `AI_PROVIDER=openai`
   - `OPENAI_API_KEY=sk-proj-xxxxxxxx`
   - `OPENAI_MODEL=gpt-4.1-mini`

#### Step 6.2: Anthropic (Fallback / Alternate)
1. Sign in to [Anthropic Console](https://console.anthropic.com/settings/keys).
2. Generate API Key: `sk-ant-xxxxxxxx`.
3. Values:
   - `ANTHROPIC_API_KEY=sk-ant-xxxxxxxx`
   - `ANTHROPIC_MODEL=claude-sonnet-4-20250514`

---

### Provider 7: Sentry (Observability)

#### Step 7.1: Sentry Organization & Projects
1. Sign in to [Sentry.io](https://sentry.io).
2. Create 3 distinct projects:
   * `god-api` (Platform: Node.js / Express)
   * `god-admin` (Platform: Next.js)
   * `god-mobile` (Platform: React Native)

#### Step 7.2: Obtain DSNs
In each project -> **Settings** -> **Client Keys (DSN)**:
* `god-api` DSN -> `SENTRY_DSN` in `kredibble-backend/.env`
* `god-admin` DSN -> `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN` in `kredibble-admin/.env`
* `god-mobile` DSN -> `EXPO_PUBLIC_SENTRY_DSN` in `kredibble-app/.env`

---

### Provider 8: Vercel (Admin Dashboard)

#### Step 8.1: Import Project to Company Team
1. Sign in to [Vercel](https://vercel.com).
2. Import repository `Aeomar999/Global-Opportunities`.
3. Set **Root Directory** to `kredibble-admin`.
4. Framework Preset: Next.js.

#### Step 8.2: Configure Domains
Under **Project Settings** -> **Domains**:
* Add `admin.globalopportunitydesk.com` (Environment: Production)
* Add `staging-admin.globalopportunitydesk.com` (Environment: Preview / Staging)

#### Step 8.3: Configure Vercel Environment Variables
In **Project Settings** -> **Environment Variables**:

* **For Production:**
  * `NEXT_PUBLIC_API_URL` = `/api`
  * `API_PROXY_TARGET` = `https://api.globalopportunitydesk.com`
  * `NEXT_PUBLIC_APP_ENV` = `production`
  * `NEXT_PUBLIC_USE_MOCKS` = `false`
  * `NEXT_PUBLIC_SENTRY_DSN` = `<admin_sentry_dsn>`

* **For Staging / Preview:**
  * `NEXT_PUBLIC_API_URL` = `/api`
  * `API_PROXY_TARGET` = `https://staging-api.globalopportunitydesk.com`
  * `NEXT_PUBLIC_APP_ENV` = `staging`
  * `NEXT_PUBLIC_USE_MOCKS` = `false`

---

### Provider 9: Expo EAS (Mobile Application)

#### Step 9.1: Configure Expo Project
1. Log in to [Expo Dashboard](https://expo.dev).
2. Ensure project belongs to the company organization.
3. Check `kredibble-app/app.json`:
   ```json
   {
     "expo": {
       "name": "Global Opportunities",
       "slug": "kredibble-app",
       "owner": "company-expo-org"
     }
   }
   ```

#### Step 9.2: Generate Robot Token
1. In Expo Dashboard -> **Account Settings** -> **Access Tokens**.
2. Create robot token: `GOD_EAS_DEPLOY`.
3. Add to GitHub repository secrets as `EXPO_TOKEN`.

#### Step 9.3: EAS Secrets
In `kredibble-app`, build profiles in `eas.json` are already mapped to:
* `development` -> `https://dev-api.globalopportunitydesk.com/api/v1`
* `staging` -> `https://staging-api.globalopportunitydesk.com/api/v1`
* `production` -> `https://api.globalopportunitydesk.com/api/v1`

---

## 3. Cryptographic Secrets & Session Continuity

### Generating Secrets for Staging and Development
For `JWT_SECRET` and `ADMIN_JWT_SECRET`, run in terminal:
```bash
# Generate user JWT secret (minimum 48 bytes base64)
openssl rand -base64 48

# Generate distinct admin JWT secret (must differ from user secret)
openssl rand -base64 48
```

### Critical Production Session Continuity Extraction (Plan 4f)
> [!CAUTION]
> In production, generating brand new JWT secrets will invalidate all active mobile tokens and log out every user and administrator.

1. Open Render Dashboard -> **Services** -> `kredibble-api` -> **Environment**.
2. Locate the dynamically generated variables:
   * `JWT_SECRET`
   * `ADMIN_JWT_SECRET`
3. Copy these exact strings into `/opt/god/production/api.env` on your Hostinger VPS.

---

## 4. Master Variable Crosswalk Table

| Variable Name | Applications | Provider / Where to Find | Format / Example |
|---|---|---|---|
| `PORT` | Backend | Fixed local port | `4000` |
| `NODE_ENV` | Backend, Admin | Runtime state | `development` (local) or `production` (staging/prod) |
| `APP_ENV` | Backend, Admin | Deployment stage (SEC-112) | `development`, `staging`, `production` |
| `CORS_ORIGIN` | Backend | Allowed client origins | `https://admin.globalopportunitydesk.com,https://globalopportunitydesk.com` |
| `COOKIE_DOMAIN` | Backend | Subdomain cookie sharing | `.globalopportunitydesk.com` |
| `DATABASE_URL` | Backend | MongoDB Atlas -> Connect -> Drivers | `mongodb+srv://user:pass@cluster.mongodb.net/dbname` |
| `REDIS_URL` | Backend | Local or Compose internal Redis | `redis://localhost:6379` (local) or `redis://redis:6379` (VPS) |
| `JWT_SECRET` | Backend | Render (Prod) or `openssl rand -base64 48` | `64+ character base64 string` |
| `ADMIN_JWT_SECRET` | Backend | Render (Prod) or `openssl rand -base64 48` | `Distinct 64+ character base64 string` |
| `CLOUDINARY_CLOUD_NAME` | Backend | Cloudinary Console -> Dashboard | `abcde123` |
| `CLOUDINARY_API_KEY` | Backend | Cloudinary Console -> Dashboard | `123456789012345` |
| `CLOUDINARY_API_SECRET` | Backend | Cloudinary Console -> Dashboard | `Secret key string` |
| `STORAGE_BUCKET` | Backend | Cloudflare R2 -> Buckets | `god-db-backups` |
| `STORAGE_ACCESS_KEY` | Backend | Cloudflare R2 -> API Tokens | `Cloudflare R2 Access Key ID` |
| `STORAGE_SECRET_KEY` | Backend | Cloudflare R2 -> API Tokens | `Cloudflare R2 Secret Access Key` |
| `RESEND_API_KEY` | Backend | Resend Dashboard -> API Keys | `re_1234567890abcdef` |
| `RESEND_FROM_EMAIL` | Backend | Verified sending email | `Global Opportunities <verify@globalopportunitydesk.com>` |
| `AI_PROVIDER` | Backend | AI Engine selector | `openai` or `anthropic` |
| `OPENAI_API_KEY` | Backend | OpenAI Platform -> API Keys | `sk-proj-xxxxxxxx` |
| `OPENAI_MODEL` | Backend | OpenAI Model identifier | `gpt-4.1-mini` |
| `ANTHROPIC_API_KEY` | Backend | Anthropic Console -> Keys | `sk-ant-xxxxxxxx` |
| `ANTHROPIC_MODEL` | Backend | Anthropic Model identifier | `claude-sonnet-4-20250514` |
| `WORDPRESS_SYNC_BASE_URL` | Backend | WP REST API Endpoint | `https://globalopportunitydesk.com/wp-json` |
| `WORDPRESS_API_KEY` | Backend | WP Admin -> Application Passwords | `xxxx xxxx xxxx xxxx` |
| `SENTRY_DSN` | Backend, Admin | Sentry Project Settings -> Keys | `https://xxxx@o0.ingest.sentry.io/0` |
| `NEXT_PUBLIC_API_URL` | Admin | Next.js API client target | `http://localhost:4000/api` (local) or `/api` (Vercel) |
| `API_PROXY_TARGET` | Admin | Next.js rewrite target | `https://api.globalopportunitydesk.com` |
| `NEXT_PUBLIC_USE_MOCKS` | Admin | Static mock toggle | `false` |
| `EXPO_PUBLIC_API_URL` | Mobile App | Mobile API endpoint | `https://api.globalopportunitydesk.com/api/v1` |
| `EXPO_PUBLIC_SENTRY_DSN` | Mobile App | Sentry Mobile project key | `https://xxxx@o0.ingest.sentry.io/0` |

---

## 5. Verification Commands

After populating variables and deploying containers, run these verification commands:

```bash
# 1. Verify Cloudflare Edge & Origin Pull
curl -I https://api.globalopportunitydesk.com/api/v1/health

# 2. Verify API Health & Deployed Release
curl -s https://api.globalopportunitydesk.com/api/v1/health | jq .

# 3. Direct origin IP check (must fail or refuse without Cloudflare client cert)
curl -k -I https://<VPS_IP>/api/v1/health

# 4. Run automated deployment smoke suite
node scripts/smoke.mjs "https://api.globalopportunitydesk.com" "<RELEASE_SHA>" "production"
```
