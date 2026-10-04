# Plan 2b: Admin Pages on Real Data Implementation Plan

> **For agentic workers:** this plan runs as a Ralph loop, one task per iteration. Steps use checkbox (`- [ ]`) syntax. Progress is tracked in `.superpowers/sdd/progress.md` as `2b Task N: complete (<sha>, <evidence>)`.

**Goal:** The 16 admin pages that still import `src/lib/mock-*.ts` read and write real data through the admin API. Each action persists. The mock files are deleted.

**Architecture:**
- **Backend:** Plan 2a's `mountAdminDataRoutes` gains a few more routes:
  - admin collections for grant applications and community posts;
  - `GET /admin/opportunities/:id`;
  - `GET /admin/analytics`;
  - `POST /admin/staff/invite`;
  - `POST /admin/upload`, an admin variant of the upload router built by a factory.
- **Admin client:** `src/lib/api.ts` types are brought in line with the backend models. Each page is rewired following the existing real-data pattern in `src/app/(dashboard)/seekers/page.tsx`: `useState`/`useEffect`/`useCallback`, a loading spinner, an error state with retry, and an empty state.
- **Testing:** every page gets one Playwright test against seeded data in the e2e API (`kredibble-backend/scripts/e2e-server.js`). The test proves the page shows real data and that one action persists across a reload.

**Tech Stack:** Express 4, Mongoose 9, Zod 4, Jest + supertest; Next.js 16 (read `kredibble-admin/node_modules/next/dist/docs/` before using any Next API you're unsure of), React 19, TypeScript strict, Playwright.

## Global Constraints

- **Branch:** `security/phase-3-admin-pages`, created from `security/phase-3-admin-data-api`, which is PR #26. The PR targets `main`.
- **Commits:** commit after each task, then `git push`. Messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Stage only the task's files; never `git add .` or a bare `git add -A`.
- **Admin-only routes:** every admin route uses `requireAdminAuth` (admin sessions only). A user Bearer token gets 401. Staff-portal roles get no new access.
- **Validation:** request bodies on new routes go through `validate(zodSchema)`. Any query-filter value that isn't a plain string answers 400 (SEC-061).
- **Never** remove `validate`, widen CORS, rate limits or upload caps, or lower bcrypt cost. Admin uploads keep the 5 MB cap and the MIME and magic-byte checks.
- **Audit:** admin writes stay audit-logged.
- **Code hygiene:** no `console.log` in `src/`. No `any` in TypeScript. No mock data left in a rewired page. Fields the API doesn't have are removed from the UI, not faked.
- **Design:** keep each page's existing layout and Tailwind classes. Change only what wiring needs: loading, error and empty states, and disabled buttons while a request runs.
- **Backend checks:** `npm run lint && npm test` in `kredibble-backend` whenever backend files change. The contract test (`tests/admin-api-contract.test.js`) must pass: every client call is served.
- **Admin checks:** `npm run lint && npm run typecheck && npm run build` in `kredibble-admin` whenever admin files change. `npm run test:e2e` must pass after every page task.
- **Records:** after each task, add any lesson-worthy decision to `C:\Users\Jerry\Desktop\PROJECT 2026\SYSTEM_DESIGN_LESSONS.md` (AGENTS.md § System Design Learning Journal). Task 13 updates `task.md`.
- **Decisions made in this plan:**
  - **Staff invite** links an **existing** Kredibble account by email; there is no email-invite flow.
  - **Approving a posting** sets `vetted: true` and `moderationStatus: 'published'`. Rejecting sets `moderationStatus: 'rejected'`.

---

### Task 1: Admin collections for grant applications, community posts and single opportunities

**Files:**
- Modify: `kredibble-backend/src/routes/index.js` (`mountAdminDataRoutes`)
- Modify: `kredibble-backend/src/routes/admin-api.js` (`GET /opportunities` filter hardening)
- Test: `kredibble-backend/tests/sec-077-admin-pages-api.test.js` (new)

**Routes:**
- `adminCollection('/grant-applications', { Model: GrantApplication, resourceName: 'GrantApplication', policyKey: 'grant-applications', searchFields: ['applicantName'], filterFields: ['grantId', 'status'] })`
  - `?grantId=` must cast to the ObjectId field. Check that a string `grantId` filter matches; Mongoose casts it in `find`.
- `adminCollection('/community/posts', { Model: ChannelPost, resourceName: 'ChannelPost', policyKey: 'community/posts', searchFields: ['title', 'body'], filterFields: ['channelId', 'flagged'], populate: { path: 'authorId', select: 'name email avatarUrl' } })`
- `GET /admin/opportunities/:id`, behind `requireAdminAuth`. It returns one `Opportunity` via `toClientObject`, or 404 `Opportunity not found` (also for an invalid id).
  - Register it inside `mountAdminDataRoutes`; the staff-portal router has no GET-by-id, so the request falls through to it.
- In `admin-api.js` `GET /opportunities`, reject a non-string value for any of `country`, `type`, `moderationStatus` or `vetted` with `ApiError(400, 'Invalid query parameters')`. Convert `vetted` `'true'`/`'false'` to a boolean.

**Tests** (supertest, admin cookie via `signAdminToken`, the pattern in `tests/sec-075-admin-api.test.js`):
- [ ] `GET /admin/grant-applications?grantId=<id>` lists only that grant's applications. `PATCH /admin/grant-applications/:id {status:'approved'}` persists.
- [ ] `DELETE /admin/community/posts/:id` with the cookie returns 204 and removes the post. A user Bearer token gets 401.
- [ ] `GET /admin/opportunities/:id` returns the posting; an unknown id returns 404.
- [ ] `GET /admin/opportunities?moderationStatus[$ne]=x` returns 400.
- [ ] Write each test first, see it fail (404 or 200), implement, see it pass. Then `npm run lint && npm test`, commit `feat(admin-api): grant applications, community posts, single opportunity (SEC-077)` and push.

---

### Task 2: Analytics, staff invite and admin upload endpoints

**Files:**
- Modify: `kredibble-backend/src/routes/index.js` (`mountAdminDataRoutes`)
- Modify: `kredibble-backend/src/routes/upload.js` (factory)
- Modify: `kredibble-backend/src/schemas/` (add `admin.js` with the invite schema)
- Test: `kredibble-backend/tests/sec-077-admin-pages-api.test.js` (append)

**`GET /admin/analytics`** (`requireAdminAuth`) returns:

```js
{
  seekers: { total, active },            // SeekerProfile; active = status 'active'
  hirers: { total, verified },           // HirerAccount; verified = verified === true
  applications: { total },               // Applicant count
  reports: { total, open },              // Report; open = status 'open'
  opportunitiesByType: [{ type, count }] // Opportunity aggregate grouped by `type`, sorted by type
}
```

Use `countDocuments` and one `aggregate`, run in a single `Promise.all`.

**`POST /admin/staff/invite`** (`requireAdminAuth`, `validate(staffInviteSchema)`):
- The body is `{ email: z.string().email(), role: z.string().min(2).max(80) }`.
- Look up the user by `emailNormalized`. If none exists, answer 404 `No Kredibble account uses that email. Ask them to sign up first.`.
- If a `StaffMember` with that `userId` exists, answer 409 `That account is already on the staff list`.
- Otherwise create `StaffMember { userId, name: user.name, email: user.email, role, status: 'active', joinedDate: today as YYYY-MM-DD }`.
- Write an audit row with action `ADMIN_USER_UPDATE`, resource type `user`, and metadata `{ staffInvite: true, role }`; never log the email.
- Answer 201 with `toClientObject(staff)`.

**`POST /admin/upload?purpose=article-banner`:**
- Turn `upload.js` into `createUploadRouter({ authenticate, purposes, folderFor })` and keep `export const uploadRouter = createUploadRouter({ authenticate: requireAuth, purposes: <existing enum values>, folderFor: (req, purpose) => \`kredibble/${req.auth.sub}/${purpose}\` })`. User uploads must behave exactly as before.
- Mount `createUploadRouter({ authenticate: requireAdminAuth, purposes: ['article-banner'], folderFor: (req, purpose) => \`kredibble/admin/${purpose}\` })` at `/admin/upload`. Images only: drop PDF from the allowed MIME set for this mount, passed as a factory option. Keep the size cap, the magic-byte check and the rate limiter.

**Tests:**
- [ ] Analytics: with 2 seekers (1 active), 1 verified hirer, 1 open report and 2 job postings, the response matches exactly.
- [ ] Invite:
  - an existing seeker by email (any casing) → 201, and a `StaffMember` exists;
  - again → 409;
  - an unknown email → 404;
  - an invalid email → 400;
  - a user Bearer token → 401.
- [ ] Admin upload: a valid PNG with the cookie gives 200 with `folder` under `kredibble/admin/article-banner` (Cloudinary is mocked in test); a PDF gives 400; a user Bearer token gives 401. The existing upload tests in `tests/security.p0.test.js` still pass unchanged.
- [ ] TDD order, then `npm run lint && npm test`. Commit `feat(admin-api): analytics, staff invite by email, admin image upload (SEC-077)` and push.

---

### Task 3: Admin client types and functions match the API

**Files:**
- Modify: `kredibble-admin/src/lib/api.ts`

Bring the record types in line with the backend models, so pages can't read fields that don't exist. Check each model file in `kredibble-backend/src/models/`. At minimum:
- `EventRecord`: `id, title, hirer, location, dateTime, capacity, attendeesCount, status, createdAt, updatedAt`.
- `GrantRecord`: `id, title, hirer, sector, fundingPool, allocated, status, createdAt, updatedAt`.
- `GrantApplicationRecord` (new): `id, grantId, applicantName, requestedAmount, status, createdAt`.
- `ArticleRecord`: `id, title, category, duration?, summary, content, status, bannerImage?, createdAt, updatedAt`.
- `ChannelRecord`: `id, name, category, owner?, bio?, avatar?, visibility, status, followers?, postsCount, createdBy?, createdAt, updatedAt`.
- `ChannelPost`: `id, channelId, authorName, authorId?: { id, name, email, avatarUrl? } | string | null, title?, body, flagged, createdAt`.
- `ReportRecord` (new): `id, targetType, targetLabel?, reporterName?, reason, details?, status, linkedChannelId?, createdAt`.
- `StaffMember`: `id, userId, name, email, role, status, joinedDate?, createdAt, updatedAt`.
- `CompanyVerification`: the model fields (`name, industry, companySize, location, website, companyEmail, recruiterName, recruiterRole, recruiterEmail, submittedDate, overallStatus, hirerId`).
- `VerificationDoc`: `id, companyId, verificationCaseId?, key, label?, fileName?, status`.
- `OpportunityRecord` (new): the `Opportunity` fields the detail page shows.

Add these functions. Each keeps a literal path, so the contract test sees it:
- `getReports(params)` → `requestPage<ReportRecord>`; `getReportById`; `updateReport(id, { status })`.
- `updateEvent(id, data)`; `updateGrant(id, data)`.
- `getGrantApplications(grantId, params)` → `requestPage`; `updateGrantApplication(id, { status })`.
- `createArticle(data)`; `updateArticle(id, data)`; `uploadArticleBanner(file)`.
  - `uploadArticleBanner` sends `FormData` to `/admin/upload?purpose=article-banner` and must not set `Content-Type` (the browser sets the boundary). Give `requestPayload` a way to skip the default JSON header when the body is `FormData`.
- `deleteCommunityPost(id)`.
- `inviteStaff({ email, role })`.
- `getAnalytics()`; `getOpportunityById(id)`; `moderateOpportunity(id, decision: 'approve' | 'reject')`.
  - `moderateOpportunity` sends `{ vetted: true, moderationStatus: 'published' }` or `{ moderationStatus: 'rejected' }` with `PATCH /admin/opportunities/:id`.

- [ ] Admin `npm run lint && npm run typecheck && npm run build` pass. The pages that already use these types still compile; fix any compile errors in them. Backend contract test passes. Commit `refactor(admin): client types match API models; functions for remaining pages` and push.

---

### Tasks 4–12: Rewire one page group per task

Each task follows the same steps:

- [ ] **Seed:** extend `scripts/e2e-server.js` with records for this page. Use distinctive names (`E2E …`), and print nothing.
- [ ] **RED:** add a Playwright test to `tests/admin.e2e.spec.ts` (in a `test.describe` named after the page) that signs in, opens the page, expects the seeded record's text, performs the task's action, reloads, and expects the persisted result. Run `npm run test:e2e -- -g "<describe name>"` and see it fail.
- [ ] **Rewire** the page or pages:
  - remove every `@/lib/mock-*` import;
  - fetch with the `api.ts` functions;
  - add loading (`Loader2` spinner), error (`AlertCircle` plus a retry button) and empty states;
  - make each action call the API, disable its button while the request is pending, and update the UI from the response;
  - remove fields the API doesn't have;
  - for a detail page, show the API's "not found" message instead of crashing.
- [ ] **GREEN:**
  - `npm run test:e2e -- -g "<describe name>"` passes;
  - then admin `npm run lint && npm run typecheck && npm run build`;
  - then the whole `npm run test:e2e`;
  - and the backend contract test.
- [ ] **Commit** `feat(admin): <page> on real data (SEC-077)`, then push. Record which fields were dropped from the UI in the commit body.

| Task | Pages | Data | Action to prove |
|---|---|---|---|
| 4 | `reports`, `reports/[id]` | `getReports` (filter by status), `getReportById` | Resolve a report → status `resolved` after reload |
| 5 | `events`, `events/[id]` | `getEvents`, `getEventById` | Change capacity (persists); cancel → status `cancelled` |
| 6 | `grants`, `grants/[id]` | `getGrants`, `getGrantById`, `getGrantApplications` | Approve an application → `approved` after reload |
| 7 | `content/articles`, `content/articles/[id]` (including `new`) | `getArticles`, `getArticleById`, `createArticle`, `updateArticle`, `uploadArticleBanner` | Create an article, then publish it → appears as published in the list. The banner picker uploads and stores the returned URL. A local preview URL must never be saved. |
| 8 | `community`, `community/[id]` | `getCommunityChannels`, `getCommunityChannelById`, `getCommunityChannelPosts`, `updateCommunityChannel`, `deleteCommunityPost` | Remove a post (gone after reload); suspend/restore a channel |
| 9 | `staff`, `staff/[id]`, `staff/invite` | `getStaff`, `getStaffById`, `updateStaff`, `inviteStaff` | Invite the seeded seeker's email as "Writer" → listed; change role → persists. An unknown email shows the API's message. |
| 10 | `verification/[id]` | `getVerificationCompanyById`, `getVerificationCompanyDocuments`, `updateVerificationDocument`, `updateVerificationCompany` | Approve a document → `approved`; approve the company → `approved` in the verification list |
| 11 | `opportunities/[id]` | `getOpportunityById`, `moderateOpportunity` | Approve a pending posting → shows published after reload |
| 12 | `analytics` | `getAnalytics` | The stat cards show the seeded counts (no action) |

Status values come from the backend. Where a mock type used a value the API doesn't, use the API's value. For example, a channel is suspended with `status: 'suspended'`, and an event is cancelled with `status: 'cancelled'`.

---

### Task 13: Delete mock data, record the work, open the PR

- [ ] `rg "lib/mock-" kredibble-admin/src` returns nothing. Delete every `kredibble-admin/src/lib/mock-*.ts` that is no longer imported. If one is still imported, by a component or a page outside the 16, rewire that import or record why it stays.
- [ ] Run everything: backend `npm run lint && npm test`; admin `npm run lint && npm run typecheck && npm run build && npm run test:e2e`.
- [ ] Update `task.md`:
  - SEC-077 becomes `✅ Done`, and its acceptance boxes are ticked only if true: `rg "lib/mock-"` is empty, and every admin action persists and is audited.
  - Add Progress Log rows with SHAs, test counts and the dropped-field notes.
  - Add a finding row (next free SEC id) for the `admin-api.js` `GET /opportunities` operator-injection gap that Task 1 fixed.
- [ ] Roadmap: Plan 2b's status becomes `In review (PR #<n>)`.
- [ ] Journal: add at least one lesson from this plan (for example, "drop fields you can't back with data instead of faking them", or "one end-to-end test per page proves wiring that unit tests can't"), plus a concepts-table row.
- [ ] Commit `docs: SEC-077 admin pages on real data`, push, and open the PR against `main`:
  - title: `Admin pages on real data (SEC-077)`;
  - body: what changed per page, the new endpoints, the decisions (existing-account staff invite, approve = vet + publish), test evidence;
  - it ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
