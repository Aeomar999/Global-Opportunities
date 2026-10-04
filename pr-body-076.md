## Summary

Fixes SEC-076: Admin session expires at 15 min with no refresh mechanism.

## Changes

### Backend
- **src/middleware/auth.js**: Added `setAdminRefreshCookie`/`clearAdminRefreshCookie` for path-scoped (`/auth/admin`) httpOnly refresh cookies (30-day TTL)
- **src/routes/auth.js**:
  - Admin login (`/auth/admin/login`) now sets refresh token as cookie instead of returning in JSON
  - Admin logout (`/auth/admin/logout`) clears refresh cookie and revokes token
  - Added `POST /auth/admin/refresh` — rotates refresh token, sets new access+refresh cookies
  - Added `GET /auth/admin/me` — validates admin cookie, returns user for session check

### Admin Client (kredibble-admin/src/lib/api.ts)
- `request()` now retries once on 401 by calling `/auth/admin/refresh`
- Added `checkAdminSession()` for layout-mount session validation
- Added `refreshAdminSession()` helper with deduplication

## Design
- Refresh tokens stored in httpOnly, Secure, SameSite=Strict cookies (not localStorage)
- Path-scoped to `/auth/admin` so they only travel on auth endpoints
- Token rotation on every refresh with reuse detection (revokes family on replay)
- Maintains SEC-040 audience separation (admin tokens use `adminJwtSecret`)

## Testing
- All 153 backend tests pass
- Lint clean