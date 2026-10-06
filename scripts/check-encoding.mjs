#!/usr/bin/env node
/**
 * Text-encoding check for every git-tracked file (SEC-116).
 *
 * Fails on what broke SEC-090 (SEC-110): UTF-16 files (what Windows PowerShell 5.1
 * writes by default), stray NUL bytes, invalid UTF-8 (a file re-saved as
 * Windows-1252), a UTF-8 byte-order mark in a file whose parser rejects one, and
 * CRLF line endings in shell scripts.
 *
 * Usage: node scripts/check-encoding.mjs   (exits 1 when any file fails)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Formats that are binary by design and never checked. */
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.icns', '.bmp', '.svgz',
  '.pdf', '.docx', '.xlsx', '.pptx', '.zip', '.gz', '.tgz', '.jar', '.keystore', '.jks',
  '.ttf', '.otf', '.woff', '.woff2', '.mp3', '.mp4', '.mov', '.webm', '.wasm',
]);

/** Formats whose parsers (YAML, JSON, bash) reject a UTF-8 byte-order mark. Dotenv files are matched by name. */
const BOM_SENSITIVE_EXTENSIONS = new Set(['.yml', '.yaml', '.json', '.sh']);

const strictUtf8 = new TextDecoder('utf-8', { fatal: true });

/**
 * Whether a tracked path is text that should be checked.
 * @param {string} filePath repository-relative path
 * @returns {boolean}
 */
export const isCheckedPath = (filePath) => !BINARY_EXTENSIONS.has(extname(filePath).toLowerCase());

/**
 * Lists the encoding problems in one file.
 * @param {string} filePath repository-relative path (drives the extension rules and messages)
 * @param {Buffer} content the file's raw bytes
 * @returns {string[]} one message per problem; empty when the file is fine
 */
export const findEncodingProblems = (filePath, content) => {
  const startsWith = (...bytes) => bytes.every((byte, index) => content[index] === byte);

  if (startsWith(0xff, 0xfe) || startsWith(0xfe, 0xff)) {
    return ['is UTF-16 (it has a UTF-16 byte-order mark); re-save it as UTF-8'];
  }
  if (content.includes(0x00)) {
    return ['contains NUL bytes (probably UTF-16 without a byte-order mark); re-save it as UTF-8'];
  }
  try {
    strictUtf8.decode(content);
  } catch {
    return ['is not valid UTF-8 (probably re-saved as Windows-1252); restore it from git history'];
  }

  const problems = [];
  const extension = extname(filePath).toLowerCase();
  const normalizedPath = filePath.replace(/\\/g, '/');
  const isShellScript = extension === '.sh' || normalizedPath.startsWith('deploy/bin/');
  const isBomSensitive = BOM_SENSITIVE_EXTENSIONS.has(extension) || basename(filePath).startsWith('.env') || isShellScript;
  if (isBomSensitive && startsWith(0xef, 0xbb, 0xbf)) {
    problems.push('starts with a UTF-8 byte-order mark, which its parser rejects; remove it');
  }
  if (isShellScript && content.includes('\r\n')) {
    problems.push('has CRLF line endings; bash needs LF');
  }
  return problems;
};

/**
 * Checks every tracked text file and prints each problem.
 * @returns {number} how many files failed
 */
const checkTrackedFiles = () => {
  const listing = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const files = listing.split('\0').filter(Boolean).filter(isCheckedPath);
  let failingFiles = 0;
  for (const file of files) {
    let content;
    try {
      content = readFileSync(file);
    } catch (error) {
      if (error.code === 'ENOENT') continue; // deleted in the working tree, still in the index
      throw error;
    }
    const problems = findEncodingProblems(file, content);
    if (problems.length > 0) {
      failingFiles += 1;
      for (const problem of problems) console.error(`${file}: ${problem}`);
    }
  }
  console.log(`check-encoding: ${files.length} files checked, ${failingFiles} failing`);
  return failingFiles;
};

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  process.exitCode = checkTrackedFiles() > 0 ? 1 : 0;
}
