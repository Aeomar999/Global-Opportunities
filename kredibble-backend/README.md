# Kredibble Backend

Express API built with MongoDB, Cloudinary, AI assistant providers, WordPress content feeds, and Resend email verification.

## Setup

1. Copy `.env.example` to `.env` if not present.
2. Ensure you have a MongoDB Atlas cluster and Cloudinary account.
3. Install dependencies: `npm install`
4. Run locally: `npm run dev`

Default API URL: `http://localhost:4000/api`

## Deployment (Render)

1. Create a new **Web Service** on Render.
2. Connect your GitHub repository.
3. Set the following:
   - **Root Directory:** `kredibble-backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Add the following **Environment Variables**:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: *(Your MongoDB Atlas URL)*
   - `JWT_SECRET`: *(A long random string)*
   - `ADMIN_JWT_SECRET`: *(Another long random string)*
   - `CLOUDINARY_CLOUD_NAME`: *(From Cloudinary dashboard)*
   - `CLOUDINARY_API_KEY`: *(From Cloudinary dashboard)*
   - `CLOUDINARY_API_SECRET`: *(From Cloudinary dashboard)*
   - `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`: *(For the selected `AI_PROVIDER`)*
   - `INSIGHT_GHANA_WORDPRESS_URL` and `AFRICAN_JOURNAL_WORDPRESS_URL`: *(Publication site roots)*
   - `WORDPRESS_AUTH_URL` and `WORDPRESS_SYNC_SECRET`: *(WordPress account bridge)*
   - `RESEND_API_KEY` and `RESEND_FROM_EMAIL`: *(Resend API key and verified sender)*
   - `CORS_ORIGIN`: *(The URLs of your deployed admin/web apps, comma-separated)*

## Useful Routes

- `GET /api/health` - Health check (Use this for Render)
- `POST /api/auth/register` - User signup
- `POST /api/auth/login` - User login
- `POST /api/upload` - File upload to Cloudinary (Requires Auth)
- `POST /api/community/channels` - Create a public or private community group (Requires Auth)
- `POST /api/community/channels/:channelId/join-requests` - Apply to join a community with form responses
- `GET /api/community/channels/:channelId/join-requests` - Review pending applications (Community admin only)
- `POST /api/community/channels/:channelId/members/:userId/accept` - Accept an application (Community admin only)
- `POST /api/community/channels/:channelId/members/:userId/ban` - Ban a community member (Community admin only)
- `POST /api/community/channels/:channelId/members/:userId/unban` - Unban a community member (Community admin only)
- `PUT /api/community/channels/:channelId/posts/:postId/pin` - Pin one group message (Community admin only)
- `GET /api/opportunities?type=competition` - Filter opportunity listings by type
- `GET /api/opportunities?type=fellowship` - List fellowship opportunities
- `GET /api/opportunities?type=training-workshop` - List training and workshop opportunities
- `GET /api/opportunity-types` - Available listing type values
- `POST /api/assistant/chat` - AI assistant chat using `openai` or `anthropic` (Requires Auth)
- `GET /api/news?source=insightGhana` - Normalized WordPress posts; omit `source` for both configured sources
- `POST /api/auth/verification-code/send` - Send an email verification code with Resend
- `POST /api/auth/verification-code/verify` - Verify an email code

## Admin Portal API

See [docs/ADMIN_PORTAL_API.md](docs/ADMIN_PORTAL_API.md) for the frontend-ready route and payload contract.
Give WordPress developers [docs/WORDPRESS_DEVELOPER_HANDOFF.md](docs/WORDPRESS_DEVELOPER_HANDOFF.md) for the required plugin routes and sync contract.

All `/api/admin` endpoints require a JWT and an active staff role. The backend supports roles from the portal brief, including Partnerships Officer, Opportunities Officer, Writer, Training and Capacity Development Officer, Database Officer, Communications Officer, Social Media Manager, Country Lead, Admin Support, and Desk Lead.

- `/api/admin/opportunities` - Vetted opportunity management, WordPress sync retry, and app/website analytics
- `/api/admin/programs` - Internally run programs
- `/api/admin/partners` - Six-stage partner pipeline; `onboard` and `renew` automatically close a partner
- `/api/admin/ambassadors` - Ambassador directory and amplification logs
- `/api/admin/beneficiaries` - Deduplicated beneficiary records and verification
- `/api/admin/social-posts` - Manual social reporting and monthly totals
- `/api/admin/dashboard`, `/api/admin/targets`, `/api/admin/scorecards`, `/api/admin/reports/monthly` - Live metrics, targets, scorecards, and reports
- `/api/admin/testimonials` - Testimonial moderation
- `/api/admin/settings/pipeline-stages` and `/api/admin/settings/integrations` - Fixed pipeline labels and write-only integration configuration status

Use `POST /api/opportunities/:id/views` with `{ "source": "app" }` or `{ "source": "website" }` to record a view. Opportunity applications use the existing `POST /api/opportunities/:id/applicants` endpoint and accept the same `source` value.

## WordPress Mirror

MongoDB remains the system of record. When `WORDPRESS_SYNC_BASE_URL` and `WORDPRESS_API_KEY` are configured, writes to opportunities, programs, partners, ambassadors, beneficiaries, and social posts are mirrored to WordPress. The backend calls `POST {WORDPRESS_SYNC_BASE_URL}/{resource}` for creates and `POST {WORDPRESS_SYNC_BASE_URL}/{resource}/{wordpressId}` for updates, with a bearer API key and `{ id, wordpressId, record }` payload. WordPress should return `{ "wordpressId": "..." }`; ambassador creation may additionally return `{ "referralCode": "..." }`.

If WordPress is unavailable, MongoDB still saves the record and its `wordpressSync.status` is marked `pending` or `failed`. A WordPress success response must include its record ID, otherwise the backend marks the sync as failed to prevent duplicate records. Staff can retry from the matching `POST /api/admin/{resource}/:id/retry-wordpress-sync` endpoint.

## App, Website, and AI Integration

The app and public WordPress website both use this API; neither should write directly to MongoDB. The app sends its JWT as `Authorization: Bearer <token>` for authenticated actions and identifies opportunity events with `source: "app"`. The WordPress plugin calls the public read APIs and records views with `source: "website"` plus a stable `visitorId`; a referral URL should also include `referralCode`. Admin writes are mirrored to WordPress only after `WORDPRESS_SYNC_BASE_URL` and `WORDPRESS_API_KEY` are set on the backend server.

Set `OPENAI_API_KEY` for ChatGPT or `ANTHROPIC_API_KEY` for Claude, select the default with `AI_PROVIDER`, and call `POST /api/assistant/chat` with an app JWT. A request may override the provider with `"provider": "openai"` or `"provider": "anthropic"`. Keep every AI key on the backend; the app and WordPress site must never receive it.
