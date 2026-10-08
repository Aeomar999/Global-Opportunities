#!/usr/bin/env node

/**
 * Deployment Smoke Test Runner (SEC-115, D2)
 *
 * Verifies post-deployment API health:
 * 1. Health check (/api/v1/health) matches expected release SHA and environment.
 * 2. Public read endpoint returns HTTP 200.
 * 3. CORS preflight permits admin origin requests.
 *
 * Usage:
 *   node scripts/smoke.mjs <baseUrl> <expectedSha> [expectedEnv]
 *
 * Environment variable overrides:
 *   SMOKE_BASE_URL, SMOKE_RELEASE_SHA, SMOKE_ENV, SMOKE_ADMIN_ORIGIN
 */

import { pathToFileURL } from 'node:url';

/**
 * Normalizes and compares release SHAs (supporting 7-char short or 40-char full SHAs).
 * @param {string} actual
 * @param {string} expected
 * @returns {boolean}
 */
export function matchReleaseSha(actual, expected) {
  if (!actual || !expected) return false;
  const cleanActual = actual.trim().toLowerCase();
  const cleanExpected = expected.trim().toLowerCase();
  return cleanActual === cleanExpected ||
    cleanActual.startsWith(cleanExpected) ||
    cleanExpected.startsWith(cleanActual);
}

/**
 * Resolves the admin origin corresponding to the target environment.
 * @param {string} [env]
 * @returns {string}
 */
export function getAdminOriginForEnv(env) {
  switch (env) {
    case 'staging':
      return 'https://staging.admin.globalopportunitydesk.com';
    case 'development':
      return 'http://localhost:3000';
    case 'production':
    default:
      return 'https://admin.globalopportunitydesk.com';
  }
}

/**
 * Executes the smoke test suite.
 * @param {object} options
 * @param {string} options.baseUrl
 * @param {string} options.expectedSha
 * @param {string} [options.expectedEnv]
 * @param {string} [options.adminOrigin]
 * @param {typeof fetch} [options.fetchFn]
 * @returns {Promise<{ success: boolean, results: Array<{ step: string, passed: boolean, message: string }> }>}
 */
export async function runSmokeTest({
  baseUrl,
  expectedSha,
  expectedEnv,
  adminOrigin,
  fetchFn = globalThis.fetch,
}) {
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  const targetAdminOrigin = adminOrigin || getAdminOriginForEnv(expectedEnv);
  const results = [];

  console.log(`[smoke] Starting smoke test against ${cleanBaseUrl}`);
  console.log(`[smoke] Target release SHA: ${expectedSha}`);
  if (expectedEnv) console.log(`[smoke] Target environment: ${expectedEnv}`);
  console.log(`[smoke] Testing CORS origin: ${targetAdminOrigin}\n`);

  // Step 1: Health check
  try {
    const healthUrl = `${cleanBaseUrl}/api/v1/health`;
    console.log(`[smoke] 1/3 Checking ${healthUrl}...`);
    const healthRes = await fetchFn(healthUrl, { method: 'GET', headers: { 'Accept': 'application/json' } });

    if (!healthRes.ok) {
      throw new Error(`Health check returned HTTP ${healthRes.status} ${healthRes.statusText}`);
    }

    const healthData = await healthRes.json();
    if (healthData.status !== 'ok' && healthData.status !== 'degraded') {
      throw new Error(`Unexpected health status: "${healthData.status}"`);
    }

    if (!matchReleaseSha(healthData.release, expectedSha)) {
      throw new Error(`Release SHA mismatch: expected "${expectedSha}", received "${healthData.release}"`);
    }

    if (expectedEnv && healthData.environment !== expectedEnv) {
      throw new Error(`Environment mismatch: expected "${expectedEnv}", received "${healthData.environment}"`);
    }

    results.push({
      step: 'health',
      passed: true,
      message: `Health check passed (status: ${healthData.status}, release: ${healthData.release}, env: ${healthData.environment})`,
    });
    console.log(`[smoke] ✓ Health check verified`);
  } catch (err) {
    results.push({ step: 'health', passed: false, message: err.message });
    console.error(`[smoke] ✗ Health check failed: ${err.message}`);
    return { success: false, results };
  }

  // Step 2: Public data read
  try {
    const publicUrl = `${cleanBaseUrl}/api/v1/opportunities?limit=1`;
    console.log(`[smoke] 2/3 Checking public read at ${publicUrl}...`);
    const publicRes = await fetchFn(publicUrl, { method: 'GET', headers: { 'Accept': 'application/json' } });

    if (!publicRes.ok) {
      throw new Error(`Public read returned HTTP ${publicRes.status} ${publicRes.statusText}`);
    }

    results.push({
      step: 'public_read',
      passed: true,
      message: `Public read endpoint accessible (HTTP ${publicRes.status})`,
    });
    console.log(`[smoke] ✓ Public read verified`);
  } catch (err) {
    results.push({ step: 'public_read', passed: false, message: err.message });
    console.error(`[smoke] ✗ Public read failed: ${err.message}`);
    return { success: false, results };
  }

  // Step 3: CORS preflight
  try {
    const preflightUrl = `${cleanBaseUrl}/api/v1/auth/me`;
    console.log(`[smoke] 3/3 Checking CORS preflight at ${preflightUrl}...`);
    const corsRes = await fetchFn(preflightUrl, {
      method: 'OPTIONS',
      headers: {
        'Origin': targetAdminOrigin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });

    if (corsRes.status !== 200 && corsRes.status !== 204) {
      throw new Error(`CORS preflight returned HTTP ${corsRes.status} ${corsRes.statusText}`);
    }

    const allowOrigin = corsRes.headers.get('access-control-allow-origin');
    if (allowOrigin !== targetAdminOrigin && allowOrigin !== '*') {
      throw new Error(`CORS allow-origin mismatch: expected "${targetAdminOrigin}", received "${allowOrigin}"`);
    }

    results.push({
      step: 'cors_preflight',
      passed: true,
      message: `CORS preflight successful for origin ${targetAdminOrigin}`,
    });
    console.log(`[smoke] ✓ CORS preflight verified`);
  } catch (err) {
    results.push({ step: 'cors_preflight', passed: false, message: err.message });
    console.error(`[smoke] ✗ CORS preflight failed: ${err.message}`);
    return { success: false, results };
  }

  console.log('\n[smoke] All deployment smoke tests PASSED.');
  return { success: true, results };
}

// CLI entry point
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const baseUrl = process.argv[2] || process.env.SMOKE_BASE_URL;
  const expectedSha = process.argv[3] || process.env.SMOKE_RELEASE_SHA;
  const expectedEnv = process.argv[4] || process.env.SMOKE_ENV;
  const adminOrigin = process.env.SMOKE_ADMIN_ORIGIN;

  if (!baseUrl || !expectedSha) {
    console.error('Usage: node scripts/smoke.mjs <baseUrl> <expectedSha> [expectedEnv]');
    process.exit(1);
  }

  runSmokeTest({ baseUrl, expectedSha, expectedEnv, adminOrigin })
    .then(({ success }) => {
      process.exit(success ? 0 : 1);
    })
    .catch((err) => {
      console.error(`[smoke] Fatal error: ${err.message}`);
      process.exit(1);
    });
}
