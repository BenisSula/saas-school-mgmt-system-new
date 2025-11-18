import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrandProvider } from '../../components/ui/BrandProvider';
import { DashboardRouteProvider } from '../../context/DashboardRouteContext';
import { api, type PlatformOverview } from '../../lib/api';
import { queryClient } from '../../lib/react-query';
import SuperuserOverviewPage from './SuperuserOverviewPage';

const overview: PlatformOverview = {
  totals: {
    schools: 5,
    activeSchools: 4,
    suspendedSchools: 1,
    users: 250,
    pendingUsers: 6
  },
  roleDistribution: {
    admins: 20,
    hods: 12,
    teachers: 80,
    students: 150
  },
  subscriptionBreakdown: {
    free: 1,
    trial: 2,
    paid: 2
  },
  revenue: {
    total: 125000,
    byTenant: [
      { tenantId: 'tenant_a', amount: 50000 },
      { tenantId: 'tenant_b', amount: 75000 }
    ]
  },
  recentSchools: [
    {
      id: 'tenant_a',
      name: 'North Ridge Academy',
      status: 'active',
      subscriptionType: 'paid',
      createdAt: new Date('2025-02-01T00:00:00Z').toISOString()
    }
  ]
};

describe('SuperuserOverviewPage', () => {
  beforeEach(() => {
    vi.spyOn(api.superuser, 'getOverview').mockResolvedValue(overview);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders platform statistics and revenue insights', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrandProvider>
          <DashboardRouteProvider defaultTitle="Dashboard overview">
            <SuperuserOverviewPage />
          </DashboardRouteProvider>
        </BrandProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(api.superuser.getOverview).toHaveBeenCalledTimes(1));

    const statsSection = await screen.findByLabelText(/Platform statistics/i);
    expect(
      within(statsSection).getByRole('heading', { level: 2, name: /Total schools/i })
    ).toBeInTheDocument();
    expect(
      within(statsSection).getByRole('heading', { level: 2, name: /Total users/i })
    ).toBeInTheDocument();

    const insightsSection = await screen.findByLabelText(/Subscription and revenue insights/i);
    expect(
      within(insightsSection).getByRole('heading', { level: 2, name: /Subscription mix/i })
    ).toBeInTheDocument();
    expect(
      within(insightsSection).getByRole('heading', { level: 2, name: /Revenue snapshot/i })
    ).toBeInTheDocument();
  });
});
