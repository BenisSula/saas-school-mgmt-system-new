import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrandProvider } from '../../ui/BrandProvider';
import { TopSchools } from '../TopSchools';

const mockGetTopSchools = vi.fn();
const mockGetBranding = vi.fn().mockResolvedValue(null);

vi.mock('../../../lib/api', () => ({
  api: {
    getTopSchools: (...args: unknown[]) => mockGetTopSchools(...args),
    getBranding: (...args: unknown[]) => mockGetBranding(...args)
  }
}));

const renderComponent = () =>
  render(
    <BrandProvider>
      <TopSchools />
    </BrandProvider>
  );

beforeEach(() => {
  mockGetTopSchools.mockReset();
  mockGetBranding.mockResolvedValue(null);
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
});

describe('TopSchools', () => {
  it('renders top schools after loading', async () => {
    mockGetTopSchools.mockResolvedValueOnce([
      {
        id: '1',
        name: 'Example High',
        logo_url: null,
        metric_label: 'Active students',
        metric_value: 1240,
        case_study_url: 'https://example.com/case-study'
      }
    ]);

    renderComponent();

    expect(screen.getByText(/Loading top schools…/i)).toBeInTheDocument();
    expect(await screen.findByText('Example High')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view case study/i })).toBeInTheDocument();
  });

  it('renders empty state when no schools returned', async () => {
    mockGetTopSchools.mockResolvedValueOnce([]);

    renderComponent();

    await waitFor(() => expect(mockGetTopSchools).toHaveBeenCalled());
    expect(await screen.findByText(/No schools to display/i)).toBeInTheDocument();
  });

  it('shows error banner when request fails', async () => {
    mockGetTopSchools.mockRejectedValueOnce(new Error('Network down'));

    renderComponent();

    expect(
      await screen.findByText(/Unable to load top schools: Network down/i)
    ).toBeInTheDocument();
  });
});
