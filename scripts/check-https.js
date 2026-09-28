#!/usr/bin/env node
// SEC-016: Build-time HTTPS enforcement check
// Fails the build if API URL is not HTTPS in production

const isProduction = process.env.NODE_ENV === 'production';
const apiUrl = process.env.EXPO_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL;

if (isProduction) {
  if (!apiUrl) {
    console.error('SEC-016 FAIL: No API URL configured in production');
    process.exit(1);
  }
  if (!apiUrl.startsWith('https://')) {
    console.error(`SEC-016 FAIL: API URL must use https:// in production. Got: ${apiUrl}`);
    process.exit(1);
  }
  console.log('SEC-016 OK: API URL uses HTTPS in production');
} else {
  console.log('SEC-016 SKIP: Not in production environment');
}