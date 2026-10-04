import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { signAdminToken } from '../src/middleware/auth.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.resolve(here, '../../kredibble-admin/src/lib/api.ts');
const SAMPLE_ID = '64b7f1c2a1b2c3d4e5f60718';

/**
 * Every `request(...)` / `requestPage(...)` call in the admin client whose
 * path is a literal, as { method, path }. Query-string holes are dropped; any
 * other hole becomes a sample id.
 */
const clientCalls = () => {
  const source = fs.readFileSync(CLIENT, 'utf8');
  const pattern = /\brequest(?:Page)?(?:<[^(]*>)?\(\s*([`"])(\/[^`"]*)\1(?:\s*,\s*\{[^}]*?method:\s*"([A-Z]+)")?/g;
  return [...source.matchAll(pattern)].map(([, , raw, method]) => ({
    method: method || 'GET',
    path: raw.replace(/\$\{(query|queryString)\}/g, '').replace(/\$\{[^}]+\}/g, SAMPLE_ID),
  }));
};

describe('admin client ↔ API contract', () => {
  it('finds the client\'s calls', () => {
    expect(clientCalls().length).toBeGreaterThan(20);
  });

  it('serves every path the admin client calls', async () => {
    const admin = await User.create({ name: 'Contract Admin', email: 'contract@example.com', role: 'admin', passwordHash: 'x' });
    const cookie = `kredibble_admin_token=${signAdminToken(admin)}`;
    const missing = [];

    for (const { method, path: callPath } of clientCalls()) {
      const res = await request(app)[method.toLowerCase()](`/api/v1${callPath}`).set('Cookie', cookie).send({});
      // A missing record is a 404 with the resource's own message; only an unknown route says this.
      if (res.status === 404 && res.body?.error?.message === 'Route not found') missing.push(`${method} ${callPath}`);
    }

    expect(missing).toEqual([]);
  });
});
