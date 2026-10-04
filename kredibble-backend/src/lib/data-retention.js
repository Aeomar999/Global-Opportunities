import { Applicant } from '../models/Platform.js';
import { VerificationDoc } from '../models/Platform.js';
import logger from './logger.js';

/**
 * Data retention policy limits (Q11 / SEC-065 / SEC-092):
 * - Rejected Applicant CVs/Resumes: 180 days (6 months)
 * - Rejected Company Verification Docs: 90 days (3 months)
 * - Audit Logs: 365 days (1 year, auto-indexed via TTL)
 * - User Tombstones: 7 years (2555 days, anti-fraud email hashes)
 */
export const RETENTION_POLICY = {
  APPLICANT_CV_DAYS: 180,
  VERIFICATION_DOC_DAYS: 90,
  AUDIT_LOG_DAYS: 365,
  TOMBSTONE_DAYS: 7 * 365,
};

/**
 * Redact CV/resume URLs from rejected job applications older than the retention threshold.
 * Complies with GDPR Art. 5(1)(e) and Ghana Data Protection Act 843 storage minimization.
 */
export const cleanupRejectedApplicantPii = async ({ now = new Date(), maxAgeDays = RETENTION_POLICY.APPLICANT_CV_DAYS } = {}) => {
  const cutoff = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);
  const result = await Applicant.updateMany(
    {
      status: 'Rejected',
      updatedAt: { $lte: cutoff },
      resumeUrl: { $ne: null },
    },
    {
      $set: { resumeUrl: null },
    }
  );

  return result.modifiedCount || 0;
};

/**
 * Purge rejected company verification documents older than the retention threshold.
 */
export const cleanupRejectedVerificationDocs = async ({ now = new Date(), maxAgeDays = RETENTION_POLICY.VERIFICATION_DOC_DAYS } = {}) => {
  const cutoff = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);
  const result = await VerificationDoc.deleteMany({
    status: 'rejected',
    updatedAt: { $lte: cutoff },
  });

  return result.deletedCount || 0;
};

/**
 * Execute full data retention sweep across applicable collections.
 */
export const runDataRetentionSweep = async (options = {}) => {
  try {
    const applicantsRedacted = await cleanupRejectedApplicantPii(options);
    const verificationDocsPurged = await cleanupRejectedVerificationDocs(options);

    logger.info(
      { applicantsRedacted, verificationDocsPurged },
      'Data retention sweep completed successfully'
    );

    return {
      applicantsRedacted,
      verificationDocsPurged,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error({ err: error.message }, 'Data retention sweep failed');
    throw error;
  }
};
