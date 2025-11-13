import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminConfigurationPage from '../pages/AdminConfigurationPage';

vi.setConfig({ testTimeout: 12000 });

const brandingResponse = {
  logo_url: 'https://cdn.example/logo.svg',
  primary_color: '#123456',
  secondary_color: '#654321',
  theme_flags: { darkMode: true }
};
const termsResponse: unknown[] = [];
const classesResponse: unknown[] = [];

describe('AdminConfigurationPage', () => {
  const fetchMock = vi.fn<
    Promise<{
      ok: boolean;
      status: number;
      json: () => Promise<unknown>;
    }>,
    [string | URL, (globalThis.RequestInit | undefined)?]
  >();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchMock.mockImplementation((input: string | URL, init?: globalThis.RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/configuration/branding') && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => brandingResponse
        });
      }
      if (url.endsWith('/configuration/terms') && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => termsResponse
        });
      }
      if (url.endsWith('/configuration/classes') && (!init || init.method === undefined)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => classesResponse
        });
      }
      if (url.endsWith('/configuration/terms') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            id: 'term-1',
            name: 'Winter Term',
            starts_on: '2025-01-10',
            ends_on: '2025-04-01'
          })
        });
      }
      if (url.endsWith('/configuration/classes') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            id: 'class-1',
            name: 'Grade 9',
            description: 'Lower senior'
          })
        });
      }
      if (url.endsWith('/configuration/branding') && init?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            ...brandingResponse,
            primary_color: '#abcdef'
          })
        });
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = originalFetch;
  });

  it('loads branding and allows creating terms and classes', async () => {
    render(<AdminConfigurationPage />);

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

    await waitFor(() => expect(screen.getByText('Winter Term')).toBeInTheDocument());

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
