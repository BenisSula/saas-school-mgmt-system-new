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
    '^node:(.*)$': '$1',
    // Explicitly map Node built-ins to prevent Jest from trying to resolve them as file paths
    '^fs$': 'fs',
    '^util$': 'util',
    '^constants$': 'constants',
    '^path$': 'path',
    '^stream$': 'stream',
    '^events$': 'events',
    '^http$': 'http',
    '^https$': 'https',
    '^url$': 'url',
    '^querystring$': 'querystring',
    '^os$': 'os',
    '^crypto$': 'crypto',
    // Mock formidable to avoid module resolution issues
    '^formidable$': '<rootDir>/tests/mocks/formidable.js'
  },
  // Transform superagent and supertest, but not formidable
  // formidable is CommonJS and should work as-is, but we need to handle its fs import
  transformIgnorePatterns: [
    '/node_modules/(?!(superagent|@jest|supertest)/)',
    '/node_modules/formidable/',
    '/node_modules/.pnpm/'
  ],
  // Setup file to handle Node built-in module resolution
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Configure Jest to properly handle Node built-in modules
  // This prevents Jest from trying to resolve built-ins as file paths
  moduleDirectories: ['node_modules', '<rootDir>'],
  // Use custom resolver to handle Node built-ins correctly
  resolver: '<rootDir>/jest-resolver.js',
  // Ensure formidable and its dependencies are completely ignored
  modulePathIgnorePatterns: []
};

export default config;

