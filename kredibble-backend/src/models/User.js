import mongoose from 'mongoose';
import crypto from 'node:crypto';

const normalizeEmail = (email) => String(email).trim().toLowerCase();

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  emailNormalized: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true, 
    lowercase: true, 
    trim: true,
    // SEC-028: Auto-generate from email if not provided
    default: function() {
      return this.email ? normalizeEmail(this.email) : undefined;
    }
  },
  role: { type: String, required: true, enum: ['seeker', 'hirer', 'admin'] },
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
  role: { type: String, required: true }, // e.g. SUPER_ADMIN, MODERATOR
  status: { type: String, default: 'active' },
  joinedDate: String,
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
export const StaffMember = mongoose.model('StaffMember', staffMemberSchema);

// SEC-009: revoked refresh tokens with TTL cleanup (denylist)
const revokedRefreshTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
}, { timestamps: true });

export const RevokedRefreshToken = mongoose.model('RevokedRefreshToken', revokedRefreshTokenSchema);

// From main: email verification codes with TTL
const emailVerificationCodeSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

export const EmailVerificationCode = mongoose.model('EmailVerificationCode', emailVerificationCodeSchema);

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