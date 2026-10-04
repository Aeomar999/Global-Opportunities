# WordPress Integration Handoff

## Purpose

The Kredibble backend is the system of record for staff-managed data. WordPress is the public presentation layer. Staff create and edit records through the app's admin APIs; the backend mirrors those changes to WordPress automatically.

The WordPress plugin must never connect directly to MongoDB and must not contain backend, AI, or database credentials.

## One-Time Configuration

The backend is configured to call this WordPress REST API base URL:

```text
https://globalopportunitydesk.com/wp-json/god/v1/admin
```

The project owner will provide a `WORDPRESS_API_KEY` separately. Store it in the WordPress server configuration, not in JavaScript, page builders, or public plugin settings.

Each protected WordPress endpoint must require this header:

```http
Authorization: Bearer <WORDPRESS_API_KEY>
```

Requests with a missing or incorrect key must return `401 Unauthorized` before reading or writing any data.

## Required REST Routes

Register the following routes with the WordPress REST API. `wordpressId` is the ID previously returned by WordPress.

| Resource | Create | Update | Delete |
| --- | --- | --- | --- |
| Opportunities | `POST /opportunities` | `POST /opportunities/{wordpressId}` | `DELETE /opportunities/{wordpressId}` |
| Programs | `POST /programs` | `POST /programs/{wordpressId}` | `DELETE /programs/{wordpressId}` |
| Partners | `POST /partners` | `POST /partners/{wordpressId}` | `DELETE /partners/{wordpressId}` |
| Ambassadors | `POST /ambassadors` | `POST /ambassadors/{wordpressId}` | `DELETE /ambassadors/{wordpressId}` |
| Beneficiaries | `POST /beneficiaries` | `POST /beneficiaries/{wordpressId}` | `DELETE /beneficiaries/{wordpressId}` |
| Social posts | `POST /social-posts` | `POST /social-posts/{wordpressId}` | `DELETE /social-posts/{wordpressId}` |

For example, WordPress receives an opportunity create request at:

```text
POST https://globalopportunitydesk.com/wp-json/god/v1/admin/opportunities
```

An update is made at:

```text
POST https://globalopportunitydesk.com/wp-json/god/v1/admin/opportunities/123
```

## Request Contract

Every create or update request uses this JSON shape:

```json
{
  "id": "mongodb-record-id",
  "wordpressId": "123",
  "record": {
    "title": "Example opportunity",
    "description": "Opportunity details",
    "country": "Ghana"
  }
}
```

`wordpressId` is empty or absent for a create. The plugin must create a record and return:

```json
{ "wordpressId": "123" }
```

For updates, use the URL `wordpressId` to update the existing WordPress record and return the same response. Never create a duplicate record when an update request arrives.

For ambassadors, WordPress generates the referral code on first creation and returns it with the WordPress ID:

```json
{
  "wordpressId": "123",
  "referralCode": "GOD-ABC123"
}
```

For deletes, remove or archive the specified WordPress record and return a `2xx` response.

## WordPress Storage and Visibility

Use a custom plugin. Do not place this logic in a theme.

| Resource | Recommended WordPress storage | Public website visibility |
| --- | --- | --- |
| Opportunities | Custom post type plus post meta | Public after the backend marks it vetted and published |
| Programs | Custom post type plus post meta | Public when appropriate |
| Ambassadors | Custom post type or private custom table | Public only for fields approved for a directory |
| Partners | Private custom table or private post type | Never expose contact details publicly |
| Beneficiaries | Private custom table | Never expose beneficiary names, email addresses, phone numbers, or institutions publicly |
| Social posts | Private custom table or custom post type | Publish only entries intentionally selected for public display |

The plugin should preserve the MongoDB ID in record metadata, for example `_god_backend_id`, to help support staff diagnose a sync issue.

## Website Features That Call the Backend

WordPress pages display the mirrored records. They should also report website activity to the backend.

### Opportunity views

```text
POST https://YOUR_BACKEND/api/opportunities/{opportunityId}/views
```

```json
{
  "source": "website",
  "visitorId": "stable-anonymous-browser-id",
  "referralCode": "OPTIONAL-AMBASSADOR-CODE"
}
```

Create one anonymous browser ID and retain it in a first-party cookie or local storage. Do not use a WordPress API key in this browser request.

### Opportunity applications

```text
POST https://YOUR_BACKEND/api/opportunities/{opportunityId}/applicants
```

Send `source: "website"` and any referral code with the application data. The backend records the website/application split for analytics.

### Testimonials

```text
POST https://YOUR_BACKEND/api/testimonials
GET  https://YOUR_BACKEND/api/testimonials
```

The website sends `name`, `email`, `comment`, and optional `photo`. Only approved testimonials appear in the `GET` response. Never display submitter email addresses.

## Shared User Accounts

If the website needs signup or login, its forms call the same backend as the mobile app:

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

This creates one account in the backend MongoDB database that works in both the website and mobile app. Do not create a second WordPress user account for the same person unless a future single-sign-on design explicitly requires it.

The WordPress domain must be included in the backend `CORS_ORIGIN` environment variable. The backend has already been configured for `https://globalopportunitydesk.com` and `https://www.globalopportunitydesk.com`.

## Failure Handling

If WordPress returns a non-2xx response or is offline, the backend still saves the MongoDB record and marks `wordpressSync.status` as `failed`. A staff member can retry through the corresponding admin endpoint:

```text
POST /api/admin/{resource}/{id}/retry-wordpress-sync
```

The WordPress plugin should return useful JSON errors, for example:

```json
{ "message": "Opportunity record not found" }
```

## Acceptance Checklist

1. A request without the bearer key returns `401`.
2. Creating an opportunity from the backend creates one WordPress record and returns `wordpressId`.
3. Updating that opportunity updates the same WordPress record without duplication.
4. A failed request leaves the MongoDB record available for retry.
5. A new ambassador response includes both `wordpressId` and `referralCode`.
6. Partner and beneficiary data cannot be retrieved through a public WordPress endpoint or page.
7. Website view events appear as `source: website` in backend opportunity analytics.

## Security Rules

- Do not expose `WORDPRESS_API_KEY`, Anthropic/OpenAI keys, MongoDB credentials, or backend JWT secrets in browser code.
- Use HTTPS for every backend and WordPress request.
- Validate and sanitize all values before saving WordPress posts or table rows.
- Use WordPress capabilities for any internal management screens; the backend bearer key alone is for server-to-server sync only.
