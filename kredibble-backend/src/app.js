import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { connectToDatabase } from './lib/mongodb.js';
import { createApiRouter } from './routes/index.js';
import { isAllowedOrigin } from './lib/cors.js';
import { globalApiLimiter } from './lib/rate-limiters.js';
import { ApiError } from './utils/http.js';
import { auditContext } from './lib/audit.js';
import logger from './lib/logger.js';

const swaggerDocument = JSON.parse(fs.readFileSync(new URL('./swagger.json', import.meta.url)));

const app = express();
app.set('trust proxy', 1);

const isTest = env.isTest;

// 1. Basic security and CORS (Must be at the top)
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new ApiError(403, 'Origin is not allowed by CORS'));
    },
    credentials: true,
  }),
);

app.use(cookieParser());

// SEC-024: global API rate limiter (100 req / 15 min). Routed through the shared
// factory so the counter lives in Redis in production and holds across replicas.
// Skipped entirely in test to avoid polluting the route-manifest sweep.
if (!isTest) {
  app.use('/api', globalApiLimiter);
}


// 2. Ensure DB connection for serverless environments
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    next(new ApiError(503, `Service Unavailable: Database connection failed. ${error.message}`));
  }
});

app.use(express.json({ limit: '1mb' }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

// SEC-017 + SEC-039: audit context with request ID propagation
app.use(auditContext);

// 3. Routes
app.get('/', (req, res) => {
  res.json({ message: 'Kredibble API is running' });
});

// SEC-014: Swagger only in non-production unless explicitly enabled
if (!env.isProduction || process.env.ENABLE_SWAGGER === 'true') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} else {
  // In production without ENABLE_SWAGGER, return 404 for docs routes
  app.use('/api-docs', (req, res) => res.status(404).json({ error: { message: 'Not found' } }));
}

// SEC-015: the router is mounted exactly once, under /api. It used to be mounted a
// second time at "/" as a "fallback for calls missing the /api prefix", but that
// duplicate mount sat *outside* the rate limiter above, so every endpoint was
// reachable unthrottled via /<resource>. Both clients already call /api
// (kredibble-app/.env and the NEXT_PUBLIC_API_URL default), so the fallback only
// widened the attack surface. It is gone rather than rate-limited twice.
// SEC-019: mount at /api/v1 as primary versioned path with populate enabled
const apiV1Router = createApiRouter({ enablePopulate: true });
app.use('/api/v1', apiV1Router);

// SEC-019 / SEC-095: legacy /api mount with fixed Sunset header and rate-limited deprecation logging
// Uses separate router WITHOUT populate to preserve backward compatibility
const apiLegacyRouter = createApiRouter({ enablePopulate: false });
const FIXED_SUNSET_DATE = new Date('2027-10-01T00:00:00Z').toUTCString();
const deprecatedLogSeen = new Set();

app.use('/api', (req, res, next) => {
  res.set('Deprecation', 'true');
  res.set('Link', '</api/v1>; rel="successor-version"');
  res.set('Sunset', FIXED_SUNSET_DATE);

  // SEC-095: Log deprecation usage once per client per day to prevent logging noise
  const clientDay = `${req.ip}:${new Date().toISOString().slice(0, 10)}`;
  if (!deprecatedLogSeen.has(clientDay)) {
    deprecatedLogSeen.add(clientDay);
    logger.warn({ method: req.method, url: req.originalUrl }, 'Deprecated API endpoint accessed');
    if (deprecatedLogSeen.size > 5000) deprecatedLogSeen.clear();
  }

  next();
});

app.use('/api', apiLegacyRouter);

app.use((req, res) => {
  res.status(404).json({ error: { message: 'Route not found' } });
});

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: { message: 'Uploaded file must be 5MB or smaller' } });
    return;
  }

  if (err.name === 'MulterError') {
    res.status(400).json({ error: { message: err.message } });
    return;
  }

  if (err.code === 'P2025') {
    res.status(404).json({ error: { message: 'Resource not found' } });
    return;
  }

  // Client-input failures must not surface as 5xx. A Mongoose ValidationError
  // (missing required field, bad enum) or a CastError (malformed ObjectId in the
  // path) is a bad request, not a server fault — otherwise bad input pollutes
  // error dashboards and tells callers to retry something that will never work.
  const isBadRequest =
    err.name === 'ValidationError' ||
    err.name === 'CastError' ||
    err.name === 'StrictModeError';

  const status = isBadRequest ? 400 : err.status || 500;
  // SEC-064: Hide internal error messages for 5xx responses in production
  const message = (status >= 500 && !env.isDevelopment)
    ? 'Internal server error'
    : (err.message || 'Internal server error');

  res.status(status).json({
    error: {
      message,
      stack: env.isDevelopment ? err.stack : undefined,
    },
  });
});

export { app };
export default app;