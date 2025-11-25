/**
 * Responsive Layout Tests
 * Tests for mobile-first breakpoints and responsive behavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { DashboardRouteProvider } from '../context/DashboardRouteContext';
import { ManagementPageLayout } from '../components/admin/ManagementPageLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import type { AuthUser } from '../lib/api';
import { createTestQueryClient } from './test-utils';

// Mock window.matchMedia for responsive tests
const createMatchMedia = (matches: boolean) => {
  return vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

describe('Responsive Layout Tests', () => {
  const queryClient = createTestQueryClient();

  describe('ManagementPageLayout', () => {
    it('renders with mobile-first grid layout', () => {
      render(
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <DashboardRouteProvider defaultTitle="Test">
              <ManagementPageLayout
                title="Test Page"
                description="Test description"
                error={null}
                loading={false}
                onExportCSV={() => {}}
              >
                <div>Test Content</div>
              </ManagementPageLayout>
            </DashboardRouteProvider>
          </QueryClientProvider>
        </BrowserRouter>
      );

      const container = screen.getByText('Test Page').closest('div');
      expect(container).toHaveClass('grid', 'grid-cols-1');
    });

    it('applies responsive classes for tablet and desktop', () => {
      render(
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <DashboardRouteProvider defaultTitle="Test">
              <ManagementPageLayout
                title="Test Page"
                description="Test description"
                error={null}
                loading={false}
                onExportCSV={() => {}}
              >
                <div>Test Content</div>
              </ManagementPageLayout>
            </DashboardRouteProvider>
          </QueryClientProvider>
        </BrowserRouter>
      );

      const header = screen.getByText('Test Page').closest('header');
      expect(header).toHaveClass('flex-col', 'sm:flex-row');
    });
  });

  describe('DashboardLayout', () => {
    it('renders with responsive grid layout', () => {
      const mockUser: AuthUser = {
        id: '1',
        email: 'test@example.com',
        role: 'admin',
        tenantId: 'tenant-1',
        isVerified: true,
        status: 'active',
      };

      const { container } = render(
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <DashboardRouteProvider defaultTitle="Test">
              <DashboardLayout user={mockUser} onLogout={() => {}}>
                <div>Test Content</div>
              </DashboardLayout>
            </DashboardRouteProvider>
          </QueryClientProvider>
        </BrowserRouter>
      );

      const gridContainer = container.querySelector('.grid');
      expect(gridContainer).toHaveClass('grid-cols-1', 'sm:grid-cols-[auto_1fr]');
    });
  });

  describe('Mobile Breakpoint (<= 480px)', () => {
    beforeEach(() => {
      window.matchMedia = createMatchMedia(true);
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 480,
      });
    });

    it('should stack elements vertically on mobile', () => {
      render(
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <DashboardRouteProvider defaultTitle="Test">
              <ManagementPageLayout
                title="Mobile Test"
                description="Mobile description"
                error={null}
                loading={false}
                onExportCSV={() => {}}
              >
                <div>Content</div>
              </ManagementPageLayout>
            </DashboardRouteProvider>
          </QueryClientProvider>
        </BrowserRouter>
      );

      const header = screen.getByText('Mobile Test').closest('header');
      expect(header).toHaveClass('flex-col');
    });
  });

  describe('Large Breakpoint (>= 1440px)', () => {
    beforeEach(() => {
      window.matchMedia = createMatchMedia(true);
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1440,
      });
    });

    it('should use multi-column layout on large screens', () => {
      render(
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <DashboardRouteProvider defaultTitle="Test">
              <ManagementPageLayout
                title="Large Screen Test"
                description="Large description"
                error={null}
                loading={false}
                onExportCSV={() => {}}
              >
                <div>Content</div>
              </ManagementPageLayout>
            </DashboardRouteProvider>
          </QueryClientProvider>
        </BrowserRouter>
      );

      const contentGrid = screen.getByText('Content').closest('.grid');
      expect(contentGrid).toHaveClass('lg:grid-cols-12');
    });
  });

  describe('Typography', () => {
    it('headings should use Poppins font', () => {
      render(
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <DashboardRouteProvider defaultTitle="Test">
              <ManagementPageLayout
                title="Typography Test"
                description="Test"
                error={null}
                loading={false}
                onExportCSV={() => {}}
              >
                <div>Content</div>
              </ManagementPageLayout>
            </DashboardRouteProvider>
          </QueryClientProvider>
        </BrowserRouter>
      );

      const heading = screen.getByText('Typography Test');
      expect(heading).toHaveClass('font-heading');
    });
  });
});
