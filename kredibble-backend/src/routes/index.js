import { Router } from 'express';
import mongoose from 'mongoose';
import { authRouter } from './auth.js';
import { uploadRouter } from './upload.js';
import { asyncHandler, itemResponse, listResponse, notFound, stripSensitive, ApiError, parsePagination, paginatedResponse } from '../utils/http.js';
import { requireAuth, requireAdminAuth, requireRole } from '../middleware/auth.js';
import {
  RESOURCE_POLICIES,
  ADMIN,
  isAllowed,
  buildCreatePayload,
  buildUpdatePayload,
} from '../lib/policies.js';
import { User, StaffMember } from '../models/User.js';
import { SeekerProfile, HirerAccount, Candidate } from '../models/Profiles.js';
import {
  Opportunity, Applicant, Event, Grant,
  GrantApplication, CompanyVerification, VerificationDoc, EventAttendee
} from '../models/Platform.js';
import { Channel, ChannelPost, Report } from '../models/Community.js';
import { Article, Notification } from '../models/Content.js';


export const apiRouter = Router();

const parseJson = (value, fallback = []) => {
  if (!value) return fallback;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
};

const stringifyArrayFields = (data, fields) => {
  const next = { ...data };
  for (const field of fields) {
    if (Array.isArray(next[field])) next[field] = JSON.stringify(next[field]);
  }
  return next;
};

const withParsedProfile = (profile) =>
  profile && {
    ...toClientObject(profile),
    technicalSkills: parseJson(profile.technicalSkills),
    softSkills: parseJson(profile.softSkills),
    tools: parseJson(profile.tools),
    certifications: parseJson(profile.certifications),
  };

const withParsedOpportunity = (opportunity) =>
  opportunity && {
    ...toClientObject(opportunity),
    experienceLevels: parseJson(opportunity.experienceLevels),
  };

const withParsedCandidate = (candidate) =>
  candidate && {
    ...toClientObject(candidate),
    skills: parseJson(candidate.skills),
  };

const toClientObject = (document) => {
  if (!document) return null;
  const value = document.toJSON ? document.toJSON() : document;
  // `stripSensitive` runs last so no caller can bypass the redaction (SEC-011/012).
  return stripSensitive({
    id: value.id || value._id?.toString(),
    ...value,
    _id: undefined,
    __v: undefined,
  });
};


/**
 * Throws 403 when the caller's role is not permitted for `action`.
 * `AUTHENTICATED` (any valid token) short-circuits to allowed.
 */
const assertPolicy = (policy, action, req, label = 'resource') => {
  if (!isAllowed(policy, action, req.auth?.role)) {
    const actionLabel = { read: 'view', create: 'create', update: 'update', delete: 'delete' }[action] || action;
    throw new ApiError(403, `You do not have permission to ${actionLabel} this ${label}`);
  }
};

/**
 * Express middleware pair for hand-written routes: authenticate, then authorize
 * against the same policy table the CRUD factory uses. `requireAuth` is always
 * first so an anonymous caller receives 401 (not 403) and cannot probe which
 * resources exist.
 */
const guard = (policyKey, action, label = 'resource') => [
  requireAuth,
  (req, res, next) => {
    try {
      assertPolicy(RESOURCE_POLICIES[policyKey], action, req, label);
      next();
    } catch (error) {
      next(error);
    }
  },
];

/** Reduce a hand-written route's body to its policy allowlist (SEC-007). */
const writableBody = (policyKey, req) => buildCreatePayload(RESOURCE_POLICIES[policyKey], req.body);

/**
 * Escape regex metacharacters before interpolating user input into a $regex.
 * Without this, a query like `a{999999}` is both a regex-injection vector and a
 * catastrophic-backtracking (ReDoS) denial of service against the search routes.
 */
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Build a case-insensitive escaped regex, or undefined for blank input. */
const searchPattern = (value) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  return { $regex: escapeRegex(trimmed), $options: 'i' };
};

/** "a,b,c" -> escaped alternation. Returns undefined when the list is empty. */
const searchAlternation = (value) => {
  if (!value) return undefined;
  const terms = String(value)
    .split(',')
    .map((term) => escapeRegex(term.trim()))
    .filter(Boolean);
  return terms.length > 0 ? { $regex: terms.join('|'), $options: 'i' } : undefined;
};

/**
 * Enforce record-level ownership (SEC-002). A role policy answers "may this ROLE
 * write?"; it cannot answer "is this THEIR record?". Without this check any
 * authenticated user could PATCH or DELETE another user's seeker profile by id.
 *
 * Admins bypass ownership - they are the moderation surface. A document whose
 * owner field is missing fails closed rather than defaulting to allow.
 */
const assertOwnership = (document, ownerField, req, label) => {
  if (!ownerField) return;
  if (req.auth?.role === ADMIN) return;

  const owner = document?.[ownerField];
  if (!owner || String(owner) !== String(req.auth?.sub)) {
    throw new ApiError(403, `You do not have permission to modify this ${label}`);
  }
};

const collectionRoutes = ({
  Model,
  resourceName,
  policyKey,
  normalizeIn,
  normalizeOut,
  searchFields = [],
  ownerField = null,
}) => {
  const router = Router();
  const policy = RESOURCE_POLICIES[policyKey] || null;
  if (!policy) throw new Error(`Missing authorization policy for "${policyKey}"`);

  // SEC-002: nothing in a collection is readable without a valid token.
  router.use(requireAuth);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      assertPolicy(policy, 'read', req, resourceName);
      const { status, type, q } = req.query;
      const { page, limit, skip } = parsePagination(req.query);
      const filter = {};

      if (status) {
        if (resourceName === 'Company verification') filter.overallStatus = status;
        else if (resourceName === 'Opportunity') filter.moderationStatus = status;
        else filter.status = status;
      }

      if (type && resourceName === 'Opportunity') filter.type = type;

      if (q) {
        // Escaped: `?q=a{999999}` would otherwise be a ReDoS payload.
        const pattern = searchPattern(q);
        if (pattern) {
          filter.$or = searchFields.map((field) => ({ [field]: pattern }));
        }
      }

      const [data, total] = await Promise.all([
        Model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Model.countDocuments(filter),
      ]);
      listResponse(res, normalizeOut ? data.map(normalizeOut) : data.map(toClientObject), total, page, limit);
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      assertPolicy(policy, 'read', req, resourceName);
      const item = await Model.findById(req.params.id);
      if (!item) throw notFound(resourceName);
      itemResponse(res, normalizeOut ? normalizeOut(item) : toClientObject(item));
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      assertPolicy(policy, 'create', req, resourceName);
      // SEC-007: the body is reduced to an explicit allowlist before it reaches the model.
      const allowed = buildCreatePayload(policy, req.body);
      // SEC-002: the owner is derived from the token, never from the body. Otherwise
      // a caller could create a seeker/hirer profile belonging to another user, or
      // post an opportunity under someone else's company.
      if (ownerField && req.auth?.role !== ADMIN) {
        allowed[ownerField] = req.auth.sub;
      }
      const data = normalizeIn ? normalizeIn(allowed) : allowed;
      const item = new Model(data);
      await item.save();
      res.status(201).json({ data: normalizeOut ? normalizeOut(item) : toClientObject(item) });
    }),
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      assertPolicy(policy, 'update', req, resourceName);
      // Load first so ownership can be checked before anything is written.
      const existing = await Model.findById(req.params.id);
      if (!existing) throw notFound(resourceName);
      assertOwnership(existing, ownerField, req, resourceName);

      // SEC-007: unknown keys are dropped, admin-only keys only for admins.
      const allowed = buildUpdatePayload(policy, req.body, req.auth?.role);
      const data = normalizeIn ? normalizeIn(allowed) : allowed;
      const item = await Model.findByIdAndUpdate(
        req.params.id,
        data,
        { new: true, runValidators: true },
      );
      if (!item) throw notFound(resourceName);
      itemResponse(res, normalizeOut ? normalizeOut(item) : toClientObject(item));
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      assertPolicy(policy, 'delete', req, resourceName);
      const existing = await Model.findById(req.params.id);
      if (!existing) throw notFound(resourceName);
      assertOwnership(existing, ownerField, req, resourceName);
      await Model.findByIdAndDelete(req.params.id);
      res.status(204).send();
    }),
  );

  return router;
};


apiRouter.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const statusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const isHealthy = dbStatus === 1;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'error',
    service: 'kredibble-backend',
    database: {
      status: statusMap[dbStatus] || 'unknown',
      connected: isHealthy,
    },
    timestamp: new Date().toISOString(),
  });
});

// SEC-003: the summary exposes platform-wide counts (total users, open reports,
 // pending moderation queues), so it is admin-only. `requireAdminAuth` validates
 // the admin cookie or header and enforces role=admin + audience=kredibble-admin.
 apiRouter.get('/dashboard/summary', requireAdminAuth, asyncHandler(async (req, res) => {

  const [
    pendingVerifications,
    pendingOpportunities,
    activeSeekers,
    activeHirers,
    openReports,
    totalUsers,
    totalOpportunities,
  ] = await Promise.all([
    CompanyVerification.countDocuments({ overallStatus: 'pending' }),
    Opportunity.countDocuments({ moderationStatus: 'pending' }),
    SeekerProfile.countDocuments({ status: 'active' }),
    HirerAccount.countDocuments({ status: 'active' }),
    Report.countDocuments({ status: 'open' }),
    User.countDocuments(),
    Opportunity.countDocuments(),
  ]);

  itemResponse(res, {
    pendingVerifications,
    pendingOpportunities,
    activeSeekers,
    activeHirers,
    openReports,
    totalUsers,
    totalOpportunities,
  });
}));

apiRouter.use('/auth', authRouter);
apiRouter.use('/upload', uploadRouter);

// Resource Routes
// Search routes must be registered BEFORE the /seekers and /candidates collection
// mounts below. collectionRoutes defines a `/:id` handler, and "search" is a
// single path segment, so mounting the collection first would swallow
// /candidates/search and /seekers/search and turn them into a findById('search')
// CastError. Both are called by the mobile career screen.
apiRouter.get('/candidates/search', ...guard('candidates', 'read', 'candidate'), asyncHandler(async (req, res) => {
    const { skills, university, country, q } = req.query;
    const filter = {};

    const query = searchPattern(q);
    if (query) filter.$or = [{ name: query }, { profession: query }];
    const location = searchPattern(country);
    if (location) filter.location = location;
    const school = searchPattern(university);
    if (school) filter.university = school;
    const skillMatch = searchAlternation(skills);
    if (skillMatch) filter.skills = skillMatch;

    const data = await Candidate.find(filter).sort({ createdAt: -1 });
    listResponse(res, data.map(withParsedCandidate));
}));

apiRouter.get('/seekers/search', ...guard('seekers', 'read', 'seeker'), asyncHandler(async (req, res) => {
    const { skills, university, country, q } = req.query;
    const filter = {};

    const query = searchPattern(q);
    if (query) filter.profession = query;
    const origin = searchPattern(country);
    if (origin) filter.country = origin;
    const school = searchPattern(university);
    if (school) filter.university = school;
    const skillMatch = searchAlternation(skills);
    if (skillMatch) filter.technicalSkills = skillMatch;

    const data = await SeekerProfile.find(filter).sort({ createdAt: -1 });
    listResponse(res, data.map(withParsedProfile));
}));

apiRouter.use('/users', collectionRoutes({ Model: User, resourceName: 'User', policyKey: 'users', searchFields: ['name', 'email'] }));
apiRouter.use('/staff', collectionRoutes({ Model: StaffMember, resourceName: 'Staff', policyKey: 'staff', searchFields: ['name', 'email'] }));
apiRouter.use('/seekers', collectionRoutes({
  Model: SeekerProfile,
  resourceName: 'Seeker',
  policyKey: 'seekers',
  normalizeIn: (data) => stringifyArrayFields(data, ['technicalSkills', 'softSkills', 'tools', 'certifications']),
  normalizeOut: withParsedProfile,
  searchFields: ['profession', 'university', 'country'],
  ownerField: 'userId',
}));
apiRouter.use('/hirers', collectionRoutes({ Model: HirerAccount, resourceName: 'Hirer', policyKey: 'hirers', searchFields: ['companyName', 'industry'], ownerField: 'userId' }));
apiRouter.use('/opportunities', collectionRoutes({
  Model: Opportunity,
  resourceName: 'Opportunity',
  policyKey: 'opportunities',
  normalizeIn: (data) => stringifyArrayFields(data, ['experienceLevels']),
  normalizeOut: withParsedOpportunity,
  searchFields: ['title', 'company', 'location'],
  ownerField: 'hirerId',
}));
apiRouter.use('/candidates', collectionRoutes({
  Model: Candidate,
  resourceName: 'Candidate',
  policyKey: 'candidates',
  normalizeIn: (data) => stringifyArrayFields(data, ['skills']),
  normalizeOut: withParsedCandidate,
  searchFields: ['name', 'profession']
}));
apiRouter.use('/community/channels', collectionRoutes({ Model: Channel, resourceName: 'Channel', policyKey: 'community/channels', searchFields: ['name', 'category'] }));
apiRouter.use('/reports', collectionRoutes({ Model: Report, resourceName: 'Report', policyKey: 'reports', searchFields: ['reason', 'details'] }));
apiRouter.use('/events', collectionRoutes({ Model: Event, resourceName: 'Event', policyKey: 'events', searchFields: ['title', 'location'] }));
apiRouter.use('/grants', collectionRoutes({ Model: Grant, resourceName: 'Grant', policyKey: 'grants', searchFields: ['title', 'sector'] }));
apiRouter.use('/articles', collectionRoutes({ Model: Article, resourceName: 'Article', policyKey: 'articles', searchFields: ['title', 'category'] }));
apiRouter.use('/notifications', collectionRoutes({ Model: Notification, resourceName: 'Notification', policyKey: 'notifications', searchFields: ['title', 'message'] }));
apiRouter.use('/verification/companies', collectionRoutes({ Model: CompanyVerification, resourceName: 'Company verification', policyKey: 'verification/companies', searchFields: ['name', 'industry'], ownerField: 'hirerId' }));


// Special nested routes
apiRouter.post('/opportunities/:opportunityId/applicants', ...guard('applicants', 'create', 'applicant'), asyncHandler(async (req, res) => {
    const applicant = new Applicant(
      stringifyArrayFields(writableBody('applicants', req), ['skills']),
    );
    applicant.set('opportunityId', req.params.opportunityId);
    await applicant.save();
    await Opportunity.findByIdAndUpdate(req.params.opportunityId, { $inc: { applicantsCount: 1 } });
    res.status(201).json({ data: toClientObject(applicant) });
}));

apiRouter.get('/opportunities/:opportunityId/applicants', ...guard('applicants', 'read', 'applicant'), asyncHandler(async (req, res) => {
    const applicants = await Applicant.find({ opportunityId: req.params.opportunityId }).sort({ createdAt: -1 });
    listResponse(res, applicants.map(toClientObject));
}));

apiRouter.post('/community/channels/:channelId/posts', ...guard('community/posts', 'create', 'post'), asyncHandler(async (req, res) => {
    const post = new ChannelPost(writableBody('community/posts', req));
    post.set('channelId', req.params.channelId);
    await post.save();
    await Channel.findByIdAndUpdate(req.params.channelId, { $inc: { postsCount: 1 } });
    
    try {
      const { getIO } = await import('../socket.js');
      const io = getIO();
      io.to(`channel_${req.params.channelId}`).emit('receive_message', toClientObject(post.toObject()));
    } catch (err) {
      console.warn('Socket not initialized or failed to broadcast:', err.message);
    }
    
    res.status(201).json({ data: toClientObject(post) });
}));

apiRouter.get('/community/channels/:channelId/posts', ...guard('community/posts', 'read', 'post'), asyncHandler(async (req, res) => {
    const posts = await ChannelPost.find({ channelId: req.params.channelId }).sort({ createdAt: -1 });
    listResponse(res, posts.map(toClientObject));
}));

apiRouter.post('/grants/:grantId/applications', ...guard('grant-applications', 'create', 'grant application'), asyncHandler(async (req, res) => {
    const application = new GrantApplication(writableBody('grant-applications', req));
    application.set('grantId', req.params.grantId);
    await application.save();
    res.status(201).json({ data: toClientObject(application) });
}));

apiRouter.post('/events/:eventId/attendees', ...guard('event-attendees', 'create', 'booking'), asyncHandler(async (req, res) => {
    // Read quantity from the sanitized body, not req.body, and bound it. The raw
    // expression `Number(req.body.quantity) || 1` treats -5 and NaN-ish input as
    // truthy, so a caller could decrement attendeesCount or pass Infinity.
    const body = writableBody('event-attendees', req);
    const quantity = Math.min(Math.max(Number.parseInt(body.quantity, 10) || 1, 1), 10);

    const attendee = new EventAttendee({ ...body, quantity });
    attendee.set('eventId', req.params.eventId);
    await attendee.save();
    await Event.findByIdAndUpdate(req.params.eventId, { $inc: { attendeesCount: quantity } });
    res.status(201).json({ data: toClientObject(attendee) });
}));

apiRouter.get('/events/:eventId/attendees', ...guard('event-attendees', 'read', 'attendee'), asyncHandler(async (req, res) => {
    const attendees = await EventAttendee.find({ eventId: req.params.eventId }).sort({ createdAt: -1 });
    listResponse(res, attendees.map(toClientObject));
}));

apiRouter.get('/grants/:grantId/applications', ...guard('grant-applications', 'read', 'grant application'), asyncHandler(async (req, res) => {
    const applications = await GrantApplication.find({ grantId: req.params.grantId }).sort({ createdAt: -1 });
    listResponse(res, applications.map(toClientObject));
}));

apiRouter.post('/verification/companies/:id/documents', ...guard('verification/documents', 'create', 'document'), asyncHandler(async (req, res) => {
    const doc = new VerificationDoc(writableBody('verification/documents', req));
    doc.set('companyId', req.params.id);
    await doc.save();
    res.status(201).json({ data: toClientObject(doc) });
}));

apiRouter.get('/verification/companies/:id/documents', ...guard('verification/documents', 'read', 'document'), asyncHandler(async (req, res) => {
    const docs = await VerificationDoc.find({ companyId: req.params.id }).sort({ createdAt: -1 });
    listResponse(res, docs.map(toClientObject));
}));

// Provide basic CRUD for these nested resources so they can be read, updated, or deleted directly by ID

apiRouter.use('/applicants', collectionRoutes({ Model: Applicant, resourceName: 'Applicant', policyKey: 'applicants' }));
apiRouter.use('/grant-applications', collectionRoutes({ Model: GrantApplication, resourceName: 'GrantApplication', policyKey: 'grant-applications' }));
apiRouter.use('/verification/documents', collectionRoutes({ Model: VerificationDoc, resourceName: 'VerificationDoc', policyKey: 'verification/documents' }));
apiRouter.use('/community/posts', collectionRoutes({ Model: ChannelPost, resourceName: 'ChannelPost', policyKey: 'community/posts' }));


/**
 * Saved items are private to their owner. `userId` is a path param, so an IDOR
 * check is required on top of authentication: a caller may only touch their own
 * list unless they are an admin.
 */
const assertSelfOrAdmin = (req) => {
  if (req.auth?.role === ADMIN) return;
  if (String(req.auth?.sub) !== String(req.params.userId)) {
    throw new ApiError(403, 'You can only access your own saved items');
  }
};

const savedItemsGuard = [
  requireAuth,
  (req, res, next) => {
    try {
      assertSelfOrAdmin(req);
      next();
    } catch (error) {
      next(error);
    }
  },
];

apiRouter.post('/users/:userId/saved', savedItemsGuard, asyncHandler(async (req, res) => {
  const { SavedItem } = await import('../models/User.js');
  const { itemId, itemType } = req.body;
  if (!itemId || !['opportunities', 'events', 'grants', 'internships'].includes(itemType)) {
    throw new ApiError(400, 'A valid itemId and itemType are required');
  }
  const existing = await SavedItem.findOne({ userId: req.params.userId, itemId, itemType });
  if (existing) {
    await SavedItem.findByIdAndDelete(existing._id);
    res.json({ action: 'removed' });
  } else {
    const newItem = new SavedItem({ userId: req.params.userId, itemId, itemType });
    await newItem.save();
    res.status(201).json({ action: 'added', data: toClientObject(newItem) });
  }
}));

apiRouter.get('/users/:userId/saved', savedItemsGuard, asyncHandler(async (req, res) => {
  const { SavedItem } = await import('../models/User.js');
  const savedItems = await SavedItem.find({ userId: req.params.userId }).sort({ createdAt: -1 });
  listResponse(res, savedItems.map(toClientObject));
}));


