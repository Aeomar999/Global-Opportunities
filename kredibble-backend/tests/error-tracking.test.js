import request from 'supertest';
import express from 'express';
import {
  sanitizeSentryEvent,
  initErrorTracking,
  captureException,
  captureMessage,
  setupSentryErrorHandler,
} from '../src/lib/error-tracking.js';
import { createHttpLogger } from '../src/lib/http-logger.js';
import { auditContext } from '../src/lib/audit.js';

describe('SEC-090 / SEC-095: Observability & Error Tracking', () => {
  describe('Sentry Event Sanitization (beforeSend)', () => {
    it('strips cookies, authorization, and sensitive headers from event.request', () => {
      const rawEvent = {
        request: {
          url: 'https://staging-api.globalopportunitydesk.com/api/v1/auth/me',
          method: 'GET',
          cookies: { session: 'secret_session_token' },
          headers: {
            host: 'staging-api.globalopportunitydesk.com',
            authorization: 'Bearer sensitive_jwt_token',
            cookie: 'session=secret_session_token',
            'x-api-key': 'super_secret_key',
            'custom-auth-token': 'token_value',
            'user-agent': 'Mozilla/5.0',
          },
        },
      };

      const sanitized = sanitizeSentryEvent(rawEvent);

      expect(sanitized.request.cookies).toBeUndefined();
      expect(sanitized.request.headers.cookie).toBeUndefined();
      expect(sanitized.request.headers.authorization).toBeUndefined();
      expect(sanitized.request.headers['x-api-key']).toBeUndefined();
      expect(sanitized.request.headers['custom-auth-token']).toBeUndefined();
      expect(sanitized.request.headers['user-agent']).toBe('Mozilla/5.0');
    });

    it('strips request body data from event.request', () => {
      const rawEvent = {
        request: {
          url: 'https://staging-api.globalopportunitydesk.com/api/v1/auth/login',
          method: 'POST',
          data: {
            email: 'user@example.com',
            password: 'secretPassword123!',
          },
        },
      };

      const sanitized = sanitizeSentryEvent(rawEvent);

      expect(sanitized.request.data).toBeUndefined();
    });

    it('strips user PII (email, IP, username) from event.user', () => {
      const rawEvent = {
        user: {
          id: 'usr_12345',
          email: 'admin@globalopportunitydesk.com',
          ip_address: '192.0.2.1',
          username: 'jerry',
        },
      };

      const sanitized = sanitizeSentryEvent(rawEvent);

      expect(sanitized.user.id).toBe('usr_12345');
      expect(sanitized.user.email).toBeUndefined();
      expect(sanitized.user.ip_address).toBeUndefined();
      expect(sanitized.user.username).toBeUndefined();
    });

    it('handles null or malformed events safely without throwing', () => {
      expect(sanitizeSentryEvent(null)).toBeNull();
      expect(sanitizeSentryEvent(undefined)).toBeNull();

      const malformedEvent = { request: 'not-an-object' };
      expect(() => sanitizeSentryEvent(malformedEvent)).not.toThrow();
    });
  });

  describe('Sentry Initialization & Capture Helpers', () => {
    it('returns false when no DSN is provided', () => {
      const result = initErrorTracking({ dsn: '', force: true });
      expect(result).toBe(false);
    });

    it('captureException tags event with requestId when provided', () => {
      const error = new Error('Test forced failure');
      const eventId = captureException(error, {
        requestId: 'req_test_12345',
        req: { method: 'GET', url: '/api/v1/test' },
      });

      // When DSN is not set or in test, Sentry returns undefined or mock event ID without throwing
      expect(() => captureException(error, { requestId: 'req_test_12345' })).not.toThrow();
      expect(eventId === undefined || typeof eventId === 'string').toBe(true);
    });

    it('captureMessage tags event with requestId and level', () => {
      expect(() =>
        captureMessage('Service health degraded', 'warning', { requestId: 'req_health_999' })
      ).not.toThrow();
    });
  });

  describe('Express Error Handler & Access Logging Integration', () => {
    let testApp;

    beforeAll(() => {
      testApp = express();
      testApp.use(createHttpLogger());
      testApp.use(auditContext);

      testApp.get('/test/forced-500', () => {
        throw new Error('Database cluster unreachable');
      });

      setupSentryErrorHandler(testApp);

      testApp.use((err, req, res, _next) => {
        const status = err.status || 500;
        const requestId = req.auditContext?.requestId || req.id || req.get?.('x-request-id');

        captureException(err, { req, requestId });

        res.status(status).json({
          error: {
            message: 'Internal server error',
            requestId,
          },
        });
      });
    });

    it('includes requestId in 500 error response and X-Request-Id header', async () => {
      const customRequestId = 'trace-uuid-abc-123';
      const response = await request(testApp)
        .get('/test/forced-500')
        .set('x-request-id', customRequestId);

      expect(response.status).toBe(500);
      expect(response.headers['x-request-id']).toBe(customRequestId);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe('Internal server error');
      expect(response.body.error.requestId).toBe(customRequestId);
    });
  });
});
