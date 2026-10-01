import crypto from 'node:crypto';
import dotenv from 'dotenv';
import logger from '../lib/logger.js';

dotenv.config();

const parseOrigins = (value) =>
  value
    ? value.split(',').map((origin) => origin.trim()).filter(Boolean)
    : ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:19006'];

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const assertStrongEnough = (name, value) => {
  if (value.length < 32) {
    throw new Error(`CRITICAL SECURITY ERROR: ${name} must be at least 32 characters (got ${value.length}). Generate one with: openssl rand -base64 48`);
  }
  if (value.includes('replace-with') || value.includes('placeholder')) {
    throw new Error(`CRITICAL SECURITY ERROR: ${name} is still a placeholder value.`);
  }
  return value;
};

const ephemeralWarned = new Set();

// Production must supply both secrets explicitly. Everywhere else we mint an
// ephemeral per-process secret: random, never shared, and useless to an attacker,
// so local dev and test boot without a checked-in credential. There is
// intentionally no hardcoded fallback literal for any environment.
const resolveSecret = (name) => {
  const provided = process.env[name];
  if (provided) return assertStrongEnough(name, provided);
  if (isProduction) {
    throw new Error(`CRITICAL SECURITY ERROR: ${name} is not set. Generate one with: openssl rand -base64 48`);
  }
  if (!ephemeralWarned.has(name)) {
    ephemeralWarned.add(name);
    logger.warn({ configKey: name }, 'Config key unset - using ephemeral secret. Set in .env to persist sessions.');
  }
  return crypto.randomBytes(48).toString('hex');
};

const env = {
  nodeEnv,
  isDevelopment: !isProduction,
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT || 4000),
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN),
  databaseUrl: process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URI,
  // Shared counter store for rate limiting. Required in production for the
  // limiters to hold across replicas; when absent the limiters degrade to
  // per-process memory and rate-limit.js warns once at first use.
  redisUrl: process.env.REDIS_URL || null,
  get jwtSecret() {
    return this._jwtSecret ??= resolveSecret('JWT_SECRET');
  },
  get adminJwtSecret() {
    return this._adminJwtSecret ??= resolveSecret('ADMIN_JWT_SECRET');
  },
  // AI Provider config
  aiProvider: process.env.AI_PROVIDER || 'openai',
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
  // WordPress integration
  insightGhanaWordpressUrl: process.env.INSIGHT_GHANA_WORDPRESS_URL,
  africanJournalWordpressUrl: process.env.AFRICAN_JOURNAL_WORDPRESS_URL,
  // Email service
  resendApiKey: process.env.RESEND_API_KEY,
  resendFromEmail: process.env.RESEND_FROM_EMAIL,
  emailVerificationCodeTtlMinutes: Number(process.env.EMAIL_VERIFICATION_CODE_TTL_MINUTES || 10),
  outboundRequestTimeoutMs: Number(process.env.OUTBOUND_REQUEST_TIMEOUT_MS || 10000),
  aiSystemPrompt: process.env.AI_SYSTEM_PROMPT || 'You are the Global Opportunities assistant. Give accurate, helpful opportunity guidance.',
  wordpressSyncBaseUrl: process.env.WORDPRESS_SYNC_BASE_URL,
  wordpressApiKey: process.env.WORDPRESS_API_KEY,
  // Internal secret storage (secure getter pattern)
  _jwtSecret: undefined,
  _adminJwtSecret: undefined,
};

if (isProduction) {
  // Touch both so a missing/weak secret fails at boot, not on first request.
  assertStrongEnough('JWT_SECRET', env.jwtSecret);
  assertStrongEnough('ADMIN_JWT_SECRET', env.adminJwtSecret);
  if (env.jwtSecret === env.adminJwtSecret) {
    throw new Error('CRITICAL SECURITY ERROR: ADMIN_JWT_SECRET must differ from JWT_SECRET. Admin tokens must not be verifiable with the user signing key.');
  }
  if (!env.databaseUrl) {
    throw new Error('CRITICAL ERROR: databaseUrl is missing in production!');
  }
  if (!env.corsOrigins.length || env.corsOrigins.some((origin) => origin.includes('localhost'))) {
    throw new Error('CRITICAL ERROR: CORS_ORIGIN must contain only deployed application origins in production.');
  }
  if (!Number.isFinite(env.outboundRequestTimeoutMs) || env.outboundRequestTimeoutMs < 1000) {
    throw new Error('CRITICAL ERROR: OUTBOUND_REQUEST_TIMEOUT_MS must be at least 1000.');
  }
  const providerKey = env.aiProvider === 'anthropic' ? env.anthropicApiKey : env.openaiApiKey;
  if (!providerKey || providerKey.includes('placeholder')) {
    throw new Error(`CRITICAL ERROR: the configured ${env.aiProvider} API key is missing.`);
  }
  if (!env.resendApiKey || env.resendApiKey.includes('placeholder') || !env.resendFromEmail) {
    throw new Error('CRITICAL ERROR: Resend must be configured in production.');
  }
  if (Boolean(env.wordpressSyncBaseUrl) !== Boolean(env.wordpressApiKey)) {
    throw new Error('CRITICAL ERROR: WORDPRESS_SYNC_BASE_URL and WORDPRESS_API_KEY must be configured together.');
  }
}

export { env };