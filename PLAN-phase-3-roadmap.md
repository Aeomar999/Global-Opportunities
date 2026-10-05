# Phase 3 Roadmap: Launch Blockers

Covers SEC-065, SEC-075, SEC-077, SEC-081, SEC-083, SEC-084, SEC-087, SEC-090 and SEC-092 from `task.md`. The work is split into four plans, each a separate branch and PR with its own tests.

## Decisions (2026-10-03)

| Topic | Decision |
|---|---|
| Admin pages (SEC-077) | Connect all 20 mock-data pages to real data |
| Account deletion (SEC-065, Q11) | Delete private data (profile, CV, applications, bookings, saved items, uploads, company records). Keep public content (community posts, channels, closed postings) with the person removed. Close the user's live job postings. |
| Monitoring (SEC-090) | Sentry for errors (backend, admin, mobile); Better Stack for uptime |
| Legal (SEC-092) | Claude drafts the privacy policy and terms from what the app collects, under Ghana's Act 843; published as public pages on the admin site. A lawyer reviews before launch. |
| Admin API namespace (SEC-075) | `/api/v1/admin/*`, shared with the staff portal (`requireAdminOrStaffAuth`, chosen 2026-10-03 in PR #23). Dashboard data routes take admin sessions only (`requireAdminAuth`). |

## Plans, in order

| # | Plan | Items | Depends on | Status |
|---|---|---|---|---|
| 1 | [Backend account security](PLAN-1-account-security.md) | SEC-083, SEC-084 (backend), SEC-065, plus the 3 lint errors that keep CI red | — | Merged (PR #22) |
| 2a | [Admin data API](PLAN-2a-admin-data-api.md) | SEC-075 routes, contract test | — | Merged (PR #26) |
| 2b | [Admin pages on real data](PLAN-2b-admin-pages.md) | SEC-077 remaining 16 pages | 2a | In review (PR #28) |
| 3 | Mobile launch surface | SEC-081, SEC-083/084 screens, SEC-087, legal links | Plan 1; SEC-072 for "my applications" | Not written |
| 4 | Operations: see [Plan 4 roadmap](PLAN-4-infrastructure-roadmap.md) | SEC-089, SEC-090, SEC-110–118 | — | 4a complete, 4b next |
| 5 | Legal | SEC-092 | Plan 3 for in-app links | Not written |

Each plan is written once the previous one is merged, so it reflects the code as it really is.

## Things only you can do

These block a launch but can't be done from the repo:

- **SEC-041:** confirm `kredibble-backend.vercel.app/api/users` no longer returns 200, and rotate the Atlas database password.
- **SEC-090:** create the Sentry organisation (3 projects: backend, admin, mobile) and a Better Stack account; share the DSNs.
- **SEC-087:** Apple Developer and Google Play accounts, final app icon and splash artwork.
- **SEC-092:** legal review of the drafts; registration with Ghana's Data Protection Commission.

## Not covered here, but blocking a release

- SEC-078: admin `next@16.2.10` has a critical advisory; `npm audit` also reports high findings in all three apps.
- SEC-047 (Q10): opportunity and verification records mix `HirerAccount` ids and `User` ids. Plan 1 matches both when deleting; Plan 2 needs the decision.
- SEC-060: grant applications and reports store no user id, so deletion and export cannot find them.
- SEC-080 (reopened), SEC-097…SEC-103: filed during Plan 1; SEC-097 and SEC-098 should be done before launch.
- SEC-104 (staff-portal mass assignment) and SEC-105 (admins share one rate-limit bucket behind the Vercel proxy): filed during Plan 2b.
- SEC-060 (Q4): grant approvals record a decision only; the allocated amount won't move until allocation rules are decided.
