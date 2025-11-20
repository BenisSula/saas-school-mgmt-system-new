import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  // Explicitly ignore .js test files (these are compiled outputs)
  testPathIgnorePatterns: ['/node_modules/', '\\.js$'],
  clearMocks: true,
  changedFilesWithAncestor: false,
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        useESM: false,
        diagnostics: {
          ignoreCodes: [151001]
        }
      }
    ]
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Map node: specifiers to bare built-ins for Jest
    '^node:(.*)$': '$1'
  },
  // Allow transforming superagent/formidable and other ESM dependencies
  // Note: formidable uses Node built-ins that Jest needs to resolve correctly
  transformIgnorePatterns: [
    '/node_modules/(?!(superagent|formidable|@jest|supertest)/)'
  ]
};

export default config;

