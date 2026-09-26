import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { connectToDatabase } from './lib/mongodb.js';
import { apiRouter } from './routes/index.js';
import { ApiError } from './utils/http.js';

const swaggerDocument = JSON.parse(fs.readFileSync(new URL('./swagger.json', import.meta.url)));

const app = express();

const localDevOriginPattern =
  /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/;


const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (env.corsOrigins.includes(origin)) return true;
  if (env.isDevelopment && localDevOriginPattern.test(origin)) return true;
  if (origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com')) return true;
  // Allow Expo/React Native app origins (no CORS for native apps)
  if (origin.startsWith('exp://') || origin.startsWith('kredibbleapp://')) return true;
  // Allow native app requests (no origin header)
  if (origin === 'null' || origin === 'file://') return true;
  return false;
};

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

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: { message: 'Too many requests, please try again later.' } }
});
app.use('/api', limiter);


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

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use('/api', apiRouter);
// Fallback for calls missing the /api prefix
app.use('/', apiRouter);

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

  const status = err.status || 500;
  res.status(status).json({
    error: {
      message: err.message || 'Internal server error',
      stack: env.isDevelopment ? err.stack : undefined,
    },
  });
});

export { app };
export default app;
