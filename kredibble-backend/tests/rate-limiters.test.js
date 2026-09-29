import { jest } from '@jest/globals';
import {
  createRedisStoreWithFallback,
  extractRedisKey,
} from '../src/lib/rate-limiters.js';

/**
 * Regression tests for the Redis rate-limit store (SEC-024).
 *
 * The original `sendCommand` validated the shape of the Redis reply to detect a
 * misbehaving server, and used the wrong positional argument as the fallback
 * counter key. Both defects were invisible because the store had no tests and
 * `sendCommand` was unreachable from outside the module.
 *
 * rate-limit-redis spreads its command array into `sendCommand`, so these tests
 * assert the real command shapes taken from node_modules/rate-limit-redis.
 */

const EVALSHA = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
const WINDOW_MS = 900_000;

const incrementCommand = (key) => ['EVALSHA', EVALSHA, '1', key, String(WINDOW_MS)];
const getCommand = (key) => ['EVALSHA', EVALSHA, '1', key];
const delCommand = (key) => ['DEL', key];

/**
 * Minimal stand-in for ioredis that speaks the command shapes rate-limit-redis
 * actually issues: SCRIPT LOAD returns a string sha, EVALSHA returns the
 * [totalHits, timeToExpire] array the library's Lua script produces.
 */
const healthyRedis = (hits = []) => {
  const call = jest.fn(async (...args) => {
    const [command, payload] = args;
    if (command === 'SCRIPT' && payload === 'LOAD') return EVALSHA;
    if (command === 'EVALSHA') {
      const key = args[3];
      const count = (hits[key] ?? 0) + 1;
      hits[key] = count;
      return [count, WINDOW_MS];
    }
    if (command === 'DEL' || command === 'DECR') return 1;
    return null;
  });
  return { call };
};

describe('extractRedisKey', () => {
  it('reads the key from the EVALSHA increment command', () => {
    expect(extractRedisKey(incrementCommand('rl:auth:1.2.3.4'))).toBe('rl:auth:1.2.3.4');
  });

  it('reads the key from the EVALSHA get command', () => {
    expect(extractRedisKey(getCommand('rl:search:5.6.7.8'))).toBe('rl:search:5.6.7.8');
  });

  it('reads the key from DEL and DECR, where it is the second argument', () => {
    expect(extractRedisKey(delCommand('rl:upload:9.9.9.9'))).toBe('rl:upload:9.9.9.9');
    expect(extractRedisKey(['DECR', 'rl:upload:9.9.9.9'])).toBe('rl:upload:9.9.9.9');
  });

  it('returns an empty key for SCRIPT LOAD, which takes no key', () => {
    expect(extractRedisKey(['SCRIPT', 'LOAD', 'return {1, 1000}'])).toBe('');
  });

  it('returns an empty key for an EVALSHA that declares zero keys', () => {
    expect(extractRedisKey(['EVALSHA', EVALSHA, '0'])).toBe('');
  });

  it('does not mistake the script SHA for the client key', () => {
    // Regression: the old code used args[1] unconditionally, which for EVALSHA
    // is the script SHA. Every client would share one fallback counter, turning
    // a per-IP limit into a global one.
    expect(extractRedisKey(incrementCommand('rl:auth:1.2.3.4'))).not.toBe(EVALSHA);
  });

  it('tolerates malformed input rather than throwing', () => {
    expect(extractRedisKey(undefined)).toBe('');
    expect(extractRedisKey([])).toBe('');
    expect(extractRedisKey(['DEL'])).toBe('');
  });
});

describe('createRedisStoreWithFallback', () => {
  it('counts through Redis and does NOT degrade on a healthy array reply', async () => {
    // Regression: the old code treated `Array.isArray(result) && result[0] !== null`
    // as a misbehaviour signal. A successful EVALSHA reply is exactly that shape,
    // so the limiter flipped to in-process counters on its first request and
    // every later call bypassed Redis entirely.
    const redis = healthyRedis();
    const store = createRedisStoreWithFallback({ client: redis, prefix: 'auth', windowMs: WINDOW_MS });
    await store.init({ windowMs: WINDOW_MS });

    const first = await store.increment('1.2.3.4');
    const second = await store.increment('1.2.3.4');
    const other = await store.increment('5.6.7.8');

    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);
    expect(other.totalHits).toBe(1);

    const evalshaCalls = redis.call.mock.calls.filter(([c]) => c === 'EVALSHA');
    expect(evalshaCalls).toHaveLength(3);
  });

  it('keeps separate budgets per client', async () => {
    const redis = healthyRedis();
    const store = createRedisStoreWithFallback({ client: redis, prefix: 'auth', windowMs: WINDOW_MS });
    await store.init({ windowMs: WINDOW_MS });

    await store.increment('1.2.3.4');
    await store.increment('1.2.3.4');
    const other = await store.increment('5.6.7.8');

    expect(other.totalHits).toBe(1);
  });

  it('falls back to per-client in-process counters when Redis throws', async () => {
    // Succeed for SCRIPT LOAD so the store initialises, then fail the EVALSHA.
    const call = jest.fn(async (...args) => {
      if (args[0] === 'SCRIPT' && args[1] === 'LOAD') return EVALSHA;
      throw new Error("Stream isn't writeable and sendCommand failed");
    });
    const store = createRedisStoreWithFallback({ client: { call }, prefix: 'auth', windowMs: WINDOW_MS });
    await store.init({ windowMs: WINDOW_MS });

    // The fallback must count per client, not globally. Under the old args[1]
    // bug every client incremented the script-SHA counter together.
    const a1 = await store.increment('1.2.3.4');
    const a2 = await store.increment('1.2.3.4');
    const b1 = await store.increment('5.6.7.8');

    expect(a1.totalHits).toBe(1);
    expect(a2.totalHits).toBe(2);
    expect(b1.totalHits).toBe(1);
  });

  it('isolates fallback counters per limiter prefix', async () => {
    const call = jest.fn(async (...args) => {
      if (args[0] === 'SCRIPT' && args[1] === 'LOAD') return EVALSHA;
      throw new Error('ECONNREFUSED');
    });
    const auth = createRedisStoreWithFallback({ client: { call }, prefix: 'auth', windowMs: WINDOW_MS });
    await auth.init({ windowMs: WINDOW_MS });
    const search = createRedisStoreWithFallback({ client: { call }, prefix: 'search', windowMs: WINDOW_MS });
    await search.init({ windowMs: WINDOW_MS });

    // Same raw client key, different limiter: must not share a budget.
    // The fallback map is process-global and intentionally shared across every
    // limiter, so each test uses its own client key to stay independent.
    const authHit = await auth.increment('10.0.0.1');
    const searchHit = await search.increment('10.0.0.1');

    expect(authHit.totalHits).toBe(1);
    expect(searchHit.totalHits).toBe(1);
  });

  it('keeps a separate fallback budget for the same key in a different window', async () => {
    const call = jest.fn(async (...args) => {
      if (args[0] === 'SCRIPT' && args[1] === 'LOAD') return EVALSHA;
      throw new Error('ECONNREFUSED');
    });
    const auth = createRedisStoreWithFallback({ client: { call }, prefix: 'auth', windowMs: 900_000 });
    await auth.init({ windowMs: 900_000 });
    const passwordReset = createRedisStoreWithFallback({ client: { call }, prefix: 'password-reset', windowMs: 3_600_000 });
    await passwordReset.init({ windowMs: 3_600_000 });

    expect((await auth.increment('10.0.0.2')).totalHits).toBe(1);
    expect((await passwordReset.increment('10.0.0.2')).totalHits).toBe(1);
  });

  it('clears the counter on resetKey instead of raising it', async () => {
    // Regression: the degraded path routed every verb through increment, so a
    // DEL (used by resetKey, e.g. after a successful login) would *increase*
    // the counter and lock a legitimate client out.
    const call = jest.fn(async (...args) => {
      if (args[0] === 'SCRIPT' && args[1] === 'LOAD') return EVALSHA;
      throw new Error('ECONNREFUSED');
    });
    const store = createRedisStoreWithFallback({ client: { call }, prefix: 'auth', windowMs: WINDOW_MS });
    await store.init({ windowMs: WINDOW_MS });

    await store.increment('10.0.0.3');
    await store.increment('10.0.0.3');
    expect((await store.increment('10.0.0.3')).totalHits).toBe(3);

    await store.resetKey('10.0.0.3');

    expect((await store.increment('10.0.0.3')).totalHits).toBe(1);
  });

  it('refunds a hit on decrement instead of charging another one', async () => {
    const call = jest.fn(async (...args) => {
      if (args[0] === 'SCRIPT' && args[1] === 'LOAD') return EVALSHA;
      throw new Error('ECONNREFUSED');
    });
    const store = createRedisStoreWithFallback({ client: { call }, prefix: 'api', windowMs: WINDOW_MS });
    await store.init({ windowMs: WINDOW_MS });

    await store.increment('10.0.0.4');
    await store.increment('10.0.0.4');
    expect((await store.increment('10.0.0.4')).totalHits).toBe(3);

    // express-rate-limit calls decrement when a request is not actually
    // limited (a successful, uncounted request such as an options() probe).
    await store.decrement('10.0.0.4');

    expect((await store.increment('10.0.0.4')).totalHits).toBe(3);
  });

  it('serves the script sha in the degraded path so init can complete', async () => {
    const call = jest.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    const store = createRedisStoreWithFallback({ client: { call }, prefix: 'auth', windowMs: WINDOW_MS });

    await expect(store.init({ windowMs: WINDOW_MS })).resolves.toBeUndefined();
  });
});
