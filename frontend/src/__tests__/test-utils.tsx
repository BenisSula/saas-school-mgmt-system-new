/**
 * Test Utilities
 * Shared utilities for setting up test providers
 */

import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DashboardRouteProvider } from '../context/DashboardRouteContext';
import { BrandProvider } from '../components/ui/BrandProvider';

/**
 * Creates a new QueryClient with test-friendly defaults
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0, // Disable garbage collection for tests
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Renders a component with all necessary providers for testing
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: {
    initialEntries?: string[];
    queryClient?: QueryClient;
  } & Omit<RenderOptions, 'wrapper'>
) {
  const {
    initialEntries = ['/'],
    queryClient = createTestQueryClient(),
    ...renderOptions
  } = options || {};

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <BrandProvider>
          <DashboardRouteProvider defaultTitle="Test">{children}</DashboardRouteProvider>
        </BrandProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}

/**
 * Renders a component with QueryClientProvider only
 */
export function renderWithQueryClient(
  ui: React.ReactElement,
  options?: {
    queryClient?: QueryClient;
  } & Omit<RenderOptions, 'wrapper'>
) {
  const { queryClient = createTestQueryClient(), ...renderOptions } = options || {};

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}

/**
 * Renders a component with DashboardRouteProvider only
 */
export function renderWithDashboard(
  ui: React.ReactElement,
  options?: {
    queryClient?: QueryClient;
  } & Omit<RenderOptions, 'wrapper'>
) {
  const { queryClient = createTestQueryClient(), ...renderOptions } = options || {};

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <DashboardRouteProvider defaultTitle="Test">{children}</DashboardRouteProvider>
    </QueryClientProvider>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}
