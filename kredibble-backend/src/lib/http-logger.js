import pinoHttp from 'pino-http';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Creates structured HTTP access logging middleware using pino-http.
 * Emits JSON logs tagged with service, environment, release, and requestId (SEC-095).
 * Redacts sensitive credentials, tokens, and cookies automatically.
 *
 * @returns {import('express').RequestHandler}
 */
export function createHttpLogger() {
  const isDevelopment = env.nodeEnv !== 'production';

  return pinoHttp({
    autoLogging: {
      ignore: () => env.isTest,
    },
    genReqId: (req) => {
      const headerId = req.headers['x-request-id'];
      if (headerId && typeof headerId === 'string') {
        return headerId;
      }
      return crypto.randomUUID();
    },
    customProps: (req, _res) => ({
      service: 'kredibble-backend',
      environment: env.appEnv,
      release: env.release,
      requestId: req.id,
    }),
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["set-cookie"]',
        'req.headers["x-api-key"]',
        'req.query.token',
        'req.query.code',
        'req.query.secret',
        'req.query.password',
        'req.body.password',
        'req.body.refreshToken',
        'req.body.currentPassword',
        'req.body.newPassword',
      ],
      censor: '[REDACTED]',
    },
    customLogLevel: (_req, res, err) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res) => `${req.method} ${req.originalUrl || req.url} ${res.statusCode}`,
    customErrorMessage: (req, res, err) => `${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${err.message}`,
    transport: isDevelopment && !env.isTest ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    } : undefined,
  });
}
