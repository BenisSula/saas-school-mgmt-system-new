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
  
  // First check: If it's a Node built-in module (exact match), return the absolute path
  // to the dummy file we created, which will then require the actual built-in
  // This must be checked BEFORE trying to resolve as a file
  if (builtinModules.includes(request)) {
    // Try both with and without .js extension
    const dummyFilePath = path.resolve(__dirname, `${request}.js`);
    const dummyFilePathNoExt = path.resolve(__dirname, request);
    
    // Check if dummy file exists, if not return the module name (Jest will handle it)
    try {
      const fs = require('fs');
      // Prefer .js extension, but also check without extension
      if (fs.existsSync(dummyFilePath)) {
        // Return absolute path - Jest's requireInternalModule needs this
        return dummyFilePath;
      } else if (fs.existsSync(dummyFilePathNoExt)) {
        return dummyFilePathNoExt;
      }
    } catch {
      // If fs is not available, just return the module name
    }
    // Fallback: return the module name (shouldn't happen if dummy files are created)
    return request;
  }
  
  // Second check: Check if the request path ends with a built-in module name
  // This handles cases where Jest tries to resolve built-ins as file paths
  // e.g., 'C:\path\to\backend\fs' or 'C:\path\to\backend\util'
  const requestBasename = path.basename(normalizedRequest);
  if (builtinModules.includes(requestBasename)) {
    // Return absolute path to dummy file
    const dummyFilePath = path.resolve(__dirname, `${requestBasename}.js`);
    const dummyFilePathNoExt = path.resolve(__dirname, requestBasename);
    const fs = require('fs');
    if (fs.existsSync(dummyFilePath)) {
      return dummyFilePath;
    } else if (fs.existsSync(dummyFilePathNoExt)) {
      return dummyFilePathNoExt;
    }
    return requestBasename;
  }
  
  // Third check: Check if any part of the path matches a built-in module
  // This is critical for Windows paths like 'C:\sumano\saas-school-mgmt-system\backend\util'
  for (const mod of builtinModules) {
    // Check if the request ends with the module name (with or without path separators)
    if (normalizedRequest.endsWith(`/${mod}`) || normalizedRequest.endsWith(`\\${mod}`) || normalizedRequest === mod) {
      // Return absolute path to dummy file
      const dummyFilePath = path.resolve(__dirname, `${mod}.js`);
      const dummyFilePathNoExt = path.resolve(__dirname, mod);
      const fs = require('fs');
      if (fs.existsSync(dummyFilePath)) {
        return dummyFilePath;
      } else if (fs.existsSync(dummyFilePathNoExt)) {
        return dummyFilePathNoExt;
      }
      return mod;
    }
    // Also check if the request is an absolute path ending with the module name
    // This handles Windows paths like 'C:\path\to\backend\util'
    if (normalizedRequest.endsWith(mod) && !normalizedRequest.includes('node_modules')) {
      // Extract just the module name if it's a path
      const lastSlash = normalizedRequest.lastIndexOf('/');
      const lastBackslash = normalizedRequest.lastIndexOf('\\');
      const lastSeparator = Math.max(lastSlash, lastBackslash);
      if (lastSeparator >= 0) {
        const afterSeparator = normalizedRequest.substring(lastSeparator + 1);
        if (afterSeparator === mod) {
          return mod;
        }
      }
    }
  }
  
  // Use default Jest resolver for everything else
  try {
    return options.defaultResolver(request, options);
  } catch (error) {
    // If resolution fails with ENOENT, check if it's a built-in module
    // This is the key fix - Jest tries to read the file before the resolver can catch it
    if (error.code === 'ENOENT' || (error.message && error.message.includes('ENOENT'))) {
      const failedPath = error.path || request || '';
      const normalizedFailedPath = failedPath.replace(/\\/g, '/');
      const failedBasename = path.basename(normalizedFailedPath);
      
      // Check if the failed path's basename is a built-in module
      if (builtinModules.includes(failedBasename)) {
        // Return absolute path to dummy file
        const dummyFilePath = path.resolve(__dirname, `${failedBasename}.js`);
        const dummyFilePathNoExt = path.resolve(__dirname, failedBasename);
        const fs = require('fs');
        if (fs.existsSync(dummyFilePath)) {
          return dummyFilePath;
        } else if (fs.existsSync(dummyFilePathNoExt)) {
          return dummyFilePathNoExt;
        }
        return failedBasename;
      }
      
      // Check if any part of the failed path matches a built-in
      for (const mod of builtinModules) {
        // Check various path formats
        if (normalizedFailedPath.endsWith(`/${mod}`) || 
            normalizedFailedPath.endsWith(`\\${mod}`) || 
            normalizedFailedPath === mod || 
            normalizedFailedPath.endsWith(mod)) {
          // Extract the module name from the path
          const lastSlash = normalizedFailedPath.lastIndexOf('/');
          const lastBackslash = normalizedFailedPath.lastIndexOf('\\');
          const lastSeparator = Math.max(lastSlash, lastBackslash);
          if (lastSeparator >= 0) {
            const afterSeparator = normalizedFailedPath.substring(lastSeparator + 1);
          if (afterSeparator === mod) {
            // Return absolute path to dummy file
            const dummyFilePath = path.resolve(__dirname, `${mod}.js`);
            const dummyFilePathNoExt = path.resolve(__dirname, mod);
            const fs = require('fs');
            if (fs.existsSync(dummyFilePath)) {
              return dummyFilePath;
            } else if (fs.existsSync(dummyFilePathNoExt)) {
              return dummyFilePathNoExt;
            }
            return mod;
          }
        }
        // Return absolute path to dummy file
        const dummyFilePath = path.resolve(__dirname, `${mod}.js`);
        const dummyFilePathNoExt = path.resolve(__dirname, mod);
        const fs = require('fs');
        if (fs.existsSync(dummyFilePath)) {
          return dummyFilePath;
        } else if (fs.existsSync(dummyFilePathNoExt)) {
          return dummyFilePathNoExt;
        }
        return mod;
        }
      }
    }
    throw error;
  }
};
