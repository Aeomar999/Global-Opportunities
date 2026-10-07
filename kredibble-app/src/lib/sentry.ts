import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';

/**
 * Initializes Sentry for mobile error tracking and performance monitoring.
 * Binds environment to current EAS update channel and scrubs PII from events.
 */
export function initMobileErrorTracking(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return;
  }

  const environment = Updates.channel || (process.env.NODE_ENV === 'production' ? 'production' : 'development');

  Sentry.init({
    dsn,
    environment,
    sendDefaultPii: false,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.cookie;
          delete event.request.headers.authorization;
        }
      }
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
        delete event.user.username;
      }
      return event;
    },
  });
}

export { Sentry };
