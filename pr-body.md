## Summary

Fixes SEC-075: The admin cookie was only accepted by `/dashboard/summary`. Admin UI calls to `/verification/companies`, `/opportunities`, etc. returned 401.

## Changes

### Backend
- **src/routes/admin-api.js** (new): Admin portal routes guarded by combined auth
- **src/middleware/auth.js**: Added `requireAdminOrStaffAuth` - accepts admin cookie/JWT OR user Bearer token with StaffMember role
- **src/routes/index.js**: Mount new adminApiRouter at `/admin` (replacing old adminRouter)

### Admin Client
- **kredibble-admin/src/lib/api.ts**: Updated endpoints to use `/admin/` prefix:
  - `/dashboard/summary` → `/admin/dashboard`
  - `/verification/companies` → `/admin/verification/companies`
  - `/opportunities` → `/admin/opportunities`

## Design

Per the task's preferred approach: an `/api/admin/*` namespace guarded by combined auth that accepts:
1. Admin cookie/JWT (audience: kredibble-admin) — for admin panel
2. User Bearer token + StaffMember record — for backward compatibility with existing tests and API clients

This maintains SEC-040's audience separation while keeping existing tests working.

## Testing
- All 153 backend tests pass
- Lint clean
- The failing test "automatically closes a partner when its pipeline stage is onboard" now passes