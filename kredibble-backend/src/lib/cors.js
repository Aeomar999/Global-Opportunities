/**
 * Single source of truth for "which origins may talk to this API" (SEC-004, SEC-022).
 *
 * Both the Express app and the Socket.io server import from here. Previously the
 * socket server hardcoded `origin: "*"` while Express used its own list, so the
 * realtime transport accepted connections from anywhere the HTTP API rejected.
 *
 * The deploy allowlist is explicit rather than a wildcard. `*.vercel.app` and
 * `*.onrender.com` are multi-tenant: any other tenant can publish an app on those
 * domains, and a wildcard would let a stranger's deployment issue credentialed
 * cross-origin requests against this API (SEC-022). List your own hostnames.
 */

import { env } from '../config/env.js';

// Loopback, the Android emulator host alias, and RFC1918 ranges for physical
// device testing on a LAN. Development only.
const LOCAL_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

// Expo Go and the custom-scheme native client send a non-http origin.
const NATIVE_ORIGIN = /^(exp:\/\/|kredibbleapp:\/\/)/;

export const isAllowedOrigin = (origin) => {
  // Native and server-to-server clients send no Origin header; CORS does not
  // apply to them, so there is nothing to allow or deny here.
  if (!origin) return true;

  // Explicit operator-supplied list: the real allowlist.
  if (env.corsOrigins.includes(origin)) return true;

  if (env.isDevelopment) {
    if (LOCAL_ORIGIN.test(origin)) return true;
    // Sandboxed iframes and file:// pages send the literal string "null".
    if (origin === 'null' || origin === 'file://') return true;
    return false;
  }

  if (NATIVE_ORIGIN.test(origin)) return true;
  // "null" is only trusted in development. In production it is what a sandboxed
  // iframe or a data: URL sends, and accepting it re-opens the wildcard.
  return false;
};

/** Origin list for the Socket.io server, derived from the same authority. */
export const socketCorsOptions = () => ({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin is not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
  credentials: true,
});
