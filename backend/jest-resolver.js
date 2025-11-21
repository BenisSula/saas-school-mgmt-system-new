/**
 * Custom Jest resolver to properly handle Node built-in modules
 * This prevents Jest from trying to resolve built-ins as file paths
 * This is especially important for formidable which requires 'fs'
 */
const builtinModules = require('module').builtinModules || [];
const path = require('path');

module.exports = (request, options) => {
  // Normalize the request to handle different formats
  const normalizedRequest = request.replace(/\\/g, '/');
  
  // If it's a Node built-in module, return it as a string (Jest will handle it)
  if (builtinModules.includes(request)) {
    return request;
  }
  
  // Check if the request is a built-in module name (exact match)
  // This handles cases like require('fs'), require('util'), etc.
  if (builtinModules.includes(request)) {
    return request;
  }
  
  // Check if the request path ends with a built-in module name
  // This handles cases where Jest tries to resolve built-ins as file paths
  // e.g., 'C:\path\to\backend\fs' or 'C:\path\to\backend\util'
  const requestBasename = path.basename(normalizedRequest);
  if (builtinModules.includes(requestBasename)) {
    return requestBasename;
  }
  
  // Check if any part of the path matches a built-in module
  for (const mod of builtinModules) {
    // Check if the request ends with the module name
    if (normalizedRequest.endsWith(`/${mod}`) || normalizedRequest.endsWith(`\\${mod}`)) {
      return mod;
    }
    // Check if the request is just the module name
    if (normalizedRequest === mod) {
      return mod;
    }
  }
  
  // Use default Jest resolver for everything else
  try {
    return options.defaultResolver(request, options);
  } catch (error) {
    // If resolution fails with ENOENT, check if it's a built-in module
    if (error.code === 'ENOENT' || (error.message && error.message.includes('ENOENT'))) {
      const failedPath = error.path || request || '';
      const normalizedFailedPath = failedPath.replace(/\\/g, '/');
      const failedBasename = path.basename(normalizedFailedPath);
      
      // Check if the failed path's basename is a built-in module
      if (builtinModules.includes(failedBasename)) {
        return failedBasename;
      }
      
      // Check if any part of the failed path matches a built-in
      for (const mod of builtinModules) {
        if (normalizedFailedPath.endsWith(`/${mod}`) || normalizedFailedPath.endsWith(`\\${mod}`) || normalizedFailedPath === mod) {
          return mod;
        }
      }
    }
    throw error;
  }
};
