/**
 * Custom Jest resolver to properly handle Node built-in modules
 * This prevents Jest from trying to resolve built-ins as file paths
 */
const builtinModules = require('module').builtinModules || [];

module.exports = (request, options) => {
  // If it's a Node built-in module, return it as a string (Jest will handle it)
  if (builtinModules.includes(request)) {
    return request;
  }
  
  // Use default Jest resolver for everything else
  return options.defaultResolver(request, options);
};

