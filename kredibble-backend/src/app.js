import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { connectToDatabase } from './lib/mongodb.js';
import { apiRouter } from './routes/index.js';
import { isAllowedOrigin } from './lib/cors.js';
import { ApiError } from './utils/http.js';

const swaggerDocument = JSON.parse(fs.readFileSync(new URL('./swagger.json', import.meta.url)));

const app = express();

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

// SEC-024: global API rate limiter (100 req / 15 min). Disabled in test to avoid
// polluting the route-manifest sweep and other enumeration tests.
const isTest = process.env.NODE_ENV === 'test';
if (!isTest) {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: { message: 'Too many requests, please try again later.' } },
  });
  app.use('/api', limiter);
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

// Add simple URL logging for debugging production 404s
app.use((req, res, next) => {
  if (!env.isDevelopment) {
    console.log(`[Vercel] ${req.method} ${req.url}`);
  }
  next();
});

// 3. Routes
app.get('/', (req, res) => {
  res.json({ message: 'Kredibble API is running', env: env.nodeEnv });
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
app.use('/api', apiRouter);

app.use((req, res) => {
  res.status(404).json({ error: { message: 'Route not found' } });
});

app.use((err, req, res, next) => {
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
  res.status(status).json({
    error: {
      message: err.message || 'Internal server error',
      stack: env.isDevelopment ? err.stack : undefined,
    },
  });
});

export { app };
export default app;
