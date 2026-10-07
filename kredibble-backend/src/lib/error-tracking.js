import * as Sentry from '@sentry/node';

let isInitialized = false;

/**
 * Sanitizes Sentry event payload before sending to strip PII and credentials.
 * Ensures cookies, authorization tokens, and request bodies are never leaked.
 *
 * @param {import('@sentry/node').Event} event - Raw Sentry event
 * @param {import('@sentry/node').EventHint} [_hint] - Event metadata hint
 * @returns {import('@sentry/node').Event | null} Sanitized event or null if dropped
 */
export function sanitizeSentryEvent(event, _hint) {
  if (!event) return null;

  try {
    if (event.request) {
      delete event.request.cookies;
      delete event.request.data;

      if (event.request.headers) {
        delete event.request.headers.cookie;
        delete event.request.headers.authorization;
        delete event.request.headers['x-api-key'];
        delete event.request.headers['proxy-authorization'];

        for (const headerKey of Object.keys(event.request.headers)) {
          const lowerKey = headerKey.toLowerCase();
          if (
            lowerKey.includes('cookie') ||
            lowerKey.includes('auth') ||
            lowerKey.includes('token') ||
            lowerKey.includes('secret')
          ) {
            delete event.request.headers[headerKey];
          }
        }
      }
    }

    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
      delete event.user.username;
    }
  } catch {
    // Sanitization must never throw or break error reporting
  }

  return event;
}

/**
 * Initializes Sentry error tracking for the backend service.
 * Respects APP_ENV, RELEASE_SHA, and disables default PII collection.
 *
 * @param {object} [options] - Optional overrides for testing
 * @returns {boolean} True if initialized, false otherwise
 */
export function initErrorTracking(options = {}) {
  if (isInitialized && !options.force) {
    return true;
  }

  const dsn = options.dsn ?? process.env.SENTRY_DSN;
  const nodeEnv = process.env.NODE_ENV || 'development';
  const appEnv = options.environment ?? process.env.APP_ENV ?? (nodeEnv === 'production' ? 'production' : 'development');
  const release = options.release ?? process.env.RELEASE_SHA ?? process.env.RENDER_GIT_COMMIT ?? 'unknown';

  // Do not initialize Sentry in test unless explicitly forced with a test DSN
  if (nodeEnv === 'test' && !options.force) {
    return false;
  }

  if (!dsn) {
    return false;
  }

  const sampleRate = options.sampleRate ?? 1.0;
  const tracesSampleRate = options.tracesSampleRate ?? (
    process.env.SENTRY_TRACES_SAMPLE_RATE
      ? parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE)
      : (nodeEnv === 'production' ? 0.1 : 1.0)
  );

  Sentry.init({
    dsn,
    environment: appEnv,
    release,
    sendDefaultPii: false,
    sampleRate,
    tracesSampleRate,
    beforeSend: sanitizeSentryEvent,
    ...options.sentryOptions,
  });

  isInitialized = true;
  return true;
}

/**
 * Checks if Sentry error tracking is currently initialized and enabled.
 *
 * @returns {boolean}
 */
export function isErrorTrackingEnabled() {
  return isInitialized;
}

/**
 * Captures an exception in Sentry with contextual tags, including requestId.
 *
 * @param {Error|unknown} error - Error to capture
 * @param {object} [context] - Execution context
 * @param {string} [context.requestId] - Unique request ID
 * @param {import('express').Request} [context.req] - Express request object
 * @param {Record<string, unknown>} [context.extra] - Additional context fields
 * @returns {string|undefined} Sentry event ID
 */
export function captureException(error, context = {}) {
  const requestId =
    context.requestId ||
    context.req?.auditContext?.requestId ||
    context.req?.headers?.['x-request-id'] ||
    context.req?.id;

  return Sentry.withScope((scope) => {
    if (requestId) {
      scope.setTag('requestId', requestId);
    }

    if (context.req) {
      scope.setExtra('method', context.req.method);
      scope.setExtra('url', context.req.originalUrl || context.req.url);
    }

    if (context.extra) {
      for (const [key, value] of Object.entries(context.extra)) {
        scope.setExtra(key, value);
      }
    }

    return Sentry.captureException(error);
  });
}

/**
 * Captures an informational or warning message in Sentry tagged with requestId.
 *
 * @param {string} message - Message text
 * @param {'fatal'|'error'|'warning'|'log'|'info'|'debug'} [level='info'] - Severity level
 * @param {object} [context] - Context containing requestId or req
 * @returns {string|undefined} Sentry event ID
 */
export function captureMessage(message, level = 'info', context = {}) {
  const requestId =
    context.requestId ||
    context.req?.auditContext?.requestId ||
    context.req?.headers?.['x-request-id'] ||
    context.req?.id;

  return Sentry.withScope((scope) => {
    if (requestId) {
      scope.setTag('requestId', requestId);
    }
    scope.setLevel(level);
    return Sentry.captureMessage(message);
  });
}

/**
 * Configures Sentry error handler on the Express app if Sentry is initialized.
 *
 * @param {import('express').Application} app - Express application
 */
export function setupSentryErrorHandler(app) {
  if (isInitialized) {
    Sentry.setupExpressErrorHandler(app);
  }
}
