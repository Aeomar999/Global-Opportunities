# Plan 4 Roadmap: GOD on the Company Infrastructure Platform

Prepares this repository (GOD — Global Opportunity Desk, codename Kredibble) to be the first application on the platform described in `Company_IT_Application_Infrastructure_Plan.md`. It covers what the repo needs plus the account and console work that only IT can do. BexieMart, Neon and office IT are out of scope (see *Not in this plan*).

The work is split into seven plans, each on its own branch and PR, plus a manual track for IT. Only **Plan 4a** is written in full (`PLAN-4a-repair-sec-090.md`). Like Plans 1–2c, each later plan is written once the previous one has merged and the decisions below are confirmed, so it reflects the code as it actually is.

**Written:** 2026-10-04. **Revised the same day** against `origin/main` @ `60c1de6`, after PR #30 (SEC-090) merged and PRs #31–#33 landed. Other sessions work in the same checkout and commit from it, so every fact below was re-checked against `origin/main`, the live hosts and the CI logs.

---

## 1. Where the repo stands today (verified 2026-10-04)

| Area | Today | Infra-plan target |
|---|---|---|
| API host | Render (`kredibble-api.onrender.com`), Docker, deployed by Render's GitHub integration. `render.yaml` and Q7 say Starter (always-on), but the first request on 2026-10-04 19:33 UTC timed out after 60 s while the service woke, so it still sleeps | Hostinger VPS behind Cloudflare |
| Admin (Next.js) | Vercel project in the personal scope `jerry-amoahs-projects`, same-origin `/api` proxy to Render | Company Vercel team, `admin.` + `staging-admin.` |
| Mobile (Expo) | EAS project owned by personal account `amoahjerry835`; production channel → Render URL | Company Expo org; `development` / `staging` / `production` channels |
| Database | MongoDB Atlas (one production DB; a test admin was once created against it, `task.md` § P0) | Company Atlas org; separate staging and production projects |
| Source / CI | `Aeomar999/Global-Opportunities` (personal); `ci.yml` gates backend, admin, admin-e2e and app | Company GitHub org, branch protection, environments with approvals |
| DNS | `globalopportunitydesk.com` resolves to Hostinger (2a02:4780::/32); `api.globalopportunitydesk.com` does **not** resolve; `kredibble.com` resolves to an unrelated-looking IP; `kredibble.app` and `api.kredibble.app` (chosen in Q7) don't resolve | Cloudflare-managed company zone |
| Monitoring | None (SEC-090) | Errors, uptime, logs, alerts |
| Backups | None of our own; Atlas tier unknown (M0 has none) | Off-site, encrypted, restore-tested |

### What PR #30 (SEC-090) put on `main`, and what's wrong with it

PR #30 merged `7f8be2c` ("Prepare infrastructure for Hostinger VPS and multi-environment setup"), `b804a81` (task.md) and `712ea6c` (encoding repair) at 14:58 UTC on 2026-10-04. It has useful direction (branch-to-environment mapping, env templates, a DR playbook), but some of it is live and dangerous:

1. **Files saved as UTF-16** (SEC-110, *fixed*). `7f8be2c` wrote three CD workflows, `eas.json`, three `.env.example`, `docker-compose.prod.yml`, `DISASTER_RECOVERY.md` and two shell scripts as UTF-16, and `b804a81` re-saved `task.md` as Windows-1252. `712ea6c` repaired all of them before the merge. Cause: Windows PowerShell 5.1, whose `>` and `Out-File` write UTF-16. Still missing: a CI check so it can't recur.
2. **The production app is one bug-fix away from losing its API** (SEC-111, **P0, live**).
   - `eas.json` production points at `api.globalopportunitydesk.com`, which has no DNS record.
   - Since the merge, CD App has tried to publish that to the production update channel three times (runs 37211222000, 37222652003, 37227876413; `EXPO_TOKEN` is set).
   - Only an unrelated web-bundling failure stopped it (SEC-118). EAS shows no published production updates, so nobody is affected yet.
   - The staging/dev names (`staging.api.…`) are also two levels deep, and Cloudflare's free edge certificate covers only one level.
3. **The VPS deploy fails on every push and isn't safe** (SEC-112). The job has no `VPS_*` secrets and replaced the Render deploy step. Beyond that:
   - every branch overwrites `:latest`, the tag the production compose file runs;
   - the compose file is never copied to the VPS;
   - all `environment:` values are blank (so `NODE_ENV` is empty and the API would run development code paths);
   - `docker pull ghcr.io/${{ github.repository }}` is mixed case, which GHCR rejects. The pre-SEC-090 workflow had a comment warning about exactly this;
   - no SSH host-key pinning;
   - port 4000 is published without TLS;
   - fixed container names collide when dev, staging and production share the VPS;
   - nothing checks the new container's health or rolls back.
4. **SEC-090 is marked Done** although neither error tracking nor uptime monitoring exists (reopened).
5. **Agent state was committed** (SEC-113). `712ea6c` untracked `.claude/ralph-loop.local.md`, which held the e2e admin login (a public default in `scripts/e2e-server.js`, so hygiene rather than a leak). `.claude/scheduled_tasks.lock`, `.idea/`, a UTF-16 `test-results.json` and empty log files are still tracked.
6. **OTA updates have never worked** (SEC-118). Every CD App run, before and after PR #30, fails at `expo export` for web. This has to be fixed **after** SEC-111, never before.

The other changes in `7f8be2c` (real totals on `GET /admin/opportunities`, more third-party keys blanked in the e2e server) are fine and stay.

**Also on `main` (outside this plan):**
- CI is red: run 37222652035 failed at backend lint and at the admin Playwright real-API run.
- Q7 in `task.md` records "Render Starter + `api.kredibble.app`" as resolved, but `kredibble.app` doesn't resolve and Render still sleeps.
- This roadmap and Plan 4a were committed to `main` as drafts by another session's `81129fb`. Plan 4a Task 1 replaces them with this revision.

---

## 2. Decisions needed before Plan 4b

Recommended defaults are in **bold**. Plan 4a doesn't depend on any of them.

| # | Decision | Recommendation | Why |
|---|---|---|---|
| D1 | Domain and hostnames | **`globalopportunitydesk.com`**, single-level names: `api.`, `staging-api.`, `dev-api.`, `admin.`, `staging-admin.`; mail from `globalopportunitydesk.com` (SEC-091) | The company already holds it (it resolves to Hostinger). Single-level names are covered by Cloudflare's free Universal SSL; `staging.api.` is not. `admin.` rather than the infra plan's example `app.`, because this dashboard is staff-only and `app` reads as the mobile app. **This conflicts with Q7 in `task.md` (`kredibble.app`)**: that domain has no DNS records, so confirm whether the company owns it. If it does and the product brand is Kredibble, the same single-level pattern applies under `kredibble.app`. Retire whichever domain loses from CORS and docs. |
| D2 | How code reaches production | **Build once, promote.** Merging to `main` builds one image tagged with the commit SHA and deploys it to staging. Production runs *the same image* after someone approves it in a GitHub Environment. Development is local plus an on-demand `dev-api` deploy from any branch. | SEC-090's branch-per-environment model (`dev` → `staging` → `main`) rebuilds for each environment, so production never runs the exact artifact staging tested, and the branches drift apart. The infra plan's flow (tests → staging → approval → production) maps directly onto one pipeline with an approval gate. |
| D3 | Runtime secrets | **GitHub Environment secrets are the source of truth.** One multi-line secret per environment, `API_ENV_FILE`, holds the whole env file; each deploy writes it to the VPS with mode `0600`. Human credentials and recovery codes live in a **company password manager** (1Password Business or Bitwarden Teams). | One place to rotate, nothing secret on disk that a rebuild can't recreate, and a new VPS is a redeploy away (disaster recovery). Revisit with a dedicated secrets manager (Infisical, Doppler) when BexieMart joins. |
| D4 | Monitoring vendors | **Sentry** for errors and **Better Stack** for uptime (already decided 2026-10-03 in `PLAN-phase-3-roadmap.md`). Proposed addition: Better Stack also for logs and heartbeats. | One alerting tool for uptime, SSL/domain expiry, backup heartbeats and logs keeps on-call simple for a small team. |
| D5 | Edge and TLS | **Cloudflare proxied DNS with SSL mode "Full (strict)".** Caddy on the VPS serves a Cloudflare Origin CA certificate and requires Cloudflare's client certificate (Authenticated Origin Pulls). Hostinger's VPS firewall allows 80/443 only from Cloudflare. | Docker-published ports bypass `ufw`, so a host firewall alone doesn't protect the origin. Authenticated Origin Pulls makes the origin refuse any TLS client that isn't Cloudflare, even if a firewall rule is wrong. |
| D6 | How CI reaches the VPS | **SSH with a deploy key restricted by `command=` to one gate script** (`god-deploy-gate`, which accepts only `deploy <env> <40-hex sha>` / `rollback <env>`). The host key is pinned from a secret. No third-party SSH action. | GitHub-hosted runners have no fixed IPs, so SSH can't be IP-restricted. A forced command means a stolen deploy key can only redeploy a signed-off image, not open a shell. Tailscale is the upgrade path. |
| D7 | Atlas tiers and isolation | **Production on a tier with managed snapshots** (M10, or Flex if its backup terms suffice; confirm when buying). **Staging in a separate Atlas project** (M0 is fine). Network access: the VPS IP only, plus Render's outbound ranges during the transition. | M0 has no backups. Separate projects mean separate users, IP lists and alerts, so a staging credential can't touch production. |
| D8 | Backup target and objectives | **Nightly encrypted `mongodump` from the VPS to Cloudflare R2** (`age` encryption: the VPS holds only the public key). Keep 35 daily and 12 monthly. **RPO 24 h, RTO 4 h** (SEC-090's DR draft), confirmed by a monthly restore drill. | Provider-independent copy in addition to Atlas snapshots. A compromised VPS can write new backups but can't read old ones. |
| D9 | People | Name who holds each infra-plan role (IT Administrator, DevOps, Backend, Frontend, DBA, Management) and **who approves production deploys**. | Needed for GitHub teams, Environment reviewers, `CODEOWNERS`, alert routing and `ACCESS.md`. With one developer, allow self-approval but keep the explicit click. |

---

## 3. Target shape

```text
                 Cloudflare (company account): DNS, proxy, WAF, edge TLS
                                  │  Full (strict) + Authenticated Origin Pulls
┌─────────────────────────────────┴────────────────────────────────────────────┐
│ Hostinger VPS (Ubuntu 24.04)    firewall: 443/80 ← Cloudflare only; 22 key-only│
│                                                                                 │
│  platform/ (shared by every app)        deploy/ (GOD, one compose project/env) │
│  ┌──────────────┐  edge network        ┌─────────────────────────────────────┐ │
│  │ Caddy        │ ───────────────────▶ │ god-production: api ── redis        │ │
│  │ api.…        │ ───────────────────▶ │ god-staging:    api ── redis        │ │
│  │ staging-api.…│ ───────────────────▶ │ god-development: api ── redis       │ │
│  │ dev-api.…    │                      └─────────────────────────────────────┘ │
│  └──────────────┘   later: BexieMart API on the same edge network              │
│  Vector (container logs + host metrics → Better Stack)                          │
│  systemd timer: nightly mongodump → age → R2, heartbeat on success              │
└─────────────────────────────────────────────────────────────────────────────────┘
        │                                     │
 MongoDB Atlas (company org)          Vercel (company team): kredibble-admin
  god-production / god-staging          production → admin.…   staging → staging-admin.…
                                        /api proxied to the matching API host
 EAS (company org): channels development / staging / production
 Hostinger: WordPress site globalopportunitydesk.com (backend syncs postings to it)
```

**Release flow (D2):**

```text
PR ──▶ CI: backend · admin · admin-e2e · app · repo hygiene   (required checks)
merge to main ──▶ build image :<sha> once ──▶ staging (API, admin, mobile channel)
              ──▶ health check (environment=staging, release=<sha>) + smoke test
              ──▶ [production approval in GitHub Environment]
              ──▶ production: same image <sha>, admin and OTA built from the same commit
              ──▶ health check; on failure the VPS rolls back to the previous sha
rollback any time: run the deploy workflow with an older sha
```

---

## 4. Plans, in order

| # | Plan | Items | Depends on | Status |
|---|---|---|---|---|
| 4a | [Disarm SEC-090's live config and add repo guardrails](PLAN-4a-repair-sec-090.md): **PR 1 is urgent** | SEC-111 (disarm), SEC-112 (Render CD back, health reports environment and release), SEC-113, SEC-116; records SEC-110–118 | — | **Done (PR #34, PR #35)** |
| 4b | [GOD API on the VPS, staging first](PLAN-4b-api-on-vps.md) | SEC-112, SEC-089 (always-on host) | 4a; M1–M4; D1, D3, D5, D6 | 🟡 **Scaffolding implemented** (feature branch) |
| 4c | Build-once promotion pipeline | SEC-115, SEC-112 (rollback), SEC-118 (OTA publishing) | 4b; M1, M6, M7; D2, D9 | Not written |
| 4d | Observability | SEC-090, SEC-095 | 4a (Sentry can start right away); 4b for logs; M8 | Not written |
| 4e | Backups and disaster recovery | SEC-089 (backups, restore drill) | 4b; M5, M9; D7, D8 | Not written |
| 4f | Cutover from Render, domain and decommission | SEC-111 (re-point), SEC-091, SEC-094, SEC-117 | 4b–4e; M10, M11 | Not written |
| 4g | Ownership, access and the reusable app standard | SEC-114 | track M; written alongside 4b, finished after 4f | Not written |

Plans 4d and 4g can run in parallel with 4b/4c. Plan 4f must come last: monitoring and backups exist **before** production moves.

### 4a — Disarm SEC-090's live config and add repo guardrails *(written)*
**PR 1 (urgent):** records SEC-110–118, points production `eas.json` back at Render, and restores the Render-era `cd-backend.yml`. **PR 2:** a UTF-8 check, stops tracking local state, adds a CI hygiene job (encoding, actionlint, shellcheck, gitleaks) and Dependabot, and teaches the API its `APP_ENV` and release SHA, which every later deploy check depends on. Production behaviour returns to what it was before PR #30. Both PRs are built in separate worktrees from `origin/main`, because other sessions switch branches in the shared checkout.

### 4b — GOD API on the VPS, staging first ([Implementation Plan](PLAN-4b-api-on-vps.md) · *Scaffolding implemented*)
**Files:** `deploy/compose.yml` (api + redis; no published ports; joins the external `edge` network with alias `god-<env>-api`; memory limits; log rotation; project name `god-<env>`, so no `container_name`); `deploy/env/api.env.example` (canonical variable list, replaces the SEC-090 compose `environment:` block); `deploy/bin/god-deploy` (pull `:<sha>`, start, wait until `/api/v1/health` reports `release=<sha>` and `environment=<env>`, otherwise restore the previous sha and exit non-zero); `deploy/bin/god-deploy-gate` (SSH forced-command parser, D6) with a shell test; `platform/vps/bootstrap.sh` (idempotent: Docker from Docker's apt repo, `deploy` user, SSH hardening, unattended upgrades, fail2ban, `edge` network, `/opt/god/<env>`); `platform/vps/edge/{compose.yml,Caddyfile}` (Caddy 2.11; per-host sites; `trusted_proxies` = Cloudflare ranges with `client_ip_headers CF-Connecting-IP`, and `header_up X-Forwarded-For {client_ip}` so the API's `trust proxy 1` sees the real client); `docs/infrastructure/VPS.md`. Removes `docker-compose.prod.yml` and `kredibble-backend/scripts/db-{dump,restore}.sh` (replaced in 4b/4e).
**Done when:**
- `https://staging-api.<domain>/api/v1/health` returns 200 with `environment: staging` and the deployed SHA.
- Ports 4000 and 6379 are closed from the internet, and the origin IP refuses TLS without Cloudflare's client certificate.
- Socket.io connects through Cloudflare.
- Two client IPs get independent rate-limit buckets on staging.
- Deploying an image with a broken env file rolls back automatically and fails the job.

### 4c — Build-once promotion pipeline
**Files:** rewrite `cd-backend.yml` (build `:<sha>` once → `deploy-staging` → smoke → `deploy-production` with `environment: production`; `workflow_dispatch` input `sha` for rollback; plain `ssh` with `known_hosts` from a secret; the env file piped over stdin to the gate); rewrite `cd-admin.yml` (Vercel custom environment `staging`: `vercel pull --environment=staging`, `vercel build --target=staging`, `vercel deploy --prebuilt --target=staging`; production after approval, from the same commit); rewrite `cd-app.yml` (`eas update --channel staging` on merge, `--channel production` after approval; `eas.json` profiles `development` / `staging` / `production` with single-level hostnames, **production stays on Render until 4f**). Fix SEC-118 here, by publishing native platforms only or fixing NativeWind's web cache, and prove it on the staging channel first; `scripts/smoke.mjs <baseUrl> <sha>` (health, one public read, CORS preflight from the admin origin); `kredibble-backend/scripts/migrate.js` + `kredibble-backend/migrations/` (ordered, idempotent, recorded in a `migrations` collection; run by `god-deploy` before switching containers; expand/contract rule in `DEPLOYMENT.md`, because old and new API versions and old mobile builds run side by side); `docs/infrastructure/DEPLOYMENT.md`.
**Done when:**
- A merged PR reaches staging with no manual step, and production waits for approval.
- Staging and production report the same release SHA, from the same image digest.
- Rolling back to the previous SHA takes under 5 minutes.
- Migrations run once and are skipped on re-run (test).

### 4d — Observability (SEC-090's real scope)
**Files:**
- **Backend:** `@sentry/node` loaded with `node --import ./src/instrument.js`. `src/lib/error-tracking.js` sets environment = `APP_ENV`, release = `RELEASE_SHA` and `sendDefaultPii: false`, and its `beforeSend` strips cookies, `Authorization` and request bodies. The error handler reports 5xx errors tagged with `requestId`.
- **Admin:** `@sentry/nextjs` with `tunnelRoute`, so CSP `connect-src 'self'` stays as it is. Source maps are uploaded in CI.
- **Mobile:** `@sentry/react-native` Expo plugin, `getSentryExpoConfig` in Metro, source maps uploaded for EAS updates. Environment = channel.
- **Logging (SEC-095):** one access-log line per request (pino-http with the request id); fields `service, environment, release, requestId`. `platform/vps/vector/vector.yaml` ships container logs and host metrics.
- **Better Stack monitors:** API health per environment (keyword `"status":"ok"`), admin sign-in page, WordPress site, SSL and domain expiry, and heartbeats for backups and the restore drill.
- **Atlas alerts:** connections, disk, backup failure.
- **Docs:** `docs/infrastructure/MONITORING.md` (who gets which alert).

**Done when:**
- SEC-090's two criteria pass: a forced 500 on staging appears in Sentry with its `X-Request-Id`, and stopping the staging API raises an alert.
- Logs are searchable by request id for 14 days.
- No cookie or token appears in any captured event (test).

### 4e — Backups and disaster recovery
**Files:**
- `deploy/bin/god-backup`: `mongodump --archive --gzip`, with credentials read from a mounted `--config` file, never from argv. Output goes through `age -r <public key>` and is uploaded to R2. It pings a heartbeat on success and also writes a `monthly/` copy on the 1st.
- `platform/vps/systemd/god-backup-production.{service,timer}`.
- `deploy/bin/god-restore`: restores into a *new* database by default, and refuses the production cluster unless given `--i-understand-this-overwrites-production`.
- `.github/workflows/restore-drill.yml`: monthly and on demand. It fetches the latest backup with a read-only R2 token, decrypts it with the key from a `backup-drill` environment and restores into a `mongo:7` service container. Then it runs `kredibble-backend/scripts/verify-restore.js` (collections present, users and opportunities non-empty, newest `createdAt` under 26 h old), records the measured RTO and pings a heartbeat.
- `docs/infrastructure/DISASTER_RECOVERY.md` (replaces the root draft). It answers the infra plan's seven questions for each asset: Atlas data, Cloudinary media, WordPress, configuration and secrets, the VPS, and documentation.

**Done when:** two consecutive drills pass and are logged, the measured RTO is within target, and a missed nightly backup raises an alert within 26 h.

### 4f — Cutover from Render, domain and decommission
**Sequence:**
1. Preconditions: 4b–4e done, staging healthy for a week, Atlas allowing both Render and the VPS.
2. Copy `JWT_SECRET` and `ADMIN_JWT_SECRET` **from Render** into the production `API_ENV_FILE`. Render generated them (`generateValue: true`); without the same values every user is signed out when their app switches host.
3. Deploy production on the VPS at the SHA Render runs, and check `api.` health.
4. Point Vercel production `API_PROXY_TARGET` at `https://api.<domain>/api` and check admin sign-in.
5. Change `eas.json` production `EXPO_PUBLIC_API_URL` and publish a production OTA update. Watch Sentry and uptime.
6. Keep Render on the same SHA for at least 4 weeks: installed apps that haven't fetched the update still call it. When Render's traffic is near zero, suspend it, then delete it.
7. Remove `render.yaml`, the Render deploy step, `kredibble-backend/vercel.json` and `kredibble-backend/api/`.
8. Rotate Atlas passwords and any third-party keys that lived in personal accounts.
9. Verify the Resend domain (SPF, DKIM, DMARC in Cloudflare; SEC-091).
10. Remove `kredibble-admin-jerry-amoahs-projects.vercel.app` and `*.kredibble.com` from CORS.
11. Update `AGENTS.md` (deployment topology, CI/CD) and `README.md` (SEC-094).

**Done when:**
- Render and every old host are gone. Re-run the "Deployed surfaces" commands in `task.md` § *Verification Commands*: nothing returns 200.
- `api.` health reports `production` and the released SHA.
- Test emails reach the inbox with DKIM passing.

### 4g — Ownership, access and the reusable app standard
**Files:** in `docs/infrastructure/`:
- `ACCOUNTS.md`: register of provider, purpose, owning *role*, billing, MFA status, where recovery codes are kept (the password-manager item name, never the secret), second admin, last review date.
- `ACCESS.md`: the infra plan's six roles × GitHub, Vercel, Atlas, Cloudflare, Hostinger, Expo, Sentry, Better Stack and VPS users, plus a quarterly access review.
- `ENVIRONMENTS.md`: hostnames, databases, channels, who can deploy.
- `INCIDENT_RESPONSE.md`: severities, who's on call, communications, postmortems in the existing `POSTMORTEM-*.md` format.
- `APP-STANDARD.md`: the infra plan's §5 template, using GOD's real files as the reference implementation, with notes on what changes for Postgres/Neon.
- `README.md` index.

Also `.github/CODEOWNERS` (`deploy/`, `platform/`, `.github/` → DevOps team; each app → its team). When BexieMart onboards, `platform/` moves to a company platform repository.
**Done when:**
- No production resource belongs to a personal account.
- Every account has MFA and a second admin.
- A new engineer can find who owns what without asking.

---

## 5. Track M: things only IT can do (infra plan Phase 1, days 1–30)

These happen in provider consoles, not in the repo. Each line notes what the repo needs from it. Do them in this order; M1–M4 block Plan 4b.

| # | Task | Repo needs |
|---|---|---|
| M1 | Create the company **GitHub organization**; enforce 2FA; create teams per role (D9). Transfer this repo into it (GitHub redirects the old URL). Protect `main`: PR required, required checks `Backend (lint, test)`, `Admin (lint, typecheck, build)`, `Admin (Playwright end-to-end)`, `Mobile app (lint, typecheck, test, bundle)`, `Repo hygiene (encoding, workflows, shell, secrets)`, no force-push. Create Environments `development` (any branch), `staging` (main only), `production` (main only, required reviewers). Enable Dependabot security updates and secret scanning. | GHCR images move to `ghcr.io/<org>/…`; the workflows use `github.repository`, lowercased by `metadata-action`. Environment secrets per D3/D6. A read-only GHCR pull token for the VPS (from a machine user). |
| M2 | Company **password manager**: root and owner logins and recovery codes for every provider; a break-glass procedure. | Item names for `ACCOUNTS.md` |
| M3 | Company **Cloudflare** account; add the `globalopportunitydesk.com` zone. **Before changing nameservers, copy every existing record** (the WordPress A/AAAA records, MX, SPF, DKIM, verification TXT); otherwise the website and email break. Move the domain registration into a company-owned registrar account. Create an Origin CA certificate and turn on Authenticated Origin Pulls. | Hostnames (D1); origin certificate and key on the VPS |
| M4 | Company **Hostinger** account; VPS (KVM 2 or larger: 2 vCPU / 8 GB RAM is enough for three GOD environments and, later, BexieMart). Ubuntu 24.04; enable Hostinger snapshots; VPS firewall 80/443 from Cloudflare ranges only. | VPS IP, `VPS_KNOWN_HOSTS`, the deploy key's public half |
| M5 | Company **MongoDB Atlas** organization; projects `god-production` and `god-staging` (D7); a least-privilege user per environment; a `backup` role user for dumps; IP access list (VPS, plus Render during transition); alerts; MFA. **Check production for `@test.com` accounts and `test-admin@kredibble.com`** and remove them (SEC-117). | `DATABASE_URL` per environment in `API_ENV_FILE` |
| M6 | Company **Vercel team on Pro**: Hobby is non-commercial only and has no custom environments. Transfer `kredibble-admin`, add the `staging` custom environment and domains, and create a team-owned `VERCEL_TOKEN`. | `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, token |
| M7 | Company **Expo organization**; transfer the project (the project ID stays the same, `owner` in `app.json` changes); create a robot `EXPO_TOKEN`. | `app.json` `owner` |
| M8 | **Sentry** org (projects `god-api`, `god-admin`, `god-mobile`) and **Better Stack** team; set up alert routing per D9. | DSNs, `SENTRY_AUTH_TOKEN` |
| M9 | **Cloudflare R2** bucket `god-db-backups` with lifecycle rules (D8); a write-only token for the VPS and a read-only token for the drill; an `age` key pair (private key in the password manager and the `backup-drill` environment). | Tokens and `age` public key |
| M10 | Company **Resend** account; verify the sending domain (SEC-091). | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| M11 | **Inventory and shut down unknown deployments**: `kredibble-backend.vercel.app` (SEC-041; it lives in a different, unidentified Vercel account) and `kredibble-backend-murex.vercel.app` (paused). Record the Render service; it's retired in 4f. | Nothing; closes SEC-041 for good |
| M12 | **WordPress on Hostinger**: enable backups, MFA on wp-admin, rotate `WORDPRESS_API_KEY` into company ownership. | New key in `API_ENV_FILE` |

---

## 6. Coverage of the infrastructure plan

| Infra plan section | Where it's handled |
|---|---|
| §3 Cloud accounts, source control, hosting, DNS | Track M (M1, M3–M7), 4g `ACCOUNTS.md` |
| §5 Standard template for future apps | 4g `APP-STANDARD.md`; `platform/` (4b) is the shared half |
| §6 Development, staging, production | D2, 4b (per-environment compose projects), 4c (pipeline), `ENVIRONMENTS.md` |
| §7 Phase 1: foundation, MFA, roles, secrets, ownership docs | Track M, D3, D9, 4g |
| §8 Phase 2: deployments, tests, approvals, rollbacks, migrations, release docs | 4a (CI gates), 4b (health-gated rollback), 4c (approval, rollback, migrations, `DEPLOYMENT.md`) |
| §9 Phase 3: uptime, API, DB, server, errors, latency, deploy failures, SSL, DNS; logs; alerts | 4d (Sentry; Better Stack monitors incl. SSL and domain expiry; Atlas alerts; Vector logs and host metrics; latency via Sentry performance and Better Stack response times; deploy failures via workflow notifications) |
| §10 Phase 4: MFA, RBAC, least privilege, separate credentials, secrets, no secrets in git, HTTPS, WAF, firewall, dependency updates, DB restrictions, audit logs, backups | Track M (MFA, RBAC, Atlas IP lists), D3, 4a (gitleaks, Dependabot), D5 (HTTPS, WAF, firewall, Authenticated Origin Pulls), D7 (separate credentials), existing app audit log (SEC-017), 4e |
| §11 Phase 5: backups and the seven recovery questions, tested restores | 4e |
| §12 GOD infrastructure (WordPress, Next.js on Vercel, RN, API on VPS, Atlas, Cloudflare) | Target shape (§3 above), 4b–4f, M12 |
| §14 Shared VPS, separate databases | `platform/` vs `deploy/` split in 4b; separate Atlas projects (D7) |
| §15 Domain strategy | D1, M3, 4f |
| §16–17 IT responsibilities, access model | 4g `ACCESS.md`, M1 teams, `CODEOWNERS` |
| §18 90-day rollout | Days 1–30: track M, 4a, 4g start. Days 31–60: 4b, 4c. Days 61–90: 4d, 4e, 4f, 4g finished |

**Not in this plan:** BexieMart (its own repo; it reuses `platform/` and `APP-STANDARD.md`), Neon, office/employee IT, SEC-092 (legal), SEC-087 (store readiness). The app-level security backlog in `task.md` is also out of scope; its open P0s, such as SEC-080, still gate launch. Tracks M and 4a–4c can proceed in parallel with that work.

---

## 7. New findings (recorded in `task.md` by Plan 4a, Task 1)

| ID | Finding | Priority |
|---|---|---|
| SEC-110 | SEC-090 files saved as UTF-16; `task.md` re-saved as Windows-1252 (fixed in 712ea6c; guard pending) | P0 |
| SEC-111 | Production mobile build on `main` points at a hostname that doesn't exist; two-level staging/dev names | P0 |
| SEC-112 | Deploy pipeline unsafe (CD Backend fails every push; mutable `:latest`, blank env, no host-key pinning, no TLS, collisions, no rollback, health can't identify the release) | P1 |
| SEC-113 | Local agent/IDE state and generated output tracked in git | P2 |
| SEC-114 | Infrastructure owned by personal accounts | P1 |
| SEC-115 | No production approval gate, no build-once promotion | P1 |
| SEC-116 | No repo hygiene gates (encoding, workflow lint, shell lint, secret scan, dependency updates) | P2 |
| SEC-117 | Known-password test accounts may exist in real databases | P1 |
| SEC-118 | EAS Update has never published (web export fails in every CD App run); fix only after SEC-111 | P1 |

SEC-089 (backups and always-on hosting) and SEC-090 (monitoring) are reopened; their real scope moves to 4b, 4e and 4d.
