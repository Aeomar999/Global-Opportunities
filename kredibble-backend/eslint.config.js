import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    // seed-test-credentials.js is a gitignored local fixture script.
    ignores: ['node_modules/**', 'coverage/**', 'scratch/**', 'scripts/seed-test-credentials.js'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_|^next$|^req$|^res$', varsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }],
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: { ...globals.jest },
    },
  },
];
