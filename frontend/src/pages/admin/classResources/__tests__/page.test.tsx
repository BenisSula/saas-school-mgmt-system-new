/**
 * Class Resources Page Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ClassResourcesPage from '../page';
import { api } from '../../../../lib/api';
import { renderWithProviders } from '../../../../__tests__/test-utils';

// Mock API
vi.mock('../../../../lib/api', () => ({
  api: {
    classResources: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock useClasses hook
vi.mock('../../../../hooks/queries/useClasses', () => ({
  useClasses: vi.fn(() => ({
    data: [
      { id: 'class-1', name: 'Class A' },
      { id: 'class-2', name: 'Class B' },
    ],
  })),
}));

// renderWithProviders is imported from test-utils

describe('ClassResourcesPage', () => {
  let queryClient: ReturnType<typeof renderWithProviders>['queryClient'];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the page with title', async () => {
    (api.classResources.list as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const result = renderWithProviders(<ClassResourcesPage />);
    queryClient = result.queryClient;

    await waitFor(() => {
      expect(screen.getByText('Class Resources')).toBeInTheDocument();
    });
  });

  it('should display empty state when no resources', async () => {
    (api.classResources.list as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    renderWithProviders(<ClassResourcesPage />);

    await waitFor(() => {
      expect(
        screen.getByText('No class resources found. Add your first resource to get started.')
      ).toBeInTheDocument();
    });
  });

  it('should display resources in table', async () => {
    const mockResources = [
      {
        id: '1',
        class_id: 'class-1',
        title: 'Test Document',
        description: 'Test description',
        resource_type: 'document' as const,
        resource_url: 'https://example.com/doc.pdf',
        file_name: 'doc.pdf',
        file_size: 1024,
        mime_type: 'application/pdf',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ];

    (api.classResources.list as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResources);

    renderWithProviders(<ClassResourcesPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Document')).toBeInTheDocument();
    });
  });

  it('should open create modal when Add Resource button is clicked', async () => {
    (api.classResources.list as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    renderWithProviders(<ClassResourcesPage />);

    await waitFor(() => {
      const addButton = screen.getByText('Add Resource');
      addButton.click();
    });

    await waitFor(() => {
      expect(screen.getByText('Add Class Resource')).toBeInTheDocument();
    });
  });
});
