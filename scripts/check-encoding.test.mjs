import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findEncodingProblems, isCheckedPath } from './check-encoding.mjs';

const utf16WithBom = (text) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]);
const utf8WithBom = (text) => Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, 'utf8')]);

test('flags a UTF-16 file with a byte-order mark', () => {
  const problems = findEncodingProblems('.github/workflows/cd-backend.yml', utf16WithBom('name: CD\n'));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /UTF-16/);
});

test('flags UTF-16 without a byte-order mark by its NUL bytes', () => {
  const problems = findEncodingProblems('docker-compose.yml', Buffer.from('services:\n', 'utf16le'));
  assert.match(problems[0], /NUL/);
});

test('flags Windows-1252 text, which is not valid UTF-8', () => {
  // 0x97 is an em dash in Windows-1252 and an invalid byte in UTF-8.
  const problems = findEncodingProblems('task.md', Buffer.from([0x53, 0x45, 0x43, 0x20, 0x97, 0x20, 0x78]));
  assert.match(problems[0], /not valid UTF-8/);
});

test('accepts UTF-8 with emoji and symbols', () => {
  assert.deepEqual(findEncodingProblems('task.md', Buffer.from('| SEC-090 | ✅ Done — ≥ 2 replicas |\n', 'utf8')), []);
});

test('accepts a UTF-8 byte-order mark in Markdown', () => {
  assert.deepEqual(findEncodingProblems('task.md', utf8WithBom('# task.md\n')), []);
});

test('rejects a UTF-8 byte-order mark in YAML, JSON, shell and dotenv files', () => {
  for (const file of ['ci.yml', 'kredibble-app/eas.json', 'scripts/db-dump.sh', 'kredibble-backend/.env.example']) {
    assert.match(findEncodingProblems(file, utf8WithBom('x\n'))[0] ?? '', /byte-order mark/, file);
  }
});

test('rejects CRLF line endings in shell scripts only', () => {
  assert.match(findEncodingProblems('scripts/backup.sh', Buffer.from('#!/bin/bash\r\necho hi\r\n'))[0] ?? '', /CRLF/);
  assert.deepEqual(findEncodingProblems('README.md', Buffer.from('line\r\nline\r\n')), []);
});

test('skips binary formats', () => {
  assert.equal(isCheckedPath('kredibble-app/assets/images/icon.png'), false);
  assert.equal(isCheckedPath('KREDBBLE_SECURITY_HARDENING_REPORT.docx'), false);
  assert.equal(isCheckedPath('task.md'), true);
});
