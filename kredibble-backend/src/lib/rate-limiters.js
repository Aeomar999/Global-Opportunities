import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env.js';

const isTest = env.nodeEnv === 'test';

/**
 * Registration rate limiter: 5 requests per hour per IP
 * Stricter than the general auth limiter to prevent account enumeration
 */
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  message: { error: { message: 'Too many registration attempts from this IP, please try again after an hour' } },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  skip: () => isTest,
});

/**
 * Search rate limiter: 60 requests per 15 minutes per IP
 * Applied to search endpoints
 */
export const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 60,
  message: { error: { message: 'Too many search requests, please try again later' } },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  skip: () => isTest,
  skip: () => isTest,
});

/**
 * Password reset / verification code send rate limiter: 3 requests per hour per IP
 * Prevents abuse of email sending
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 3,
  message: { error: { message: 'Too many verification code requests, please try again after an hour' } },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  skip: () => isTest,
});

/**
 * AI/expensive endpoints rate limiter: 20 requests per 15 minutes per user
 * Applied to AI chat and other expensive operations
 */
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  message: { error: { message: 'Too many AI requests, please try again later' } },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.auth?.sub || ipKeyGenerator(req, { ipv6Subnet: 56 }),
  skip: () => isTest,
});

/**
 * Generic strict rate limiter for sensitive endpoints: 10 requests per hour per IP
 */
export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 10,
  message: { error: { message: 'Too many requests, please try again after an hour' } },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: ipKeyGenerator,
  skip: () => isTest,
});