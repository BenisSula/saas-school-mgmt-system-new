/**
 * Admin Billing Page
 * Tenant-level billing management
 * Phase 8.1 - Billing & Stripe Integration
 */

import { SubscriptionCard } from '../../components/billing/SubscriptionCard';
import { InvoiceList } from '../../components/billing/InvoiceList';
import { usePayments } from '../../hooks/queries/useBilling';
import RouteMeta from '../../components/layout/RouteMeta';
import { CreditCard, History } from 'lucide-react';
import type { BillingPayment } from '../../lib/api';

export default function AdminBillingPage() {
  const { data: paymentsData } = usePayments({ limit: 10 });

  const formatAmount = (cents?: number, currency = 'USD') => {
    if (!cents) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(cents / 100);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'succeeded':
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
      case 'pending':
        return 'text-yellow-500';
      case 'refunded':
        return 'text-gray-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <RouteMeta title="Billing">
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
            Billing & Subscription
          </h1>
          <p className="text-sm text-[var(--brand-muted)]">
            Manage your subscription, view invoices, and track payment history.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <SubscriptionCard />
          </div>

          <div className="lg:col-span-2">
            <InvoiceList />
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <History className="h-5 w-5 text-[var(--brand-muted)]" />
                <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                  Recent Payments
                </h2>
              </div>

              {paymentsData?.data && paymentsData.data.length > 0 ? (
                <div className="space-y-2">
                  {paymentsData.data.map((payment: BillingPayment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-[var(--brand-border)] bg-black/10"
                    >
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-4 w-4 text-[var(--brand-muted)]" />
                        <div>
                          <p className="text-sm font-medium text-[var(--brand-surface-contrast)]">
                            {formatAmount(payment.amount_cents, payment.currency)}
                          </p>
                          <p className="text-xs text-[var(--brand-muted)]">
                            {formatDate(payment.created_at)}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-sm font-medium capitalize ${getStatusColor(
                          payment.status
                        )}`}
                      >
                        {payment.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--brand-muted)]">No payment history available.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </RouteMeta>
  );
}
