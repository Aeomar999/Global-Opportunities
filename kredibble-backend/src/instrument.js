/**
 * Sentry instrumentation entry point.
 * Loaded via `node --import ./src/instrument.js` before any other module executes,
 * ensuring early OpenTelemetry and runtime error capture.
 */
import { initErrorTracking } from './lib/error-tracking.js';

initErrorTracking();
