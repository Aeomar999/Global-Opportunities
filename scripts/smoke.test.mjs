import test from 'node:test';
import assert from 'node:assert/strict';
import { matchReleaseSha, getAdminOriginForEnv, runSmokeTest } from './smoke.mjs';

test('matchReleaseSha: matches identical, short, and prefix SHAs', () => {
  const fullSha = 'ba9c64e495983dc8931eea5aa3b3303a6d7cc241';
  const shortSha = 'ba9c64e';

  assert.equal(matchReleaseSha(fullSha, fullSha), true);
  assert.equal(matchReleaseSha(fullSha, shortSha), true);
  assert.equal(matchReleaseSha(shortSha, fullSha), true);
  assert.equal(matchReleaseSha(fullSha, '1111111'), false);
  assert.equal(matchReleaseSha('', fullSha), false);
  assert.equal(matchReleaseSha(fullSha, null), false);
});

test('getAdminOriginForEnv: resolves origins per environment', () => {
  assert.equal(getAdminOriginForEnv('staging'), 'https://staging-admin.globalopportunitydesk.com');
  assert.equal(getAdminOriginForEnv('development'), 'http://localhost:3000');
  assert.equal(getAdminOriginForEnv('production'), 'https://admin.globalopportunitydesk.com');
  assert.equal(getAdminOriginForEnv(undefined), 'https://admin.globalopportunitydesk.com');
});

test('runSmokeTest: succeeds when all endpoints pass', async () => {
  const targetSha = 'ba9c64e495983dc8931eea5aa3b3303a6d7cc241';
  const targetEnv = 'staging';

  const mockFetch = async (url, options = {}) => {
    if (url.includes('/api/v1/health')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          status: 'ok',
          environment: targetEnv,
          release: targetSha,
          database: 'connected',
        }),
      };
    }

    if (url.includes('/api/v1/opportunities')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ data: [] }),
      };
    }

    if (url.includes('/api/v1/auth/me') && options.method === 'OPTIONS') {
      return {
        ok: true,
        status: 204,
        statusText: 'No Content',
        headers: new Headers({
          'access-control-allow-origin': 'https://staging-admin.globalopportunitydesk.com',
          'access-control-allow-methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
        }),
      };
    }

    throw new Error(`Unhandled URL in mock: ${url}`);
  };

  const outcome = await runSmokeTest({
    baseUrl: 'https://staging-api.globalopportunitydesk.com',
    expectedSha: targetSha,
    expectedEnv: targetEnv,
    fetchFn: mockFetch,
  });

  assert.equal(outcome.success, true);
  assert.equal(outcome.results.length, 3);
  assert.equal(outcome.results.every((r) => r.passed), true);
});

test('runSmokeTest: fails if release SHA does not match', async () => {
  const mockFetch = async (url) => {
    if (url.includes('/api/v1/health')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          status: 'ok',
          environment: 'staging',
          release: 'old_commit_sha_123',
        }),
      };
    }
    return { ok: true, status: 200 };
  };

  const outcome = await runSmokeTest({
    baseUrl: 'https://staging-api.globalopportunitydesk.com',
    expectedSha: 'expected_new_sha_456',
    expectedEnv: 'staging',
    fetchFn: mockFetch,
  });

  assert.equal(outcome.success, false);
  assert.match(outcome.results[0].message, /Release SHA mismatch/);
});

test('runSmokeTest: fails if environment does not match', async () => {
  const mockFetch = async (url) => {
    if (url.includes('/api/v1/health')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          status: 'ok',
          environment: 'development',
          release: 'matching_sha',
        }),
      };
    }
    return { ok: true, status: 200 };
  };

  const outcome = await runSmokeTest({
    baseUrl: 'https://staging-api.globalopportunitydesk.com',
    expectedSha: 'matching_sha',
    expectedEnv: 'staging',
    fetchFn: mockFetch,
  });

  assert.equal(outcome.success, false);
  assert.match(outcome.results[0].message, /Environment mismatch/);
});

test('runSmokeTest: fails if public read returns HTTP 500', async () => {
  const mockFetch = async (url) => {
    if (url.includes('/api/v1/health')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          status: 'ok',
          environment: 'staging',
          release: 'matching_sha',
        }),
      };
    }
    if (url.includes('/api/v1/opportunities')) {
      return {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      };
    }
    return { ok: true, status: 200 };
  };

  const outcome = await runSmokeTest({
    baseUrl: 'https://staging-api.globalopportunitydesk.com',
    expectedSha: 'matching_sha',
    expectedEnv: 'staging',
    fetchFn: mockFetch,
  });

  assert.equal(outcome.success, false);
  assert.equal(outcome.results[1].passed, false);
  assert.match(outcome.results[1].message, /HTTP 500/);
});

test('runSmokeTest: fails if CORS preflight rejects origin', async () => {
  const mockFetch = async (url, options = {}) => {
    if (url.includes('/api/v1/health')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          status: 'ok',
          environment: 'staging',
          release: 'matching_sha',
        }),
      };
    }
    if (url.includes('/api/v1/opportunities')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ data: [] }),
      };
    }
    if (url.includes('/api/v1/auth/me') && options.method === 'OPTIONS') {
      return {
        ok: true,
        status: 204,
        headers: new Headers({
          'access-control-allow-origin': 'https://different-origin.com',
        }),
      };
    }
    return { ok: true, status: 200 };
  };

  const outcome = await runSmokeTest({
    baseUrl: 'https://staging-api.globalopportunitydesk.com',
    expectedSha: 'matching_sha',
    expectedEnv: 'staging',
    fetchFn: mockFetch,
  });

  assert.equal(outcome.success, false);
  assert.equal(outcome.results[2].passed, false);
  assert.match(outcome.results[2].message, /CORS allow-origin mismatch/);
});
