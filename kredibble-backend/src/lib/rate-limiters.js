import crypto from 'node:crypto';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import Redis from 'ioredis';
import { RedisStore } from 'rate-limit-redis';
import { env } from '../config/env.js';
import logger from './logger.js';

const isProduction = env.isProduction;

let redisClient = null;
let hasWarnedAboutMissingRedis = false;

/**
 * In-process fallback counters, used only when Redis is configured but
 * unreachable. Keeps the API serving instead of 500-ing every request while
 * still applying *some* limit, and logs loudly so the outage is visible.
 *
 * Keys are the fully-prefixed Redis keys (`rl:<limiter>:<clientKey>`), so a
 * single shared map stays correctly namespaced per limiter and per client.
 */
const fallbackCounters = new Map();

function sweepFallbackCounters() {
  const now = Date.now();
  for (const [key, entry] of fallbackCounters) {
    if (entry.resetTime <= now) fallbackCounters.delete(key);
  }
}

function incrementFallback(key, windowMs) {
  const now = Date.now();
  const entry = fallbackCounters.get(key);
  if (!entry || entry.resetTime <= now) {
    fallbackCounters.set(key, { count: 1, resetTime: now + windowMs });
    return { count: 1, timeToExpire: windowMs };
  }
  entry.count += 1;
  return { count: entry.count, timeToExpire: entry.resetTime - now };
}

function decrementFallback(key) {
  const entry = fallbackCounters.get(key);
  if (entry) entry.count = Math.max(0, entry.count - 1);
}

/**
 * Emulate the Redis verbs rate-limit-redis issues, in process.
 *
 * `sendCommand` must reply in the raw Redis shape the library expects, and each
 * verb has different semantics, so the degraded path has to dispatch on the
 * verb rather than treating every command as an increment:
 *
 *   SCRIPT LOAD  -> the script sha (a string)
 *   EVALSHA       -> [totalHits, timeToExpire]
 *   DECR          -> decrement, used to refund a hit
 *   DEL           -> forget the key, used to reset a limiter
 *
 * Routing DECR/DEL through the increment path would make a rate limit reset
 * *raise* the counter, which locks a legitimate client out of the endpoint.
 */
function createFallbackCounter(windowMs) {
  return {
    async run(command, key) {
      if (command === 'SCRIPT') return 'in-process-fallback';
      if (command === 'DECR') {
        decrementFallback(key);
        return 1;
      }
      if (command === 'DEL') {
        fallbackCounters.delete(key);
        return 1;
      }
      if (fallbackCounters.size > 10_000) sweepFallbackCounters();
      const { count, timeToExpire } = incrementFallback(key, windowMs);
      return [count, timeToExpire];
    },
  };
}

/**
 * Extract the Redis key a command operates on.
 *
 * `rate-limit-redis` spreads its command array into `sendCommand`, so the
 * arguments depend on the command verb:
 *
 *   SCRIPT LOAD <body>                              -> no key
 *   EVALSHA <sha> <numkeys> <key> [args...]          -> key is args[3]
 *   DECR <key> / DEL <key>                           -> key is args[1]
 *
 * Getting this wrong is not cosmetic: returning the script SHA instead of the
 * client key would funnel every client in the process into one shared counter
 * and turn a per-IP limit into a global one.
 *
 * Exported for unit testing.
 */
export function extractRedisKey(args) {
  if (!Array.isArray(args) || args.length === 0) return '';

  const command = String(args[0] ?? '').toUpperCase();

  if (command === 'SCRIPT') return '';
  if (command === 'EVAL' || command === 'EVALSHA' || command === 'EVAL_RO') {
    const numKeys = Number(args[2]);
    return Number.isFinite(numKeys) && numKeys > 0 ? String(args[3] ?? '') : '';
  }
  return args.length > 1 ? String(args[1] ?? '') : '';
}

/**
 * Shared Redis connection used by every limiter.
 *
 * Returns null when Redis is not configured, which leaves the limiters on the
 * default in-memory store. Redis is used whenever REDIS_URL is set so the path
 * is exercisable outside production; in production its absence is a real
 * weakness (counters are per-instance), so it is logged as an error rather
 * than silently accepted.
 */
function getRedisClient() {
  if (redisClient) return redisClient;

  if (!env.redisUrl) {
    if (isProduction && !hasWarnedAboutMissingRedis) {
      hasWarnedAboutMissingRedis = true;
      logger.error(
        'REDIS_URL is not set. Rate limit counters are per-process and will NOT hold across multiple instances. Set REDIS_URL in production.',
      );
    }
    return null;
  }

  const client = new Redis(env.redisUrl, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 3000)),
  });

  client.on('error', (error) => {
    logger.error({ error: error.message }, 'Redis rate limiter connection error');
  });

  redisClient = client;
  return redisClient;
}

/**
 * Build a RedisStore whose commands degrade to bounded in-process counters if
 * the Redis call throws.
 *
 * Exported so the sendCommand contract can be unit tested with a stub client.
 * The previous version validated the reply shape to detect misbehaviour, which
 * was wrong: a healthy EVALSHA reply *is* an array, so that check permanently
 * degraded a working limiter after its first request.
 */
export function createRedisStoreWithFallback({ client, prefix, windowMs }) {
  const fallback = createFallbackCounter(windowMs);
  let degradedForThisLimiter = false;

  return new RedisStore({
    prefix: `rl:${prefix}:`,
    windowMs,
    sendCommand: async (...args) => {
      const runFallback = () =>
        fallback.run(String(args[0] ?? '').toUpperCase(), extractRedisKey(args));

      if (degradedForThisLimiter) return runFallback();
      try {
        // rate-limit-redis already validates and throws on a malformed reply,
        // so a throw is the only real failure signal. Inspecting the result
        // shape here would treat the normal [totalHits, timeToExpire] array as
        // an error and silently kill the shared store.
        return await client.call(...args);
      } catch (error) {
        if (!degradedForThisLimiter) {
          degradedForThisLimiter = true;
          logger.error(
            { error: error.message },
            'Redis rate limit command failed; falling back to in-process counters for this limiter. Limits are per-process until this process restarts.',
          );
        }
        return runFallback();
      }
    },
  });
}

/**
 * Build a rate limiter backed by Redis in production.
 *
 * Every limiter gets its own `prefix`: rate-limit-redis keys are derived from
 * the client key alone, so limiters sharing a namespace would throttle each
 * other (a search limit consumed would spend the password-reset budget).
 */
function createRateLimiter({ prefix, windowMs, limit, message, keyGenerator, skip }) {
  const client = getRedisClient();
  const options = {
    windowMs,
    limit,
    message,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: keyGenerator || ((req) => ipKeyGenerator(req.ip)),
    // Off under Jest and on the admin e2e server only; env.isE2E is never true in production.
    skip: skip || (() => env.isTest || env.isE2E),
  };

  if (client) {
    options.store = createRedisStoreWithFallback({ client, prefix, windowMs });
  }

  return rateLimit(options);
}

/** 5 registration attempts per hour per IP — limits account/email enumeration. */
export const registrationLimiter = createRateLimiter({
  prefix: 'registration',
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: { error: { message: 'Too many registration attempts from this IP, please try again after an hour' } },
});

/** 60 searches per 15 minutes per IP. */
export const searchLimiter = createRateLimiter({
  prefix: 'search',
  windowMs: 15 * 60 * 1000,
  limit: 60,
  message: { error: { message: 'Too many search requests, please try again later' } },
});

/** 3 verification/reset codes per hour per IP — protects the email provider budget. */
export const passwordResetLimiter = createRateLimiter({
  prefix: 'password-reset',
  windowMs: 60 * 60 * 1000,
  limit: 3,
  message: { error: { message: 'Too many verification code requests, please try again after an hour' } },
});

/** 20 AI calls per 15 minutes per authenticated user. */
export const aiLimiter = createRateLimiter({
  prefix: 'ai',
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: { message: 'Too many AI requests, please try again later' } },
  keyGenerator: (req) => req.auth?.sub || ipKeyGenerator(req.ip, { ipv6Subnet: 56 }),
});

/** 10 requests per hour per IP for sensitive endpoints. */
export const strictLimiter = createRateLimiter({
  prefix: 'strict',
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: { error: { message: 'Too many requests, please try again after an hour' } },
});

/**
 * 100 requests per 15 minutes across the whole API.
 * SEC-105: If an admin cookie or bearer token is present, key on its hash
 * so each authenticated user / admin behind proxies (Vercel proxy or CGNAT)
 * gets their own bucket instead of sharing one global IP limit.
 */
export const globalApiLimiter = createRateLimiter({
  prefix: 'global',
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: { error: { message: 'Too many requests, please try again later.' } },
  keyGenerator: (req) => {
    if (req.cookies?.kredibble_admin_token) {
      return `adm:${crypto.createHash('sha256').update(req.cookies.kredibble_admin_token).digest('hex').slice(0, 16)}`;
    }
    const auth = req.headers?.authorization;
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      return `tok:${crypto.createHash('sha256').update(auth.slice(7)).digest('hex').slice(0, 16)}`;
    }
    return ipKeyGenerator(req.ip);
  },
});

/** 20 auth attempts per 15 minutes per IP — the brute-force boundary. */
export const authLimiter = createRateLimiter({
  prefix: 'auth',
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: { message: 'Too many authentication attempts, please try again later.' } },
});

/** 20 uploads per hour per authenticated user (value preserved from the previous inline limiter). */
export const uploadLimiter = createRateLimiter({
  prefix: 'upload',
  windowMs: 60 * 60 * 1000,
  limit: 20,
  message: { error: { message: 'Too many uploads, please try again later' } },
  keyGenerator: (req) => req.auth?.sub || ipKeyGenerator(req.ip, { ipv6Subnet: 56 }),
});

/** SEC-062: Rate limit verification code checks per email (10 attempts per hour). */
export const emailVerificationLimiter = createRateLimiter({
  prefix: 'email-verification',
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: { error: { message: 'Too many verification attempts for this email, please try again after an hour' } },
  keyGenerator: (req) => String(req.body?.email || '').trim().toLowerCase() || 'unknown',
});

/** SEC-083: reset-code requests — 5 per hour per IP. */
export const forgotPasswordLimiter = createRateLimiter({
  prefix: 'forgot-password',
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: { error: { message: 'Too many password reset requests, please try again after an hour' } },
});

/** SEC-083: reset-code guesses — 10 per hour per target email, on top of the 5-attempt cap per code. */
export const passwordResetAttemptLimiter = createRateLimiter({
  prefix: 'password-reset-attempt',
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: { error: { message: 'Too many password reset attempts for this email, please try again after an hour' } },
  keyGenerator: (req) => String(req.body?.email || '').trim().toLowerCase() || 'unknown',
});

/**
 * SEC-083: reset-code requests — 3 per hour per target email. The per-IP limit
 * alone lets rotating IPs flood one inbox, cancel its code on every request and
 * spend the shared email quota.
 */
export const forgotPasswordEmailLimiter = createRateLimiter({
  prefix: 'forgot-password-email',
  windowMs: 60 * 60 * 1000,
  limit: 3,
  message: { error: { message: 'Too many password reset requests for this email, please try again after an hour' } },
  keyGenerator: (req) => String(req.body?.email || '').trim().toLowerCase() || 'unknown',
});

/**
 * SEC-084/SEC-065: current-password checks behind a session (change password,
 * delete account) — 5 per hour per user, so a stolen token can't be used to
 * guess the password from many IPs.
 */
export const reauthLimiter = createRateLimiter({
  prefix: 'reauth',
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: { error: { message: 'Too many password attempts, please try again after an hour' } },
  keyGenerator: (req) => String(req.auth?.sub || 'unknown'),
});
