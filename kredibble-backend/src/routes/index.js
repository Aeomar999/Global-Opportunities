import { Router } from 'express';
import mongoose from 'mongoose';
import { authRouter } from './auth.js';
import { uploadRouter } from './upload.js';
import { assistantRouter } from './assistant.js';
import { newsRouter } from './news.js';
import { ApiError, asyncHandler, itemResponse, listResponse, notFound } from '../utils/http.js';
import { User, StaffMember } from '../models/User.js';
import { SeekerProfile, HirerAccount, Candidate } from '../models/Profiles.js';
import {
  Opportunity, Applicant, Event, Grant,
  GrantApplication, CompanyVerification, VerificationDoc, EventAttendee, opportunityTypes
} from '../models/Platform.js';
import { Channel, ChannelPost, CommunityMembership, Report } from '../models/Community.js';
import { Article, Notification } from '../models/Content.js';
import { optionalAuth, requireAuth, requireRole } from '../middleware/auth.js';
import { Ambassador, OpportunityEngagement, Testimonial } from '../models/AdminPortal.js';
import { adminRouter } from './admin.js';

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
  return {
    id: value.id || value._id?.toString(),
    ...value,
    _id: undefined,
    __v: undefined,
  };
};

const escapedRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pageOptions = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 25));
  return { skip: (page - 1) * limit, limit };
};

const collectionRoutes = ({
  Model,
  resourceName,
  normalizeIn,
  normalizeOut,
  searchFields = [],
  middleware = [],
  readMiddleware = middleware,
  writeMiddleware = middleware,
  readFilter = () => ({}),
  prepareWrite,
  authorizeWrite = () => {},
}) => {
  const router = Router();

  router.get(
    '/',
    ...readMiddleware,
    asyncHandler(async (req, res) => {
      const { status, type, q } = req.query;
      const filter = { ...readFilter(req) };

      if (status) {
        const statusField = resourceName === 'Company verification'
          ? 'overallStatus'
          : resourceName === 'Opportunity'
            ? 'moderationStatus'
            : 'status';
        if (filter[statusField] === undefined) filter[statusField] = status;
      }

      if (type && resourceName === 'Opportunity') filter.type = type;

      if (q) {
        const query = escapedRegex(q);
        filter.$or = searchFields.map((field) => ({ [field]: { $regex: query, $options: 'i' } }));
      }

      const { skip, limit } = pageOptions(req.query);
      const data = await Model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
      listResponse(res, normalizeOut ? data.map(normalizeOut) : data.map(toClientObject));
    }),
  );

  router.get(
    '/:id',
    ...readMiddleware,
    asyncHandler(async (req, res) => {
      if (!mongoose.isValidObjectId(req.params.id)) throw notFound(resourceName);
      const item = await Model.findOne({ _id: req.params.id, ...readFilter(req) });
      if (!item) throw notFound(resourceName);
      itemResponse(res, normalizeOut ? normalizeOut(item) : toClientObject(item));
    }),
  );

  router.post(
    '/',
    ...writeMiddleware,
    asyncHandler(async (req, res) => {
      await authorizeWrite(null, req);
      const source = prepareWrite ? await prepareWrite(req.body, null, req) : req.body;
      const data = normalizeIn ? normalizeIn(source) : source;
      const item = new Model(data);
      await item.save();
      res.status(201).json({ data: normalizeOut ? normalizeOut(item) : toClientObject(item) });
    }),
  );

  router.patch(
    '/:id',
    ...writeMiddleware,
    asyncHandler(async (req, res) => {
      if (!mongoose.isValidObjectId(req.params.id)) throw notFound(resourceName);
      const current = await Model.findById(req.params.id);
      if (!current) throw notFound(resourceName);
      await authorizeWrite(current, req);
      const source = prepareWrite ? await prepareWrite(req.body, current, req) : req.body;
      const data = normalizeIn ? normalizeIn(source) : source;
      const item = await Model.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
      if (!item) throw notFound(resourceName);
      itemResponse(res, normalizeOut ? normalizeOut(item) : toClientObject(item));
    }),
  );

  router.delete(
    '/:id',
    ...writeMiddleware,
    asyncHandler(async (req, res) => {
      if (!mongoose.isValidObjectId(req.params.id)) throw notFound(resourceName);
      const current = await Model.findById(req.params.id);
      if (!current) throw notFound(resourceName);
      await authorizeWrite(current, req);
      await current.deleteOne();
      res.status(204).send();
    }),
  );

  return router;
};

const prepareStandardOpportunityWrite = (data, current, req) => {
  const next = { ...data };
  if (next.vetted === true || ['published', 'approved'].includes(next.moderationStatus)) {
    throw new ApiError(403, 'Only the admin opportunity API can vet or publish an opportunity');
  }
  delete next.vetted;
  delete next.vettedBy;
  delete next.vettedAt;
  delete next.wordpressSync;
  delete next.createdBy;
  delete next.hirerId;
  if (!current) next.createdBy = req.auth.sub;
  return next;
};

const publicOpportunityFilter = () => ({ vetted: true, moderationStatus: { $in: ['published', 'approved'] } });
const publicOpportunity = (opportunity) => {
  const { createdBy, hirerId, vetted, vettedBy, vettedAt, wordpressSync, assignedWriterId, ...safe } = withParsedOpportunity(opportunity);
  return safe;
};
const opportunityWriteAccess = (current, req) => {
  if (req.auth.role === 'admin') return;
  if (req.auth.role !== 'hirer') throw new ApiError(403, 'Only hirers can manage opportunity listings');
  if (current && String(current.createdBy) !== String(req.auth.sub)) {
    throw new ApiError(403, 'You can only manage your own opportunity listings');
  }
};

const adminOnly = [requireAuth, requireRole('admin')];
const publicTestimonial = (testimonial) => {
  const { email, ...safe } = toClientObject(testimonial);
  return safe;
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

apiRouter.get('/dashboard/summary', ...adminOnly, asyncHandler(async (req, res) => {
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
apiRouter.use('/assistant', assistantRouter);
apiRouter.use('/news', newsRouter);
apiRouter.use('/admin', adminRouter);

apiRouter.get('/me/profile', requireAuth, asyncHandler(async (req, res) => {
  const Model = req.auth.role === 'seeker' ? SeekerProfile : req.auth.role === 'hirer' ? HirerAccount : null;
  if (!Model) throw new ApiError(404, 'Profile not found');
  const profile = await Model.findOne({ userId: req.auth.sub });
  if (!profile) throw notFound('Profile');
  itemResponse(res, req.auth.role === 'seeker' ? withParsedProfile(profile) : toClientObject(profile));
}));

apiRouter.patch('/me/profile', requireAuth, asyncHandler(async (req, res) => {
  const isSeeker = req.auth.role === 'seeker';
  const Model = isSeeker ? SeekerProfile : req.auth.role === 'hirer' ? HirerAccount : null;
  if (!Model) throw new ApiError(403, 'Only seeker and hirer accounts have editable profiles');
  const allowedFields = isSeeker
    ? ['profession', 'university', 'country', 'city', 'phone', 'bio', 'professionalSummary', 'experienceLevel', 'technicalSkills', 'softSkills', 'tools', 'certifications']
    : ['companyName', 'tagline', 'logo', 'bannerImage', 'industry', 'companySize', 'location', 'website', 'companyEmail', 'description', 'recruiterName', 'recruiterRole', 'recruiterEmail', 'recruiterPhone', 'recruiterLinkedin', 'publicCompanyProfile'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowedFields.includes(key)));
  const normalized = isSeeker ? stringifyArrayFields(updates, ['technicalSkills', 'softSkills', 'tools', 'certifications']) : updates;
  const profile = await Model.findOneAndUpdate({ userId: req.auth.sub }, normalized, { new: true, runValidators: true });
  if (!profile) throw notFound('Profile');
  itemResponse(res, isSeeker ? withParsedProfile(profile) : toClientObject(profile));
}));

apiRouter.get('/candidates/search', requireAuth, requireRole('hirer', 'admin'), asyncHandler(async (req, res) => {
  const { skills, university, country, q } = req.query;
  const filter = {};
  if (q) filter.$or = [{ name: { $regex: escapedRegex(q), $options: 'i' } }, { profession: { $regex: escapedRegex(q), $options: 'i' } }];
  if (country) filter.location = { $regex: escapedRegex(country), $options: 'i' };
  if (university) filter.university = { $regex: escapedRegex(university), $options: 'i' };
  if (skills) {
    const skillsArray = String(skills).split(',').map((skill) => escapedRegex(skill.trim())).filter(Boolean).slice(0, 10);
    if (skillsArray.length) filter.skills = { $regex: skillsArray.join('|'), $options: 'i' };
  }
  const { skip, limit } = pageOptions(req.query);
  const data = await Candidate.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
  listResponse(res, data.map(withParsedCandidate));
}));

apiRouter.get('/seekers/search', ...adminOnly, asyncHandler(async (req, res) => {
  const { skills, university, country, q } = req.query;
  const filter = {};
  if (q) filter.$or = [{ profession: { $regex: escapedRegex(q), $options: 'i' } }];
  if (country) filter.country = { $regex: escapedRegex(country), $options: 'i' };
  if (university) filter.university = { $regex: escapedRegex(university), $options: 'i' };
  if (skills) {
    const skillsArray = String(skills).split(',').map((skill) => escapedRegex(skill.trim())).filter(Boolean).slice(0, 10);
    if (skillsArray.length) filter.technicalSkills = { $regex: skillsArray.join('|'), $options: 'i' };
  }
  const { skip, limit } = pageOptions(req.query);
  const data = await SeekerProfile.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
  listResponse(res, data.map(withParsedProfile));
}));

// Resource Routes
apiRouter.use('/users', collectionRoutes({
  Model: User,
  resourceName: 'User',
  searchFields: ['name', 'email'],
  middleware: adminOnly,
}));
apiRouter.use('/staff', collectionRoutes({
  Model: StaffMember,
  resourceName: 'Staff',
  searchFields: ['name', 'email'],
  middleware: adminOnly,
}));
apiRouter.use('/seekers', collectionRoutes({
  Model: SeekerProfile,
  resourceName: 'Seeker',
  normalizeIn: (data) => stringifyArrayFields(data, ['technicalSkills', 'softSkills', 'tools', 'certifications']),
  normalizeOut: withParsedProfile,
  searchFields: ['profession', 'university', 'country'],
  middleware: adminOnly,
}));
apiRouter.use('/hirers', collectionRoutes({ Model: HirerAccount, resourceName: 'Hirer', searchFields: ['companyName', 'industry'], middleware: adminOnly }));
apiRouter.use('/opportunities', collectionRoutes({
  Model: Opportunity,
  resourceName: 'Opportunity',
  normalizeIn: (data) => stringifyArrayFields(data, ['experienceLevels']),
  normalizeOut: publicOpportunity,
  searchFields: ['title', 'company', 'location'],
  readFilter: publicOpportunityFilter,
  writeMiddleware: [requireAuth],
  prepareWrite: prepareStandardOpportunityWrite,
  authorizeWrite: opportunityWriteAccess,
}));

apiRouter.get('/opportunity-types', (req, res) => {
  itemResponse(res, opportunityTypes);
});
apiRouter.use('/candidates', collectionRoutes({
  Model: Candidate,
  resourceName: 'Candidate',
  normalizeIn: (data) => stringifyArrayFields(data, ['skills']),
  normalizeOut: withParsedCandidate,
  searchFields: ['name', 'profession'],
  middleware: adminOnly,
}));
apiRouter.use('/reports', collectionRoutes({ Model: Report, resourceName: 'Report', searchFields: ['reason', 'details'], middleware: adminOnly }));
apiRouter.use('/events', collectionRoutes({
  Model: Event,
  resourceName: 'Event',
  searchFields: ['title', 'location'],
  readFilter: () => ({ status: 'upcoming' }),
  writeMiddleware: adminOnly,
}));
apiRouter.use('/grants', collectionRoutes({
  Model: Grant,
  resourceName: 'Grant',
  searchFields: ['title', 'sector'],
  readFilter: () => ({ status: 'open' }),
  writeMiddleware: adminOnly,
}));
apiRouter.use('/articles', collectionRoutes({
  Model: Article,
  resourceName: 'Article',
  searchFields: ['title', 'category'],
  readFilter: () => ({ status: 'published' }),
  writeMiddleware: adminOnly,
}));
apiRouter.use('/notifications', collectionRoutes({ Model: Notification, resourceName: 'Notification', searchFields: ['title', 'message'], middleware: adminOnly }));
apiRouter.use('/verification/companies', collectionRoutes({ Model: CompanyVerification, resourceName: 'Company verification', searchFields: ['name', 'industry'], middleware: adminOnly }));

apiRouter.get('/testimonials', asyncHandler(async (req, res) => {
  const testimonials = await Testimonial.find({ status: 'approved' }).sort({ createdAt: -1 });
  listResponse(res, testimonials.map(publicTestimonial));
}));

apiRouter.post('/testimonials', requireAuth, asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const comment = String(req.body.comment || '').trim();
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !comment) throw new ApiError(400, 'name, a valid email, and comment are required');
  const testimonial = await Testimonial.create({ name, email, comment, photo: req.body.photo });
  res.status(201).json({ data: publicTestimonial(testimonial) });
}));

// Special nested routes
const toId = (value) => value?.toString();

const getChannelOrThrow = async (channelId) => {
  const channel = await Channel.findById(channelId);
  if (!channel) throw notFound('Channel');
  return channel;
};

const getCommunityUserOrThrow = async (userId) => {
  if (!mongoose.isValidObjectId(userId)) throw new ApiError(400, 'A valid userId is required');
  const user = await User.findById(userId);
  if (!user) throw notFound('User');
  return user;
};

const getMembership = (channelId, userId) =>
  userId ? CommunityMembership.findOne({ channelId, userId }) : null;

const isLegacyMember = (channel, userId) =>
  (channel.memberIds || []).some((memberId) => toId(memberId) === userId);

const canAccessChannel = async (channel, user) => {
  if (channel.visibility === 'public' || user?.role === 'admin' || toId(channel.createdBy) === user?.sub) return true;
  const membership = await getMembership(channel._id, user?.sub);
  return membership?.status === 'active' || isLegacyMember(channel, user?.sub);
};

const canManageChannel = async (channel, user) => {
  if (user?.role === 'admin' || toId(channel.createdBy) === user?.sub) return true;
  const membership = await getMembership(channel._id, user?.sub);
  return membership?.status === 'active' && membership.role === 'admin';
};

const requireChannelAdmin = async (channel, user) => {
  if (!await canManageChannel(channel, user)) throw new ApiError(403, 'Only a community admin can manage this group');
};

const submitJoinRequest = async (channel, userId, body = {}) => {
  let membership = await getMembership(channel._id, userId);
  if (membership?.status === 'banned') throw new ApiError(403, 'This user is banned from this community');
  if (membership?.status === 'active') return { membership, accepted: true };
  if (!membership && isLegacyMember(channel, userId)) {
    membership = await CommunityMembership.create({ channelId: channel._id, userId, status: 'active' });
    return { membership, accepted: true };
  }
  const status = channel.visibility === 'private' || channel.requiresApproval ? 'pending' : 'active';
  if (!membership) membership = new CommunityMembership({ channelId: channel._id, userId });
  membership.status = status;
  membership.application = {
    message: String(body.message || '').trim(),
    answers: body.answers && typeof body.answers === 'object' ? body.answers : {},
  };
  membership.reviewedBy = null;
  membership.reviewedAt = null;
  membership.bannedReason = undefined;
  await membership.save();
  return { membership, accepted: status === 'active' };
};

apiRouter.get('/community/channels', optionalAuth, asyncHandler(async (req, res) => {
  const membershipChannelIds = req.auth
    ? await CommunityMembership.find({ userId: req.auth.sub, status: 'active' }).distinct('channelId')
    : [];
  const filter = req.auth
    ? { $or: [{ visibility: 'public' }, { createdBy: req.auth.sub }, { memberIds: req.auth.sub }, { _id: { $in: membershipChannelIds } }] }
    : { visibility: 'public' };
  if (req.query.visibility) filter.$and = [{ visibility: req.query.visibility }];
  if (req.query.q) {
    filter.$and = [...(filter.$and || []), {
      $or: ['name', 'category'].map((field) => ({ [field]: { $regex: escapedRegex(req.query.q), $options: 'i' } })),
    }];
  }
  const { skip, limit } = pageOptions(req.query);
  const channels = await Channel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
  listResponse(res, channels.map(toClientObject));
}));

apiRouter.post('/community/channels', requireAuth, asyncHandler(async (req, res) => {
  const { visibility = 'public', bio, avatar } = req.body;
  const name = String(req.body.name || '').trim();
  const category = String(req.body.category || '').trim();
  if (!name || !category) throw new ApiError(400, 'name and category are required');
  if (!['public', 'private'].includes(visibility)) throw new ApiError(400, 'visibility must be public or private');
  const channel = await Channel.create({
    name,
    category,
    visibility,
    bio,
    avatar,
    createdBy: req.auth.sub,
    requiresApproval: typeof req.body.requiresApproval === 'boolean' ? req.body.requiresApproval : visibility === 'private',
  });
  await CommunityMembership.create({ channelId: channel._id, userId: req.auth.sub, role: 'admin', status: 'active' });
  res.status(201).json({ data: toClientObject(channel) });
}));

apiRouter.get('/community/channels/:channelId', optionalAuth, asyncHandler(async (req, res) => {
  const channel = await getChannelOrThrow(req.params.channelId);
  if (!await canAccessChannel(channel, req.auth)) throw new ApiError(403, 'You do not have access to this private group');
  itemResponse(res, toClientObject(channel));
}));

apiRouter.patch('/community/channels/:channelId', requireAuth, asyncHandler(async (req, res) => {
  const channel = await getChannelOrThrow(req.params.channelId);
  await requireChannelAdmin(channel, req.auth);
  const allowedFields = ['name', 'category', 'bio', 'avatar', 'visibility', 'status', 'requiresApproval'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowedFields.includes(key)));
  if (updates.visibility && !['public', 'private'].includes(updates.visibility)) throw new ApiError(400, 'visibility must be public or private');
  Object.assign(channel, updates);
  await channel.save();
  itemResponse(res, toClientObject(channel));
}));

apiRouter.post('/community/channels/:channelId/join-requests', requireAuth, asyncHandler(async (req, res) => {
  const channel = await getChannelOrThrow(req.params.channelId);
  const result = await submitJoinRequest(channel, req.auth.sub, req.body);
  res.status(result.accepted ? 201 : 202).json({ data: { membership: toClientObject(result.membership), accepted: result.accepted } });
}));

apiRouter.get('/community/channels/:channelId/join-requests', requireAuth, asyncHandler(async (req, res) => {
  const channel = await getChannelOrThrow(req.params.channelId);
  await requireChannelAdmin(channel, req.auth);
  const status = req.query.status || 'pending';
  const memberships = await CommunityMembership.find({ channelId: channel._id, status }).populate('userId', 'name email avatarUrl');
  listResponse(res, memberships.map(toClientObject));
}));

apiRouter.post('/community/channels/:channelId/members', requireAuth, asyncHandler(async (req, res) => {
  const channel = await getChannelOrThrow(req.params.channelId);
  await requireChannelAdmin(channel, req.auth);
  const userId = String(req.body.userId || '');
  await getCommunityUserOrThrow(userId);
  if (toId(channel.createdBy) === userId && req.body.role !== 'admin') throw new ApiError(400, 'The group creator must remain an admin');
  const membership = await CommunityMembership.findOneAndUpdate(
    { channelId: channel._id, userId },
    { $set: { status: 'active', role: req.body.role === 'admin' ? 'admin' : 'member', reviewedBy: req.auth.sub, reviewedAt: new Date(), bannedReason: undefined } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  itemResponse(res, toClientObject(membership));
}));

apiRouter.post('/community/channels/:channelId/members/:userId/accept', requireAuth, asyncHandler(async (req, res) => {
  const channel = await getChannelOrThrow(req.params.channelId);
  await requireChannelAdmin(channel, req.auth);
  const membership = await CommunityMembership.findOne({ channelId: channel._id, userId: req.params.userId });
  if (!membership || membership.status !== 'pending') throw new ApiError(404, 'Pending join request not found');
  membership.status = 'active';
  membership.role = req.body.role === 'admin' ? 'admin' : 'member';
  membership.reviewedBy = req.auth.sub;
  membership.reviewedAt = new Date();
  await membership.save();
  itemResponse(res, toClientObject(membership));
}));

apiRouter.delete('/community/channels/:channelId/members/:userId', requireAuth, asyncHandler(async (req, res) => {
  const channel = await getChannelOrThrow(req.params.channelId);
  await requireChannelAdmin(channel, req.auth);
  if (toId(channel.createdBy) === req.params.userId) throw new ApiError(400, 'The group creator cannot be removed');
  const membership = await CommunityMembership.findOneAndUpdate(
    { channelId: channel._id, userId: req.params.userId },
    { $set: { status: 'removed', reviewedBy: req.auth.sub, reviewedAt: new Date() } },
    { new: true },
  );
  if (!membership) throw notFound('Community member');
  itemResponse(res, toClientObject(membership));
}));

apiRouter.post('/community/channels/:channelId/members/:userId/ban', requireAuth, asyncHandler(async (req, res) => {
  const channel = await getChannelOrThrow(req.params.channelId);
  await requireChannelAdmin(channel, req.auth);
  if (toId(channel.createdBy) === req.params.userId) throw new ApiError(400, 'The group creator cannot be banned');
  await getCommunityUserOrThrow(req.params.userId);
  const membership = await CommunityMembership.findOneAndUpdate(
    { channelId: channel._id, userId: req.params.userId },
    { $set: { status: 'banned', reviewedBy: req.auth.sub, reviewedAt: new Date(), bannedReason: String(req.body.reason || '').trim() || undefined } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  itemResponse(res, toClientObject(membership));
}));

apiRouter.post('/community/channels/:channelId/members/:userId/unban', requireAuth, asyncHandler(async (req, res) => {
  const channel = await getChannelOrThrow(req.params.channelId);
  await requireChannelAdmin(channel, req.auth);
  const membership = await CommunityMembership.findOneAndUpdate(
    { channelId: channel._id, userId: req.params.userId, status: 'banned' },
    { $set: { status: 'removed', reviewedBy: req.auth.sub, reviewedAt: new Date(), bannedReason: undefined } },
    { new: true },
  );
  if (!membership) throw new ApiError(404, 'Banned community member not found');
  itemResponse(res, toClientObject(membership));
}));

apiRouter.post('/opportunities/:opportunityId/applicants', requireAuth, asyncHandler(async (req, res) => {
    if (req.auth.role !== 'seeker') throw new ApiError(403, 'Only seeker accounts can submit an application');
    const opportunity = await Opportunity.findOne({ _id: req.params.opportunityId, ...publicOpportunityFilter() });
    if (!opportunity) throw notFound('Opportunity');
    const seeker = await SeekerProfile.findOne({ userId: req.auth.sub });
    const user = await User.findById(req.auth.sub);
    if (!seeker || !user) throw new ApiError(403, 'A seeker profile is required to submit an application');
    const referralCode = String(req.body.referralCode || '').trim().toUpperCase();
    const ambassador = referralCode && opportunity.referralCodeOnApply
      ? await Ambassador.findOne({ referralCode })
      : null;
    if (referralCode && opportunity.referralCodeOnApply && !ambassador) {
      throw new ApiError(400, 'Invalid referral code');
    }
    const applicant = new Applicant({
      ...stringifyArrayFields(req.body, ['skills']),
      opportunityId: req.params.opportunityId,
      seekerId: seeker._id,
      name: user.name,
      referralCode: ambassador ? referralCode : undefined,
      ambassadorId: ambassador?._id,
    });
    await applicant.save();
    await Opportunity.findByIdAndUpdate(req.params.opportunityId, { $inc: { applicantsCount: 1 } });
    await OpportunityEngagement.create({ opportunityId: req.params.opportunityId, event: 'application', source: 'app', userId: req.auth.sub, ambassadorId: ambassador?._id, referralCode: ambassador ? referralCode : undefined });
    res.status(201).json({ data: toClientObject(applicant) });
}));

apiRouter.get('/opportunities/:opportunityId/applicants', ...adminOnly, asyncHandler(async (req, res) => {
    const applicants = await Applicant.find({ opportunityId: req.params.opportunityId }).sort({ createdAt: -1 });
    listResponse(res, applicants.map(toClientObject));
}));

apiRouter.post('/opportunities/:opportunityId/views', optionalAuth, asyncHandler(async (req, res) => {
  const opportunity = await Opportunity.findById(req.params.opportunityId);
  if (!opportunity) throw notFound('Opportunity');
  const source = req.body.source === 'website' ? 'website' : 'app';
  const referralCode = String(req.body.referralCode || '').trim().toUpperCase();
  const ambassador = referralCode ? await Ambassador.findOne({ referralCode }) : null;
  if (referralCode && !ambassador) throw new ApiError(400, 'Invalid referral code');
  await OpportunityEngagement.create({
    opportunityId: opportunity._id,
    event: 'view',
    source,
    userId: req.auth?.sub,
    ambassadorId: ambassador?._id,
    referralCode: ambassador ? referralCode : undefined,
    visitorId: String(req.body.visitorId || '').trim() || undefined,
  });
  res.status(202).json({ data: { recorded: true } });
}));

apiRouter.post('/community/channels/:channelId/posts', requireAuth, asyncHandler(async (req, res) => {
    const channel = await getChannelOrThrow(req.params.channelId);
    if (!await canAccessChannel(channel, req.auth)) throw new ApiError(403, 'You do not have access to this private group');
    const author = await User.findById(req.auth.sub);
    const post = new ChannelPost({
      ...Object.fromEntries(Object.entries(req.body).filter(([key]) => ['body', 'title', 'bannerImage', 'link', 'linkText', 'hasRespondButton', 'reactions'].includes(key))),
      channelId: req.params.channelId,
      authorId: req.auth.sub,
      authorName: author?.name || req.body.authorName || 'Community member',
    });
    await post.save();
    await Channel.findByIdAndUpdate(req.params.channelId, { $inc: { postsCount: 1 } });
    
    try {
      const { getIO } = await import('../socket.js');
      const io = getIO();
      io.to(`channel_${req.params.channelId}`).emit('receive_message', toClientObject(post.toObject()));
    } catch (err) {
      console.warn('Socket not initialized or failed to broadcast:', err.message);
    }
    
    res.status(201).json({ data: post });
}));

apiRouter.get('/community/channels/:channelId/posts', optionalAuth, asyncHandler(async (req, res) => {
    const channel = await getChannelOrThrow(req.params.channelId);
    if (!await canAccessChannel(channel, req.auth)) throw new ApiError(403, 'You do not have access to this private group');
    const { skip, limit } = pageOptions(req.query);
    const posts = await ChannelPost.find({ channelId: req.params.channelId }).sort({ pinnedAt: -1, createdAt: -1 }).skip(skip).limit(limit);
    listResponse(res, posts.map(toClientObject));
}));

apiRouter.put('/community/channels/:channelId/posts/:postId/pin', requireAuth, asyncHandler(async (req, res) => {
  const channel = await getChannelOrThrow(req.params.channelId);
  await requireChannelAdmin(channel, req.auth);
  const post = await ChannelPost.findOne({ _id: req.params.postId, channelId: channel._id });
  if (!post) throw notFound('Channel post');
  if (channel.pinnedPostId && toId(channel.pinnedPostId) !== toId(post._id)) {
    await ChannelPost.findByIdAndUpdate(channel.pinnedPostId, { pinnedAt: null, pinnedBy: null });
  }
  post.pinnedAt = new Date();
  post.pinnedBy = req.auth.sub;
  channel.pinnedPostId = post._id;
  await Promise.all([post.save(), channel.save()]);
  itemResponse(res, { channel: toClientObject(channel), post: toClientObject(post) });
}));

apiRouter.delete('/community/channels/:channelId/posts/:postId/pin', requireAuth, asyncHandler(async (req, res) => {
  const channel = await getChannelOrThrow(req.params.channelId);
  await requireChannelAdmin(channel, req.auth);
  if (toId(channel.pinnedPostId) !== req.params.postId) throw new ApiError(400, 'This message is not pinned');
  const post = await ChannelPost.findOne({ _id: req.params.postId, channelId: channel._id });
  if (!post) throw notFound('Channel post');
  channel.pinnedPostId = null;
  post.pinnedAt = null;
  post.pinnedBy = null;
  await Promise.all([post.save(), channel.save()]);
  itemResponse(res, { channel: toClientObject(channel), post: toClientObject(post) });
}));

apiRouter.post('/grants/:grantId/applications', requireAuth, asyncHandler(async (req, res) => {
    const grant = await Grant.findOne({ _id: req.params.grantId, status: 'open' });
    if (!grant) throw notFound('Grant');
    const user = await User.findById(req.auth.sub);
    const application = new GrantApplication({
      applicantName: user?.name,
      requestedAmount: req.body.requestedAmount,
      grantId: req.params.grantId,
    });
    await application.save();
    res.status(201).json({ data: application });
}));

apiRouter.post('/events/:eventId/attendees', requireAuth, asyncHandler(async (req, res) => {
    const user = await User.findById(req.auth.sub);
    if (!user) throw new ApiError(401, 'User not found');
    const event = await Event.findOneAndUpdate(
      { _id: req.params.eventId, status: 'upcoming', $expr: { $lt: ['$attendeesCount', '$capacity'] } },
      { $inc: { attendeesCount: 1 } },
      { new: true },
    );
    if (!event) throw new ApiError(409, 'This event is unavailable or already at capacity');
    const attendee = new EventAttendee({
      fullName: user.name,
      email: user.email,
      quantity: 1,
      eventId: req.params.eventId,
    });
    try {
      await attendee.save();
    } catch (error) {
      await Event.findByIdAndUpdate(event._id, { $inc: { attendeesCount: -1 } });
      throw error;
    }
    res.status(201).json({ data: toClientObject(attendee) });
}));

apiRouter.get('/events/:eventId/attendees', ...adminOnly, asyncHandler(async (req, res) => {
    const attendees = await EventAttendee.find({ eventId: req.params.eventId }).sort({ createdAt: -1 });
    listResponse(res, attendees.map(toClientObject));
}));

apiRouter.get('/grants/:grantId/applications', ...adminOnly, asyncHandler(async (req, res) => {
    const applications = await GrantApplication.find({ grantId: req.params.grantId }).sort({ createdAt: -1 });
    listResponse(res, applications.map(toClientObject));
}));

apiRouter.post('/verification/companies/:id/documents', ...adminOnly, asyncHandler(async (req, res) => {
    const doc = new VerificationDoc({
      ...req.body,
      companyId: req.params.id,
    });
    await doc.save();
    res.status(201).json({ data: doc });
}));

apiRouter.get('/verification/companies/:id/documents', ...adminOnly, asyncHandler(async (req, res) => {
    const docs = await VerificationDoc.find({ companyId: req.params.id }).sort({ createdAt: -1 });
    listResponse(res, docs.map(toClientObject));
}));

// Provide basic CRUD for these nested resources so they can be read, updated, or deleted directly by ID
apiRouter.use('/applicants', collectionRoutes({ Model: Applicant, resourceName: 'Applicant', middleware: adminOnly }));
apiRouter.use('/grant-applications', collectionRoutes({ Model: GrantApplication, resourceName: 'GrantApplication', middleware: adminOnly }));
apiRouter.use('/verification/documents', collectionRoutes({ Model: VerificationDoc, resourceName: 'VerificationDoc', middleware: adminOnly }));

apiRouter.post('/users/:userId/saved', requireAuth, asyncHandler(async (req, res) => {
  if (String(req.auth.sub) !== req.params.userId) throw new ApiError(403, 'You can only manage your own saved items');
  const { SavedItem } = await import('../models/User.js');
  const { itemId, itemType } = req.body;
  if (!mongoose.isValidObjectId(itemId) || !['opportunities', 'events', 'grants', 'internships'].includes(itemType)) {
    throw new ApiError(400, 'A valid itemId and itemType are required');
  }
  const existing = await SavedItem.findOne({ userId: req.params.userId, itemId, itemType });
  if (existing) {
    await SavedItem.findByIdAndDelete(existing._id);
    res.json({ action: 'removed' });
  } else {
    const newItem = new SavedItem({ userId: req.params.userId, itemId, itemType });
    await newItem.save();
    res.status(201).json({ action: 'added', data: newItem });
  }
}));

apiRouter.get('/users/:userId/saved', requireAuth, asyncHandler(async (req, res) => {
  if (String(req.auth.sub) !== req.params.userId) throw new ApiError(403, 'You can only view your own saved items');
  const { SavedItem } = await import('../models/User.js');
  const savedItems = await SavedItem.find({ userId: req.params.userId }).sort({ createdAt: -1 });
  listResponse(res, savedItems.map(toClientObject));
}));

