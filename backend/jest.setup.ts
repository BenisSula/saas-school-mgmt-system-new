/**
 * Jest setup file to handle Node built-in module resolution issues
 * This file ensures Jest properly recognizes Node built-ins when imported
 * through ESM modules like formidable
 */

// Fix source-map-support compatibility issue
// Patch the source-map library's local util.js to ensure it's loaded correctly
// The issue is that source-map uses a local util.js file, but source-map-support
// tries to process source maps and fails because Node.js util doesn't have getArg
// We patch Module.require to ensure the local util.js is used correctly
const Module = require('module');
const originalRequire = Module.prototype.require;
const path = require('path');

Module.prototype.require = function (id: string) {
  // Intercept requires for source-map's local util.js
  if (id === './util' || id.endsWith('/source-map/lib/util')) {
    const mod = originalRequire.apply(this, arguments);
    // Ensure getArg and parseSourceMapInput exist
    if (mod && !mod.getArg) {
      mod.getArg = function (options: Record<string, unknown>, name: string, defaultValue?: unknown) {
        if (name in options && options[name] !== undefined) {
          return options[name];
        }
        return defaultValue;
      };
    }
    if (mod && !mod.parseSourceMapInput) {
      mod.parseSourceMapInput = function (input: unknown) {
        return typeof input === 'string' ? JSON.parse(input) : input;
      };
    }
    return mod;
  }
  
  return originalRequire.apply(this, arguments);
};

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

// Ensure Node built-ins are available and properly resolved
// This prevents Jest from trying to resolve them as file paths
// The custom resolver should handle this, but this provides an additional safeguard
if (typeof global !== 'undefined' && typeof require !== 'undefined') {
  // Pre-require common built-ins to ensure they're available
  // This helps Jest's module resolution system recognize them
  // We use the dummy files we created to prevent ENOENT errors
  try {
    const path = require('path');
    const fs = require('fs');
    
    // Pre-load built-ins through dummy files if they exist
    const builtinModules = ['util', 'constants', 'fs', 'path', 'crypto'];
    builtinModules.forEach(mod => {
      const dummyFile = path.join(__dirname, `${mod}.js`);
      if (fs.existsSync(dummyFile)) {
        try {
          require(dummyFile);
        } catch {
          // Fallback to direct require
          require(mod);
        }
      } else {
        require(mod);
      }
    });
  } catch {
    // Built-ins should always be available in Node
  }
}
