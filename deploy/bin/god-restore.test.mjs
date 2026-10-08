import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';

const RESTORE_SCRIPT = 'deploy/bin/god-restore';

const runRestore = (args, extraEnv = {}) => {
  return new Promise((resolveResult) => {
    const env = {
      ...process.env,
      DRY_RUN: '1',
      ...extraEnv,
    };

    execFile('bash', [RESTORE_SCRIPT, ...args], { env }, (error, stdout, stderr) => {
      resolveResult({
        exitCode: error ? (error.code ?? 1) : 0,
        stdout: stdout.toString().trim(),
        stderr: stderr.toString().trim(),
      });
    });
  });
};

test('god-restore: displays help on --help', async () => {
  const res = await runRestore(['--help']);
  assert.equal(res.exitCode, 0);
  assert.match(res.stdout, /Usage: god-restore/);
});

test('god-restore: rejects execution when --archive is missing', async () => {
  const res = await runRestore(['--identity', '/tmp/id.txt']);
  assert.notEqual(res.exitCode, 0);
  assert.match(res.stderr, /--archive is required/);
});

test('god-restore: rejects execution when --identity is missing', async () => {
  const res = await runRestore(['--archive', '/tmp/dump.age']);
  assert.notEqual(res.exitCode, 0);
  assert.match(res.stderr, /--identity private key file is required/);
});

test('god-restore: refuses to overwrite production database without safety flag', async () => {
  const res = await runRestore([
    '--dry-run',
    '--archive', '/tmp/dump.age',
    '--identity', '/tmp/id.txt',
    '--target-uri', 'mongodb+srv://admin:secret@kredibble-cluster.mongodb.net/production',
  ]);

  assert.notEqual(res.exitCode, 0);
  assert.match(res.stderr, /TARGET IS DETECTED AS PRODUCTION/);
  assert.match(res.stderr, /--i-understand-this-overwrites-production/);
});

test('god-restore: permits production restore when safety flag is explicitly supplied', async () => {
  const res = await runRestore([
    '--dry-run',
    '--archive', '/tmp/dump.age',
    '--identity', '/tmp/id.txt',
    '--target-uri', 'mongodb+srv://admin:secret@kredibble-cluster.mongodb.net/production',
    '--i-understand-this-overwrites-production',
  ]);

  assert.equal(res.exitCode, 0);
  assert.match(res.stdout, /Target verified/);
  assert.match(res.stdout, /\[DRY-RUN\] age -d -i/);
});

test('god-restore: permits restore into isolated database without production flag', async () => {
  const res = await runRestore([
    '--dry-run',
    '--archive', '/tmp/dump.age',
    '--identity', '/tmp/id.txt',
    '--target-uri', 'mongodb://localhost:27017/local_dev',
    '--target-db', 'restore_drill_isolated',
  ]);

  assert.equal(res.exitCode, 0);
  assert.match(res.stdout, /Target verified/);
  assert.match(res.stdout, /restore_drill_isolated/);
});
