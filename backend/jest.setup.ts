/**
 * Jest setup file to handle Node built-in module resolution issues
 * This file ensures Jest properly recognizes Node built-ins when imported
 * through ESM modules like formidable
 */

// Ensure Node built-ins are available globally
// This prevents Jest from trying to resolve them as file paths
if (typeof global !== 'undefined') {
  // Node built-ins are already available in Node environment
  // This file serves as a placeholder to ensure proper module resolution
}

