/**
 * Comprehensive Accessibility Tests
 * Scans key pages for WCAG 2.1 AA violations
 */

import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../pages';
import AuthUnifiedPage from '../pages/auth/Auth';

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

// Mock API calls
vi.mock('../lib/api', () => ({
  api: {
    auth: {
      login: vi.fn(),
      register: vi.fn(),
    },
  },
}));

afterEach(() => {
  cleanup();
});

beforeAll(() => {
  Object.defineProperty(window.HTMLCanvasElement.prototype, 'getContext', {
    value: () => null,
    configurable: true,
  });
});

afterAll(() => {
  delete (window.HTMLCanvasElement.prototype as unknown as Record<string, unknown>).getContext;
});

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

describe('Accessibility Scan - Key Pages', () => {
  const scanResults: ScanResult[] = [];

  it('HomePage should have no critical accessibility violations', async () => {
    const result = await scanPage('HomePage', <HomePage />);
    scanResults.push(result);

    // Filter critical violations (HIGH severity)
    const criticalViolations = result.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(criticalViolations).toHaveLength(0);
  });

  it('AuthUnifiedPage should have no critical accessibility violations', async () => {
    const result = await scanPage('AuthUnifiedPage', <AuthUnifiedPage />);
    scanResults.push(result);

    // Filter critical violations
    const criticalViolations = result.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(criticalViolations).toHaveLength(0);
  });

  // Generate report after all tests
  // Note: File writing is handled by the test runner or CI/CD pipeline
  // For local development, results are logged to console
  afterAll(() => {
    if (scanResults.length > 0) {
      console.log('\n📊 Accessibility Scan Results:');
      scanResults.forEach((result) => {
        console.log(`  ${result.page}: ${result.violations.length} violations`);
      });
      // In CI/CD, this would write to a file
      // For now, we log to console to avoid Node.js dependencies in browser tests
    }
  });
});
