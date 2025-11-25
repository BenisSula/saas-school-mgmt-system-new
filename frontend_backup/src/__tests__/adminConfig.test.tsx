import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminConfigurationPage from '../pages/admin/ConfigurationPage';

vi.setConfig({ testTimeout: 12000 });

const brandingResponse = {
  logo_url: 'https://cdn.example/logo.svg',
  primary_color: '#123456',
  secondary_color: '#654321',
  theme_flags: { darkMode: true }
};
let termsResponse: unknown[] = [];
const classesResponse: unknown[] = [];

describe('AdminConfigurationPage', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchMock.mockImplementation(async (...args: Parameters<typeof fetch>) => {
      const [input, init] = args;
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      if (url.endsWith('/configuration/branding') && (!init || init.method === undefined)) {
        return {
          ok: true,
          status: 200,
          json: async () => brandingResponse
        } as unknown as Response;
      }
      // Handle POST /configuration/terms (create term) - check this first before GET
      if (url.endsWith('/configuration/terms') && init?.method === 'POST') {
        const newTerm = {
          id: 'term-1',
          name: 'Winter Term',
          starts_on: '2025-01-10',
          ends_on: '2025-04-01'
        };
        // Update the terms list immediately for subsequent GET requests
        termsResponse = [newTerm];
        return {
          ok: true,
          status: 201,
          json: async () => newTerm
        } as unknown as Response;
      }
      // Handle GET /configuration/terms (list terms) - must come after POST check
      if ((url.endsWith('/configuration/terms') || url.includes('/configuration/terms')) && (!init || init.method === undefined || init.method === 'GET')) {
        return {
          ok: true,
          status: 200,
          json: async () => termsResponse
        } as unknown as Response;
      }
      if (url.endsWith('/configuration/classes') && (!init || init.method === undefined)) {
        return {
          ok: true,
          status: 200,
          json: async () => classesResponse
        } as unknown as Response;
      }
      if (url.endsWith('/configuration/classes') && init?.method === 'POST') {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            id: 'class-1',
            name: 'Grade 9',
            description: 'Lower senior'
          })
        } as unknown as Response;
      }
      if (url.endsWith('/configuration/branding') && init?.method === 'PUT') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ...brandingResponse,
            primary_color: '#abcdef'
          })
        } as unknown as Response;
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = originalFetch;
  });

  it('loads branding and allows creating terms and classes', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AdminConfigurationPage />
      </QueryClientProvider>
    );

    expect(await screen.findByText(/Tenant Configuration/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/configuration/branding'),
      expect.anything()
    );

    // Create term
    fireEvent.change(screen.getByLabelText('Term name'), {
      target: { value: 'Winter Term' }
    });
    fireEvent.change(screen.getByLabelText('Start date'), {
      target: { value: '2025-01-10' }
    });
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2025-04-01' }
    });

    fireEvent.click(screen.getByRole('button', { name: /Add term/i }));

    // Wait for the term to appear in the table after React Query refetch
    // The component uses useTerms() which will refetch after createTermMutation succeeds
    // React Query will invalidate and refetch, so we need to wait for the refetch
    await waitFor(
      () => {
        // The term name should appear in a table cell
        const termText = screen.queryByText('Winter Term');
        expect(termText).toBeInTheDocument();
      },
      { timeout: 10000 }
    );

    // Create class
    fireEvent.change(screen.getByLabelText('Class name'), {
      target: { value: 'Grade 9' }
    });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Lower senior' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Add class/i }));

    await waitFor(() => expect(screen.getByText('Grade 9')).toBeInTheDocument());

    // Save branding
    fireEvent.change(screen.getByLabelText('Primary color'), {
      target: { value: '#abcdef' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Save branding/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/configuration/branding'),
        expect.objectContaining({
          method: 'PUT'
        })
      )
    );
  });
});
