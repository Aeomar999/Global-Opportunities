# VPS Infrastructure & Operations Guide

This document describes the host architecture, security controls, server provisioning, and deployment operations for running the Global Opportunity Desk (GOD) API on the Hostinger VPS.

---

## 1. Architectural Overview & Security Topology

```
             Internet (Clients, Browsers, Mobile App)
                                │
                                ▼
         Cloudflare Edge (WAF, DDoS Shield, Edge TLS)
                                │
                                │ Full (strict) TLS + Authenticated Origin Pulls (AOP)
                                ▼
       ┌────────────────────────────────────────────────────────┐
       │ Hostinger VPS (Ubuntu 24.04 LTS)                       │
       │ Firewall (UFW): Port 22 (SSH), 80/443 (Caddy Edge)    │
       │                                                        │
       │  platform/vps/edge (Caddy 2 Reverse Proxy)             │
       │  ┌──────────────────────────────────────────────────┐  │
       │  │ Caddy 2 container (ports 80 & 443 bound to host) │  │
       │  │ - Cloudflare Origin CA certificate               │  │
       │  │ - Authenticated Origin Pull (AOP) client verify  │  │
       │  │ - Trusts Cloudflare IPs & restores real client IP│  │
       │  └───────────────────┬──────────────────────────────┘  │
       │                      │ Docker 'edge' bridge network    │
       │         ┌────────────┼────────────┐                    │
       │         ▼            ▼            ▼                    │
       │    ┌─────────┐  ┌─────────┐  ┌─────────┐               │
       │    │staging  │  │prod     │  │dev      │               │
       │    │api      │  │api      │  │api      │               │
       │    │(no host │  │(no host │  │(no host │               │
       │    │ ports)  │  │ ports)  │  │ ports)  │               │
       │    └────┬────┘  └────┬────┘  └────┬────┘               │
       │         │            │            │                    │
       │      internal     internal     internal                │
       │      network      network      network                 │
       │         │            │            │                    │
       │    ┌────┴────┐  ┌────┴────┐  ┌────┴────┐               │
       │    │redis    │  │redis    │  │redis    │               │
       │    │(no host │  │(no host │  │(no host │               │
       │    │ ports)  │  │ ports)  │  │ ports)  │               │
       │    └─────────┘  └─────────┘  └─────────┘               │
       └────────────────────────────────────────────────────────┘
```

### Core Security Guarantees:
1. **Zero Exposed Application Ports:** Neither the API (`4000`) nor Redis (`6379`) publishes host ports. All inter-service communication is encapsulated inside isolated Docker compose networks. Only Caddy publishes ports 80 and 443.
2. **Authenticated Origin Pulls (AOP):** Direct traffic hitting the VPS origin IP is terminated by Caddy, which requires Cloudflare's client certificate (`origin_pull_ca.pem`). Attackers attempting to bypass Cloudflare WAF receive a TLS handshake failure.
3. **Accurate Rate Limiting & Real Client IP:** Caddy extracts `CF-Connecting-IP` from verified Cloudflare IP blocks and forwards it in `X-Forwarded-For`. Express backend configured with `trust proxy 1` reads the true client IP, ensuring per-user rate limiters work properly.
4. **Environment Isolation:** Deployments use dynamic compose project names `god-${APP_ENV}`, keeping volumes (`redis_data`) and internal networks (`god-${APP_ENV}-internal`) completely separate.
5. **Restricted SSH Deployment Gate:** CI connects via an unprivileged `deploy` SSH key bound to `/opt/god/bin/god-deploy-gate` via `authorized_keys` forced command. The key cannot spawn an interactive shell or execute arbitrary binaries.

---

## 2. Server Provisioning (Initial Host Setup)

Run the automated, idempotent bootstrap script as `root` on a clean Ubuntu 24.04 VPS:

```bash
# Clone the repository or copy bootstrap script to server
sudo bash platform/vps/bootstrap.sh
```

### What Bootstrap Configures:
- Installs Docker Engine, Buildx, and Compose plugin from Docker's official apt repository.
- Hardens OpenSSH daemon: key-based authentication only, root login disabled/prohibit-password, max auth tries 4.
- Enables Fail2ban for SSH brute-force protection.
- Configures UFW firewall: default deny incoming; allows TCP 22, 80, 443 only.
- Creates unprivileged user `deploy` belonging to the `docker` group.
- Creates Docker bridge network `edge`.
- Downloads Cloudflare Authenticated Origin Pull CA cert to `/etc/ssl/cloudflare/origin_pull_ca.pem`.
- Provisions `/opt/god/{staging,production,development,bin,deploy}` directory hierarchy.

---

## 3. SSL Certificates & Edge Proxy Setup

### Step 1: Cloudflare Origin CA Certificates
1. In the Cloudflare Dashboard, go to **SSL/TLS** > **Origin Server** > **Create Certificate**.
2. Select hostname list: `*.globalopportunitydesk.com`, `globalopportunitydesk.com`.
3. Copy the certificate and private key to the VPS:
   ```bash
   sudo nano /etc/ssl/cloudflare/origin.crt
   sudo nano /etc/ssl/cloudflare/origin.key
   sudo chmod 600 /etc/ssl/cloudflare/origin.key
   sudo chmod 644 /etc/ssl/cloudflare/origin.crt
   ```

### Step 2: Enable Cloudflare Authenticated Origin Pulls
1. In the Cloudflare Dashboard, navigate to **SSL/TLS** > **Origin Server**.
2. Toggle **Authenticated Origin Pulls** to **ON**.
3. Under **SSL/TLS** > **Overview**, set encryption mode to **Full (strict)**.

### Step 3: Launch Caddy Edge Reverse Proxy
```bash
sudo cp platform/vps/edge/Caddyfile /opt/platform/edge/Caddyfile
sudo cp platform/vps/edge/compose.yml /opt/platform/edge/compose.yml
cd /opt/platform/edge
docker compose up -d
```

Verify Caddy is running and healthy:
```bash
docker ps --filter name=edge-caddy
docker logs edge-caddy
```

---

## 4. SSH Deployment Gate Configuration

### Step 1: Install Deployment Binaries
```bash
sudo cp deploy/bin/god-deploy /opt/god/bin/god-deploy
sudo cp deploy/bin/god-deploy-gate /opt/god/bin/god-deploy-gate
sudo chmod 755 /opt/god/bin/god-deploy*
sudo chown deploy:deploy /opt/god/bin/god-deploy*

sudo cp deploy/compose.yml /opt/god/deploy/compose.yml
sudo chown deploy:deploy /opt/god/deploy/compose.yml
```

### Step 2: Configure Authorized Keys for CI Runner
On the VPS, append the CI deploy key to `/home/deploy/.ssh/authorized_keys` with the forced-command restriction:

```text
command="/opt/god/bin/god-deploy-gate",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty ssh-ed25519 AAAAC3NzaC1lZDI1NTE5... github-actions-deploy
```

Verify permissions:
```bash
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
```

---

## 5. Environment Secrets & Deployment

### Step 1: Setup Environment Secrets File
Copy `deploy/env/api.env.example` to the target environment path:
```bash
sudo cp deploy/env/api.env.example /opt/god/staging/api.env
sudo chown deploy:deploy /opt/god/staging/api.env
sudo chmod 600 /opt/god/staging/api.env
sudo nano /opt/god/staging/api.env
```
Ensure all required secrets (`JWT_SECRET`, `ADMIN_JWT_SECRET`, `DATABASE_URL`, `CORS_ORIGIN`) are populated with valid production/staging credentials.

### Step 2: Triggering Deployments

#### Via SSH (e.g. from GitHub Actions CI or operator):
```bash
# Deploy a release:
ssh -i deploy_key deploy@vps_ip "deploy staging <40_hex_commit_sha>"

# Rollback to previous release:
ssh -i deploy_key deploy@vps_ip "rollback staging"

# Check deployment status:
ssh -i deploy_key deploy@vps_ip "status staging"
```

#### What `god-deploy` Executes Automatically:
1. Validates that `/opt/god/${APP_ENV}/api.env` exists.
2. Pulls Docker image `ghcr.io/aeomar999/global-opportunities/kredibble-backend:<sha>`.
3. Starts the compose project with `docker compose -f /opt/god/deploy/compose.yml --project-name god-${APP_ENV} up -d`.
4. Polls `/api/v1/health` inside the container every 3 seconds for up to 60 seconds.
5. Verifies that `release` matches `<sha>` and `environment` matches `${APP_ENV}`.
6. **Automatic Rollback:** If the health check times out or fails (e.g., database connection error, missing secret), `god-deploy` automatically redeploys the previous release SHA and exits with code 1.

---

## 6. Operations & Troubleshooting Runbook

### Checking Logs
```bash
# Staging API logs
docker compose -f /opt/god/deploy/compose.yml --project-name god-staging logs -f api

# Staging Redis logs
docker compose -f /opt/god/deploy/compose.yml --project-name god-staging logs -f redis

# Edge Caddy logs
docker logs -f edge-caddy
```

### Checking Container Health Directly
```bash
docker compose -f /opt/god/deploy/compose.yml --project-name god-staging exec -T api node -e "
  fetch('http://127.0.0.1:4000/api/v1/health')
    .then(r => r.json())
    .then(d => console.log(JSON.stringify(d, null, 2)))
"
```

### Verifying Authenticated Origin Pulls (AOP) Defense
Test direct access from an external terminal to the VPS IP:
```bash
# Should be rejected with TLS handshake / alert failure:
curl -v -k https://<VPS_IP>/api/v1/health
```
When requesting through the Cloudflare proxy hostname:
```bash
# Should succeed with HTTP 200:
curl -v https://staging-api.globalopportunitydesk.com/api/v1/health
```

### Verifying Firewall Status
```bash
sudo ufw status verbose
sudo fail2ban-client status sshd
```
