import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';

const GATE_SCRIPT = 'deploy/bin/god-deploy-gate';

/**
 * Executes god-deploy-gate in dry-run mode with given SSH_ORIGINAL_COMMAND.
 * @param {string|undefined} sshOriginalCommand
 * @param {Record<string, string>} [extraEnv]
 * @returns {Promise<{ exitCode: number, stdout: string, stderr: string }>}
 */
const runGate = (sshOriginalCommand, extraEnv = {}) => {
  return new Promise((resolveResult) => {
    const env = {
      ...process.env,
      DRY_RUN: '1',
      WSLENV: 'SSH_ORIGINAL_COMMAND:DRY_RUN:DEPLOY_BIN:GOD_BASE_DIR:ENV_FILE:COMPOSE_FILE',
      ...extraEnv,
    };
    if (sshOriginalCommand !== undefined) {
      env.SSH_ORIGINAL_COMMAND = sshOriginalCommand;
    } else {
      delete env.SSH_ORIGINAL_COMMAND;
    }

    execFile('bash', [GATE_SCRIPT], { env }, (error, stdout, stderr) => {
      resolveResult({
        exitCode: error ? (error.code ?? 1) : 0,
        stdout: stdout.toString().trim(),
        stderr: stderr.toString().trim(),
      });
    });
  });
};

const SAMPLE_SHA = '0123456789abcdef0123456789abcdef01234567';

test('god-deploy-gate: accepts valid deploy commands', async () => {
  for (const envName of ['staging', 'production', 'development']) {
    const res = await runGate(`deploy ${envName} ${SAMPLE_SHA}`);
    assert.equal(res.exitCode, 0, `deploy ${envName} should succeed`);
    assert.match(res.stdout, new RegExp(`VALIDATED: action=deploy env=${envName} sha=${SAMPLE_SHA}`));
  }
});

test('god-deploy-gate: accepts short SHA (7 to 40 hex chars)', async () => {
  const shortSha = 'abc1234';
  const res = await runGate(`deploy staging ${shortSha}`);
  assert.equal(res.exitCode, 0);
  assert.match(res.stdout, new RegExp(`VALIDATED: action=deploy env=staging sha=${shortSha}`));
});

test('god-deploy-gate: accepts valid rollback commands', async () => {
  for (const envName of ['staging', 'production', 'development']) {
    const res = await runGate(`rollback ${envName}`);
    assert.equal(res.exitCode, 0, `rollback ${envName} should succeed`);
    assert.match(res.stdout, new RegExp(`VALIDATED: action=rollback env=${envName} sha=none`));
  }
});

test('god-deploy-gate: accepts valid status commands', async () => {
  for (const envName of ['staging', 'production', 'development']) {
    const res = await runGate(`status ${envName}`);
    assert.equal(res.exitCode, 0, `status ${envName} should succeed`);
    assert.match(res.stdout, new RegExp(`VALIDATED: action=status env=${envName} sha=none`));
  }
});

test('god-deploy-gate: rejects missing or empty SSH_ORIGINAL_COMMAND', async () => {
  const resMissing = await runGate(undefined);
  assert.notEqual(resMissing.exitCode, 0);
  assert.match(resMissing.stderr, /Rejected/i);

  const resEmpty = await runGate('');
  assert.notEqual(resEmpty.exitCode, 0);
  assert.match(resEmpty.stderr, /Rejected/i);
});

test('god-deploy-gate: rejects invalid environments', async () => {
  for (const badEnv of ['test', 'prod', 'qa', 'local', '../root']) {
    const res = await runGate(`deploy ${badEnv} ${SAMPLE_SHA}`);
    assert.notEqual(res.exitCode, 0, `bad env ${badEnv} must fail`);
    assert.match(res.stderr, /Rejected/i);
  }
});

test('god-deploy-gate: rejects invalid SHA formatting', async () => {
  const badShas = ['123', 'not-a-hex-sha!', '1234567890abcdef1234567890abcdef1234567g', SAMPLE_SHA + 'extra'];
  for (const badSha of badShas) {
    const res = await runGate(`deploy staging ${badSha}`);
    assert.notEqual(res.exitCode, 0, `bad sha ${badSha} must fail`);
    assert.match(res.stderr, /Rejected/i);
  }
});

test('god-deploy-gate: rejects command injection attempts', async () => {
  const maliciousCommands = [
    `deploy staging ${SAMPLE_SHA}; rm -rf /`,
    `deploy staging ${SAMPLE_SHA} && whoami`,
    `deploy staging ${SAMPLE_SHA} | sh`,
    `deploy staging $(whoami)`,
    `deploy staging \`whoami\``,
    `rollback staging; reboot`,
    `status staging && cat /etc/passwd`,
    `cat /etc/shadow`,
    `/bin/bash`,
    `sh`,
    `deploy staging ${SAMPLE_SHA} > /tmp/out`,
    `deploy staging ${SAMPLE_SHA} < /tmp/in`,
  ];

  for (const cmd of maliciousCommands) {
    const res = await runGate(cmd);
    assert.notEqual(res.exitCode, 0, `malicious command "${cmd}" must be rejected`);
    assert.match(res.stderr, /Rejected/i);
  }
});

test('god-deploy-gate: rejects rollback or status with trailing extra arguments', async () => {
  const resRollback = await runGate('rollback staging extra-arg');
  assert.notEqual(resRollback.exitCode, 0);
  assert.match(resRollback.stderr, /Rejected/i);

  const resStatus = await runGate('status staging extra-arg');
  assert.notEqual(resStatus.exitCode, 0);
  assert.match(resStatus.stderr, /Rejected/i);
});

test('god-deploy-gate: delegates to god-deploy when DEPLOY_BIN is provided', async () => {
  const res = await runGate(`deploy staging ${SAMPLE_SHA}`, {
    DEPLOY_BIN: 'deploy/bin/god-deploy',
    DRY_RUN: '1',
  });
  assert.equal(res.exitCode, 0);
  assert.match(res.stdout, /god-deploy: Starting deployment of/i);
  assert.match(res.stdout, /god-deploy: Deployment completed \(dry run\)/i);
});

test('god-deploy: rejects missing or invalid environment argument', () => {
  return new Promise((resolveResult) => {
    execFile('bash', ['deploy/bin/god-deploy', 'deploy', 'bad-env', SAMPLE_SHA], (error, stdout, stderr) => {
      assert.notEqual(error, null);
      assert.match(stderr, /Invalid environment/i);
      resolveResult();
    });
  });
});

test('god-deploy: status action executes cleanly in dry-run mode', () => {
  return new Promise((resolveResult) => {
    execFile('bash', ['deploy/bin/god-deploy', 'status', 'staging'], { env: { ...process.env, DRY_RUN: '1' } }, (error, stdout) => {
      assert.equal(error, null);
      assert.match(stdout, /Deployment Status for god-staging/i);
      resolveResult();
    });
  });
});

test('god-deploy: rollback action fails if no previous release is found', () => {
  return new Promise((resolveResult) => {
    execFile('bash', ['deploy/bin/god-deploy', 'rollback', 'staging'], {
      env: {
        ...process.env,
        DRY_RUN: '1',
        GOD_BASE_DIR: '/tmp/nonexistent-god-dir-' + Date.now(),
        WSLENV: 'DRY_RUN:GOD_BASE_DIR',
      },
    }, (error, stdout, stderr) => {
      assert.notEqual(error, null);
      assert.match(stderr, /No previous release/i);
      resolveResult();
    });
  });
});


