import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';

const BACKUP_SCRIPT = 'deploy/bin/god-backup';
const VALID_AGE_KEY = 'age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p';

const runBackup = (args, extraEnv = {}) => {
  return new Promise((resolveResult) => {
    const env = {
      ...process.env,
      DRY_RUN: '1',
      DATABASE_URL: 'mongodb://localhost:27017/test_god',
      ...extraEnv,
    };

    execFile('bash', [BACKUP_SCRIPT, ...args], { env }, (error, stdout, stderr) => {
      resolveResult({
        exitCode: error ? (error.code ?? 1) : 0,
        stdout: stdout.toString().trim(),
        stderr: stderr.toString().trim(),
      });
    });
  });
};

test('god-backup: displays help on --help', async () => {
  const res = await runBackup(['--help']);
  assert.equal(res.exitCode, 0);
  assert.match(res.stdout, /Usage: god-backup/);
});

test('god-backup: rejects unknown options', async () => {
  const res = await runBackup(['--unknown-flag']);
  assert.notEqual(res.exitCode, 0);
  assert.match(res.stderr, /Unknown option: --unknown-flag/);
});

test('god-backup: rejects invalid age public key format', async () => {
  const res = await runBackup(['--recipient', 'not-a-valid-age-key']);
  assert.notEqual(res.exitCode, 0);
  assert.match(res.stderr, /Invalid age public key format/);
});

test('god-backup: dry-run plan includes encryption and upload', async () => {
  const res = await runBackup([
    '--dry-run',
    '--recipient', VALID_AGE_KEY,
    '--env', 'staging',
    '--bucket', 'custom-r2-bucket',
    '--heartbeat', 'https://betterstack.com/ping/abc',
  ]);

  assert.equal(res.exitCode, 0);
  assert.match(res.stdout, /\[DRY-RUN\] mongodump --config=/);
  assert.match(res.stdout, /custom-r2-bucket/);
  assert.match(res.stdout, /https:\/\/betterstack\.com\/ping\/abc/);
});

test('god-backup: dry-run with --no-upload skips remote sync', async () => {
  const res = await runBackup([
    '--dry-run',
    '--recipient', VALID_AGE_KEY,
    '--no-upload',
  ]);

  assert.equal(res.exitCode, 0);
  assert.doesNotMatch(res.stdout, /Upload to s3:/);
});
