/**
 * Mock for formidable module to avoid Node built-in module resolution issues in Jest
 * This mock provides a minimal implementation that satisfies supertest's requirements
 */
module.exports = {
  __esModule: true,
  default: function Formidable() {
    this.parse = function(req, callback) {
      // Return empty fields and files
      callback(null, { fields: {}, files: {} });
    };
  }
};

