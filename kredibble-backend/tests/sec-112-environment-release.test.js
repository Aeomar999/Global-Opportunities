import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import request from 'supertest';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';

// A complete production configuration with obviously fake values, so env.js passes its boot checks.
const PRODUCTION_ENV = {
  NODE_ENV: 'production',
  JWT_SECRET: 'a'.repeat(64),
  ADMIN_JWT_SECRET: 'b'.repeat(64),
  DATABASE_URL: 'mongodb://127.0.0.1:27017/kredibble-config-test',
  CORS_ORIGIN: 'https://admin.example.com',
};

// Run from an empty temp dir so dotenv can't load the developer's .env (same approach as the SEC-006 tests).
const emptyCwd = mkdtempSync(join(tmpdir(), 'kredibble-env-'));
const envModuleUrl = pathToFileURL(resolve(process.cwd(), 'src/config/env.js')).href;

/** Loads src/config/env.js in a child process with exactly `vars` and returns what it resolved. */
const bootConfig = (vars) => {
  const script = `const { env } = await import(${JSON.stringify(envModuleUrl)});
console.log(JSON.stringify({ appEnv: env.appEnv, release: env.release }));`;
  try {
    const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: emptyCwd,
      env: { PATH: process.env.PATH, ...vars },
      stdio: 'pipe',
      encoding: 'utf8',
    });
    return { ok: true, ...JSON.parse(stdout.trim().split('\n').pop()) };
  } catch (error) {
    return { ok: false, stderr: String(error.stderr || '') };
  }
};

describe('SEC-112: the API reports which environment and release it is', () => {
  it('reports both on the health check', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.statusCode).toBe(200);
    expect(res.body.environment).toBe(env.appEnv);
    expect(['development', 'test', 'staging', 'production']).toContain(res.body.environment);
    expect(res.body.release).toBe(env.release);
    expect(res.body.release.length).toBeGreaterThan(0);
  });

  it('defaults to production when NODE_ENV=production and APP_ENV is unset (today\'s Render service)', () => {
    expect(bootConfig(PRODUCTION_ENV)).toMatchObject({ ok: true, appEnv: 'production' });
  });

  it('runs staging with production code paths', () => {
    expect(bootConfig({ ...PRODUCTION_ENV, APP_ENV: 'staging' })).toMatchObject({ ok: true, appEnv: 'staging' });
  });

  it('refuses an unknown APP_ENV', () => {
    const result = bootConfig({ ...PRODUCTION_ENV, APP_ENV: 'prod' });
    expect(result.ok).toBe(false);
    expect(result.stderr).toContain('APP_ENV must be one of');
  });

  it('refuses a deployed environment without NODE_ENV=production', () => {
    // The SEC-090 compose file left NODE_ENV blank, which would have served a deployed API with
    // development behaviour: Swagger, stack traces in errors, per-process secrets.
    const result = bootConfig({ APP_ENV: 'staging' });
    expect(result.ok).toBe(false);
    expect(result.stderr).toContain('requires NODE_ENV=production');
  });

  it('takes the release from RELEASE_SHA, then RENDER_GIT_COMMIT, else "unknown"', () => {
    expect(bootConfig({ ...PRODUCTION_ENV, RELEASE_SHA: 'abc1234' }).release).toBe('abc1234');
    expect(bootConfig({ ...PRODUCTION_ENV, RELEASE_SHA: '', RENDER_GIT_COMMIT: 'def5678' }).release).toBe('def5678');
    expect(bootConfig(PRODUCTION_ENV).release).toBe('unknown');
  });
});
