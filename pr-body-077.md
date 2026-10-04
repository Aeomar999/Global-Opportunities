## Summary

Partial progress on SEC-077: Added admin API routes for admin pages to replace mock data.

## Changes

### Backend (kredibble-backend)
- **src/routes/admin-api.js**: Added admin API routes for the following resources with combined auth (`requireAdminOrStaffAuth`):
  - **Seekers**: GET `/admin/seekers`, GET `/admin/seekers/:id`
  - **Hirers**: GET `/admin/hirers`, GET `/admin/hirers/:id`
  - **Events**: GET `/admin/events`, GET `/admin/events/:id`
  - **Grants**: GET `/admin/grants`, GET `/admin/grants/:id`
  - **Articles**: GET `/admin/articles`, GET `/admin/articles/:id`
  - **Staff**: GET `/admin/staff`, GET `/admin/staff/:id`, POST `/admin/staff`, PATCH `/admin/staff/:id`, DELETE `/admin/staff/:id`
  - **Community Channels**: GET `/admin/community/channels`, GET `/admin/community/channels/:id`, POST `/admin/community/channels`, PATCH `/admin/community/channels/:id`, DELETE `/admin/community/channels/:id`
  - **Community Posts**: GET `/admin/community/channels/:channelId/posts`
  - **Verification Companies**: GET `/admin/verification/companies`, GET `/admin/verification/companies/:id`, PATCH `/admin/verification/companies/:id`
  - **Verification Documents**: GET `/admin/verification/companies/:companyId/documents`, GET `/admin/verification/documents`, GET `/admin/verification/documents/:id`, PATCH `/admin/verification/documents/:id`, POST `/admin/verification/companies/:companyId/documents`, DELETE `/admin/verification/documents/:id`

All routes use `requireAdminOrStaffAuth` middleware (accepts admin cookie/JWT or user Bearer token + StaffMember role) and include pagination, filtering, and search.

### Admin Client (kredibble-admin)
- **src/lib/api.ts**: Added API methods for all new admin endpoints:
  - `getSeekers`, `getSeekerById`
  - `getHirers`, `getHirerById`
  - `getEvents`, `getEventById`
  - `getGrants`, `getGrantById`
  - `getArticles`, `getArticleById`
  - `getStaff`, `getStaffById`, `createStaff`, `updateStaff`, `deleteStaff`
  - `getCommunityChannels`, `getCommunityChannelById`, `createCommunityChannel`, `updateCommunityChannel`, `deleteCommunityChannel`
  - `getCommunityChannelPosts`
  - `getVerificationCompanies`, `getVerificationCompanyById`, `updateVerificationCompany`
  - `getVerificationCompanyDocuments`, `getVerificationDocuments`, `getVerificationDocumentById`, `updateVerificationDocument`, `createVerificationDocument`, `deleteVerificationDocument`

### Testing
- All 153 backend tests pass
- Backend lint passes
- Backend server starts successfully

### Remaining Work (SEC-077)
- Wire admin pages to use these new API methods instead of mock data
- Delete mock files (`src/lib/mock-*.ts`)
- Add loading, error, and empty states to admin pages
- Add audit logging for admin mutations
- Update admin pages: analytics, community, content/articles, events, grants, hirers, opportunities/[id], reports, seekers, staff, verification

## Related
- SEC-075 (admin cookie accepted by data routes) - PR #23 ✅
- SEC-076 (admin session refresh) - PR #24 ✅