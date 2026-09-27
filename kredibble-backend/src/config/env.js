import crypto from 'node:crypto';
import dotenv from 'dotenv';

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
    console.warn(`[config] ${name} is unset - using a random ephemeral secret. Tokens will not survive a restart. Set ${name} in .env to persist sessions.`);
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
  get jwtSecret() {
    return this._jwtSecret ??= resolveSecret('JWT_SECRET');
  },
  get adminJwtSecret() {
    return this._adminJwtSecret ??= resolveSecret('ADMIN_JWT_SECRET');
  },
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
}

export { env };
