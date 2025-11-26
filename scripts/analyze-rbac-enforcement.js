/**
 * RBAC Hardening Analysis Script
 * Scans backend routes to identify role/permission enforcement
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const backendSrc = path.join(__dirname, '..', 'backend', 'src');
const routesDir = path.join(backendSrc, 'routes');

// Route categories and their expected roles/permissions
const routeCategories = {
  admin: {
    basePath: '/admin',
    requiredRole: 'admin',
    requiredPermissions: ['users:manage', 'school:manage'],
    routes: [],
  },
  superuser: {
    basePath: '/superuser',
    requiredRole: 'superadmin',
    requiredPermissions: [],
    routes: [],
  },
  teacher: {
    basePath: '/teacher',
    requiredRole: 'teacher',
    requiredPermissions: [],
    routes: [],
  },
  student: {
    basePath: '/student',
    requiredRole: 'student',
    requiredPermissions: [],
    routes: [],
  },
  hod: {
    basePath: '/hod',
    requiredRole: 'hod',
    requiredPermissions: [],
    routes: [],
  },
};

// Scan route files
function scanRouteFile(filePath, category) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  const routes = [];
  let currentRoute = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Match route definitions
    const routeMatch = line.match(/router\.(get|post|put|delete|patch)\s*\(['"`]([^'"`]+)['"`]/);
    if (routeMatch) {
      if (currentRoute) {
        routes.push(currentRoute);
      }
      
      currentRoute = {
        method: routeMatch[1].toUpperCase(),
        path: routeMatch[2],
        line: i + 1,
        middleware: [],
        hasAuth: false,
        hasRoleCheck: false,
        hasPermissionCheck: false,
        status: 'NOT_ENFORCED',
      };
    }
    
    if (currentRoute) {
      // Check for middleware
      if (line.includes('authenticate') || line.includes('requireAuth')) {
        currentRoute.hasAuth = true;
        currentRoute.middleware.push('authenticate');
      }
      
      if (line.includes('requireRole')) {
        currentRoute.hasRoleCheck = true;
        currentRoute.middleware.push('requireRole');
        const roleMatch = line.match(/requireRole\(\[(.*?)\]/);
        if (roleMatch) {
          currentRoute.requiredRoles = roleMatch[1].split(',').map(r => r.trim().replace(/['"]/g, ''));
        }
      }
      
      if (line.includes('requirePermission')) {
        currentRoute.hasPermissionCheck = true;
        currentRoute.middleware.push('requirePermission');
        const permMatch = line.match(/requirePermission\(['"`]([^'"`]+)['"`]/);
        if (permMatch) {
          currentRoute.requiredPermissions = [permMatch[1]];
        }
      }
      
      if (line.includes('requireSuperuser')) {
        currentRoute.hasRoleCheck = true;
        currentRoute.middleware.push('requireSuperuser');
        currentRoute.requiredRoles = ['superadmin'];
      }
      
      // Check router.use() for global middleware
      if (line.includes('router.use(')) {
        if (line.includes('authenticate')) {
          currentRoute.hasAuth = true;
          currentRoute.middleware.push('authenticate (global)');
        }
        if (line.includes('requirePermission')) {
          currentRoute.hasPermissionCheck = true;
          currentRoute.middleware.push('requirePermission (global)');
        }
        if (line.includes('requireRole')) {
          currentRoute.hasRoleCheck = true;
          currentRoute.middleware.push('requireRole (global)');
        }
        if (line.includes('requireSuperuser')) {
          currentRoute.hasRoleCheck = true;
          currentRoute.middleware.push('requireSuperuser (global)');
        }
      }
    }
  }
  
  if (currentRoute) {
    routes.push(currentRoute);
  }
  
  // Determine enforcement status
  routes.forEach(route => {
    if (route.hasAuth && (route.hasRoleCheck || route.hasPermissionCheck)) {
      route.status = 'ENFORCED';
    } else if (route.hasAuth) {
      route.status = 'PARTIAL'; // Has auth but no role/permission check
    } else {
      route.status = 'NOT_ENFORCED';
    }
  });
  
  return routes;
}

// Scan all admin route files
function scanAdminRoutes() {
  const adminRoutesDir = path.join(routesDir, 'admin');
  const files = fs.readdirSync(adminRoutesDir).filter(f => f.endsWith('.ts'));
  
  const allRoutes = [];
  
  files.forEach(file => {
    const filePath = path.join(adminRoutesDir, file);
    const routes = scanRouteFile(filePath, 'admin');
    routes.forEach(route => {
      route.file = file;
      route.category = 'admin';
      allRoutes.push(route);
    });
  });
  
  return allRoutes;
}

// Scan superuser routes
function scanSuperuserRoutes() {
  const superuserRoutesDir = path.join(routesDir, 'superuser');
  if (!fs.existsSync(superuserRoutesDir)) {
    return [];
  }
  
  const files = fs.readdirSync(superuserRoutesDir).filter(f => f.endsWith('.ts'));
  const allRoutes = [];
  
  files.forEach(file => {
    const filePath = path.join(superuserRoutesDir, file);
    const routes = scanRouteFile(filePath, 'superuser');
    routes.forEach(route => {
      route.file = file;
      route.category = 'superuser';
      allRoutes.push(route);
    });
  });
  
  return allRoutes;
}

// Generate report
function generateReport() {
  const adminRoutes = scanAdminRoutes();
  const superuserRoutes = scanSuperuserRoutes();
  const allRoutes = [...adminRoutes, ...superuserRoutes];
  
  const enforced = allRoutes.filter(r => r.status === 'ENFORCED');
  const partial = allRoutes.filter(r => r.status === 'PARTIAL');
  const notEnforced = allRoutes.filter(r => r.status === 'NOT_ENFORCED');
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalRoutes: allRoutes.length,
      enforced: enforced.length,
      partial: partial.length,
      notEnforced: notEnforced.length,
    },
    routes: allRoutes.map(route => ({
      category: route.category,
      file: route.file,
      method: route.method,
      path: route.path,
      line: route.line,
      status: route.status,
      middleware: route.middleware,
      requiredRoles: route.requiredRoles || [],
      requiredPermissions: route.requiredPermissions || [],
    })),
    issues: [
      ...notEnforced.map(r => ({
        severity: 'high',
        issue: `Route ${r.method} ${r.path} in ${r.file} is not enforced`,
        recommendation: 'Add authenticate and requirePermission/requireRole middleware',
      })),
      ...partial.map(r => ({
        severity: 'medium',
        issue: `Route ${r.method} ${r.path} in ${r.file} has auth but no role/permission check`,
        recommendation: 'Add requirePermission or requireRole middleware',
      })),
    ],
    recommendations: [
      {
        priority: 'high',
        action: 'Add role/permission checks to all admin routes',
        count: notEnforced.length,
      },
      {
        priority: 'medium',
        action: 'Add role/permission checks to partially enforced routes',
        count: partial.length,
      },
    ],
  };
  
  return report;
}

// Write report
const report = generateReport();
const reportPath = path.join(__dirname, '..', 'rbac_hardening_report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log('RBAC Hardening Report Generated');
console.log(`Report written to: ${reportPath}`);
console.log(`\nSummary:`);
console.log(`  Total Routes: ${report.summary.totalRoutes}`);
console.log(`  Enforced: ${report.summary.enforced}`);
console.log(`  Partial: ${report.summary.partial}`);
console.log(`  Not Enforced: ${report.summary.notEnforced}`);
console.log(`\nIssues:`);
console.log(`  High: ${report.issues.filter(i => i.severity === 'high').length}`);
console.log(`  Medium: ${report.issues.filter(i => i.severity === 'medium').length}`);

