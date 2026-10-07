import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "development",
    release: process.env.RELEASE_SHA || process.env.NEXT_PUBLIC_RELEASE_SHA || process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
}
