import { Router } from 'express';
import mongoose from 'mongoose';
import { authRouter } from './auth.js';
import { uploadRouter } from './upload.js';
import { assistantRouter } from './assistant.js';
import { newsRouter } from './news.js';
import { asyncHandler, itemResponse, listResponse, notFound } from '../utils/http.js';
import { User, StaffMember } from '../models/User.js';
import { SeekerProfile, HirerAccount, Candidate } from '../models/Profiles.js';
import {
  Opportunity, Applicant, Event, Grant,
  GrantApplication, CompanyVerification, VerificationDoc, EventAttendee, opportunityTypes
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
  return {
    id: value.id || value._id?.toString(),
    ...value,
    _id: undefined,
    __v: undefined,
  };
};

const collectionRoutes = ({ Model, resourceName, normalizeIn, normalizeOut, searchFields = [] }) => {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { status, type, q } = req.query;
      const filter = {};

      if (status) {
        if (resourceName === 'Company verification') filter.overallStatus = status;
        else if (resourceName === 'Opportunity') filter.moderationStatus = status;
        else filter.status = status;
      }

      if (type && resourceName === 'Opportunity') filter.type = type;

      if (q) {
        const query = String(q);
        filter.$or = searchFields.map((field) => ({ [field]: { $regex: query, $options: 'i' } }));
      }

      const data = await Model.find(filter).sort({ createdAt: -1 });
      listResponse(res, normalizeOut ? data.map(normalizeOut) : data.map(toClientObject));
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const item = await Model.findById(req.params.id);
      if (!item) throw notFound(resourceName);
      itemResponse(res, normalizeOut ? normalizeOut(item) : toClientObject(item));
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const data = normalizeIn ? normalizeIn(req.body) : req.body;
      const item = new Model(data);
      await item.save();
      res.status(201).json({ data: normalizeOut ? normalizeOut(item) : toClientObject(item) });
    }),
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const data = normalizeIn ? normalizeIn(req.body) : req.body;
      const item = await Model.findByIdAndUpdate(req.params.id, data, { new: true });
      if (!item) throw notFound(resourceName);
      itemResponse(res, normalizeOut ? normalizeOut(item) : toClientObject(item));
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
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

apiRouter.get('/dashboard/summary', asyncHandler(async (req, res) => {
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

// Resource Routes
apiRouter.use('/users', collectionRoutes({ Model: User, resourceName: 'User', searchFields: ['name', 'email'] }));
apiRouter.use('/staff', collectionRoutes({ Model: StaffMember, resourceName: 'Staff', searchFields: ['name', 'email'] }));
apiRouter.use('/seekers', collectionRoutes({
  Model: SeekerProfile,
  resourceName: 'Seeker',
  normalizeIn: (data) => stringifyArrayFields(data, ['technicalSkills', 'softSkills', 'tools', 'certifications']),
  normalizeOut: withParsedProfile,
  searchFields: ['profession', 'university', 'country']
}));
apiRouter.use('/hirers', collectionRoutes({ Model: HirerAccount, resourceName: 'Hirer', searchFields: ['companyName', 'industry'] }));
apiRouter.use('/opportunities', collectionRoutes({
  Model: Opportunity,
  resourceName: 'Opportunity',
  normalizeIn: (data) => stringifyArrayFields(data, ['experienceLevels']),
  normalizeOut: withParsedOpportunity,
  searchFields: ['title', 'company', 'location']
}));

apiRouter.get('/opportunity-types', (req, res) => {
  itemResponse(res, opportunityTypes);
});
apiRouter.use('/candidates', collectionRoutes({
  Model: Candidate,
  resourceName: 'Candidate',
  normalizeIn: (data) => stringifyArrayFields(data, ['skills']),
  normalizeOut: withParsedCandidate,
  searchFields: ['name', 'profession']
}));
apiRouter.use('/community/channels', collectionRoutes({ Model: Channel, resourceName: 'Channel', searchFields: ['name', 'category'] }));
apiRouter.use('/reports', collectionRoutes({ Model: Report, resourceName: 'Report', searchFields: ['reason', 'details'] }));
apiRouter.use('/events', collectionRoutes({ Model: Event, resourceName: 'Event', searchFields: ['title', 'location'] }));
apiRouter.use('/grants', collectionRoutes({ Model: Grant, resourceName: 'Grant', searchFields: ['title', 'sector'] }));
apiRouter.use('/articles', collectionRoutes({ Model: Article, resourceName: 'Article', searchFields: ['title', 'category'] }));
apiRouter.use('/notifications', collectionRoutes({ Model: Notification, resourceName: 'Notification', searchFields: ['title', 'message'] }));
apiRouter.use('/verification/companies', collectionRoutes({ Model: CompanyVerification, resourceName: 'Company verification', searchFields: ['name', 'industry'] }));

// Special nested routes
apiRouter.post('/opportunities/:opportunityId/applicants', asyncHandler(async (req, res) => {
    const applicant = new Applicant({
      ...stringifyArrayFields(req.body, ['skills']),
      opportunityId: req.params.opportunityId,
    });
    await applicant.save();
    await Opportunity.findByIdAndUpdate(req.params.opportunityId, { $inc: { applicantsCount: 1 } });
    res.status(201).json({ data: applicant });
}));

apiRouter.get('/opportunities/:opportunityId/applicants', asyncHandler(async (req, res) => {
    const applicants = await Applicant.find({ opportunityId: req.params.opportunityId }).sort({ createdAt: -1 });
    listResponse(res, applicants.map(toClientObject));
}));

apiRouter.post('/community/channels/:channelId/posts', asyncHandler(async (req, res) => {
    const post = new ChannelPost({
      ...req.body,
      channelId: req.params.channelId,
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

apiRouter.get('/community/channels/:channelId/posts', asyncHandler(async (req, res) => {
    const posts = await ChannelPost.find({ channelId: req.params.channelId }).sort({ createdAt: -1 });
    listResponse(res, posts.map(toClientObject));
}));

apiRouter.post('/grants/:grantId/applications', asyncHandler(async (req, res) => {
    const application = new GrantApplication({
      ...req.body,
      grantId: req.params.grantId,
    });
    await application.save();
    res.status(201).json({ data: application });
}));

apiRouter.post('/events/:eventId/attendees', asyncHandler(async (req, res) => {
    const attendee = new EventAttendee({
      ...req.body,
      eventId: req.params.eventId,
    });
    await attendee.save();
    // also increment the Event attendeesCount if you wish:
    await Event.findByIdAndUpdate(req.params.eventId, { $inc: { attendeesCount: req.body.quantity || 1 } });
    res.status(201).json({ data: attendee });
}));

apiRouter.get('/events/:eventId/attendees', asyncHandler(async (req, res) => {
    const attendees = await EventAttendee.find({ eventId: req.params.eventId }).sort({ createdAt: -1 });
    listResponse(res, attendees.map(toClientObject));
}));

apiRouter.get('/grants/:grantId/applications', asyncHandler(async (req, res) => {
    const applications = await GrantApplication.find({ grantId: req.params.grantId }).sort({ createdAt: -1 });
    listResponse(res, applications.map(toClientObject));
}));

apiRouter.post('/verification/companies/:id/documents', asyncHandler(async (req, res) => {
    const doc = new VerificationDoc({
      ...req.body,
      companyId: req.params.id,
    });
    await doc.save();
    res.status(201).json({ data: doc });
}));

apiRouter.get('/verification/companies/:id/documents', asyncHandler(async (req, res) => {
    const docs = await VerificationDoc.find({ companyId: req.params.id }).sort({ createdAt: -1 });
    listResponse(res, docs.map(toClientObject));
}));

apiRouter.get('/candidates/search', asyncHandler(async (req, res) => {
    const { skills, university, country, q } = req.query;
    const filter = {};
    
    if (q) filter.$or = [{ name: { $regex: q, $options: 'i' } }, { profession: { $regex: q, $options: 'i' } }];
    if (country) filter.location = { $regex: country, $options: 'i' };
    if (university) filter.university = { $regex: university, $options: 'i' };
    if (skills) {
      const skillsArray = skills.split(',').map(s => s.trim()).filter(Boolean);
      if (skillsArray.length > 0) {
        filter.skills = { $regex: skillsArray.join('|'), $options: 'i' };
      }
    }

    const data = await Candidate.find(filter).sort({ createdAt: -1 });
    listResponse(res, data.map(withParsedCandidate));
}));

apiRouter.get('/seekers/search', asyncHandler(async (req, res) => {
    const { skills, university, country, q } = req.query;
    const filter = {};
    
    if (q) filter.$or = [{ profession: { $regex: q, $options: 'i' } }];
    if (country) filter.country = { $regex: country, $options: 'i' };
    if (university) filter.university = { $regex: university, $options: 'i' };
    if (skills) {
      const skillsArray = skills.split(',').map(s => s.trim()).filter(Boolean);
      if (skillsArray.length > 0) {
        filter.technicalSkills = { $regex: skillsArray.join('|'), $options: 'i' };
      }
    }

    const data = await SeekerProfile.find(filter).sort({ createdAt: -1 });
    listResponse(res, data.map(withParsedProfile));
}));

// Provide basic CRUD for these nested resources so they can be read, updated, or deleted directly by ID
apiRouter.use('/applicants', collectionRoutes({ Model: Applicant, resourceName: 'Applicant' }));
apiRouter.use('/grant-applications', collectionRoutes({ Model: GrantApplication, resourceName: 'GrantApplication' }));
apiRouter.use('/verification/documents', collectionRoutes({ Model: VerificationDoc, resourceName: 'VerificationDoc' }));
apiRouter.use('/community/posts', collectionRoutes({ Model: ChannelPost, resourceName: 'ChannelPost' }));

apiRouter.post('/users/:userId/saved', asyncHandler(async (req, res) => {
  const { SavedItem } = await import('../models/User.js');
  const { itemId, itemType } = req.body;
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

apiRouter.get('/users/:userId/saved', asyncHandler(async (req, res) => {
  const { SavedItem } = await import('../models/User.js');
  const savedItems = await SavedItem.find({ userId: req.params.userId }).sort({ createdAt: -1 });
  listResponse(res, savedItems.map(toClientObject));
}));

