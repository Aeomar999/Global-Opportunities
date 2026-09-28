/**
 * Central authorization + mass-assignment policy table (SEC-002, SEC-003, SEC-007).
 *
 * Two independent concerns live here:
 *
 *  1. WHO may touch a resource. `read` / `create` / `update` / `delete` hold either
 *     the string 'authenticated' (any valid token) or a list of roles.
 *
 *  2. WHICH FIELDS a caller may write. `createFields` / `updateFields` are strict
 *     allowlists. Anything a client sends that is not listed is dropped, so a
 *     request body can never reach a model with server-managed or privileged keys
 *     such as `role`, `passwordHash`, `applicantsCount`, `moderationStatus`,
 *     `verified`, or `flagged`.
 *
 * Keeping both in one table means adding a resource is a single decision, and an
 * endpoint cannot accidentally ship with an auth guard but no field allowlist.
 */

export const ADMIN = 'admin';
export const HIRER = 'hirer';
export const SEEKER = 'seeker';

export const AUTHENTICATED = 'authenticated';

const ADMIN_ONLY = [ADMIN];

/**
 * Profile fields a user controls about themselves. Server-managed columns
 * (rating, verified, applicationsCount, savedCount) are intentionally absent.
 */
const SEEKER_SELF_FIELDS = [
  'profession',
  'university',
  'country',
  'city',
  'phone',
  'bio',
  'professionalSummary',
  'experienceLevel',
  'technicalSkills',
  'softSkills',
  'tools',
  'certifications',
  'joinedDate',
];

/** Company profile fields a hirer controls. `verification`/`verified` are admin-only. */
const HIRER_SELF_FIELDS = [
  'companyName',
  'tagline',
  'logo',
  'bannerImage',
  'industry',
  'companySize',
  'location',
  'website',
  'companyEmail',
  'description',
  'recruiterName',
  'recruiterRole',
  'recruiterEmail',
  'recruiterPhone',
  'recruiterLinkedin',
  'joinedDate',
  'publicCompanyProfile',
];

export const RESOURCE_POLICIES = {
  // --- Internal identity surfaces. Never exposed to non-admins. ---
  users: {
    // Any authenticated user may read the directory; `passwordHash` is stripped
    // on every response (SEC-011/012). Writes stay admin-only, so role cannot be
    // changed by a non-admin. Scoping *which* fields each role may see is tracked
    // as a follow-up, not silently widened here.
    read: AUTHENTICATED,
    create: ADMIN_ONLY,
    update: ADMIN_ONLY,
    delete: ADMIN_ONLY,
    // `passwordHash` is never writable over HTTP; passwords change through the
    // dedicated auth flows only.
    createFields: ['name', 'email', 'role', 'avatarUrl'],
    updateFields: ['name', 'role', 'avatarUrl'],
  },
  staff: {
    read: ADMIN_ONLY,
    create: ADMIN_ONLY,
    update: ADMIN_ONLY,
    delete: ADMIN_ONLY,
    createFields: ['userId', 'name', 'email', 'role', 'status', 'joinedDate'],
    updateFields: ['name', 'email', 'role', 'status', 'joinedDate'],
  },

  // --- Profiles ---
  seekers: {
    read: AUTHENTICATED,
    create: [SEEKER, HIRER, ADMIN],
    update: AUTHENTICATED, // ownership enforced per-request in routes/index.js
    delete: [HIRER, ADMIN],
    createFields: ['userId', ...SEEKER_SELF_FIELDS, 'status'],
    updateFields: SEEKER_SELF_FIELDS,
  },
  hirers: {
    read: AUTHENTICATED,
    create: [HIRER, ADMIN],
    update: AUTHENTICATED, // ownership enforced per-request in routes/index.js
    delete: [HIRER, ADMIN],
    createFields: ['userId', ...HIRER_SELF_FIELDS, 'status'],
    updateFields: HIRER_SELF_FIELDS,
    // Verification state is awarded by admins, never self-asserted.
    adminUpdateFields: ['verification', 'verified', 'status'],
  },
  candidates: {
    read: AUTHENTICATED, // role-scoped filtering is tracked separately (SEC-019)
    create: ADMIN_ONLY,
    update: ADMIN_ONLY,
    delete: ADMIN_ONLY,
    createFields: ['name', 'profession', 'university', 'location', 'image', 'matchScore', 'skills', 'bio'],
    updateFields: ['name', 'profession', 'university', 'location', 'image', 'matchScore', 'skills', 'bio'],
  },

  // --- Marketplace ---
  opportunities: {
    read: AUTHENTICATED,
    create: [HIRER, ADMIN],
    update: AUTHENTICATED, // ownership enforced per-request in routes/index.js
    delete: [HIRER, ADMIN],
    createFields: [
      'hirerId',
      'title',
      'type',
      'company',
      'location',
      'description',
      'date',
      'workType',
      'salary',
      'experienceLevels',
      'eventDateTime',
      'eventRegion',
      'eventCategory',
      'grantBudgetRange',
      'grantSector',
    ],
    updateFields: [
      'title',
      'type',
      'company',
      'location',
      'description',
      'date',
      'workType',
      'salary',
      'experienceLevels',
      'eventDateTime',
      'eventRegion',
      'eventCategory',
      'grantBudgetRange',
      'grantSector',
    ],
    // `moderationStatus` and `applicantsCount` are server/admin controlled.
    adminUpdateFields: ['moderationStatus', 'applicantsCount', 'status'],
  },
  applicants: {
    read: [HIRER, ADMIN],
    create: [SEEKER, HIRER, ADMIN],
    update: [HIRER, ADMIN],
    delete: [HIRER, ADMIN],
    createFields: ['opportunityId', 'seekerId', 'name', 'skills', 'resumeUrl'],
    updateFields: ['status'],
  },
  'grant-applications': {
    read: ADMIN_ONLY,
    create: AUTHENTICATED,
    update: ADMIN_ONLY,
    delete: ADMIN_ONLY,
    createFields: ['grantId', 'applicantName', 'requestedAmount'],
    updateFields: ['status'],
  },
  events: {
    read: AUTHENTICATED,
    create: ADMIN_ONLY,
    update: ADMIN_ONLY,
    delete: ADMIN_ONLY,
    createFields: ['title', 'hirer', 'location', 'dateTime', 'capacity', 'status'],
    updateFields: ['title', 'location', 'dateTime', 'capacity', 'status'],
  },
  // Ticket booking. Anyone authenticated may book, but `quantity` is allowlisted
  // so a caller cannot inflate `attendeesCount` by injecting an arbitrary number.
  'event-attendees': {
    read: [HIRER, ADMIN], // attendee email addresses are PII
    create: AUTHENTICATED,
    update: ADMIN_ONLY,
    delete: ADMIN_ONLY,
    createFields: ['fullName', 'email', 'quantity'],
    updateFields: ['status'],
  },
  grants: {
    read: AUTHENTICATED,
    create: ADMIN_ONLY,
    update: ADMIN_ONLY,
    delete: ADMIN_ONLY,
    createFields: ['title', 'hirer', 'sector', 'fundingPool', 'status'],
    updateFields: ['title', 'sector', 'fundingPool', 'status'],
  },

  // --- Community ---
  'community/channels': {
    read: AUTHENTICATED,
    create: AUTHENTICATED,
    update: AUTHENTICATED,
    delete: [HIRER, ADMIN],
    createFields: ['hirerId', 'name', 'owner', 'category', 'followers', 'avatar', 'bio'],
    updateFields: ['name', 'category', 'followers', 'avatar', 'bio', 'status'],
  },
  'community/posts': {
    read: AUTHENTICATED,
    create: AUTHENTICATED,
    update: AUTHENTICATED,
    delete: AUTHENTICATED,
    createFields: ['channelId', 'authorName', 'body', 'title', 'bannerImage', 'link', 'linkText', 'hasRespondButton', 'date'],
    updateFields: ['body', 'title', 'bannerImage', 'link', 'linkText', 'hasRespondButton'],
    // Moderation flag is server controlled.
    adminUpdateFields: ['flagged', 'status'],
  },
  reports: {
    read: ADMIN_ONLY,
    create: AUTHENTICATED,
    update: ADMIN_ONLY,
    delete: ADMIN_ONLY,
    createFields: ['targetType', 'targetLabel', 'reporterName', 'reason', 'details', 'date', 'linkedChannelId'],
    updateFields: ['status', 'targetLabel', 'details'],
  },

  // --- Content / comms ---
  articles: {
    read: AUTHENTICATED,
    create: ADMIN_ONLY,
    update: ADMIN_ONLY,
    delete: ADMIN_ONLY,
    createFields: ['category', 'title', 'duration', 'summary', 'content', 'status', 'bannerImage'],
    updateFields: ['category', 'title', 'duration', 'summary', 'content', 'status', 'bannerImage'],
  },
  // Broadcast notifications, not per-user mailboxes: the mobile app calls
  // GET /notifications?userId=... as any signed-in role, and the route ignores
  // the param. Reads stay open to any authenticated user; authoring is admin-only.
  notifications: {
    read: AUTHENTICATED,
    create: ADMIN_ONLY,
    update: ADMIN_ONLY,
    delete: ADMIN_ONLY,
    createFields: ['title', 'message', 'audience', 'type', 'priority', 'isActive'],
    updateFields: ['title', 'message', 'audience', 'type', 'priority', 'isActive'],
  },


  // --- Verification ---
  'verification/companies': {
    read: [HIRER, ADMIN],
    create: [HIRER, ADMIN],
    update: [HIRER, ADMIN],
    delete: ADMIN_ONLY,
    createFields: [
      'hirerId',
      'name',
      'industry',
      'companySize',
      'location',
      'website',
      'companyEmail',
      'recruiterName',
      'recruiterRole',
      'recruiterEmail',
      'submittedDate',
    ],
    updateFields: ['name', 'industry', 'companySize', 'location', 'website', 'companyEmail', 'recruiterName', 'recruiterRole', 'recruiterEmail'],
    // Adjudication status is awarded by admins, never self-asserted.
    adminUpdateFields: ['overallStatus'],
  },
  'verification/documents': {
    read: [HIRER, ADMIN],
    create: [HIRER, ADMIN],
    update: ADMIN_ONLY,
    delete: ADMIN_ONLY,
    createFields: ['companyId', 'verificationCaseId', 'key', 'label', 'fileName'],
    updateFields: ['label', 'fileName'],
    adminUpdateFields: ['status'],
  },
};

/** Roles allowed for a policy action, or the AUTHENTICATED sentinel. */
export const allowedRoles = (policy, action) => {
  const spec = policy?.[action];
  if (!spec) return AUTHENTICATED;
  return spec;
};

export const isAllowed = (policy, action, role) => {
  const spec = allowedRoles(policy, action);
  if (spec === AUTHENTICATED) return true;
  return Array.isArray(spec) && spec.includes(role);
};

/**
 * Reduce a request body to an explicit allowlist (SEC-007).
 * Unknown keys are dropped rather than rejected so existing clients keep working.
 */
export const pickFields = (body, fields) => {
  const out = {};
  if (!body || typeof body !== 'object') return out;
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) out[field] = body[field];
  }
  return out;
};

/**
 * Build the writable payload for an update, adding admin-only fields only when
 * the caller actually holds the admin role.
 */
export const buildUpdatePayload = (policy, body, role) => {
  const fields = [...(policy?.updateFields || [])];
  if (role === ADMIN && Array.isArray(policy?.adminUpdateFields)) {
    fields.push(...policy.adminUpdateFields);
  }
  return pickFields(body, fields);
};

export const buildCreatePayload = (policy, body) => pickFields(body, policy?.createFields || []);
