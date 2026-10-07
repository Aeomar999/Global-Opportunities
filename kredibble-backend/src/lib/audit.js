import { AuditLog } from '../models/User.js';
import logger from './logger.js';
import crypto from 'node:crypto';

export const AUDIT_ACTIONS = {
  // Auth
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILURE: 'auth.login.failure',
  LOGOUT: 'auth.logout',
  REFRESH_TOKEN: 'auth.refresh',
  REGISTER: 'auth.register',
  PASSWORD_CHANGE: 'auth.password.change',
  PASSWORD_RESET_REQUEST: 'auth.password.reset_request',
  PASSWORD_RESET: 'auth.password.reset',
  ROLE_CHANGE: 'auth.role.change',
  EMAIL_VERIFY: 'auth.email.verify',

  // Admin mutations
  ADMIN_VERIFICATION_DECISION: 'admin.verification.decision',
  ADMIN_REPORT_RESOLUTION: 'admin.report.resolution',
  ADMIN_BULK_EXPORT: 'admin.bulk.export',
  ADMIN_DELETE: 'admin.delete',
  ADMIN_USER_UPDATE: 'admin.user.update',
  ADMIN_OPPORTUNITY_MODERATE: 'admin.opportunity.moderate',

  // GDPR/CCPA
  DATA_EXPORT: 'data.export',
  ACCOUNT_DELETE: 'account.delete',

  // Other sensitive operations
  UPLOAD: 'upload.create',
  SAVED_ITEM_TOGGLE: 'saved_item.toggle',
  APPLICATION_SUBMIT: 'application.submit',
  GRANT_APPLY: 'grant.apply',
  EVENT_BOOK: 'event.book',
};

export const AUDIT_RESOURCE_TYPES = {
  USER: 'user',
  SEEKER_PROFILE: 'seeker_profile',
  HIRER_ACCOUNT: 'hirer_account',
  OPPORTUNITY: 'opportunity',
  APPLICANT: 'applicant',
  EVENT: 'event',
  GRANT: 'grant',
  GRANT_APPLICATION: 'grant_application',
  COMPANY_VERIFICATION: 'company_verification',
  VERIFICATION_DOC: 'verification_doc',
  COMMUNITY_CHANNEL: 'community_channel',
  COMMUNITY_POST: 'community_post',
  REPORT: 'report',
  NOTIFICATION: 'notification',
  ARTICLE: 'article',
  SAVED_ITEM: 'saved_item',
  EVENT_ATTENDEE: 'event_attendee',
};

/**
 * Emit an audit log entry.
 * Never logs tokens, passwords, or PII bodies.
 * @param {Object} params
 * @param {string|ObjectId} params.actorId - User ID (optional for anonymous actions)
 * @param {string} params.actorRole - 'seeker' | 'hirer' | 'admin' | 'anonymous'
 * @param {string} params.action - One of AUDIT_ACTIONS
 * @param {string} [params.resourceType] - One of AUDIT_RESOURCE_TYPES
 * @param {string|ObjectId} [params.resourceId]
 * @param {string} [params.ip]
 * @param {string} [params.userAgent]
 * @param {string} [params.requestId]
 * @param {'success'|'failure'} params.outcome
 * @param {Object} [params.metadata] - Additional context (no secrets)
 */
export async function auditLog(params) {
  try {
    await AuditLog.create({
      actorId: params.actorId || null,
      actorRole: params.actorRole,
      action: params.action,
      resourceType: params.resourceType || null,
      resourceId: params.resourceId || null,
      ip: params.ip || null,
      userAgent: params.userAgent || null,
      requestId: params.requestId || null,
      outcome: params.outcome,
      metadata: params.metadata || {},
    });
  } catch (error) {
    // Audit logging must never break the main flow
    logger.error({ error: error.message }, 'Audit log failed');
  }
}

/**
 * Middleware to attach request context for audit logging.
 * Adds req.auditContext with ip, userAgent, requestId.
 */
export const auditContext = (req, res, next) => {
  req.auditContext = {
    ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
    requestId: req.id || req.get('x-request-id') || crypto.randomUUID(),
  };
  // Propagate request ID in response headers (SEC-039)
  res.set('X-Request-Id', req.auditContext.requestId);
  next();
};

/**
 * Helper to emit audit from route handlers with auth context.
 * Usage: auditReq(req, { action, resourceType, resourceId, outcome, metadata })
 */
export function auditReq(req, params) {
  const actorId = req.auth?.sub || null;
  const actorRole = req.auth?.role || 'anonymous';
  const { ip, userAgent, requestId } = req.auditContext || {
    ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
    requestId: req.id || req.get('x-request-id') || crypto.randomUUID(),
  };

  return auditLog({
    actorId,
    actorRole,
    ip,
    userAgent,
    requestId,
    ...params,
  });
}