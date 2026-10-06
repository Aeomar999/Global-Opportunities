# Plan 4a: Disarm SEC-090's Live Deploy Config and Add Repo Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the production hazard that PR #30 (SEC-090) put on `main`, then add the checks and the environment/release reporting that every later infrastructure plan relies on.

**Why (verified 2026-10-04, `origin/main` @ `60c1de6`):**
- **Production mobile hazard.** PR #30 merged at 14:58 UTC. Since then `kredibble-app/eas.json` points the **production** build at `https://api.globalopportunitydesk.com/api`, which has no DNS record. `cd-app.yml` has already tried to publish that config to the production update channel three times (runs 37211222000, 37222652003, 37227876413, with `EXPO_TOKEN` set). The only thing that stopped it was an unrelated web-bundling failure (SEC-118). `eas update:list --branch production` shows no published updates, so no user is affected yet. Fixing SEC-118 first would publish an update that cuts every installed app off from the API.
- **CD Backend is red.** It fails on every push since PR #30: the new VPS job has no SSH secrets, and the Render deploy step is gone. Render still deploys `main` through its own GitHub integration.
- **False status.** SEC-090 is marked ✅ Done, but no error tracking or uptime monitoring exists.
- **Leftover tracked files.** Local state and a UTF-16 test report are still tracked. (712ea6c already re-encoded the UTF-16 files and repaired `task.md`.)
- **Gap for later plans.** The API can't say which environment or release it is.

**Architecture:**
- **Two PRs.**
  - *PR 1 (hotfix, Tasks 1–2):* record the findings, point production back at Render and restore the Render-era `cd-backend.yml`. Merge as soon as it's reviewed.
  - *PR 2 (Tasks 3–8):* guardrails and environment reporting, branched from `main` after PR 1 merges.
- **Production behaviour stays as it was before PR #30.** Render is the API host and the production URLs point at it. Staging and dev profiles keep pointing at hosts that don't exist yet, so those builds fail to connect instead of writing to the production database.
- **Guardrails use plain Node and stock CI tools.** `scripts/check-encoding.mjs` has no dependencies and is tested with `node:test`. The CI `hygiene` job runs it, plus actionlint, shellcheck and gitleaks from pinned images.
- **Environment identity:** `APP_ENV` (development | test | staging | production) is separate from `NODE_ENV` (whether production code paths run). `RELEASE_SHA` comes from the Docker build, with Render's `RENDER_GIT_COMMIT` as fallback. Both appear on `GET /api/v1/health`.

**Tech Stack:** Node 24 (`.nvmrc`), `node:test`, Express + Jest + supertest + mongodb-memory-server, GitHub Actions, `rhysd/actionlint:1.7.12`, `ghcr.io/gitleaks/gitleaks:v8.30.1`, shellcheck (preinstalled on `ubuntu-latest`), Dependabot.

## Global Constraints

- **Work in a dedicated worktree outside the shared folder.** Other sessions switch branches in `Global-Opportunities/` and have committed untracked files from it (81129fb swept these plan drafts into `main`). For PR 1:
  ```bash
  cd "/c/Users/Jerry/Desktop/PROJECT 2026/Global-Opportunities"
  git fetch origin
  git worktree add "../GO-plan4a-hotfix" -b security/SEC-111-disarm-deploy-config origin/main
  cd "../GO-plan4a-hotfix"
  ```
  For PR 2 (after PR 1 merges): `git fetch origin && git worktree add "../GO-plan4a-guardrails" -b security/SEC-116-repo-guardrails origin/main`, then `(cd kredibble-backend && npm ci)` in that worktree before Task 7.
- **Before every commit,** run `git branch --show-current`; it must print this plan's branch. Stage files by explicit path only. Never `git add .`, a bare `git add -A`, or `git commit -a`. Commit messages use `SEC-1xx: …` and end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git push` after every commit.
- **Never write repo files with Windows PowerShell 5.1.** Its `>`, `Out-File` and `Set-Content` produce UTF-16 or ANSI, which is what broke SEC-090 (SEC-110). Use the editor tools, Git Bash or Node, and run this plan's shell commands in **Git Bash** from the worktree root.
- **Production stays on Render.** Don't change `API_PROXY_TARGET` or `CORS_ORIGIN`. The only production URL edit is Task 2's revert. Don't touch SEC-118 (the web-export failure) in this plan.
- **CI on `main` was already red at the time of writing** (run 37222652035: `Backend (lint, test)` at lint, `Admin (Playwright end-to-end)` at the real-API run). That's out of scope. If it's still red, list the failing jobs in each PR body; don't fix them here.
- **Backend checks:** `(cd kredibble-backend && npm run lint && npm test)` whenever backend files change.
- **Workflows:** never mask a failing step (`|| true`); every job keeps `timeout-minutes`.
- **Secrets:** never print, log or commit a password, token or key.
- **Records:** findings go into `task.md` before any fix (Task 1, per `AGENTS.md`). Task 8 updates statuses, the Progress Log, `PLAN-phase-3-roadmap.md` and `C:\Users\Jerry\Desktop\PROJECT 2026\SYSTEM_DESIGN_LESSONS.md`.

## File Structure

| File | PR | Change | Responsibility |
|---|---|---|---|
| `task.md` | 1, 2 | Modify | Findings SEC-110–118; SEC-089/090 statuses; Q7 note; Progress Log |
| `PLAN-4-infrastructure-roadmap.md`, `PLAN-4a-repair-sec-090.md` | 1 | Replace | The revised plans (`main` has the 81129fb drafts) |
| `kredibble-app/eas.json` | 1 | Modify | Production `EXPO_PUBLIC_API_URL` back to Render |
| `.github/workflows/cd-backend.yml` | 1, 2 | Restore, then modify | Render-era version (`374eae1`); PR 2 adds the `RELEASE_SHA` build arg |
| `scripts/check-encoding.mjs`, `scripts/check-encoding.test.mjs` | 2 | Create | Fails on non-UTF-8 tracked text files; unit tests |
| `.gitattributes` | 2 | Create | Keep `.sh` files LF |
| `package.json` (root) | 2 | Modify | `check:encoding`, `test:scripts` |
| `AGENTS.md` | 2 | Modify | Encoding guardrail; CI table mentions the hygiene job |
| `.gitignore` | 2 | Modify | Ignore local agent/IDE state and generated test output |
| `.github/workflows/ci.yml` | 2 | Modify | `hygiene` job; `RELEASE_SHA` build arg |
| `.github/dependabot.yml` | 2 | Create | Weekly npm / actions / Docker updates |
| `kredibble-backend/src/config/env.js` | 2 | Modify | `appEnv`, `release` |
| `kredibble-backend/src/routes/index.js` | 2 | Modify | Health check reports `environment`, `release` |
| `kredibble-backend/tests/sec-112-environment-release.test.js` | 2 | Create | Health wiring + boot-config tests |
| `kredibble-backend/Dockerfile` | 2 | Modify | `ARG/ENV RELEASE_SHA` |
| `render.yaml`, `kredibble-backend/.env.example` | 2 | Modify | `APP_ENV` explicit; variables documented |

---

## PR 1: Disarm (merge as soon as it's reviewed)

### Task 1: Record the findings

**Files:**
- Modify: `task.md`
- Replace: `PLAN-4-infrastructure-roadmap.md`, `PLAN-4a-repair-sec-090.md` (copy the revised versions from the shared folder `C:\Users\Jerry\Desktop\PROJECT 2026\Global-Opportunities\`, where they are untracked; `main` has the older 81129fb drafts)

**Interfaces:**
- Produces: finding ids SEC-110 … SEC-118, used in every later commit message and Progress Log row.

- [x] **Step 1: Bring in the revised plans**

```bash
cp "../Global-Opportunities/PLAN-4-infrastructure-roadmap.md" "../Global-Opportunities/PLAN-4a-repair-sec-090.md" .
git diff --stat -- PLAN-4-infrastructure-roadmap.md PLAN-4a-repair-sec-090.md
```
Expected: both files show changes against `main`'s copies.

- [x] **Step 2: Correct the SEC-089 and SEC-090 rows**

In the *Findings Summary* table, replace:
```
| SEC-089 | Shared Redis configured via render.yaml for rate limits | P1 | Operations | ✅ Done |
```
with:
```
| SEC-089 | Shared Redis, always-on hosting, database backups | P1 | Operations | 🟡 Redis configured (render.yaml). Not always-on: the first request on 2026-10-04 19:33 UTC timed out after 60 s while Render woke up, so the Starter plan in render.yaml isn't in effect. Backups and restore drill open — Plans 4b, 4e |
```
and replace:
```
| SEC-090 | Error tracking, uptime monitoring, VPS/Docker infrastructure | P1 | Operations | ✅ Done |
```
with:
```
| SEC-090 | No error tracking or uptime monitoring | P1 | Operations | Open — PR #30 marked it Done, but it added deploy scaffolding only (no error tracking, no uptime checks); Plan 4d |
```

- [x] **Step 3: Add the new rows after the SEC-109 row**

Insert directly below the row that starts `| SEC-109 | The admin e2e server loaded`:
```
| SEC-110 | SEC-090 commit saved 11 files as UTF-16 (3 CD workflows, `eas.json`, 3 `.env.example`, `docker-compose.prod.yml`, `DISASTER_RECOVERY.md`, 2 shell scripts); b804a81 re-saved `task.md` as Windows-1252 | P0 | Repo / CI/CD | ✅ Fixed in 712ea6c (re-encoded, task.md repaired); CI guard in SEC-116 |
| SEC-111 | Production mobile config on `main` (PR #30) points at `api.globalopportunitydesk.com`, which does not resolve; CD App tried to publish it to the production channel on three pushes and was stopped only by SEC-118; staging/dev names are two levels deep (`staging.api.…`), which Cloudflare's free edge certificate doesn't cover | P0 | Deployment | Open — Plan 4a Task 2 |
| SEC-112 | Deploy pipeline unsafe: CD Backend fails on every push since PR #30 (no SSH secrets; Render deploy step removed); every branch overwrites `:latest`, which the VPS compose file runs; compose never copied; blank `environment:` values; mixed-case image ref; no SSH host-key pinning; API port published without TLS; container names collide across environments; no health-gated rollback; health check can't identify the release | P1 | CI/CD + Deployment | Open — Plan 4a (revert, health), Plans 4b/4c |
| SEC-113 | Local agent/IDE state and generated output tracked in git (`.claude/scheduled_tasks.lock`, `.idea/`, UTF-16 `kredibble-backend/test-results.json`, `server_*.log`; the Ralph-loop file was untracked in 712ea6c) | P2 | Repo hygiene | Open — Plan 4a |
| SEC-114 | Infrastructure owned by personal accounts (GitHub repo and GHCR namespace, Expo owner, Vercel scope, Render service) | P1 | Ownership | Open — Plan 4 track M, Plan 4g |
| SEC-115 | No production approval gate and no build-once promotion: every push to `main` deploys straight to production | P1 | CI/CD | Open — Plan 4c |
| SEC-116 | No repo hygiene gates: file encoding, workflow lint, shell lint, secret scanning, automated dependency updates | P2 | CI/CD | Open — Plan 4a |
| SEC-117 | Known-password test accounts may exist in real databases (`@test.com` seed accounts; a test admin was created against production; the e2e admin login is a public default) | P1 | Data / Access | Open — Plan 4 track M5 |
| SEC-118 | EAS Update has never published: every CD App run fails at `expo export` for web (`react-native-css-interop/.cache/web.css` SHA-1 error), so the OTA path described in `AGENTS.md` doesn't work | P1 | Mobile CI/CD | Open — Plan 4c; fix only after SEC-111 |
```

- [x] **Step 4: Add the task cards**

Insert on the line before `# Execution Order`, followed by a blank line:

````markdown
# 2026-10-04 Infrastructure Findings (Plan 4)

Found while planning the move to the company infrastructure platform (`Company_IT_Application_Infrastructure_Plan.md`). Roadmap: `PLAN-4-infrastructure-roadmap.md`.

### SEC-110 — SEC-090 files saved as UTF-16; `task.md` re-saved as Windows-1252 (fixed)
**Evidence:** 7f8be2c wrote `.github/workflows/cd-{backend,admin,app}.yml`, `kredibble-app/eas.json`, `kredibble-{backend,admin,app}/.env.example`, `docker-compose.prod.yml`, `DISASTER_RECOVERY.md` and `kredibble-backend/scripts/db-{dump,restore}.sh` as UTF-16LE, which git showed as binary. b804a81 re-saved `task.md` as Windows-1252, turning every ✅ ❌ ⚠️ into `?`. Cause: Windows PowerShell 5.1, whose `>` and `Out-File` write UTF-16. 712ea6c re-encoded the files and repaired `task.md` before PR #30 merged.
**Remaining:** a CI check so it can't recur (SEC-116).

### SEC-111 — Production mobile build points at a hostname that doesn't exist
**Evidence:** on `main` since PR #30, `eas.json` production `EXPO_PUBLIC_API_URL` is `https://api.globalopportunitydesk.com/api`, which has no DNS record on 2026-10-04 (the apex resolves to Hostinger). CD App runs 37211222000, 37222652003 and 37227876413 logged `EXPO_PUBLIC_API_URL=https://api.globalopportunitydesk.com/api` and ran `eas update --channel production`. Only the web-export failure (SEC-118) stopped them. `eas update:list --branch production` shows no updates. Q7 (*Open Questions*) names `api.kredibble.app`, which doesn't resolve either. The staging and dev names (`staging.api.…`, `dev.api.…`) are two levels below the apex, and Cloudflare's free Universal SSL certificate covers only one level.
**Fix:** point production back at `https://kredibble-api.onrender.com/api` (Plan 4a Task 2). Settle the domain (roadmap D1), use single-level names (Plan 4c), and switch production only in the Plan 4f cutover, after the API answers on the new name.
**Acceptance criteria:**
- [x] The production profile names a host that answers `/api/v1/health` with 200
- [ ] The production API URL changes only in the Plan 4f cutover commit

### SEC-112 — Deploy pipeline is unsafe
**Evidence:** since PR #30, `cd-backend.yml` runs `deploy-vps` (`appleboy/ssh-action`) on every push and fails, because no `VPS_*` secrets exist; the Render deploy step it replaced is gone. The workflow tags every branch build `latest` while `docker-compose.prod.yml` runs `:latest`. Nothing copies the compose file to the VPS. Every `environment:` entry is blank (`NODE_ENV=`, `DATABASE_URL=` …). `docker pull ghcr.io/${{ github.repository }}/…` is mixed case, which GHCR rejects (the pre-SEC-090 workflow had a comment warning about this). No host-key fingerprint is pinned. `ports: "4000:4000"` exposes plain HTTP. `container_name` collides across environments. There's no health-gated rollback, and `/api/v1/health` doesn't say which release or environment answered.
**Fix:** Plan 4a: restore the Render-era `cd-backend.yml`; add `APP_ENV` and the release SHA to the health check. Plan 4b: per-environment compose projects with no published ports, the env file outside git, Caddy + Cloudflare TLS, a health-gated deploy with automatic rollback. Plan 4c: images tagged by commit SHA only, a pinned host key, a forced-command deploy key.
**Acceptance criteria:**
- [x] CD Backend no longer fails on pushes to `main`
- [x] `/api/v1/health` reports `environment` and `release` (test)
- [ ] A deploy whose new container never reports the expected release rolls back and fails the job (staging)

### SEC-113 — Local agent and IDE state tracked in git
**Evidence:** `git ls-files` on `main` lists `.claude/scheduled_tasks.lock`, 6 files under `.idea/`, `kredibble-backend/test-results.json` (a UTF-16 Jest report) and `kredibble-backend/server_{stdout,stderr}.log`. 712ea6c already untracked `.claude/ralph-loop.local.md`, which held the e2e admin login; that login is the public default in `scripts/e2e-server.js`, so SEC-117 covers the real databases.
**Fix:** `git rm --cached` the files and ignore their paths.
**Acceptance criteria:**
- [x] `git ls-files .claude .idea` lists nothing; the files remain on disk

### SEC-114 — Infrastructure owned by personal accounts
**Evidence:** repository `Aeomar999/Global-Opportunities` and its GHCR images; `app.json` `"owner": "amoahjerry835"`; Vercel scope `jerry-amoahs-projects` (also in `render.yaml` `CORS_ORIGIN`); the Render service and the JWT secrets it generated. The infra plan's key principle is that company infrastructure must not depend on a developer's personal account.
**Fix:** Plan 4 track M (company GitHub org, Vercel team, Expo org, Atlas org, Cloudflare, Hostinger, password manager) and Plan 4g (`ACCOUNTS.md`, `ACCESS.md`).
**Acceptance criteria:**
- [ ] Every production resource is owned by a company account with MFA and a second admin, recorded in `docs/infrastructure/ACCOUNTS.md`

### SEC-115 — No production approval gate, no build-once promotion
**Evidence:** `cd-backend.yml`, `cd-admin.yml` and `cd-app.yml` deploy to production on every push to `main` with no approval. SEC-090's branch-per-environment design rebuilds the image for each branch, so production would never run the exact image staging tested.
**Fix:** Plan 4c: build once per commit, deploy it to staging automatically, then promote the same image to production through a GitHub Environment with required reviewers.
**Acceptance criteria:**
- [ ] Production deploys wait for approval
- [ ] Staging and production report the same release SHA for the same release

### SEC-116 — No repository hygiene gates
**Evidence:** SEC-110 reached a commit because nothing checks file encodings, workflow syntax or shell scripts. There's no secret scanner (a login was committed in 7f8be2c) and no automated dependency updates (SEC-078 and SEC-088 were found by hand).
**Fix:** Plan 4a: `scripts/check-encoding.mjs`; a `Repo hygiene` CI job running the encoding check, actionlint, shellcheck and gitleaks; `.github/dependabot.yml`.
**Acceptance criteria:**
- [x] `Repo hygiene` runs on every PR and is green
- [x] Dependabot opens weekly update PRs

### SEC-117 — Known-password test accounts may exist in real databases
**Evidence:** the gitignored `kredibble-backend/scripts/seed-test-credentials.js` creates `admin@test.com`, `seeker@test.com` and `hirer@test.com` with weak passwords. The P0 section above records a test admin created against the production database. The e2e admin login (`test-admin@kredibble.com`) is a public default in `scripts/e2e-server.js`.
**Fix:** track M5: query production and staging for `@test.com` and `test-admin@` accounts and delete them (or rotate their passwords and remove the admin role). Never run the seed script against a non-local database.
**Acceptance criteria:**
- [ ] A query against production returns no such accounts (date and query recorded in the Progress Log)

### SEC-118 — EAS Update has never published
**Evidence:** every recent CD App run (37033225462, 37169138873, 37211222000, 37222652003, 37227876413) passes lint, typecheck and tests, then fails in `Publish update`: `expo export … --platform=all` fails web bundling with `Failed to get the SHA-1 for: …/react-native-css-interop/.cache/web.css` → `Export failed` → `update command failed`. `eas update:list --branch production` returns no updates.
**Fix:** Plan 4c, **only after SEC-111 is fixed**: publish native platforms only (the mobile app ships no web build), or fix NativeWind's web cache path. Fixing it while SEC-111 is open would publish an update pointing every installed app at a host that doesn't exist.
**Acceptance criteria:**
- [ ] A staging-channel update publishes from CI and a test device receives it
````

- [x] **Step 5: Annotate Q7**

In `# Open Questions`, directly below the line `   - API & WebSockets: \`https://api.kredibble.app\``, add:
```
   - **2026-10-04 note (Plan 4):** `kredibble.app` and `api.kredibble.app` have no DNS records, the first request to Render took over 60 s (still sleeping), and the company infrastructure plan specifies a Hostinger VPS behind Cloudflare. Hosting and domain are re-decided in `PLAN-4-infrastructure-roadmap.md` (D1, D2); until then production stays on `kredibble-api.onrender.com`.
```

- [x] **Step 6: Add a Progress Log row**

Append after the last row of the `# Progress Log` table (the line before the blank line that precedes `# Open Questions`):
```
| 2026-10-04 | SEC-110–118 | — | Findings recorded | Plan 4 roadmap; SEC-089 and SEC-090 statuses corrected; SEC-111 hazard confirmed from CD App logs (no production update was published) |
```

- [x] **Step 7: Verify**

```bash
file task.md
grep -c "SEC-11[0-8]" task.md
git diff --stat
```
Expected: `UTF-8 text …` (not "Non-ISO"); the SEC-11x count is at least 19 (9 rows + 9 card headings + the log row). The diff touches `task.md` and the two plan files only.

- [x] **Step 8: Commit**

```bash
git branch --show-current   # must print security/SEC-111-disarm-deploy-config
git add task.md PLAN-4-infrastructure-roadmap.md PLAN-4a-repair-sec-090.md
git commit -m "SEC-111: record infrastructure findings SEC-110 to SEC-118

SEC-090 was marked done without error tracking or uptime checks; SEC-089's
always-on claim does not hold (Render still cold-starts). Revised Plan 4 docs.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin security/SEC-111-disarm-deploy-config
```

---

### Task 2: Point production back at Render and restore the Render-era backend CD

**Files:**
- Modify: `kredibble-app/eas.json` (production profile only)
- Restore from `374eae1`: `.github/workflows/cd-backend.yml` (unchanged on `main` since PR #30, so this exactly undoes PR #30's version)

**Interfaces:**
- Produces: `eas.json` `build.production.env.EXPO_PUBLIC_API_URL === "https://kredibble-api.onrender.com/api"`. PR 2 (Task 7) adds a build arg to the restored `cd-backend.yml` `image` job.

- [x] **Step 1: Confirm the hazard**

```bash
node -p "require('./kredibble-app/eas.json').build.production.env.EXPO_PUBLIC_API_URL"
nslookup api.globalopportunitydesk.com 2>&1 | tail -3
git diff b8c1e2f origin/main --stat -- .github/workflows/cd-backend.yml kredibble-app/eas.json
```
Expected: `https://api.globalopportunitydesk.com/api`; nslookup finds no address for the name; the last command prints nothing (neither file changed since PR #30).

- [x] **Step 2: Point the production profile at Render**

In `kredibble-app/eas.json`, inside `"production"`, replace:
```json
        "EXPO_PUBLIC_API_URL": "https://api.globalopportunitydesk.com/api"
```
with:
```json
        "EXPO_PUBLIC_API_URL": "https://kredibble-api.onrender.com/api"
```
Leave the `development` and `staging` profiles as they are. A staging build that can't connect fails safe; pointing it at Render would let testers write to the production database. Plan 4c gives them real hosts.

- [x] **Step 3: Restore the Render-era backend CD**

```bash
git checkout 374eae1 -- .github/workflows/cd-backend.yml
git diff 374eae1 -- .github/workflows/cd-backend.yml
grep -n "branches\|RENDER_DEPLOY_HOOK_URL\|ssh-action" .github/workflows/cd-backend.yml
```
Expected: the diff is empty. The grep shows `branches: [main]` and the `RENDER_DEPLOY_HOOK_URL` lines, and no `ssh-action`. (Without the hook secret, the step prints a notice and skips; Render still deploys `main` through its GitHub integration, the `main - kredibble-api` deployments.)

- [x] **Step 4: Verify**

```bash
node -e "const p = require('./kredibble-app/eas.json').build.production.env.EXPO_PUBLIC_API_URL; if (p !== 'https://kredibble-api.onrender.com/api') { throw new Error(p); } console.log('production ->', p)"
curl -s --max-time 120 https://kredibble-api.onrender.com/api/v1/health
```
Expected: `production -> https://kredibble-api.onrender.com/api`, then JSON with `"status":"ok"`. The first call can take over a minute while Render wakes; that delay is the SEC-089 evidence.

- [x] **Step 5: Commit, push, open PR 1**

```bash
git branch --show-current   # must print security/SEC-111-disarm-deploy-config
git add kredibble-app/eas.json .github/workflows/cd-backend.yml
git commit -m "SEC-111: point production back at Render; restore the Render-era backend CD

PR #30 pointed the production mobile build at api.globalopportunitydesk.com,
which has no DNS record. CD App tried to publish it to the production channel
three times and was stopped only by an unrelated web-export failure (SEC-118).
PR #30's cd-backend replaced the Render step with a VPS deploy that fails on
every push (no VPS exists yet; SEC-112). Plans 4b/4c rebuild both properly.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
BODY="$(mktemp)"
cat > "$BODY" <<'EOF'
## Why this is urgent

Since PR #30, `eas.json` points the **production** app at `api.globalopportunitydesk.com`, which has no DNS record. CD App has already tried to publish that to the production update channel three times (runs 37211222000, 37222652003, 37227876413). Only an unrelated web-bundling failure (SEC-118) stopped it. EAS shows no published production updates, so nobody is affected yet. Anyone fixing SEC-118 before this merges would cut every installed app off from the API.

## What

- `eas.json`: production `EXPO_PUBLIC_API_URL` back to `https://kredibble-api.onrender.com/api` (SEC-111). Staging/dev profiles unchanged; they fail safe.
- `cd-backend.yml`: restored to the Render-era version (374eae1). PR #30's VPS job fails on every push because no VPS exists yet (SEC-112).
- `task.md`: findings SEC-110–SEC-118; SEC-089 and SEC-090 statuses corrected (SEC-090 was marked done without monitoring).
- Revised `PLAN-4-infrastructure-roadmap.md` and `PLAN-4a-repair-sec-090.md`.

## Production impact

Restores the pre-PR #30 production configuration. Render remains the API host. Merging touches `kredibble-app/`, so CD App runs; it still fails at the web export (SEC-118), and if it ever succeeded it would publish the Render URL, which is today's behaviour.

## CI

<list any jobs that are red on main too, e.g. Backend lint / Admin Playwright, with run ids>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
gh pr create --base main --head security/SEC-111-disarm-deploy-config --title "SEC-111: point production back at Render; restore Render-era backend CD" --body-file "$BODY"
rm "$BODY"
```
Before running `gh pr create`, replace the `<list …>` line with the actual failing jobs (or "All green"). Expected: the PR URL is printed. Ask for review and merge before starting PR 2, and tell everyone working on the mobile app not to fix SEC-118 until it's merged.

---

## PR 2: Guardrails and environment reporting

Start only after PR 1 is merged. Create the `GO-plan4a-guardrails` worktree from the fresh `origin/main` (Global Constraints).

### Task 3: Encoding check for tracked files

**Files:**
- Create: `scripts/check-encoding.mjs`
- Create: `scripts/check-encoding.test.mjs`
- Create: `.gitattributes`
- Modify: `package.json` (root)
- Modify: `AGENTS.md` (Guardrails section)

**Interfaces:**
- Produces: `findEncodingProblems(filePath: string, content: Buffer): string[]` and `isCheckedPath(filePath: string): boolean` (exported). `node scripts/check-encoding.mjs` exits 1 when any tracked file fails. Task 5 runs both in CI.

- [x] **Step 1: Write the failing test**

Create `scripts/check-encoding.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findEncodingProblems, isCheckedPath } from './check-encoding.mjs';

const utf16WithBom = (text) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]);
const utf8WithBom = (text) => Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, 'utf8')]);

test('flags a UTF-16 file with a byte-order mark', () => {
  const problems = findEncodingProblems('.github/workflows/cd-backend.yml', utf16WithBom('name: CD\n'));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /UTF-16/);
});

test('flags UTF-16 without a byte-order mark by its NUL bytes', () => {
  const problems = findEncodingProblems('docker-compose.yml', Buffer.from('services:\n', 'utf16le'));
  assert.match(problems[0], /NUL/);
});

test('flags Windows-1252 text, which is not valid UTF-8', () => {
  // 0x97 is an em dash in Windows-1252 and an invalid byte in UTF-8.
  const problems = findEncodingProblems('task.md', Buffer.from([0x53, 0x45, 0x43, 0x20, 0x97, 0x20, 0x78]));
  assert.match(problems[0], /not valid UTF-8/);
});

test('accepts UTF-8 with emoji and symbols', () => {
  assert.deepEqual(findEncodingProblems('task.md', Buffer.from('| SEC-090 | ✅ Done — ≥ 2 replicas |\n', 'utf8')), []);
});

test('accepts a UTF-8 byte-order mark in Markdown', () => {
  assert.deepEqual(findEncodingProblems('task.md', utf8WithBom('# task.md\n')), []);
});

test('rejects a UTF-8 byte-order mark in YAML, JSON, shell and dotenv files', () => {
  for (const file of ['ci.yml', 'kredibble-app/eas.json', 'scripts/db-dump.sh', 'kredibble-backend/.env.example']) {
    assert.match(findEncodingProblems(file, utf8WithBom('x\n'))[0] ?? '', /byte-order mark/, file);
  }
});

test('rejects CRLF line endings in shell scripts only', () => {
  assert.match(findEncodingProblems('scripts/backup.sh', Buffer.from('#!/bin/bash\r\necho hi\r\n'))[0] ?? '', /CRLF/);
  assert.deepEqual(findEncodingProblems('README.md', Buffer.from('line\r\nline\r\n')), []);
});

test('skips binary formats', () => {
  assert.equal(isCheckedPath('kredibble-app/assets/images/icon.png'), false);
  assert.equal(isCheckedPath('KREDBBLE_SECURITY_HARDENING_REPORT.docx'), false);
  assert.equal(isCheckedPath('task.md'), true);
});
```

- [x] **Step 2: Run the test and see it fail**

Run: `node --test scripts/check-encoding.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `…/scripts/check-encoding.mjs`.

- [x] **Step 3: Write the checker**

Create `scripts/check-encoding.mjs`:
```js
#!/usr/bin/env node
/**
 * Text-encoding check for every git-tracked file (SEC-116).
 *
 * Fails on what broke SEC-090 (SEC-110): UTF-16 files (what Windows PowerShell 5.1
 * writes by default), stray NUL bytes, invalid UTF-8 (a file re-saved as
 * Windows-1252), a UTF-8 byte-order mark in a file whose parser rejects one, and
 * CRLF line endings in shell scripts.
 *
 * Usage: node scripts/check-encoding.mjs   (exits 1 when any file fails)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Formats that are binary by design and never checked. */
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.icns', '.bmp', '.svgz',
  '.pdf', '.docx', '.xlsx', '.pptx', '.zip', '.gz', '.tgz', '.jar', '.keystore', '.jks',
  '.ttf', '.otf', '.woff', '.woff2', '.mp3', '.mp4', '.mov', '.webm', '.wasm',
]);

/** Formats whose parsers (YAML, JSON, bash) reject a UTF-8 byte-order mark. Dotenv files are matched by name. */
const BOM_SENSITIVE_EXTENSIONS = new Set(['.yml', '.yaml', '.json', '.sh']);

const strictUtf8 = new TextDecoder('utf-8', { fatal: true });

/**
 * Whether a tracked path is text that should be checked.
 * @param {string} filePath repository-relative path
 * @returns {boolean}
 */
export const isCheckedPath = (filePath) => !BINARY_EXTENSIONS.has(extname(filePath).toLowerCase());

/**
 * Lists the encoding problems in one file.
 * @param {string} filePath repository-relative path (drives the extension rules and messages)
 * @param {Buffer} content the file's raw bytes
 * @returns {string[]} one message per problem; empty when the file is fine
 */
export const findEncodingProblems = (filePath, content) => {
  const startsWith = (...bytes) => bytes.every((byte, index) => content[index] === byte);

  if (startsWith(0xff, 0xfe) || startsWith(0xfe, 0xff)) {
    return ['is UTF-16 (it has a UTF-16 byte-order mark); re-save it as UTF-8'];
  }
  if (content.includes(0x00)) {
    return ['contains NUL bytes (probably UTF-16 without a byte-order mark); re-save it as UTF-8'];
  }
  try {
    strictUtf8.decode(content);
  } catch {
    return ['is not valid UTF-8 (probably re-saved as Windows-1252); restore it from git history'];
  }

  const problems = [];
  const extension = extname(filePath).toLowerCase();
  const isBomSensitive = BOM_SENSITIVE_EXTENSIONS.has(extension) || basename(filePath).startsWith('.env');
  if (isBomSensitive && startsWith(0xef, 0xbb, 0xbf)) {
    problems.push('starts with a UTF-8 byte-order mark, which its parser rejects; remove it');
  }
  if (extension === '.sh' && content.includes('\r\n')) {
    problems.push('has CRLF line endings; bash needs LF');
  }
  return problems;
};

/**
 * Checks every tracked text file and prints each problem.
 * @returns {number} how many files failed
 */
const checkTrackedFiles = () => {
  const listing = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const files = listing.split('\0').filter(Boolean).filter(isCheckedPath);
  let failingFiles = 0;
  for (const file of files) {
    let content;
    try {
      content = readFileSync(file);
    } catch (error) {
      if (error.code === 'ENOENT') continue; // deleted in the working tree, still in the index
      throw error;
    }
    const problems = findEncodingProblems(file, content);
    if (problems.length > 0) {
      failingFiles += 1;
      for (const problem of problems) console.error(`${file}: ${problem}`);
    }
  }
  console.log(`check-encoding: ${files.length} files checked, ${failingFiles} failing`);
  return failingFiles;
};

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  process.exitCode = checkTrackedFiles() > 0 ? 1 : 0;
}
```

- [x] **Step 4: Run the test and see it pass**

Run: `node --test scripts/check-encoding.test.mjs`
Expected: `# pass 8`, `# fail 0`. (These exact files were run on 2026-10-04 with Node 24: 8/8.)

- [x] **Step 5: Run the checker on the repo**

Run: `node scripts/check-encoding.mjs`
Expected: exit code 1 and exactly one failing file (as measured against `main` @ `60c1de6`):
```
kredibble-backend/test-results.json: is UTF-16 (it has a UTF-16 byte-order mark); re-save it as UTF-8
check-encoding: … files checked, 1 failing
```
If more files fail, something new was written with PowerShell. Record it as a SEC row before fixing it. Task 4 untracks the test report; CI doesn't run the check until Task 5.

- [x] **Step 6: Keep shell scripts LF on Windows checkouts**

Create `.gitattributes`:
```
# Shell scripts must keep LF line endings, or bash fails with "$'\r': command not found" (SEC-116).
*.sh text eol=lf
```

- [x] **Step 7: Add the root scripts**

In the root `package.json` `"scripts"` object, after `"build:admin"`, add:
```json
    "check:encoding": "node scripts/check-encoding.mjs",
    "test:scripts": "node --test scripts/check-encoding.test.mjs"
```
(Put a comma after the `"build:admin"` line.) Run: `npm run test:scripts`. Expected: `# pass 8`.

- [x] **Step 8: Add the guardrail to `AGENTS.md`**

In `## Guardrails`, after the `- **No secrets in code**` bullet, add:
```
- **Text files are UTF-8** — never write repo files with Windows PowerShell 5.1: `>`, `Out-File` and `Set-Content` produce UTF-16 or ANSI (SEC-110). Use the editor tools, Git Bash or Node. `npm run check:encoding` at the repo root must report 0 failing files; CI enforces it.
```

- [x] **Step 9: Commit**

```bash
git branch --show-current   # must print security/SEC-116-repo-guardrails
git add scripts/check-encoding.mjs scripts/check-encoding.test.mjs .gitattributes package.json AGENTS.md
git commit -m "SEC-116: check tracked files for UTF-16, Windows-1252 and stray BOMs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin security/SEC-116-repo-guardrails
```

---

### Task 4: Stop tracking local state and generated output

**Files:**
- Modify: `.gitignore`
- Untrack (files stay on disk): `kredibble-backend/test-results.json`, `.claude/scheduled_tasks.lock`, `.idea/**`, `kredibble-backend/server_stderr.log`, `kredibble-backend/server_stdout.log`

**Interfaces:**
- Produces: an index with no local or generated files, so the checker reports 0 and Task 5's secret scan covers only project files.

- [x] **Step 1: List what's tracked**

Run: `git ls-files .claude .idea .kilo .remember .superpowers kredibble-backend/test-results.json kredibble-backend/server_stderr.log kredibble-backend/server_stdout.log`
Expected: `.claude/scheduled_tasks.lock`, 6 `.idea/` files, `kredibble-backend/test-results.json` and the two `.log` files. If anything else under `.claude/` is listed (for example a shared `settings.json`), leave it tracked.

- [x] **Step 2: Ignore them**

Append to the root `.gitignore` (`.claude/*.local.*` is already there from 712ea6c; `*.log` already covers the logs, which were force-added earlier):
```
.claude/*.lock
.idea/
.kilo/
.remember/
.superpowers/

# Generated test output (SEC-113)
kredibble-backend/test-results.json
```

- [x] **Step 3: Remove them from the index only**

```bash
git rm --cached -r --quiet .claude/scheduled_tasks.lock .idea kredibble-backend/test-results.json kredibble-backend/server_stderr.log kredibble-backend/server_stdout.log
```

- [x] **Step 4: Verify**

```bash
git ls-files .claude .idea kredibble-backend/test-results.json
git check-ignore -v .claude/scheduled_tasks.lock .idea/vcs.xml kredibble-backend/test-results.json
node scripts/check-encoding.mjs
```
Expected: the first prints nothing; the second prints a `.gitignore` match for each path; the third prints `0 failing` and exits 0.

- [x] **Step 5: Commit**

```bash
git branch --show-current   # must print security/SEC-116-repo-guardrails
git add .gitignore
git commit -m "SEC-113: stop tracking local agent/IDE state and the generated Jest report

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```
(`git rm --cached` already staged the removals.)

---

### Task 5: Repo hygiene job in CI

**Files:**
- Modify: `.github/workflows/ci.yml` (new `hygiene` job)
- Create (only if gitleaks reports false positives): `.gitleaksignore`
- Modify: `AGENTS.md` (CI/CD table, `ci.yml` row)

**Interfaces:**
- Consumes: `scripts/check-encoding.mjs` and its test (Task 3).
- Produces: the check `Repo hygiene (encoding, workflows, shell, secrets)`. Roadmap track M1 makes it a required check.

- [x] **Step 1: Add the job**

In `.github/workflows/ci.yml`, add this job at the end of `jobs:`, at the same indentation as the other jobs:
```yaml
  hygiene:
    name: Repo hygiene (encoding, workflows, shell, secrets)
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
      - name: Encoding check tests
        run: node --test scripts/check-encoding.test.mjs
      # SEC-110: UTF-16 workflow files are rejected by GitHub; Windows-1252 destroys task.md.
      - name: Text files are UTF-8
        run: node scripts/check-encoding.mjs
      # actionlint also runs shellcheck on every run: block.
      - name: Lint workflows
        run: docker run --rm -v "$GITHUB_WORKSPACE:/repo" --workdir /repo rhysd/actionlint:1.7.12 -color
      - name: Lint shell scripts
        run: git ls-files -z '*.sh' | xargs -0 --no-run-if-empty shellcheck
      # Working tree only. A one-off full-history scan is part of Plan 4 track M1.
      - name: Scan for committed secrets
        run: docker run --rm -v "$GITHUB_WORKSPACE:/repo" ghcr.io/gitleaks/gitleaks:v8.30.1 dir /repo --redact --no-banner
```

- [x] **Step 2: Run what can run locally**

```bash
node --test scripts/check-encoding.test.mjs
node scripts/check-encoding.mjs
```
Expected: `# pass 8`; `0 failing`.

If Docker Desktop is available, lint the workflows locally. actionlint reads only `.github/workflows/`, so the working tree is fine:
```bash
MSYS_NO_PATHCONV=1 docker run --rm -v "$(cygpath -w "$PWD"):/repo" --workdir /repo rhysd/actionlint:1.7.12 -color
```
(`MSYS_NO_PATHCONV=1` stops Git Bash rewriting `/repo` into a Windows path.) Expected: no output, exit code 0.

Run gitleaks **only in CI**. A local working tree contains `node_modules/` and the real, gitignored `.env` files, which aren't in git and would drown the report.

- [x] **Step 3: Fix findings at the source**

- **actionlint / shellcheck:** fix each finding in the workflow or script. Don't disable rules globally. A single `# shellcheck disable=SCnnnn` is allowed only with a comment on the same line explaining why.
- **gitleaks, real secret** (a live token or key, including JWTs in `kredibble-backend/kredibble-postman-collection.json`): stop. Add a SEC row to `task.md`, ask the owner to rotate it, then remove it from the file. Rotation comes before cleanup.
- **gitleaks, false positive** (a test fixture, or an obviously fake value such as the boot-smoke-test secrets in `ci.yml`): add its `Fingerprint:` line from the report to `.gitleaksignore`, each with a `#` comment line above it saying why it's safe.

- [x] **Step 4: Update the CI table in `AGENTS.md`**

In the `## CI/CD Pipeline (GitHub Actions)` table, append to the end of the `ci.yml` row's "What it does" cell:
```
 **Hygiene:** text files are UTF-8, actionlint (with shellcheck on `run:` blocks), shellcheck on `*.sh`, gitleaks on the working tree.
```

- [x] **Step 5: Commit, push, run CI on the branch**

If Step 3 created `.gitleaksignore`, add it to the `git add` line.
```bash
git branch --show-current   # must print security/SEC-116-repo-guardrails
git add .github/workflows/ci.yml AGENTS.md
git commit -m "SEC-116: repo hygiene job (encoding, actionlint, shellcheck, gitleaks)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
gh workflow run CI --ref security/SEC-116-repo-guardrails
gh run list --branch security/SEC-116-repo-guardrails --workflow CI --limit 1
```
`ci.yml` runs on pull requests and pushes to `main`, so trigger it by hand once (it has `workflow_dispatch`). Expected when finished: `Repo hygiene (encoding, workflows, shell, secrets)` is `success`. For a failure, read `gh run view <id> --log-failed`, fix the cause and push again. Jobs that were already red on `main` (Global Constraints) are not this task's to fix.

---

### Task 6: Dependabot

**Files:**
- Create: `.github/dependabot.yml`

**Interfaces:**
- Produces: weekly update PRs. Required checks (track M1) gate them like any other PR.

- [x] **Step 1: Write the config**

Create `.github/dependabot.yml`:
```yaml
# Weekly dependency updates (SEC-116). Security updates are configured separately:
# enable "Dependabot security updates" in the repository settings (Plan 4 track M1).
version: 2
updates:
  - package-ecosystem: npm
    directory: /kredibble-backend
    schedule:
      interval: weekly
      day: monday
    open-pull-requests-limit: 5
    groups:
      minor-and-patch:
        update-types: [minor, patch]

  - package-ecosystem: npm
    directory: /kredibble-admin
    schedule:
      interval: weekly
      day: monday
    open-pull-requests-limit: 5
    groups:
      minor-and-patch:
        update-types: [minor, patch]

  # Expo pins React Native and native modules to the SDK, so routine bumps come from
  # `npx expo install --fix` during SDK upgrades. A limit of 0 keeps security updates only.
  - package-ecosystem: npm
    directory: /kredibble-app
    schedule:
      interval: weekly
      day: monday
    open-pull-requests-limit: 0

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
      day: monday
    groups:
      actions:
        patterns: ["*"]

  - package-ecosystem: docker
    directory: /kredibble-backend
    schedule:
      interval: weekly
      day: monday
```

- [x] **Step 2: Check it**

Run: `node scripts/check-encoding.mjs`. Expected: `0 failing`.
Dependabot reads the file from the default branch, so check GitHub → Insights → Dependency graph → Dependabot after PR 2 merges: all five entries should show a "last checked" time and no configuration error. Note this in the PR body.

- [x] **Step 3: Commit**

```bash
git branch --show-current   # must print security/SEC-116-repo-guardrails
git add .github/dependabot.yml
git commit -m "SEC-116: weekly Dependabot updates for npm, actions and the API image

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 7: The API reports its environment and release

**Files:**
- Create: `kredibble-backend/tests/sec-112-environment-release.test.js`
- Modify: `kredibble-backend/src/config/env.js` (after line 13 `const isProduction = …`; the `env` object at line 50)
- Modify: `kredibble-backend/src/routes/index.js` (`/health` handler near line 835; `env` is already imported on line 10)
- Modify: `kredibble-backend/Dockerfile`
- Modify: `.github/workflows/ci.yml` (`backend-image` job)
- Modify: `.github/workflows/cd-backend.yml` (`image` job)
- Modify: `render.yaml`
- Modify: `kredibble-backend/.env.example`

**Interfaces:**
- Produces:
  - `env.appEnv: 'development' | 'test' | 'staging' | 'production'`
  - `env.release: string` (commit SHA, or `'unknown'`)
  - `GET /api/v1/health` (and legacy `/api/health`) JSON gains `environment` (= `env.appEnv`) and `release` (= `env.release`). Plan 4b's `god-deploy` waits for `release === <sha>` and `environment === <env>`; Plan 4d's Sentry setup uses both.
  - Docker build arg `RELEASE_SHA`.

- [x] **Step 1: Write the failing test**

Create `kredibble-backend/tests/sec-112-environment-release.test.js`:
```js
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import request from 'supertest';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';

// A complete production configuration with obviously fake values, so env.js passes its boot checks.
const PRODUCTION_ENV = {
  NODE_ENV: 'production',
  JWT_SECRET: 'a'.repeat(64),
  ADMIN_JWT_SECRET: 'b'.repeat(64),
  DATABASE_URL: 'mongodb://127.0.0.1:27017/kredibble-config-test',
  CORS_ORIGIN: 'https://admin.example.com',
  OPENAI_API_KEY: 'sk-test-not-a-real-key',
  RESEND_API_KEY: 're_test_not_a_real_key',
  RESEND_FROM_EMAIL: 'GOD <verify@example.com>',
};

// Run from an empty temp dir so dotenv can't load the developer's .env (same approach as the SEC-006 tests).
const emptyCwd = mkdtempSync(join(tmpdir(), 'kredibble-env-'));
const envModuleUrl = pathToFileURL(resolve(process.cwd(), 'src/config/env.js')).href;

/** Loads src/config/env.js in a child process with exactly `vars` and returns what it resolved. */
const bootConfig = (vars) => {
  const script = `const { env } = await import(${JSON.stringify(envModuleUrl)});
console.log(JSON.stringify({ appEnv: env.appEnv, release: env.release }));`;
  try {
    const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: emptyCwd,
      env: { PATH: process.env.PATH, ...vars },
      stdio: 'pipe',
      encoding: 'utf8',
    });
    return { ok: true, ...JSON.parse(stdout.trim().split('\n').pop()) };
  } catch (error) {
    return { ok: false, stderr: String(error.stderr || '') };
  }
};

describe('SEC-112: the API reports which environment and release it is', () => {
  it('reports both on the health check', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.statusCode).toBe(200);
    expect(res.body.environment).toBe(env.appEnv);
    expect(['development', 'test', 'staging', 'production']).toContain(res.body.environment);
    expect(res.body.release).toBe(env.release);
    expect(res.body.release.length).toBeGreaterThan(0);
  });

  it('defaults to production when NODE_ENV=production and APP_ENV is unset (today\'s Render service)', () => {
    expect(bootConfig(PRODUCTION_ENV)).toMatchObject({ ok: true, appEnv: 'production' });
  });

  it('runs staging with production code paths', () => {
    expect(bootConfig({ ...PRODUCTION_ENV, APP_ENV: 'staging' })).toMatchObject({ ok: true, appEnv: 'staging' });
  });

  it('refuses an unknown APP_ENV', () => {
    const result = bootConfig({ ...PRODUCTION_ENV, APP_ENV: 'prod' });
    expect(result.ok).toBe(false);
    expect(result.stderr).toContain('APP_ENV must be one of');
  });

  it('refuses a deployed environment without NODE_ENV=production', () => {
    // The SEC-090 compose file left NODE_ENV blank, which would have served a deployed API with
    // development behaviour: Swagger, stack traces in errors, per-process secrets.
    const result = bootConfig({ APP_ENV: 'staging' });
    expect(result.ok).toBe(false);
    expect(result.stderr).toContain('requires NODE_ENV=production');
  });

  it('takes the release from RELEASE_SHA, then RENDER_GIT_COMMIT, else "unknown"', () => {
    expect(bootConfig({ ...PRODUCTION_ENV, RELEASE_SHA: 'abc1234' }).release).toBe('abc1234');
    expect(bootConfig({ ...PRODUCTION_ENV, RELEASE_SHA: '', RENDER_GIT_COMMIT: 'def5678' }).release).toBe('def5678');
    expect(bootConfig(PRODUCTION_ENV).release).toBe('unknown');
  });
});
```
(The child-process approach was checked against `env.js` on this Windows machine on 2026-10-04: both a full production config and `APP_ENV=staging` without `NODE_ENV` load, and neither resolves `appEnv` or `release` yet.)

- [x] **Step 2: Run it and see it fail**

Run: `(cd kredibble-backend && npx cross-env NODE_OPTIONS=--experimental-vm-modules npx jest tests/sec-112-environment-release.test.js)`
Expected: FAIL. The health test gets `undefined` for `environment`; the boot tests get `appEnv` `undefined`; `APP_ENV: 'prod'` and `APP_ENV: 'staging'` without `NODE_ENV` don't throw.

- [x] **Step 3: Resolve `appEnv` and `release` in `env.js`**

In `kredibble-backend/src/config/env.js`, directly after `const isProduction = nodeEnv === 'production';`, add:
```js
/** Deployments this API can be. Staging and production both run with NODE_ENV=production. */
const APP_ENVIRONMENTS = ['development', 'test', 'staging', 'production'];

const defaultAppEnv = () => {
  if (isProduction) return 'production';
  return nodeEnv === 'test' ? 'test' : 'development';
};

/**
 * Which deployment this process is (SEC-112). NODE_ENV only says whether production
 * code paths run, so it can't tell staging from production; APP_ENV can. When unset
 * it follows NODE_ENV, so the Render service (NODE_ENV=production) stays production.
 * @returns {'development' | 'test' | 'staging' | 'production'}
 */
const resolveAppEnv = () => {
  const appEnv = process.env.APP_ENV || defaultAppEnv();
  if (!APP_ENVIRONMENTS.includes(appEnv)) {
    throw new Error(`CRITICAL ERROR: APP_ENV must be one of ${APP_ENVIRONMENTS.join(', ')} (got "${appEnv}").`);
  }
  if ((appEnv === 'staging' || appEnv === 'production') && !isProduction) {
    throw new Error(`CRITICAL ERROR: APP_ENV=${appEnv} requires NODE_ENV=production. A deployed API must not run development code paths.`);
  }
  return appEnv;
};

/**
 * The commit this process was built from: RELEASE_SHA from the CI Docker build,
 * else Render's RENDER_GIT_COMMIT, else "unknown".
 * @returns {string}
 */
const resolveRelease = () => process.env.RELEASE_SHA || process.env.RENDER_GIT_COMMIT || 'unknown';
```
Then in the `env` object, directly after `nodeEnv,`, add:
```js
  appEnv: resolveAppEnv(),
  release: resolveRelease(),
```

- [x] **Step 4: Report both on the health check**

In `kredibble-backend/src/routes/index.js` (`env` is already imported on line 10; don't add a second import), in the `router.get('/health', …)` handler change:
```js
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'ok' : 'error',
      service: 'kredibble-backend',
      database: {
```
to:
```js
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'ok' : 'error',
      service: 'kredibble-backend',
      // SEC-112: lets a deploy confirm the new release is the one answering.
      environment: env.appEnv,
      release: env.release,
      database: {
```

- [x] **Step 5: Run the test and see it pass**

Run: `(cd kredibble-backend && npx cross-env NODE_OPTIONS=--experimental-vm-modules npx jest tests/sec-112-environment-release.test.js)`
Expected: PASS, 6 tests.

- [x] **Step 6: Bake the release into the image**

In `kredibble-backend/Dockerfile`, add after `COPY --chown=node:node src ./src` (late, so the `npm ci` layer stays cached):
```dockerfile
# The commit this image was built from, reported by /api/v1/health (SEC-112). CI passes
# --build-arg RELEASE_SHA=<sha>. Render's own build leaves it empty, and the API then
# falls back to RENDER_GIT_COMMIT.
ARG RELEASE_SHA=""
ENV RELEASE_SHA=${RELEASE_SHA}
```
In `.github/workflows/ci.yml`, job `backend-image`, add under the `docker/build-push-action@v7` step's `with:` (after `tags: kredibble-backend:ci`):
```yaml
          build-args: |
            RELEASE_SHA=${{ github.sha }}
```
In `.github/workflows/cd-backend.yml`, job `image`, add the same two lines under the `docker/build-push-action@v7` step's `with:` (after `labels: ${{ steps.meta.outputs.labels }}`).

- [x] **Step 7: Make the Render environment explicit and document the variables**

In `render.yaml`, after the `NODE_ENV` entry (`value: production`), add:
```yaml
      - key: APP_ENV
        value: production
```
In `kredibble-backend/.env.example`, after the line `PORT=4000`, add:
```
# Which deployment this is: development | staging | production (SEC-112).
# Leave it unset locally; deployments set it. Staging and production need NODE_ENV=production.
# APP_ENV=
# Commit SHA baked into the Docker image by CI and reported by /api/v1/health. Leave unset locally.
# RELEASE_SHA=
```
The `Production boot smoke test` step in `ci.yml` sets `NODE_ENV=production` without `APP_ENV`, so it exercises the default and must still print `Boot smoke test passed!`.

- [x] **Step 8: Run the backend checks**

Run: `(cd kredibble-backend && npm run lint && npm test)`
Expected: lint clean and every suite passing. If lint fails, check whether this task caused it by linting only its files:
```bash
(cd kredibble-backend && npx eslint src/config/env.js src/routes/index.js tests/sec-112-environment-release.test.js)
```
If that passes, the failure is the pre-existing red `main` (Global Constraints): record it in the PR body and continue. Don't use `git stash` to compare; the stash is shared by every worktree and other sessions keep entries there. Copy the `Tests:` summary line for the Progress Log.

- [x] **Step 9: Verify against a running server**

In a second Git Bash terminal, from the worktree:
```bash
cd kredibble-backend && PORT=4100 RELEASE_SHA="$(git rev-parse HEAD)" node scripts/e2e-server.js
```
Once it logs that it's listening, in the first terminal:
```bash
curl -s http://localhost:4100/api/v1/health
```
Expected: JSON containing `"status":"ok"`, `"environment":"development"` (the e2e server refuses `NODE_ENV=production`) and `"release":"<the HEAD sha>"`. Stop the server with Ctrl+C.

If Docker is available, also check the image:
```bash
docker build --quiet --build-arg RELEASE_SHA="$(git rev-parse HEAD)" -t god-api:local kredibble-backend
docker run --rm --entrypoint node god-api:local -e "console.log(process.env.RELEASE_SHA)"
```
Expected: the HEAD sha. (Without Docker, CI's `backend-image` job builds it with the build arg.)

- [x] **Step 10: Commit**

```bash
git branch --show-current   # must print security/SEC-116-repo-guardrails
git add kredibble-backend/tests/sec-112-environment-release.test.js kredibble-backend/src/config/env.js kredibble-backend/src/routes/index.js kredibble-backend/Dockerfile .github/workflows/ci.yml .github/workflows/cd-backend.yml render.yaml kredibble-backend/.env.example
git commit -m "SEC-112: report environment and release on the health check

APP_ENV (development|test|staging|production) is separate from NODE_ENV, so
staging can run production code paths and still say it is staging. A deployed
APP_ENV without NODE_ENV=production refuses to boot. The release SHA comes from
the Docker build arg, else Render's RENDER_GIT_COMMIT.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 8: Records and PR 2

**Files:**
- Modify: `task.md`
- Modify: `PLAN-phase-3-roadmap.md`
- Modify: `C:\Users\Jerry\Desktop\PROJECT 2026\SYSTEM_DESIGN_LESSONS.md` (outside the repo; not committed here)

**Interfaces:**
- Consumes: the commit SHAs and test summary from Tasks 1–7, and PR 1's number.

- [x] **Step 1: Update the status table in `task.md`**

Replace the last cell of these rows:
- SEC-111: `✅ Production back on Render (PR 1); single-level staging/dev names in Plan 4c, production switch in Plan 4f`
- SEC-112: `🟡 Render-era CD restored (PR 1); health reports environment and release (PR 2); deploy and rollback in Plans 4b/4c`
- SEC-113: `✅ Done (Plan 4a)`
- SEC-116: `✅ Done (Plan 4a; Dependabot confirmed after merge)`

In the cards, tick the acceptance boxes these tasks proved: SEC-111 (first box), SEC-112 (first two boxes), SEC-113, SEC-116 ("Repo hygiene runs on every PR").

- [x] **Step 2: Add Progress Log rows**

Append, using real short SHAs (`git log --oneline -10`), PR 1's number and the real test summary:
```
| <date> | SEC-111 | <sha T2> (PR #<n>) | ✅ Disarmed | eas.json production → kredibble-api.onrender.com (health 200); cd-backend restored to 374eae1 |
| <date> | SEC-113 | <sha T4> | ✅ Done | test-results.json, .claude lock, .idea/, server logs untracked; files kept on disk |
| <date> | SEC-116 | <sha T3>, <sha T5>, <sha T6> | ✅ Done | check-encoding (8 node:test tests), Repo hygiene green (run <run id>), Dependabot config |
| <date> | SEC-112 | <sha T7> | 🟡 Health | tests/sec-112-environment-release.test.js 6/6; full suite: <Tests: line>; e2e server health showed environment=development and release=<sha> |
```

- [x] **Step 3: Point the Phase 3 roadmap at Plan 4**

In `PLAN-phase-3-roadmap.md`, replace the row:
```
| 4 | Operations and legal | SEC-090, SEC-092 | Plan 3 for in-app links | Not written |
```
with:
```
| 4 | Operations: see [Plan 4 roadmap](PLAN-4-infrastructure-roadmap.md) | SEC-089, SEC-090, SEC-110–118 | — | 4a in progress |
| 5 | Legal | SEC-092 | Plan 3 for in-app links | Not written |
```

- [x] **Step 4: Add the lesson to the journal**

Append under `## Lessons Learned Per Project` in `C:\Users\Jerry\Desktop\PROJECT 2026\SYSTEM_DESIGN_LESSONS.md`, after the last Kredibble entry (use the execution date):
```markdown
### Kredibble — Know which build is running where
**Date:** YYYY-MM-DD
**What happened:** Staging and production will both run with `NODE_ENV=production`, so the API couldn't tell them apart, and its health check couldn't say which version was live. We added `APP_ENV` (development, staging or production) and a release ID: the git commit the server was built from. The health check now reports both. The API also refuses to start when `APP_ENV` says staging or production but `NODE_ENV` isn't `production`.
**The lesson:** "Which environment?" hides two questions. *How should the code behave* (debug tools on or off) and *which deployment is this* (staging or production) need separate settings. Reporting the exact build in a health check makes a deploy checkable: after releasing commit `abc123`, wait until the server says `abc123` before calling it done, and roll back if it never does. Refusing to start on contradictory settings is "fail closed" applied to configuration. A crash at boot is loud and safe. A staging server quietly running development code paths, with open API docs and detailed error messages, is neither.
**Concept tags:** `#fault-tolerance` `#api` `#security`
```
Add a row to the `## Concepts Introduced So Far` table:
```
| Environment identity vs. runtime mode; release IDs in health checks | Kredibble — deploy pipeline | YYYY-MM-DD |
```
Update the `*Last updated:*` date at the bottom of the file.

- [x] **Step 5: Commit the records**

```bash
git branch --show-current   # must print security/SEC-116-repo-guardrails
git add task.md PLAN-phase-3-roadmap.md
git commit -m "SEC-116: Plan 4a records: statuses, progress log, roadmap link

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

- [x] **Step 6: Open PR 2**

```bash
BODY="$(mktemp)"
cat > "$BODY" <<'EOF'
## What (Plan 4a, PR 2)

- **SEC-116:** `scripts/check-encoding.mjs` (8 `node:test` tests); a `Repo hygiene` CI job (UTF-8 check, actionlint, shellcheck, gitleaks); Dependabot.
- **SEC-113:** stops tracking `.claude/scheduled_tasks.lock`, `.idea/`, the UTF-16 `test-results.json` and empty server logs.
- **SEC-112 (part):** `/api/v1/health` reports `environment` (`APP_ENV`) and `release` (commit SHA). A deployed `APP_ENV` without `NODE_ENV=production` refuses to boot. The Docker image carries `RELEASE_SHA`.

## Production impact

None intended. `APP_ENV` defaults to `production` under `NODE_ENV=production` (render.yaml now sets it explicitly), and on Render the release comes from `RENDER_GIT_COMMIT`.

## Checks

- `node scripts/check-encoding.mjs` → 0 failing
- Backend: <Tests: line>
- CI: <job results; name any that are red on main too>
- After merge: Dependabot shows no config errors; make `Repo hygiene (encoding, workflows, shell, secrets)` a required check (track M1)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
gh pr create --base main --head security/SEC-116-repo-guardrails --title "SEC-116/113/112: repo guardrails and environment/release on the health check (Plan 4a)" --body-file "$BODY"
rm "$BODY"
```
Fill in the `<…>` lines before running. Expected: the PR URL is printed.

- [x] **Step 7: Clean up the worktrees after both PRs merge**

```bash
cd "/c/Users/Jerry/Desktop/PROJECT 2026/Global-Opportunities"
git worktree remove "../GO-plan4a-hotfix"
git worktree remove "../GO-plan4a-guardrails"
```

---

## Self-review notes

- **Coverage of the roadmap's 4a scope:**
  - SEC-111 disarm: Task 2.
  - Findings: Task 1.
  - Encoding check: Task 3.
  - Local state: Task 4.
  - Hygiene job (encoding, actionlint, shellcheck, gitleaks): Task 5.
  - Dependabot: Task 6.
  - Environment and release: Task 7.
  - Records and PRs: Tasks 2 and 8.
  - SEC-110's re-encoding was already done by 712ea6c and is recorded, not redone.
- **Checked against `origin/main` @ `60c1de6` (2026-10-04):**
  - `cd-backend.yml` and `eas.json` are unchanged since PR #30, so Task 2's revert is exact.
  - `routes/index.js` already imports `env`, so Task 7 adds no import.
  - The `env.js` anchors are at lines 13 and 50–51.
  - Only `test-results.json` fails the encoding check.
  - The checker code and its 8 tests were run from this plan's text and pass.
- **Names used by later plans:** health fields `environment` and `release`; `env.appEnv`, `env.release`; build arg `RELEASE_SHA`; CI check `Repo hygiene (encoding, workflows, shell, secrets)`.
- **Left for later plans:**
  - `docker-compose.prod.yml` and `kredibble-backend/scripts/db-*.sh` stay as they are on `main`; Plans 4b and 4e replace them.
  - The `.env.example` files and the staging/dev `eas.json` profiles still name the two-level hosts; Plan 4c rewrites them once D1 is confirmed.
  - SEC-118 waits for Plan 4c.
