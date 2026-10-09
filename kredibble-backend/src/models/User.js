import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { ROLE_IDS, normalizeLegacyRole } from '../lib/permissions.js';

const normalizeEmail = (email) => String(email).trim().toLowerCase();

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  emailNormalized: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true, 
    select: false,
    lowercase: true, 
    trim: true,
    // SEC-028: Auto-generate from email if not provided
    default: function() {
      return this.email ? normalizeEmail(this.email) : undefined;
    }
  },
  role: { type: String, required: true, enum: ['seeker', 'hirer', 'admin', 'deleted'] },
  passwordHash: { type: String },
  avatarUrl: { type: String },
  // SEC-009: token version for refresh rotation & forced logout
  tokenVersion: { type: Number, default: 0 },
  // SEC-009: hashed refresh token for rotation (single active per user)
  refreshTokenHash: { type: String, select: false },
  // From main: email verification status
  emailVerified: { type: Boolean, default: false },
  // SEC-025: account lockout with progressive backoff
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  lastFailedLogin: { type: Date },
  // Push notifications
  pushToken: { type: String },
  pushPlatform: { type: String, enum: ['ios', 'android', 'web', 'other'] },
  pushTokenUpdatedAt: { type: Date },
}, { timestamps: true });

// Virtuals to mimic the previous Prisma/Native structure for the frontend
userSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

userSchema.set('toJSON', { virtuals: true });

const staffMemberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  roles: {
    type: [String],
    default: [],
    validate: {
      validator: (roles) => {
        if (!Array.isArray(roles)) return false;
        if (roles.length < 1 || roles.length > 2) return false;
        return roles.every((r) => ROLE_IDS.includes(r));
      },
      message: 'Staff member must have 1 or 2 valid roles from the 12 role IDs',
    },
  },
  role: { type: String }, // maintained for backward compatibility
  status: { type: String, default: 'active' },
  joinedDate: String,
}, { timestamps: true });

staffMemberSchema.pre('validate', function() {
  if ((!this.roles || this.roles.length === 0) && this.role) {
    const normalized = normalizeLegacyRole(this.role);
    if (normalized.length > 0) {
      this.roles = normalized;
    }
  }
  if (Array.isArray(this.roles) && this.roles.length > 0 && !this.role) {
    this.role = this.roles.join(',');
  }
});

export const User = mongoose.model('User', userSchema);
export const StaffMember = mongoose.model('StaffMember', staffMemberSchema);

// SEC-009: revoked refresh tokens with TTL cleanup (denylist)
const revokedRefreshTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
}, { timestamps: true });

export const RevokedRefreshToken = mongoose.model('RevokedRefreshToken', revokedRefreshTokenSchema);

// SEC-053: RefreshToken collection with family revocation support
const refreshTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, index: true },
  deviceLabel: { type: String, default: 'Unknown Device' },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  revokedAt: { type: Date, default: null },
  replacedBy: { type: String, default: null }
}, { timestamps: true });

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

// From main: email verification codes with TTL
const emailVerificationCodeSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0, min: 0 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

export const EmailVerificationCode = mongoose.model('EmailVerificationCode', emailVerificationCodeSchema);

// SEC-083: one-time password-reset codes, stored hashed, 10-minute TTL, attempt-capped
const passwordResetCodeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0, min: 0 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

export const PasswordResetCode = mongoose.model('PasswordResetCode', passwordResetCodeSchema);

// SEC-065: record that an account was erased. Holds a hash of the email, never the email.
const userTombstoneSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  emailHash: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending', index: true },
  mediaDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, required: true },
  completedAt: { type: Date },
  retentionUntil: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

export const UserTombstone = mongoose.model('UserTombstone', userTombstoneSchema);

const savedItemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
  itemType: { type: String, enum: ['opportunities', 'events', 'grants', 'internships'], required: true }
}, { timestamps: true });

export const SavedItem = mongoose.model('SavedItem', savedItemSchema);

// SEC-009: hash a raw refresh token for storage/lookup
export const hashRefreshToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// SEC-017: Audit log for security-relevant events
const auditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  actorRole: { type: String, enum: ['seeker', 'hirer', 'admin', 'anonymous'], index: true },
  action: { type: String, required: true, index: true },
  resourceType: { type: String, index: true },
  resourceId: { type: mongoose.Schema.Types.ObjectId, index: true },
  ip: { type: String },
  userAgent: { type: String },
  requestId: { type: String, index: true },
  outcome: { type: String, enum: ['success', 'failure'], required: true },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

// TTL index for retention (e.g., 1 year)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);