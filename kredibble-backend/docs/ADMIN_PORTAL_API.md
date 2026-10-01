# Admin Portal API

All admin requests use `Authorization: Bearer <jwt>` and return `{ "data": ... }` or `{ "data": [...], "count": number }`. Staff access is derived from the active `StaffMember.role`; a platform `admin` can access every portal endpoint.

The generic `/api/users` and `/api/staff` management routes are platform-admin-only. Public signup accepts only `seeker` and `hirer`; create staff or platform admins through a protected operational process.

## Resources

| Resource | Collection endpoint | Required create fields |
| --- | --- | --- |
| Opportunities | `/api/admin/opportunities` | `title`, `description`, `offeringOrganization` or `company`, `location`, `type` |
| Programs | `/api/admin/programs` | `title`, `programType`, `status` |
| Partners | `/api/admin/partners` | `organizationName`, `partnerType`, `stage` |
| Ambassadors | `/api/admin/ambassadors` | `fullName`, `email` |
| Beneficiaries | `/api/admin/beneficiaries` | `fullName`, `email` or `phone`, `sourceType` |
| Social posts | `/api/admin/social-posts` | `platform`, `title`, `postedAt` |

Opportunities, programs, partners, ambassadors, and social posts use `GET`, `POST`, `PATCH /:id`, `DELETE /:id`, and `POST /:id/retry-wordpress-sync`. Beneficiaries use `GET`, `POST`, `PATCH /:id`, `POST /:id/verify`, and `POST /:id/retry-wordpress-sync`.

## Important Fields and Actions

- Opportunities: `vetted`, `vettedBy`, `vettedAt`, `moderationStatus`, `deadline`, `applicationLink`, `format`, `country`, `assignedWriterId`, and `referralCodeOnApply`. Only the admin opportunity route can set vetting or publish a listing. `GET /api/admin/opportunities/:id/analytics` returns app/website view and application totals.
- Programs: `programType` is `training`, `bootcamp`, `webinar`, `outreach`, `project`, `mentorship`, or `event`; `status` is `planned`, `running`, `delivered`, or `cancelled`.
- Partners: `stage` is `prospect`, `outreach`, `proposal`, `MOU`, `onboard`, or `renew`. The API calculates `closed`; clients must not set it themselves.
- Ambassadors: `referralCode` is returned read-only after WordPress sync. Log a share with `POST /api/admin/ambassadors/:id/amplifications` and `{ "channel": "LinkedIn", "note": "optional" }`.
- Beneficiaries: `sourceType` is `organic`, `ambassador-referral`, `event`, `partner-channel`, or `bulk-import`. An ambassador referral requires `ambassadorId`. Email and phone are deduplicated.
- Opportunity tracking: post views to `/api/opportunities/:id/views` using `{ "source": "app" | "website", "visitorId": "stable-client-id", "referralCode": "optional" }`. Apply through `/api/opportunities/:id/applicants` with the same `source`, `visitorId`, and optional `referralCode`.

## Reporting and Settings

- `GET /api/admin/dashboard?month=YYYY-MM` returns KPIs, progress priorities, six-month trend data, pipeline health, programs, and activity.
- `GET /api/admin/leaderboard?month=YYYY-MM` returns ranked ambassador activity.
- `GET /api/admin/scorecards?month=YYYY-MM` and `GET /api/admin/scorecards/me?month=YYYY-MM` return team and personal scores.
- `GET /api/admin/reports/monthly?month=YYYY-MM&audience=internal|partner` returns the appropriate report. Partner reports intentionally omit individual staff data.
- `GET /api/admin/targets?month=YYYY-MM` and `PUT /api/admin/targets/:metric` manage targets. The update body accepts `month`, `target`, `unit`, `note`, `greenThreshold`, and `amberThreshold`.
- `GET /api/admin/settings/integrations` returns only configured/not-configured states. Secrets are set in backend environment variables and never returned.

## Website and AI

WordPress should only receive mirrored admin records through the backend and use the public API for reads. It must send `source: "website"` and a stable `visitorId` when recording opportunity views. Configure `WORDPRESS_SYNC_BASE_URL` and `WORDPRESS_API_KEY` only on the backend.

For the assistant, configure `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY`, then call `POST /api/assistant/chat` from an authenticated app session. Never put OpenAI, Anthropic, or WordPress secrets in the mobile app or WordPress client code.

Public testimonials use `POST /api/testimonials` with `name`, `email`, `comment`, and optional `photo`. Only approved testimonials appear at `GET /api/testimonials`; moderation stays under `POST /api/admin/testimonials/:id/moderate`.
