# Plan 4a: Repair SEC-090 and Add Repo Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the unmerged `security/SEC-090-infrastructure-preparation` branch safe to merge. That means repairing the files it corrupted, returning deploy config to the working Render baseline, adding CI checks so this can't recur, and teaching the API to report which environment and release it is. Every later infrastructure plan depends on that last piece.

**Why:** See `PLAN-4-infrastructure-roadmap.md` §1. In short:
- the SEC-090 commit saved 11 files as UTF-16, which breaks the CD workflows, `eas.json` and the shell scripts;
- `task.md` was re-saved as Windows-1252, which turned every ✅ into `?`;
- production mobile config pointed at a hostname that doesn't exist;
- local agent state was committed.

**Architecture:**
- **Nothing in production changes.** Render stays the API host. The admin and mobile production URLs are untouched. The CD workflows and `eas.json` go back to their last working versions (`374eae1`), and Plans 4b/4c rebuild the multi-environment versions properly.
- **Guardrails are plain Node and stock CI tools.** `scripts/check-encoding.mjs` has no dependencies and is tested with `node:test`. The CI `hygiene` job runs it plus actionlint, shellcheck and gitleaks from pinned Docker images.
- **Environment identity:** `APP_ENV` (development | test | staging | production) is separate from `NODE_ENV` (production code paths or not). `RELEASE_SHA` comes from the Docker build, with Render's `RENDER_GIT_COMMIT` as fallback. Both appear on `GET /api/v1/health`.

**Tech Stack:** Node 24 (`.nvmrc`), `node:test`, Express + Jest + supertest + mongodb-memory-server (backend), GitHub Actions, Docker images `rhysd/actionlint:1.7.12` and `ghcr.io/gitleaks/gitleaks:v8.30.1`, shellcheck (preinstalled on `ubuntu-latest`), Dependabot.

## Global Constraints

- **Branch:** `security/SEC-090-infrastructure-preparation` (pushed, no PR yet). Fix it in place so `main` never receives the broken files. Commit after each task, then `git push`. Commit messages use `SEC-1xx: …` and end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Someone else's uncommitted work is in the tree:** the files below belong to other work. Never stage, stash, revert or reformat them. Stage files by explicit path only; never use `git add .`, a bare `git add -A`, or `git commit -a`.
  - `kredibble-admin/src/app/(dashboard)/opportunities/[id]/page.tsx`
  - `kredibble-admin/src/app/(dashboard)/opportunities/page.tsx`
  - `kredibble-admin/src/lib/api.ts`
  - `kredibble-admin/src/lib/services/lists.ts`
  - `kredibble-admin/src/lib/opportunity-types.ts`
  - `kredibble-admin/src/lib/services/opportunities.ts`
- **Never write repo files with Windows PowerShell 5.1.** Its `>`, `Out-File` and `Set-Content` produce UTF-16 or ANSI; that's how SEC-110 happened. Use the editor tools, Git Bash or Node. Run every shell command in this plan in **Git Bash** from the repo root unless it says otherwise.
- **Production stays on Render.** Don't change `EXPO_PUBLIC_API_URL`, `API_PROXY_TARGET`, `CORS_ORIGIN` or the Render deploy step.
- **Backend checks:** `(cd kredibble-backend && npm run lint && npm test)` whenever backend files change.
- **Workflow changes:** actionlint must pass (Task 5 adds it to CI). Never mask a failing step (`|| true`). Every job keeps `timeout-minutes`.
- **Secrets:** never print, log or commit a password, token or key, including the e2e admin password.
- **Records:** Task 1 adds the findings to `task.md` before any fix (AGENTS.md rule). Task 8 updates `task.md`, the Progress Log, `PLAN-phase-3-roadmap.md` and `C:\Users\Jerry\Desktop\PROJECT 2026\SYSTEM_DESIGN_LESSONS.md`.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `task.md` | Restore + edit | Restored byte-for-byte from `374eae1`; new findings SEC-110–117; SEC-089/090 statuses corrected |
| `scripts/check-encoding.mjs` | Create | Fails on non-UTF-8 tracked text files (UTF-16, NUL bytes, Windows-1252, BOM in YAML/JSON/sh/dotenv, CRLF in `.sh`) |
| `scripts/check-encoding.test.mjs` | Create | `node:test` unit tests for the checker |
| `.gitattributes` | Create | Keep `.sh` files LF on Windows checkouts |
| `package.json` (root) | Modify | `check:encoding`, `test:scripts` scripts |
| `AGENTS.md` | Modify | Encoding guardrail; CI table mentions the hygiene job |
| `.github/workflows/cd-{backend,admin,app}.yml`, `kredibble-app/eas.json` | Restore | Back to `374eae1` (the working Render baseline) |
| `docker-compose.prod.yml`, `DISASTER_RECOVERY.md`, `kredibble-{backend,admin,app}/.env.example`, `kredibble-backend/scripts/db-{dump,restore}.sh` | Re-encode | UTF-8, LF; content unchanged (Plans 4b/4e replace them) |
| `.gitignore` | Modify | Ignore local agent/IDE state and generated test output |
| `.github/workflows/ci.yml` | Modify | `hygiene` job; `RELEASE_SHA` build arg on the image job |
| `.github/dependabot.yml` | Create | Weekly npm / actions / Docker updates |
| `kredibble-backend/src/config/env.js` | Modify | `appEnv`, `release` |
| `kredibble-backend/src/routes/index.js` | Modify | Health check reports `environment`, `release` |
| `kredibble-backend/tests/sec-112-environment-release.test.js` | Create | Health wiring + boot-config tests |
| `kredibble-backend/Dockerfile` | Modify | `ARG/ENV RELEASE_SHA` |
| `render.yaml` | Modify | `APP_ENV=production` (explicit) |

---

### Task 1: Restore `task.md` and record the infrastructure findings

**Files:**
- Modify: `task.md`

**Interfaces:**
- Produces: finding ids SEC-110 … SEC-117, used in every later commit message and Progress Log row.

- [ ] **Step 1: Confirm the damage**

Run:
```bash
file task.md
git show 374eae1:task.md | file -
```
Expected: the first prints `Non-ISO extended-ASCII text …`; the second prints `UTF-8 (with BOM) text …`.

(Checked on 2026-10-04: once both versions are normalised to ASCII, 23 lines differ between `374eae1` and `b804a81`. 22 are encoding damage, such as `≥` becoming `=`; the only real edit is the SEC-090 row. Restoring therefore loses nothing.)

- [ ] **Step 2: Restore the file byte-for-byte (Git Bash, not PowerShell)**

```bash
git show 374eae1:task.md > task.md
file task.md
```
Expected: `UTF-8 (with BOM) text, with very long lines …, with CRLF line terminators`.

- [ ] **Step 3: Correct the SEC-089 and SEC-090 status rows**

In the *Findings Summary* table, replace:
```
| SEC-089 | Shared Redis configured via render.yaml for rate limits | P1 | Operations | ✅ Done |
```
with:
```
| SEC-089 | Shared Redis, always-on hosting, database backups | P1 | Operations | 🟡 Redis done (render.yaml); always-on host, backups and restore drill open — Plans 4b, 4e |
```
and replace:
```
| SEC-090 | No error tracking or uptime monitoring | P1 | Operations | Open |
```
with:
```
| SEC-090 | No error tracking or uptime monitoring | P1 | Operations | Open — b804a81 marked it Done, but 7f8be2c added deploy scaffolding only (no error tracking, no uptime checks); Plan 4d |
```

- [ ] **Step 4: Add the new finding rows after the SEC-109 row**

Insert directly below the row that starts `| SEC-109 | The admin e2e server loaded`:
```
| SEC-110 | SEC-090 commit saved 11 files as UTF-16 (3 CD workflows, `eas.json`, 3 `.env.example`, `docker-compose.prod.yml`, `DISASTER_RECOVERY.md`, 2 shell scripts); b804a81 re-saved `task.md` as Windows-1252 | P0 | Repo / CI/CD | Open — Plan 4a |
| SEC-111 | SEC-090 points the production mobile build at `api.globalopportunitydesk.com`, which does not resolve; staging/dev names are two levels deep (`staging.api.…`), which Cloudflare's free edge certificate doesn't cover | P0 | Deployment | Open — Plan 4a reverts; Plans 4c/4f re-point |
| SEC-112 | VPS deploy pipeline unsafe: every branch overwrites `:latest`, which production runs; compose file never copied; blank `environment:` values; mixed-case image ref; no SSH host-key pinning; API port published without TLS; container names collide across environments; no health-gated rollback; health check can't identify the release | P1 | CI/CD + Deployment | Open — Plan 4a (health), Plans 4b/4c |
| SEC-113 | Local agent/IDE state and generated output tracked in git (`.claude/ralph-loop.local.md` with the e2e admin login, `.claude/scheduled_tasks.lock`, `.idea/`, `test-results.json`, `server_*.log`) | P2 | Repo hygiene | Open — Plan 4a |
| SEC-114 | Infrastructure owned by personal accounts (GitHub repo and GHCR namespace, Expo owner, Vercel scope, Render service) | P1 | Ownership | Open — Plan 4 track M, Plan 4g |
| SEC-115 | No production approval gate and no build-once promotion: every push to `main` deploys straight to production | P1 | CI/CD | Open — Plan 4c |
| SEC-116 | No repo hygiene gates: file encoding, workflow lint, shell lint, secret scanning, automated dependency updates | P2 | CI/CD | Open — Plan 4a |
| SEC-117 | Known-password test accounts may exist in real databases (`@test.com` seed accounts; a test admin was created against production; the e2e admin login is a public default) | P1 | Data / Access | Open — Plan 4 track M5 |
```

- [ ] **Step 5: Add the task cards**

Insert this block on the line before `# Execution Order`, followed by a blank line:

````markdown
# 2026-10-04 Infrastructure Findings (Plan 4)

Found while planning the move to the company infrastructure platform (`Company_IT_Application_Infrastructure_Plan.md`). Roadmap: `PLAN-4-infrastructure-roadmap.md`.

### SEC-110 — SEC-090 files saved as UTF-16; `task.md` re-saved as Windows-1252
**Evidence:** `file` reports UTF-16LE (byte-order mark `ff fe`) for `.github/workflows/cd-{backend,admin,app}.yml`, `kredibble-app/eas.json`, `kredibble-{backend,admin,app}/.env.example`, `docker-compose.prod.yml`, `DISASTER_RECOVERY.md` and `kredibble-backend/scripts/db-{dump,restore}.sh`; git shows them as binary. GitHub rejects UTF-16 workflow files, `require('./eas.json')` throws, and bash can't run the scripts. b804a81 re-saved `task.md` as Windows-1252, which turned every ✅ ❌ ⚠️ into `?`. An older committed `kredibble-backend/test-results.json` is UTF-16 too. Cause: Windows PowerShell 5.1, whose `>` and `Out-File` write UTF-16.
**Fix:** restore the CD workflows and `eas.json` from 374eae1 (production is still on Render), re-encode the rest as UTF-8, restore `task.md` from 374eae1, and check encodings in CI (SEC-116).
**Acceptance criteria:**
- [ ] `node scripts/check-encoding.mjs` reports 0 failing files
- [ ] CI's `Repo hygiene` job runs it on every PR

### SEC-111 — Production mobile build pointed at a hostname that doesn't exist
**Evidence:** after 7f8be2c, `eas.json` production `EXPO_PUBLIC_API_URL` is `https://api.globalopportunitydesk.com/api`; on 2026-10-04 that name has no DNS record (the apex resolves to Hostinger). `cd-app.yml` publishes a production OTA update on every push to `main` that touches the app, so merging would have cut every installed app off from the API. The staging and dev names (`staging.api.…`, `dev.api.…`) are two levels below the apex, and Cloudflare's free Universal SSL certificate covers only one level.
**Fix:** revert `eas.json` to the Render URL (Plan 4a). Use single-level names (`staging-api.`, `dev-api.`, Plan 4c). Switch production only in the Plan 4f cutover, after the API answers on the new name.
**Acceptance criteria:**
- [ ] No client config names a host that doesn't answer `/api/v1/health` with 200
- [ ] The production API URL changes only in the Plan 4f cutover commit

### SEC-112 — VPS deploy pipeline is unsafe
**Evidence:** `cd-backend.yml` @ 7f8be2c tags every branch build `latest` (`type=raw,value=latest`) while `docker-compose.prod.yml` runs `:latest`, so a `dev` push changes what production restarts into. The deploy runs `docker-compose up` in `/opt/kredibble-<branch>`, but nothing copies a compose file there. Every `environment:` entry is blank (`NODE_ENV=`, `DATABASE_URL=` …), so the API can't boot, and filling them in would put secrets in git. `docker pull ghcr.io/${{ github.repository }}/…` is mixed case, which GHCR rejects (the pre-SEC-090 workflow had a comment warning about this). `appleboy/ssh-action` runs without a host-key fingerprint. `ports: "4000:4000"` exposes plain HTTP. `container_name` is fixed, so two environments on one VPS collide. Nothing waits for the new container to be healthy or rolls back, and `/api/v1/health` doesn't say which release or environment answered.
**Fix:** Plan 4a: `APP_ENV` and the release SHA on the health check. Plan 4b: per-environment compose projects with no published ports, the env file outside git, Caddy + Cloudflare TLS, a health-gated deploy with automatic rollback. Plan 4c: images tagged by commit SHA only, a pinned host key, a forced-command deploy key.
**Acceptance criteria:**
- [ ] `/api/v1/health` reports `environment` and `release` (test)
- [ ] A deploy whose new container never reports the expected release rolls back and fails the job (staging)
- [ ] No image tag is shared between environments; production runs an explicit SHA

### SEC-113 — Local agent and IDE state tracked in git
**Evidence:** `git ls-files` lists `.claude/ralph-loop.local.md` (Ralph-loop state committed in 7f8be2c; it contains the e2e admin login), `.claude/scheduled_tasks.lock`, 12 files under `.idea/`, `kredibble-backend/test-results.json` (a UTF-16 Jest report) and `kredibble-backend/server_{stdout,stderr}.log`. The e2e login is the throwaway default already in `scripts/e2e-server.js`; SEC-117 covers real databases.
**Fix:** `git rm --cached` the files and ignore their paths.
**Acceptance criteria:**
- [ ] `git ls-files .claude .idea` lists nothing local; the files remain on disk

### SEC-114 — Infrastructure owned by personal accounts
**Evidence:** repository `Aeomar999/Global-Opportunities` and its GHCR images; `app.json` `"owner": "amoahjerry835"`; Vercel scope `jerry-amoahs-projects` (also in `render.yaml` `CORS_ORIGIN`); the Render service and the JWT secrets it generated. The infra plan's key principle is that company infrastructure must not depend on a developer's personal account.
**Fix:** Plan 4 track M (company GitHub org, Vercel team, Expo org, Atlas org, Cloudflare, Hostinger, password manager) and Plan 4g (`ACCOUNTS.md`, `ACCESS.md`).
**Acceptance criteria:**
- [ ] Every production resource is owned by a company account with MFA and a second admin, recorded in `docs/infrastructure/ACCOUNTS.md`

### SEC-115 — No production approval gate, no build-once promotion
**Evidence:** `cd-backend.yml`, `cd-admin.yml` and `cd-app.yml` deploy to production on every push to `main` with no approval. SEC-090's branch-per-environment version rebuilt the image for each branch, so production would never have run the exact image staging tested.
**Fix:** Plan 4c: build once per commit, deploy it to staging automatically, then promote the same image to production through a GitHub Environment with required reviewers.
**Acceptance criteria:**
- [ ] Production deploys wait for approval
- [ ] Staging and production report the same release SHA for the same release

### SEC-116 — No repository hygiene gates
**Evidence:** SEC-110 got through because nothing checks file encodings, workflow syntax or shell scripts. There's no secret scanner (SEC-113 committed a login) and no automated dependency updates (SEC-078 and SEC-088 were found by hand).
**Fix:** Plan 4a: `scripts/check-encoding.mjs`; a `Repo hygiene` CI job running the encoding check, actionlint, shellcheck and gitleaks; `.github/dependabot.yml`.
**Acceptance criteria:**
- [ ] `Repo hygiene` runs on every PR and is green
- [ ] Dependabot opens weekly update PRs

### SEC-117 — Known-password test accounts may exist in real databases
**Evidence:** the gitignored `kredibble-backend/scripts/seed-test-credentials.js` creates `admin@test.com`, `seeker@test.com` and `hirer@test.com` with weak passwords. The P0 section above records a test admin created against the production database. The e2e admin login (`test-admin@kredibble.com`) is a public default in `scripts/e2e-server.js`.
**Fix:** track M5: query production and staging for `@test.com` and `test-admin@` accounts and delete them (or rotate their passwords and remove the admin role). Never run the seed script against a non-local database.
**Acceptance criteria:**
- [ ] A query against production returns no such accounts (date and query recorded in the Progress Log)
````

- [ ] **Step 6: Add a Progress Log row**

Append after the last row of the `# Progress Log` table (the line before the blank line that precedes `# Open Questions`):
```
| 2026-10-04 | SEC-110–117 | — | Findings recorded | Plan 4 roadmap written; task.md restored from 374eae1 (b804a81 had re-saved it as Windows-1252); SEC-089 and SEC-090 statuses corrected |
```

- [ ] **Step 7: Verify**

```bash
file task.md
grep -c "SEC-11[0-7]" task.md
grep -c "✅" task.md
```
Expected: `UTF-8 (with BOM) text …`; the SEC-11x count is at least 17 (8 rows + 8 card headings + the log row); the ✅ count is greater than 50.

- [ ] **Step 8: Commit**

```bash
git add task.md
git commit -m "SEC-110: restore task.md from 374eae1 and record SEC-110 to SEC-117

b804a81 re-saved task.md as Windows-1252, turning every status symbol into '?'.
The restored file has one real change re-applied: SEC-090 is open, not done.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 2: Encoding check for tracked files

**Files:**
- Create: `scripts/check-encoding.mjs`
- Create: `scripts/check-encoding.test.mjs`
- Create: `.gitattributes`
- Modify: `package.json` (root)
- Modify: `AGENTS.md` (Guardrails section)

**Interfaces:**
- Produces: `findEncodingProblems(filePath: string, content: Buffer): string[]` and `isCheckedPath(filePath: string): boolean` (exported). `node scripts/check-encoding.mjs` exits 1 when any tracked file fails. Task 5 runs both in CI.

- [ ] **Step 1: Write the failing test**

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

- [ ] **Step 2: Run the test and see it fail**

Run: `node --test scripts/check-encoding.test.mjs`
Expected: FAIL, with `Cannot find module '…/scripts/check-encoding.mjs'` (`ERR_MODULE_NOT_FOUND`).

- [ ] **Step 3: Write the checker**

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

- [ ] **Step 4: Run the test and see it pass**

Run: `node --test scripts/check-encoding.test.mjs`
Expected: `# pass 8`, `# fail 0`.

- [ ] **Step 5: Run the checker on the repo and see it catch the real damage**

Run: `node scripts/check-encoding.mjs`
Expected: exit code 1 and these 12 files (Task 1 already fixed `task.md`):
```
.github/workflows/cd-admin.yml: is UTF-16 …
.github/workflows/cd-app.yml: is UTF-16 …
.github/workflows/cd-backend.yml: is UTF-16 …
DISASTER_RECOVERY.md: is UTF-16 …
docker-compose.prod.yml: is UTF-16 …
kredibble-admin/.env.example: is UTF-16 …
kredibble-app/.env.example: is UTF-16 …
kredibble-app/eas.json: is UTF-16 …
kredibble-backend/.env.example: is UTF-16 …
kredibble-backend/scripts/db-dump.sh: is UTF-16 …
kredibble-backend/scripts/db-restore.sh: is UTF-16 …
kredibble-backend/test-results.json: is UTF-16 …
check-encoding: … files checked, 12 failing
```
Task 3 fixes them. CI doesn't run the check until Task 5, so this commit doesn't turn CI red.

- [ ] **Step 6: Keep shell scripts LF on Windows checkouts**

Create `.gitattributes`:
```
# Shell scripts must keep LF line endings, or bash fails with "$'\r': command not found" (SEC-116).
*.sh text eol=lf
```

- [ ] **Step 7: Add the root scripts**

In the root `package.json` `"scripts"` object, add after `"build:admin"`:
```json
    "build:admin": "npm run build --prefix kredibble-admin",
    "check:encoding": "node scripts/check-encoding.mjs",
    "test:scripts": "node --test scripts/check-encoding.test.mjs"
```
Run: `npm run test:scripts`. Expected: `# pass 8`.

- [ ] **Step 8: Add the guardrail to `AGENTS.md`**

In `## Guardrails`, after the `- **No secrets in code**` bullet, add:
```
- **Text files are UTF-8** — never write repo files with Windows PowerShell 5.1: `>`, `Out-File` and `Set-Content` produce UTF-16 or ANSI (SEC-110). Use the editor tools, Git Bash or Node. `npm run check:encoding` at the repo root must report 0 failing files; CI enforces it.
```

- [ ] **Step 9: Commit**

```bash
git add scripts/check-encoding.mjs scripts/check-encoding.test.mjs .gitattributes package.json AGENTS.md
git commit -m "SEC-116: check tracked files for UTF-16, Windows-1252 and stray BOMs

The check finds the 12 files the SEC-090 work saved as UTF-16 (fixed next).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 3: Repair the SEC-090 files and return deploy config to the Render baseline

**Files:**
- Restore from `374eae1`: `.github/workflows/cd-backend.yml`, `.github/workflows/cd-admin.yml`, `.github/workflows/cd-app.yml`, `kredibble-app/eas.json`
- Re-encode as UTF-8: `docker-compose.prod.yml`, `DISASTER_RECOVERY.md`, `kredibble-backend/.env.example`, `kredibble-admin/.env.example`, `kredibble-app/.env.example`, `kredibble-backend/scripts/db-dump.sh`, `kredibble-backend/scripts/db-restore.sh`
- Untrack: `kredibble-backend/test-results.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `node scripts/check-encoding.mjs` (Task 2).
- Produces: workflows that GitHub can parse again; Task 5 lints them and Task 7 adds a build arg to `cd-backend.yml`.

- [ ] **Step 1: Restore the deploy config that production runs on**

Production is on Render. The SEC-090 versions deploy to a VPS and hostnames that don't exist yet (SEC-111, SEC-112), and Plan 4c rebuilds them properly.
```bash
git checkout 374eae1 -- .github/workflows/cd-backend.yml .github/workflows/cd-admin.yml .github/workflows/cd-app.yml kredibble-app/eas.json
file .github/workflows/cd-*.yml kredibble-app/eas.json
node -e "JSON.parse(require('fs').readFileSync('kredibble-app/eas.json', 'utf8')); console.log('eas.json parses')"
grep -c "kredibble-api.onrender.com" kredibble-app/eas.json
git diff 374eae1 -- .github/workflows kredibble-app/eas.json
```
Expected: all four are `ASCII text`; `eas.json parses`; the count is `2`; the last diff is empty.

- [ ] **Step 2: Re-encode the remaining SEC-090 files as UTF-8 with LF endings**

Their content is kept as written; Plans 4b and 4e replace them.
```bash
node -e '
const fs = require("fs");
for (const file of process.argv.slice(1)) {
  const text = fs.readFileSync(file).toString("utf16le").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  fs.writeFileSync(file, text, "utf8");
  console.log("re-encoded", file);
}' docker-compose.prod.yml DISASTER_RECOVERY.md kredibble-backend/.env.example kredibble-admin/.env.example kredibble-app/.env.example kredibble-backend/scripts/db-dump.sh kredibble-backend/scripts/db-restore.sh
```
Expected: seven `re-encoded …` lines.

- [ ] **Step 3: Check the re-encoded files are readable and runnable**

```bash
file docker-compose.prod.yml DISASTER_RECOVERY.md kredibble-*/.env.example kredibble-backend/scripts/db-*.sh
head -3 kredibble-backend/.env.example
bash -n kredibble-backend/scripts/db-dump.sh && bash -n kredibble-backend/scripts/db-restore.sh && echo "scripts parse"
git diff --stat -- docker-compose.prod.yml DISASTER_RECOVERY.md kredibble-backend/.env.example
```
Expected: each file is `ASCII text` or `UTF-8 text` (not UTF-16); the head shows `# ENVIRONMENT DEPLOYMENT TEMPLATE`; `scripts parse`; git shows a text diff (line counts), not `Bin`.

- [ ] **Step 4: Stop tracking the generated Jest report**

`kredibble-backend/test-results.json` is test output (UTF-16, 255 KB), not source.
```bash
git rm --cached --quiet kredibble-backend/test-results.json
```
Append to the root `.gitignore`:
```
# Generated test output (SEC-113)
kredibble-backend/test-results.json
```
Run: `git check-ignore -v kredibble-backend/test-results.json`
Expected: `.gitignore:<line>:kredibble-backend/test-results.json	kredibble-backend/test-results.json`.

- [ ] **Step 5: Run the encoding check**

Run: `node scripts/check-encoding.mjs`
Expected: `check-encoding: … files checked, 0 failing`, exit code 0.

- [ ] **Step 6: Confirm nothing else changed**

```bash
(cd kredibble-backend && npm run lint)
git status --short
```
Expected: lint passes. Status shows only this task's files, plus the six other-work admin files from Global Constraints, which stay unstaged.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/cd-backend.yml .github/workflows/cd-admin.yml .github/workflows/cd-app.yml kredibble-app/eas.json docker-compose.prod.yml DISASTER_RECOVERY.md kredibble-backend/.env.example kredibble-admin/.env.example kredibble-app/.env.example kredibble-backend/scripts/db-dump.sh kredibble-backend/scripts/db-restore.sh .gitignore
git commit -m "SEC-110: re-encode SEC-090 files as UTF-8; restore CD and eas.json to the Render baseline

The UTF-16 workflows were invalid on GitHub, eas.json could not be parsed and the
scripts could not run. The SEC-090 CD and eas.json versions also pointed production
at api.globalopportunitydesk.com, which has no DNS record (SEC-111), so they go back
to 374eae1 until Plans 4b/4c build the VPS pipeline. Stops tracking the generated
test-results.json.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 4: Stop tracking local agent and IDE state

**Files:**
- Modify: `.gitignore`
- Untrack (files stay on disk): `.claude/ralph-loop.local.md`, `.claude/scheduled_tasks.lock`, `.idea/**`, `kredibble-backend/server_stderr.log`, `kredibble-backend/server_stdout.log`

**Interfaces:**
- Produces: a clean index; Task 5's gitleaks scan then covers only real project files.

- [ ] **Step 1: List what's tracked**

Run: `git ls-files .claude .idea .kilo .remember .superpowers kredibble-backend/server_stderr.log kredibble-backend/server_stdout.log`
Expected: `.claude/ralph-loop.local.md`, `.claude/scheduled_tasks.lock`, the `.idea/` files (`.idea/.gitignore`, `.idea/caches/deviceStreaming.xml`, `.idea/deviceManager.xml`, …) and the two `.log` files. If anything else under `.claude/` is listed (for example a shared `settings.json`), leave it tracked.

- [ ] **Step 2: Ignore local state**

Append to the root `.gitignore`:
```
# Local agent and IDE state (SEC-113)
.claude/*.local.*
.claude/*.lock
.idea/
.kilo/
.remember/
.superpowers/
```
(`*.log` is already ignored; the two logs were force-added earlier.)

- [ ] **Step 3: Remove them from the index only**

```bash
git rm --cached -r --quiet .claude/ralph-loop.local.md .claude/scheduled_tasks.lock .idea kredibble-backend/server_stderr.log kredibble-backend/server_stdout.log
```

- [ ] **Step 4: Verify**

```bash
git ls-files .claude .idea
git check-ignore -v .claude/ralph-loop.local.md .idea/vcs.xml .superpowers
ls .claude/ralph-loop.local.md
```
Expected: the first prints nothing; the second prints a `.gitignore` match for each path; the third shows the file still exists, so a running Ralph loop isn't disturbed.

The e2e login remains in this pushed branch's history. It only signs in to the throwaway in-memory API that `scripts/e2e-server.js` seeds (and is that script's public default), so the history isn't rewritten. SEC-117 checks real databases.

- [ ] **Step 5: Commit**

```bash
git add .gitignore
git commit -m "SEC-113: stop tracking local agent and IDE state

Untracks .claude/ralph-loop.local.md (Ralph-loop state, committed by accident in
7f8be2c), .claude/scheduled_tasks.lock, .idea/ and two empty server logs. The files
stay on disk.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```
(`git rm --cached` already staged the removals; `git add .gitignore` adds the ignore rules.)

---

### Task 5: Repo hygiene job in CI

**Files:**
- Modify: `.github/workflows/ci.yml` (new `hygiene` job)
- Create (only if gitleaks reports false positives): `.gitleaksignore`
- Modify: `AGENTS.md` (CI/CD table, `ci.yml` row)

**Interfaces:**
- Consumes: `scripts/check-encoding.mjs` and its test (Task 2).
- Produces: the check `Repo hygiene (encoding, workflows, shell, secrets)`. Track M1 makes it a required check.

- [ ] **Step 1: Add the job**

In `.github/workflows/ci.yml`, add this job at the end of `jobs:` (after `app:`), at the same indentation as the other jobs:
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

- [ ] **Step 2: Run what can run locally**

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

Run gitleaks **only in CI**. A local working tree contains `node_modules/` and the real, gitignored `.env` files, which aren't in git and would drown the report. Without Docker, read actionlint's result in CI too (Step 5).

- [ ] **Step 3: Fix findings at the source**

- **actionlint / shellcheck:** fix each finding in the workflow or script. Don't disable rules globally. A single `# shellcheck disable=SCnnnn` is allowed only with a comment on the same line explaining why.
- **gitleaks, real secret** (a live token or key, including JWTs in `kredibble-backend/kredibble-postman-collection.json`): stop. Add a SEC row to `task.md`, ask the owner to rotate it, then remove it from the file. Rotation comes before cleanup.
- **gitleaks, false positive** (a test fixture or an obviously fake value): add its `Fingerprint:` line from the report to `.gitleaksignore`, each with a `#` comment line above it saying why it's safe.

- [ ] **Step 4: Update the CI table in `AGENTS.md`**

In the `## CI/CD Pipeline (GitHub Actions)` table, append to the end of the `ci.yml` row's "What it does" cell:
```
 **Hygiene:** text files are UTF-8, actionlint (with shellcheck on `run:` blocks), shellcheck on `*.sh`, gitleaks on the working tree.
```

- [ ] **Step 5: Commit, push, confirm the job is green**

If Step 3 created `.gitleaksignore`, add it to the `git add` line below.
```bash
git add .github/workflows/ci.yml AGENTS.md
git commit -m "SEC-116: repo hygiene job (encoding, actionlint, shellcheck, gitleaks)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
gh run list --branch security/SEC-090-infrastructure-preparation --workflow CI --limit 1
```
`ci.yml` runs on `pull_request` and `push` to `main`, so a branch push alone doesn't trigger it. Trigger it once by hand, then read the result:
```bash
gh workflow run CI --ref security/SEC-090-infrastructure-preparation
gh run list --branch security/SEC-090-infrastructure-preparation --workflow CI --limit 1
```
Expected: once finished, every job is `success`, including `Repo hygiene (encoding, workflows, shell, secrets)`. If a job fails, read its log with `gh run view <id> --log-failed`, fix the cause and push again.

---

### Task 6: Dependabot

**Files:**
- Create: `.github/dependabot.yml`

**Interfaces:**
- Produces: weekly update PRs. Required checks (track M1) gate them like any other PR.

- [ ] **Step 1: Write the config**

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

- [ ] **Step 2: Check it**

Run: `node scripts/check-encoding.mjs`
Expected: `0 failing`.

After the push, check GitHub → Insights → Dependency graph → Dependabot. Each of the five entries shows a "last checked" time and no configuration error. (Dependabot runs from the default branch, so this check happens after the PR merges; note that in the PR body.)

- [ ] **Step 3: Commit**

```bash
git add .github/dependabot.yml
git commit -m "SEC-116: weekly Dependabot updates for npm, actions and the API image

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 7: The API reports its environment and release

**Files:**
- Create: `kredibble-backend/tests/sec-112-environment-release.test.js`
- Modify: `kredibble-backend/src/config/env.js` (after `const isProduction = …`, and the `env` object)
- Modify: `kredibble-backend/src/routes/index.js` (imports; the `/health` handler near line 734)
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

- [ ] **Step 1: Write the failing test**

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

- [ ] **Step 2: Run it and see it fail**

Run: `(cd kredibble-backend && npx cross-env NODE_OPTIONS=--experimental-vm-modules npx jest tests/sec-112-environment-release.test.js)`
Expected: FAIL. `reports both on the health check` fails because `received` is `undefined` for `environment`. The boot tests fail because `appEnv` is `undefined` and `APP_ENV: 'prod'` doesn't throw.

- [ ] **Step 3: Resolve `appEnv` and `release` in `env.js`**

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

- [ ] **Step 4: Report both on the health check**

In `kredibble-backend/src/routes/index.js`, add after the line `import { searchLimiter } from '../lib/rate-limiters.js';`:
```js
import { env } from '../config/env.js';
```
In the `router.get('/health', …)` handler, change the response body from:
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

- [ ] **Step 5: Run the test and see it pass**

Run: `(cd kredibble-backend && npx cross-env NODE_OPTIONS=--experimental-vm-modules npx jest tests/sec-112-environment-release.test.js)`
Expected: PASS, 6 tests.

- [ ] **Step 6: Bake the release into the image**

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

- [ ] **Step 7: Make the Render environment explicit and document the variables**

In `render.yaml`, after the `NODE_ENV` entry, add:
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

- [ ] **Step 8: Run the backend checks**

Run: `(cd kredibble-backend && npm run lint && npm test)`
Expected: lint clean and every suite passing. Copy the `Tests:` summary line (for example `Tests: N passed, N total`) for the Progress Log in Task 8.

- [ ] **Step 9: Verify against a running server**

In a second Git Bash terminal:
```bash
cd kredibble-backend && PORT=4100 RELEASE_SHA="$(git rev-parse HEAD)" node scripts/e2e-server.js
```
Once it logs that it's listening, run in the first terminal:
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

- [ ] **Step 10: Commit**

```bash
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

### Task 8: Records and pull request

**Files:**
- Modify: `task.md`
- Modify: `PLAN-phase-3-roadmap.md`
- Modify: `C:\Users\Jerry\Desktop\PROJECT 2026\SYSTEM_DESIGN_LESSONS.md` (outside the repo; not committed here)

**Interfaces:**
- Consumes: the commit SHAs and the test summary from Tasks 1–7.

- [ ] **Step 1: Update the status table in `task.md`**

Set these statuses (replace the last cell of each row):
- SEC-110: `✅ Done (Plan 4a; check-encoding reports 0 failing, enforced in CI)`
- SEC-111: `🟡 Reverted to the Render URL (Plan 4a); single-level names in Plan 4c, production switch in Plan 4f`
- SEC-112: `🟡 Health reports environment and release (Plan 4a); deploy and rollback in Plans 4b/4c`
- SEC-113: `✅ Done (Plan 4a)`
- SEC-116: `✅ Done (Plan 4a; Dependabot confirmed after merge)`

In the cards, tick the acceptance boxes these tasks proved: SEC-110 (both), SEC-112 (health check), SEC-113, SEC-116 ("Repo hygiene runs on every PR").

- [ ] **Step 2: Add Progress Log rows**

Append, using the real short SHAs from `git log --oneline -8` and the real test summary from Task 7 Step 8:
```
| <date> | SEC-110 | <sha T3> | ✅ Repaired | 11 SEC-090 files re-encoded or restored from 374eae1; test-results.json untracked; `node scripts/check-encoding.mjs` → 0 failing |
| <date> | SEC-111 | <sha T3> | 🟡 Reverted | eas.json and the CD workflows back on the Render baseline; production URL unchanged |
| <date> | SEC-113 | <sha T4> | ✅ Done | .claude local state, .idea/, server logs untracked; files kept on disk |
| <date> | SEC-116 | <sha T2>, <sha T5>, <sha T6> | ✅ Done | check-encoding (8 node:test tests), Repo hygiene CI job green (run <run id>), Dependabot config |
| <date> | SEC-112 | <sha T7> | 🟡 Health | tests/sec-112-environment-release.test.js 6/6; full suite: <Tests: line>; e2e server health showed environment=development and release=<sha> |
```

- [ ] **Step 3: Point the Phase 3 roadmap at Plan 4**

In `PLAN-phase-3-roadmap.md`, in the *Plans, in order* table, replace the row:
```
| 4 | Operations and legal | SEC-090, SEC-092 | Plan 3 for in-app links | Not written |
```
with:
```
| 4 | Operations: see [Plan 4 roadmap](PLAN-4-infrastructure-roadmap.md) | SEC-089, SEC-090, SEC-110–117 | — | 4a in review |
| 5 | Legal | SEC-092 | Plan 3 for in-app links | Not written |
```

- [ ] **Step 4: Add the lesson to the journal**

Append under `## Lessons Learned Per Project` in `C:\Users\Jerry\Desktop\PROJECT 2026\SYSTEM_DESIGN_LESSONS.md`, after the last Kredibble entry (use the date of execution):
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

- [ ] **Step 5: Commit the records**

```bash
git add task.md PLAN-phase-3-roadmap.md PLAN-4-infrastructure-roadmap.md PLAN-4a-repair-sec-090.md
git commit -m "SEC-110: Plan 4 records: task.md statuses, progress log, roadmap links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

- [ ] **Step 6: Open the pull request**

Write the body to a temporary file outside the repo, then create the PR:
```bash
BODY="$(mktemp)"
cat > "$BODY" <<'EOF'
## What

Makes the SEC-090 branch safe to merge (Plan 4a, `PLAN-4a-repair-sec-090.md`; roadmap `PLAN-4-infrastructure-roadmap.md`).

- **SEC-110:** 11 files from the SEC-090 commit were UTF-16 (invalid workflows, unparseable `eas.json`, unrunnable scripts) and `task.md` had been re-saved as Windows-1252. Re-encoded or restored.
- **SEC-111:** the CD workflows and `eas.json` are back on the working Render baseline. The SEC-090 versions pointed the production app at `api.globalopportunitydesk.com`, which has no DNS record. Plans 4b/4c rebuild the VPS pipeline.
- **SEC-113:** local agent/IDE state and generated output are no longer tracked.
- **SEC-116:** `Repo hygiene` CI job (UTF-8 check, actionlint, shellcheck, gitleaks) and Dependabot.
- **SEC-112 (part):** `/api/v1/health` reports `environment` (`APP_ENV`) and `release` (commit SHA); deployed environments must run with `NODE_ENV=production`.

Also in this branch from 7f8be2c: real totals on `GET /admin/opportunities` and more third-party keys blanked in the e2e server.

## Production impact

None intended. Render remains the API host; production URLs are unchanged; `APP_ENV` defaults to `production` under `NODE_ENV=production`.

## Checks

- `node scripts/check-encoding.mjs` → 0 failing
- Backend: `npm run lint && npm test` → <Tests: line>
- CI: all jobs green, including Repo hygiene
- After merge: confirm Dependabot shows no config errors; make `Repo hygiene` a required check (track M1)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
gh pr create --base main --head security/SEC-090-infrastructure-preparation --title "SEC-090 scaffolding repaired: encodings, Render baseline, repo hygiene (Plan 4a)" --body-file "$BODY"
rm "$BODY"
```
Fill in the `<Tests: line>` from Task 7 Step 8 before running. Expected: the PR URL is printed. CI runs on the PR. Every check must pass before review.

---

## Self-review notes

- **Coverage of the roadmap's 4a scope:** encodings (Tasks 2, 3), `task.md` (Task 1), Render baseline (Task 3), local state (Task 4), hygiene job with encoding, actionlint, shellcheck and gitleaks (Task 5), Dependabot (Task 6), environment and release (Task 7), records and PR (Task 8).
- **Names used by later plans:** health fields `environment` and `release`; `env.appEnv`, `env.release`; build arg `RELEASE_SHA`; CI check name `Repo hygiene (encoding, workflows, shell, secrets)`.
- **Known follow-ups, not in 4a:**
  - `docker-compose.prod.yml` and the `db-*.sh` scripts are kept only re-encoded; Plans 4b and 4e replace them.
  - The `.env.example` files still mention the two-level `staging.api.` names; Plan 4c rewrites them once D1 is confirmed.
