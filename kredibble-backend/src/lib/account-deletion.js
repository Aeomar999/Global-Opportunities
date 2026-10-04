import crypto from 'node:crypto';
import {
  User, RefreshToken, SavedItem, EmailVerificationCode, PasswordResetCode, StaffMember, AuditLog, UserTombstone,
} from '../models/User.js';
import { SeekerProfile, HirerAccount } from '../models/Profiles.js';
import { Applicant, Event, EventAttendee, CompanyVerification, VerificationDoc, Opportunity, GrantApplication } from '../models/Platform.js';
import { Channel, ChannelPost, CommunityMembership } from '../models/Community.js';
import { Testimonial } from '../models/AdminPortal.js';
import { deleteUserMedia } from './cloudinary.js';
import { env } from '../config/env.js';
import logger from './logger.js';

// Q11: the retention period is pending legal review.
const TOMBSTONE_RETENTION_MS = 7 * 365 * 24 * 60 * 60 * 1000;
const DELETED_NAME = 'Deleted User';
const LIVE_OPPORTUNITY_STATUSES = ['pending', 'published', 'approved'];

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const hashEmail = (email) =>
  crypto.createHmac('sha256', env.jwtSecret).update(String(email).trim().toLowerCase()).digest('hex');

/**
 * Where a user's data lives, as one filter per collection. Deletion and the data
 * export both use this, so they cannot drift apart.
 *
 * Grant applications and reports store no user id (SEC-060), so they can't be
 * found here yet.
 */
export async function userDataFilters(user) {
  const userId = user._id;
  // Bookings and log lines keep the email as it was typed, so match any casing.
  const email = new RegExp(`^${escapeRegex(String(user.email).trim())}$`, 'i');
  // Company records hold either a HirerAccount id or a User id, depending on
  // which code path wrote them (SEC-047), so match both.
  const hirer = await HirerAccount.findOne({ userId }).select('_id').lean();
  const companyIds = hirer ? [hirer._id, userId] : [userId];

  return {
    seekerProfile: { userId },
    hirerAccount: { userId },
    applications: { seekerId: userId },
    eventBookings: { email },
    testimonials: { email },
    companyVerifications: { hirerId: { $in: companyIds } },
    verificationDocs: { companyId: { $in: companyIds } },
    savedItems: { userId },
    channelMemberships: { userId },
    communityPosts: { authorId: userId },
    channels: { createdBy: userId },
    grantApplications: { applicantUserId: userId },
    // Staff postings set createdBy; a hirer's own postings (POST /opportunities)
    // only set hirerId, to the User id.
    opportunities: { $or: [{ createdBy: userId }, { hirerId: { $in: companyIds } }] },
    sessions: { userId },
  };
}

/**
 * Delete what is private, strip the person from what stays public, then
 * anonymise the user document. Every step is idempotent, so an interrupted run
 * can be repeated (completePendingDeletions).
 */
export async function purgeUserData(user, { deleteMedia = deleteUserMedia } = {}) {
  const userId = user._id;
  const where = await userDataFilters(user);
  const email = where.eventBookings.email;

  // SEC-101: Decrement Opportunity.applicantsCount and Event.attendeesCount so capacity is freed
  const applicantDocs = await Applicant.find(where.applications).select('opportunityId').lean();
  const eventBookingDocs = await EventAttendee.find(where.eventBookings).select('eventId').lean();

  for (const doc of applicantDocs) {
    if (doc.opportunityId) {
      await Opportunity.updateOne(
        { _id: doc.opportunityId, applicantsCount: { $gt: 0 } },
        { $inc: { applicantsCount: -1 } },
      );
    }
  }

  for (const doc of eventBookingDocs) {
    if (doc.eventId) {
      await Event.updateOne(
        { _id: doc.eventId, attendeesCount: { $gt: 0 } },
        { $inc: { attendeesCount: -1 } },
      );
    }
  }

  await Promise.all([
    SeekerProfile.deleteMany(where.seekerProfile),
    Applicant.deleteMany(where.applications),
    GrantApplication.deleteMany(where.grantApplications),
    EventAttendee.deleteMany(where.eventBookings),
    Testimonial.deleteMany(where.testimonials),
    CompanyVerification.deleteMany(where.companyVerifications),
    VerificationDoc.deleteMany(where.verificationDocs),
    SavedItem.deleteMany(where.savedItems),
    CommunityMembership.deleteMany(where.channelMemberships),
    RefreshToken.deleteMany(where.sessions),
    StaffMember.deleteMany({ userId }),
    PasswordResetCode.deleteMany({ userId }),
    EmailVerificationCode.deleteMany({ email }),
    ChannelPost.updateMany(where.communityPosts, { $set: { authorName: DELETED_NAME, authorId: null } }),
    Channel.updateMany(where.channels, { $set: { createdBy: null } }),
    Opportunity.updateMany(
      { ...where.opportunities, moderationStatus: { $in: LIVE_OPPORTUNITY_STATUSES } },
      { $set: { moderationStatus: 'closed' } },
    ),
    AuditLog.updateMany({ 'metadata.email': email }, { $unset: { 'metadata.email': '' } }),
  ]);
  // After the rest: a re-run finds company records through this account.
  await HirerAccount.deleteMany(where.hirerAccount);

  let mediaDeleted = false;
  try {
    await deleteMedia(String(userId));
    mediaDeleted = true;
  } catch (error) {
    logger.error({ err: error.message, userId: String(userId) }, 'Account media deletion failed');
  }

  // Last: the steps above match on the email.
  const placeholder = `deleted_${userId}@kredibble.local`;
  await User.updateOne(
    { _id: userId },
    {
      $set: { name: DELETED_NAME, email: placeholder, emailNormalized: placeholder, emailVerified: false, role: 'deleted' },
      $unset: { passwordHash: '', avatarUrl: '', refreshTokenHash: '', lockUntil: '', lastFailedLogin: '' },
    },
  );

  return { mediaDeleted };
}

/**
 * SEC-065: erase an account. Access is cut first, so the person is signed out
 * everywhere even if a later step fails; the tombstone stays `pending` until
 * every step has run. An error thrown after access is cut carries
 * `accountClosed: true`: completePendingDeletions finishes that deletion.
 */
export async function deleteAccount(user, deps = {}) {
  const deletedAt = new Date();
  await UserTombstone.updateOne(
    { userId: user._id },
    {
      $setOnInsert: {
        emailHash: hashEmail(user.email),
        status: 'pending',
        mediaDeleted: false,
        deletedAt,
        retentionUntil: new Date(deletedAt.getTime() + TOMBSTONE_RETENTION_MS),
      },
    },
    { upsert: true },
  );

  try {
    await User.updateOne({ _id: user._id }, { $set: { role: 'deleted' }, $inc: { tokenVersion: 1 } });
  } catch (error) {
    // SEC-103: If setting role to deleted fails, clean up the pending tombstone so the scheduler does not later erase an active account
    await UserTombstone.deleteOne({ userId: user._id, status: 'pending' });
    throw error;
  }

  try {
    await RefreshToken.deleteMany({ userId: user._id });

    const { mediaDeleted } = await purgeUserData(user, deps);

    await UserTombstone.updateOne(
      { userId: user._id },
      { $set: { status: 'completed', completedAt: new Date(), mediaDeleted } },
    );
  } catch (error) {
    error.accountClosed = true;
    throw error;
  }
  return { deletedAt };
}

let isRecoveryInFlight = false;

/**
 * SEC-065: finish account deletions that stopped part-way. A tombstone stays
 * `pending`, or has `mediaDeleted: false`, when a step failed. Every step is
 * idempotent, so running the purge again completes it. Deletions younger than
 * `minAgeMs` may still be running and are left alone.
 *
 * Run hourly by the server and by scripts/complete-account-deletions.js.
 */
export async function completePendingDeletions({ minAgeMs = 10 * 60 * 1000 } = {}) {
  // SEC-103: In-flight guard prevents multiple concurrent recovery runs
  if (isRecoveryInFlight) {
    logger.warn('completePendingDeletions is already in flight; skipping overlapping run');
    return { processed: 0, failed: 0 };
  }

  isRecoveryInFlight = true;
  try {
    const tombstones = await UserTombstone.find({
      $or: [{ status: 'pending' }, { mediaDeleted: false }],
      deletedAt: { $lte: new Date(Date.now() - minAgeMs) },
    });

    let processed = 0;
    let failed = 0;
    for (const tombstone of tombstones) {
      const userId = String(tombstone.userId);
      // One broken account must not stop the rest from being finished.
      try {
        const user = await User.findById(tombstone.userId);
        if (!user) {
          logger.warn({ userId }, 'Tombstone has no user document; skipping');
          continue;
        }
        processed += 1;
        const { mediaDeleted } = await purgeUserData(user);
        tombstone.set({ status: 'completed', completedAt: new Date(), mediaDeleted });
        await tombstone.save();
        if (!mediaDeleted) failed += 1;
        logger.info({ userId, mediaDeleted }, 'Account deletion completed');
      } catch (error) {
        failed += 1;
        logger.error({ err: error.message, userId }, 'Completing account deletion failed');
      }
    }
    return { processed, failed };
  } finally {
    isRecoveryInFlight = false;
  }
}
