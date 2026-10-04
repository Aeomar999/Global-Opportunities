# Postmortem: SEC-041

## Incident Summary
An outdated live Vercel backend (`kredibble-backend.vercel.app`) was serving user records, including password hashes, to anonymous callers because it was running pre-security-hardening code that exposed the `/api/users` endpoint without authentication.

## Exposure Window
The exposure window lasted from the initial deployment of the unguarded `/api/users` route until the Vercel backend project was disconnected and the connection severed by the user on 2026-10-02.

## Data Exposed
User records including `email`, `name`, `role`, and `passwordHash` were exposed. Given that `passwordHash` values were leaked, attackers could attempt offline brute-force attacks against those hashes.

## Actions Taken
- The user has disconnected the `kredibble-backend.vercel.app` project. It no longer builds on pushes, and the user has been instructed to take it down completely or rotate the MongoDB Atlas password so that the old code can no longer reach the database.
- The `kredibble-api.onrender.com` backend (which runs the hardened `main` code) is secure and correctly enforces authentication on `/api/users`.
- The admin dashboard environment variable `NEXT_PUBLIC_API_URL` has been updated to point to the correct, secure API or proxy.
- All new deployments of the backend enforce strict authentication, role-based access control, rate-limiting, and input validation on all routes.

## Tamper Review
A tamper review was requested. Because we do not have application-level logs from the outdated Vercel project, we rely on the database state. The user has been advised to rotate the production database password to fully contain the incident and prevent the stale Vercel deployment from continuing to read or write data.

## Prevention
The CI/CD pipeline now includes a strict `security-audit` step and `test-master` regression tests that verify route protection (e.g. `SEC-002: route-manifest test`). Code cannot reach `main` or be deployed without passing these tests. No route can be implicitly public; all routes must explicitly define their authentication requirements.
