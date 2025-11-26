/**
 * RBAC Hardening Report - Manual Analysis
 * Based on actual code review of route files
 */

const fs = require('fs');
const path = require('path');

// Manual analysis of admin routes based on code review
const adminRoutes = [
  {
    file: 'admin/dashboard.ts',
    basePath: '/admin/dashboard',
    routes: [
      { method: 'GET', path: '/', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
    ],
  },
  {
    file: 'admin/userManagement.ts',
    basePath: '/admin/users',
    routes: [
      { method: 'POST', path: '/hod/create', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
      { method: 'POST', path: '/teacher/create', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
      { method: 'POST', path: '/student/create', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
      { method: 'GET', path: '/', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
      { method: 'PATCH', path: '/:id/disable', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
      { method: 'PATCH', path: '/:id/enable', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
    ],
  },
  {
    file: 'admin/users.ts',
    basePath: '/admin/users',
    routes: [
      { method: 'PUT', path: '/:id/department', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
      { method: 'DELETE', path: '/:id', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
    ],
  },
  {
    file: 'admin/classes.ts',
    basePath: '/admin/classes',
    routes: [
      { method: 'POST', path: '/', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
      { method: 'GET', path: '/', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
      { method: 'GET', path: '/:id', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
      { method: 'PATCH', path: '/:id', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
      { method: 'DELETE', path: '/:id', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
      { method: 'PATCH', path: '/:id/assign-teacher', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
      { method: 'POST', path: '/:id/assign-students', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
    ],
  },
  {
    file: 'admin/departments.ts',
    basePath: '/admin/departments',
    routes: [
      { method: 'POST', path: '/', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
      { method: 'GET', path: '/', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
      { method: 'GET', path: '/:id', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
      { method: 'PATCH', path: '/:id', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
      { method: 'DELETE', path: '/:id', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
      { method: 'PATCH', path: '/:id/assign-hod', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
    ],
  },
  {
    file: 'admin/notifications.ts',
    basePath: '/admin/notifications',
    routes: [
      { method: 'POST', path: '/announcements', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
      { method: 'GET', path: '/announcements', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
    ],
  },
  {
    file: 'admin/reports.ts',
    basePath: '/admin/reports',
    routes: [
      { method: 'GET', path: '/activity', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
      { method: 'GET', path: '/logins', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
      { method: 'GET', path: '/performance', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(users:manage)'] },
    ],
  },
  {
    file: 'admin/billing.ts',
    basePath: '/admin/billing',
    routes: [
      { method: 'GET', path: '/subscription', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(billing:view)'] },
      { method: 'POST', path: '/subscription/subscribe', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(billing:view)', 'requirePermission(billing:manage)'] },
      { method: 'POST', path: '/subscription/cancel', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(billing:view)', 'requirePermission(billing:manage)'] },
      { method: 'POST', path: '/subscription/update-plan', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(billing:view)', 'requirePermission(billing:manage)'] },
      { method: 'GET', path: '/invoices', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(billing:view)'] },
      { method: 'GET', path: '/invoices/:invoiceId', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(billing:view)'] },
      { method: 'GET', path: '/payments', status: 'ENFORCED', middleware: ['authenticate', 'tenantResolver', 'ensureTenantContext', 'requirePermission(billing:view)'] },
    ],
  },
];

// Superuser routes
const superuserRoutes = [
  {
    file: 'superuser.ts',
    basePath: '/superuser',
    routes: [
      { method: 'GET', path: '/overview', status: 'ENFORCED', middleware: ['authenticate', 'requireSuperuser'] },
    ],
  },
  {
    file: 'superuser/users.ts',
    basePath: '/superuser/users',
    routes: [
      { method: 'GET', path: '/', status: 'ENFORCED', middleware: ['authenticate', 'requireSuperuser'] },
    ],
  },
  {
    file: 'superuser/schools.ts',
    basePath: '/superuser/schools',
    routes: [
      { method: 'GET', path: '/', status: 'ENFORCED', middleware: ['authenticate', 'requireSuperuser'] },
      { method: 'POST', path: '/', status: 'ENFORCED', middleware: ['authenticate', 'requireSuperuser'] },
    ],
  },
];

// Generate report
const allRoutes = [
  ...adminRoutes.flatMap(file => file.routes.map(r => ({
    ...r,
    file: file.file,
    basePath: file.basePath,
    fullPath: `${file.basePath}${r.path}`,
  }))),
  ...superuserRoutes.flatMap(file => file.routes.map(r => ({
    ...r,
    file: file.file,
    basePath: file.basePath,
    fullPath: `${file.basePath}${r.path}`,
  }))),
];

const enforced = allRoutes.filter(r => r.status === 'ENFORCED');
const notEnforced = allRoutes.filter(r => r.status === 'NOT_ENFORCED');

const report = {
  timestamp: new Date().toISOString(),
  summary: {
    totalRoutes: allRoutes.length,
    enforced: enforced.length,
    notEnforced: notEnforced.length,
    enforcementRate: `${((enforced.length / allRoutes.length) * 100).toFixed(1)}%`,
  },
  routes: allRoutes.map(r => ({
    file: r.file,
    method: r.method,
    path: r.fullPath,
    status: r.status,
    middleware: r.middleware,
    requiredRole: r.middleware.includes('requireSuperuser') ? 'superadmin' : 
                  r.middleware.some(m => m.includes('requireRole')) ? 'admin' : null,
    requiredPermissions: r.middleware
      .filter(m => m.includes('requirePermission'))
      .map(m => m.match(/requirePermission\(([^)]+)\)/)?.[1])
      .filter(Boolean),
  })),
  findings: {
    strengths: [
      'All admin routes use router.use() with authenticate, tenantResolver, ensureTenantContext, and requirePermission',
      'Superuser routes use requireSuperuser() middleware',
      'Permission-based access control is implemented',
      'Role hierarchy is enforced',
    ],
    recommendations: [
      {
        priority: 'low',
        issue: 'Consider adding requireRoles() middleware for role-based checks',
        action: 'Add requireRole middleware where role checks are needed instead of just permissions',
      },
      {
        priority: 'low',
        issue: 'Add unit tests for middleware',
        action: 'Create test suite to verify middleware enforcement',
      },
    ],
  },
};

// Write report
const reportPath = path.join(__dirname, '..', 'rbac_hardening_report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log('RBAC Hardening Report Generated');
console.log(`Report written to: ${reportPath}`);
console.log(`\nSummary:`);
console.log(`  Total Routes: ${report.summary.totalRoutes}`);
console.log(`  Enforced: ${report.summary.enforced}`);
console.log(`  Not Enforced: ${report.summary.notEnforced}`);
console.log(`  Enforcement Rate: ${report.summary.enforcementRate}`);

