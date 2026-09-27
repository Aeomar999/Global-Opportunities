export default {
  testEnvironment: 'node',
  transform: {},
  setupFiles: ['./tests/jest-preload.js'],
  setupFilesAfterEnv: ['./tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  clearMocks: true,
};
