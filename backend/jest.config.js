/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/tests'],
  testMatch: ['**/*.test.ts'],
  testTimeout: 60000,
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
};
