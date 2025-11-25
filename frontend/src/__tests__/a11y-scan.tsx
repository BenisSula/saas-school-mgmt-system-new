/**
 * Comprehensive Accessibility Scan
 * Scans key pages for WCAG 2.1 AA violations
 *
 * Note: This is a utility module for accessibility scanning.
 * File writing is handled by test runners or CI/CD pipelines.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { vi } from 'vitest';
import HomePage from '../pages';
import AuthUnifiedPage from '../pages/auth/Auth';
import AdminUsersPage from '../pages/admin/users/page';
import TeacherGradeEntryPage from '../pages/teacher/GradeEntryPage';
import StudentResultsPage from '../pages/student/StudentResultsPage';

// Mock auth context
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

interface ScanResult {
  page: string;
  violations: Array<{
    id: string;
    impact?: string | null;
    description: string;
    help: string;
    helpUrl: string;
    nodes: Array<{
      html: string;
      target: string[];
      failureSummary?: string;
    }>;
  }>;
  timestamp: string;
}

const scanPage = async (pageName: string, component: React.ReactElement): Promise<ScanResult> => {
  const { container } = render(<MemoryRouter>{component}</MemoryRouter>);
  const results = await axe(container, {
    rules: {
      'definition-list': { enabled: false },
    },
  });

  return {
    page: pageName,
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? null,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.map((n) => ({
        html: n.html,
        target: (Array.isArray(n.target)
          ? n.target
          : typeof n.target === 'string'
            ? [n.target]
            : [String(n.target)]) as string[],
        failureSummary: n.failureSummary,
      })),
    })),
    timestamp: new Date().toISOString(),
  };
};

export async function runA11yScan(): Promise<ScanResult[]> {
  const results: ScanResult[] = [];

  // Scan key pages
  results.push(await scanPage('HomePage', <HomePage />));
  results.push(await scanPage('AuthUnifiedPage', <AuthUnifiedPage />));
  results.push(await scanPage('AdminUsersPage', <AdminUsersPage />));
  results.push(await scanPage('TeacherGradeEntryPage', <TeacherGradeEntryPage />));
  results.push(await scanPage('StudentResultsPage', <StudentResultsPage />));

  return results;
}

// Export for use in test files
export { scanPage };
