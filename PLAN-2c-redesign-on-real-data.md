# Plan 2c: The Redesigned Admin on Real Data Implementation Plan

> **For agentic workers:** this plan runs as a Ralph loop, one task per iteration. Steps use checkbox (`- [ ]`) syntax. Progress is tracked in `.superpowers/sdd/progress.md` as `2c Task N: complete (<sha>, <evidence>)`.

**Goal:** The redesigned admin dashboard (PR #27, "G.O.D Admin") shows and changes real data for every SEC-077 page. Mock data becomes an explicit opt-in for development. Every page that isn't connected yet says so in real mode.

**Why:** PR #27 rebuilt the admin around mock data, behind a switch that defaulted to mocks in development. On `main`, the events, reports, analytics, staff invite and verification detail pages read mock data even with the switch off, so SEC-077 regressed. Plan 2b had wired the old pages and conflicts with almost every redesigned one. The user chose (2026-10-04) to keep the redesign's look and connect it to real data.

**Architecture:**
- **Merge:** the redesign is canonical for UI. On conflicts its pages, components and tests win. Plan 2b's backend work (endpoints, audit fix, channel visibility, e2e isolation) and the `api.ts` client functions are kept.
- **Data path:** pages load through the redesign's hooks (`useListData`, `useDetailData`) and per-domain loaders in `src/lib/services/`. Each loader branches on `isMockMode()`:
  - mock mode keeps today's behaviour (mock records with the mock-store overlay);
  - real mode calls `src/lib/api.ts` and maps the API record onto the page's existing type with an adapter.
- **Actions:** each action handler calls a service function `(record, patch) → Promise<record>`. In mock mode it returns `{ ...record, ...patch }`; in real mode it calls the API and returns the server's record. The page then calls `setRecord(() => next)`, which writes the mock store in mock mode and local state in real mode, and removes the `TODO(backend)` marker.
- **Mock mode:** opt-in only (`NEXT_PUBLIC_USE_MOCKS=true`); unset now means the real API.
- **Playwright:** two runs. `npm run test:e2e` drives the real API, which is what ships. `npm run test:e2e:mock` runs on port 3100 with mock mode on, for the redesign's mock-only checks. CI runs both.

**Out of scope:**
- Staff, Team and the Roles tab: Plan 2d (the role model the user chose to build).
- Partners, programs, database, network, leaderboard, scorecard, social, testimonials, monthly report, settings, notifications composer, reference data: a later plan.
- In real mode, each out-of-scope page shows a "not connected yet" notice (Task 2).

## Global Constraints

- **Branch:** `security/phase-3-admin-pages` (PR #28). Commit after each task, then `git push`. Messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage only the task's files; never `git add .` or a bare `git add -A`; never stage `.claude/` or `.superpowers/`.
- **Redesign wins on look and structure.** Keep its components (`DataTable`, `ListPage`, `DetailPage`, `DetailHeader`, `InfoCard`, `StatusBadge`, `Button`, `useToast`, `useConfirmDialog` …), copy, column configs and layouts. Don't reintroduce Plan 2b's old page markup.
- **Mock mode keeps working.** With `NEXT_PUBLIC_USE_MOCKS=true` every page behaves exactly as on `main`, and the mock suite passes.
- **No faked data in real mode.** A field or chart the API can't back is hidden, or shows an explicit "not available yet". Never fall back to mock records in real mode.
- **Admin routes** stay `requireAdminAuth` (admin sessions only). Admin writes stay audited. Query filters stay string-only (SEC-061). Never remove `validate`, widen CORS, rate limits or upload caps, or lower bcrypt cost.
- **Code hygiene:** no `console.log` in `src/` and no `any`. `NEXT_PUBLIC_*` env reads must be written literally (Next inlines them).
- **Backend checks:** `(cd kredibble-backend && npm run lint && npm test)` whenever backend files change. The contract test must pass.
- **Admin checks:** `(cd kredibble-admin && npm run lint && npm run typecheck && npm run build)` whenever admin files change. Both `npm run test:e2e` and `npm run test:e2e:mock` must pass after every task from Task 2 on.
- **Local e2e credentials:** the suites need `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD`. Run with `E2E_ADMIN_EMAIL=test-admin@kredibble.com E2E_ADMIN_PASSWORD=Password123` (the e2e API seeds that throwaway admin). Never print or log the password, and never write it to a committed file.
- **Records:** after each task, add any lesson-worthy decision to `C:\Users\Jerry\Desktop\PROJECT 2026\SYSTEM_DESIGN_LESSONS.md` in its format. Task 12 updates `task.md`, the roadmap and the PR.

---

### Task 1: Merge `main` (the redesign) into the branch

- [ ] `git merge --no-ff origin/main`. Resolve the conflicts:
  - **The 17 conflicting page files and `kredibble-admin/tests/admin.e2e.spec.ts`:** take `main`'s version (`git checkout --theirs <file>`, then `git add`).
  - **`kredibble-admin/src/lib/mock-staff.ts`** (deleted here, modified on `main`): keep `main`'s version.
  - **Every other `kredibble-admin/src/lib/mock-*.ts` that Plan 2b deleted** but the redesign imports: restore from `main` with `git checkout origin/main -- <file>`, so the build has them.
  - **`kredibble-admin/src/lib/api.ts`** auto-merges. Read the merged file and make sure Plan 2b's types and functions and the redesign's changes both survive and compile.
- [ ] Verify:
  - backend lint and test;
  - admin lint, typecheck and build;
  - `E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… npm run test:e2e`, the redesign's suite in its current default mode.

  Fix only merge damage, and record anything pre-existing that fails.
- [ ] Commit `merge: G.O.D admin redesign from main; redesign wins on pages and tests`, then push.

### Task 2: Mock data becomes opt-in; two Playwright runs; "not connected yet" notices

- [ ] **`src/lib/services/mock-mode.ts`:** `isMockMode()` returns true only for `NEXT_PUBLIC_USE_MOCKS === "true"`. Unset or anything else means the real API. Update the file's comment.
- [ ] **`playwright.config.ts`:** add `const MOCK_RUN = process.env.E2E_MOCKS === '1'`.
  - Default `BASE_URL` is `http://localhost:3100` when `MOCK_RUN`, otherwise `http://localhost:3000`.
  - The admin web server command runs on that port (`next dev -p <port>`) with env `{ NEXT_PUBLIC_API_URL: API_URL, NEXT_PUBLIC_USE_MOCKS: MOCK_RUN ? 'true' : 'false' }`.
  - The auth state file is per mode, so the two runs never share a saved session from another origin.
- [ ] **`tests/mode.ts`:** export `MOCK_RUN`. In `admin.e2e.spec.ts`, replace every `process.env.E2E_PROD === '1'` skip with `!MOCK_RUN` and keep the skip reasons. Then run the real suite. Any test that fails only because it expects mock records gets `test.skip(!MOCK_RUN, '<why it needs mock data>')`. A test that fails for any other reason is a bug to fix, not to skip.
- [ ] **`package.json`:** add `"test:e2e:mock": "cross-env E2E_MOCKS=1 playwright test"`, with `cross-env` as a devDependency (`npm i -D cross-env`, which also updates `package-lock.json`).
- [ ] **CI** (`.github/workflows/ci.yml`, the admin e2e job): after "Run Playwright", add "Run Playwright (mock mode)" running `npx playwright test` with `E2E_MOCKS: '1'` in its env. Keep the job's `timeout-minutes`; raise it only if the two runs genuinely need it.
- [ ] **Notice:** add `src/components/ui/NotConnectedNotice.tsx`, a small inline notice that renders only when `!isMockMode()`: "This page isn't connected to live data yet. What you see is sample data." Place it at the top of these pages:
  - staff (`/team` and `/staff/*`);
  - notifications, reference-data, settings;
  - partners, programs, database, network, leaderboard, scorecard, social, testimonials, monthly-report.

  Add a real-mode e2e test that one of them shows it.
- [ ] Verify everything (both e2e runs), commit `feat(admin): mock data is opt-in; real and mock Playwright runs (SEC-077)`, push.

### Tasks 3–11: Connect one domain per task

Each task follows the same steps:
- [ ] **Seed:** extend `kredibble-backend/scripts/e2e-server.js` where needed. Reuse Plan 2b's seeds (`E2E …` names); they are already there after the merge.
- [ ] **RED:** add a real-mode-only Playwright test (`test.skip(MOCK_RUN, 'real API only')`) in a describe named after the domain + " (real API)". It signs in through the saved session, opens the page, expects the seeded record, performs the task's action, reloads, and expects the persisted result. Write selectors for the redesigned UI: roles, labels, test ids the redesign already has, and `data-testid` additions only where nothing else is stable. Run it and see it fail.
- [ ] **Connect:**
  - Add or extend `src/lib/services/<domain>.ts` with the list loader, detail loader and action functions, each branching on `isMockMode()` as described under Architecture.
  - Map API records to the page's existing types in one adapter per domain.
  - Point the page at the service and remove its mock imports from the real path. Mock imports may stay inside the service's mock branch.
  - Remove each `TODO(backend)` you wire.
  - Handle action failures with the redesign's toast (`toast.error(message)`) and keep the record unchanged on failure.
- [ ] **GREEN:**
  - the new test passes;
  - then admin lint, typecheck and build;
  - both e2e runs pass;
  - backend lint and test pass if backend files changed.
- [ ] **Commit** `feat(admin): <domain> on real data in the redesign (SEC-077)` and push.

| Task | Domain (pages) | Real API | Action to prove |
|---|---|---|---|
| 3 | Verification detail (`verification/[id]`; the queue is already real) | `getVerificationCompanyById`, `getVerificationCompanyDocuments`, `updateVerificationDocument`, `updateVerificationCompany` | Approve each document, then the company → `approved` after reload, and in the queue |
| 4 | Opportunity detail (`opportunities/[id]`; the queue is already real) | `getOpportunityById`, `moderateOpportunity` | Approve a pending posting → published after reload |
| 5 | Seekers and hirers detail actions (`seekers/[id]`, `hirers/[id]`; lists already real) | PATCH `/admin/seekers/:id` and `/admin/hirers/:id` with `{ status }` | Suspend, then reinstate, a seeker → persists after reload. **Backend:** the `seekers` policy needs `adminUpdateFields: ['status', 'verified']` (as `hirers` has); add it with a backend test. |
| 6 | Reports (`reports`, `reports/[id]`) | `getReports`, `getReportById`, `updateReport` | Resolve a report → resolved after reload |
| 7 | Events (`events`, `events/[id]`) | `getEvents`, `getEventById`, `updateEvent` | Change capacity; cancel → persists after reload |
| 8 | Grants (`grants`, `grants/[id]`) | `getGrants`, `getGrantById`, `getGrantApplications`, `updateGrantApplication` | Approve an application → approved after reload. Allocation stays the stored amount (SEC-060), with the redesign showing that it doesn't move yet. |
| 9 | Articles (`content/articles`, `content/articles/[id]` incl. `new`) | `getArticles`, `getArticleById`, `createArticle`, `updateArticle`, `uploadArticleBanner` | Create a draft, publish it → published in the list. A refused banner upload (the e2e API has no Cloudinary keys) shows the server's message and saves no local preview. |
| 10 | Community (`community`, `community/[id]`) | `getCommunityChannels`, `getCommunityChannelById`, `getCommunityChannelPosts`, `updateCommunityChannel`, `deleteCommunityPost` | Remove a post (gone after reload); remove and restore a channel |
| 11 | Insights (`analytics`) and the Overview's remaining mock-only numbers | `getAnalytics`, extended | Charts show seeded counts. **Backend:** extend `GET /admin/analytics` with `verificationByStatus: [{ status, count }]` and `reportsByReason: [{ reason, count }]` (one aggregate each, in the same `Promise.all`), with a backend test. In real mode the month selector shows "Monthly history isn't available yet" rather than pretending. |

Use the API's status values and map them to the redesign's `StatusBadge` keys in the adapter. For example, a posting approved here is `published`, and a removed channel is `removed`.

### Task 12: Records, PR and CI

- [ ] `rg "TODO\(backend\)" kredibble-admin/src`: only Plan 2d and later-plan items may remain, namely the staff, roles, notifications, reference-data and portal pages. List them in the PR.
- [ ] **`task.md`:**
  - SEC-077 stays `✅ Done`, with a note: "regressed by PR #27, reconnected in Plan 2c".
  - Add a Progress Log row with SHAs and both e2e counts.
  - File new SEC rows for the redesign's unconnected areas: one for staff/roles (Plan 2d) and one for the portal pages, notifications and reference data.
- [ ] **Roadmap:**
  - Plan 2c row: in review, PR #28.
  - Add a Plan 2d row, "Admin roles and staff", with the 2026-10-04 decisions: email invite with a set-password link (72 h); existing admins become Super Admin; roles limit actions, not visibility.
- [ ] **Journal:** the lesson from this plan, e.g. a mock/real switch must default to real, so a forgotten setting can't ship sample data.
- [ ] Update PR #28's title to "Redesigned admin on real data (SEC-077)" and its body (`gh pr edit 28 --title … --body-file …`). The body covers what Plan 2b built, the merge with the redesign, what Plan 2c connected, the opt-in mock mode and the two e2e runs, what's still sample data and why, and the test evidence. It ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- [ ] Commit `docs: Plan 2c records`, push. Check that PR #28 is no longer conflicting (`gh pr view 28 --json mergeable`).
