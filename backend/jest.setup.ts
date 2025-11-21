/**
 * Jest setup file to handle Node built-in module resolution issues
 * This file ensures Jest properly recognizes Node built-ins when imported
 * through ESM modules like formidable
 */

// Mock formidable to avoid module resolution issues with Node built-ins
// Formidable is used by supertest for file uploads, but we don't need it in tests
jest.mock('formidable', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      parse: jest.fn((req, callback) => {
        callback(null, { fields: {}, files: {} });
      })
    }))
  };
});

// Ensure Node built-ins are available globally
// This prevents Jest from trying to resolve them as file paths
if (typeof global !== 'undefined') {
  // Mock fs module if it's not available (shouldn't happen in Node, but just in case)
  if (!global.fs && typeof require !== 'undefined') {
    try {
      global.fs = require('fs');
    } catch {
      // fs should always be available in Node
    }
  }
}

