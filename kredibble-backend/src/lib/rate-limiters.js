import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import Redis from 'ioredis';
import { RedisStore } from 'rate-limit-redis';
import { env } from '../config/env.js';
import logger from './logger.js';

const isProduction = env.isProduction;

let redisClient = null;
let redisDegraded = false;

/**
 * In-process fallback counters, used only when Redis is configured but
 * unreachable. Keeps the API serving instead of 500-ing every request while
 * still applying *some* limit, and logs loudly so the outage is visible.
 */
const fallbackCounters = new Map();

function sweepFallbackCounters(windowMs) {
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
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

function getFallbackStore(windowMs) {
  return {
    async increment(key) {
      if (fallbackCounters.size > 10_000) sweepFallbackCounters(windowMs);
      return incrementFallback(key, windowMs);
    },
    async decrement() {},
    async resetKey(key) {
      fallbackCounters.delete(key);
    },
    async resetAll() {
      fallbackCounters.clear();
    },
  };
}

/**
 * Shared Redis connection used by every limiter.
 *
 * Returns null when Redis is not configured, which leaves the limiters on the
 * default in-memory store. In production that is a real weakness (counters are
 * per-instance), so it is logged as a warning rather than silently accepted.
 */
function getRedisClient() {
  if (!isProduction) return null;
  if (redisDegraded) return null;
  if (redisClient) return redisClient;

  if (!env.redisUrl) {
    redisDegraded = true;
    logger.warn(
      'REDIS_URL is not set. Rate limit counters are per-process and will NOT hold across multiple instances. Set REDIS_URL in production.',
    );
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
    keyGenerator: keyGenerator || ipKeyGenerator,
    skip: skip || (() => env.isTest),
  };

  if (client) {
    const fallback = getFallbackStore(windowMs);
    let degradedForThisLimiter = false;

    options.store = new RedisStore({
      prefix: `rl:${prefix}:`,
      sendCommand: async (...args) => {
        if (degradedForThisLimiter) return fallback.increment(args[1], windowMs);
        try {
          const result = await client.call(...args);
          if (Array.isArray(result) && result[0] !== null) {
            degradedForThisLimiter = true;
            logger.error('Redis returned an unexpected rate-limit command result; falling back to in-process counters for this limiter.');
          }
          return result;
        } catch (error) {
          if (!degradedForThisLimiter) {
            degradedForThisLimiter = true;
            logger.error(
              { error: error.message },
              'Redis rate limit command failed; falling back to in-process counters for this limiter.',
            );
          }
          return fallback.increment(args[1], windowMs);
        }
      },
    });
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
  keyGenerator: (req) => req.auth?.sub || ipKeyGenerator(req, { ipv6Subnet: 56 }),
});

/** 10 requests per hour per IP for sensitive endpoints. */
export const strictLimiter = createRateLimiter({
  prefix: 'strict',
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: { error: { message: 'Too many requests, please try again after an hour' } },
});

/** 100 requests per 15 minutes per IP across the whole API. */
export const globalApiLimiter = createRateLimiter({
  prefix: 'global',
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: { error: { message: 'Too many requests, please try again later.' } },
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
  keyGenerator: (req) => req.auth?.sub || ipKeyGenerator(req, { ipv6Subnet: 56 }),
});
