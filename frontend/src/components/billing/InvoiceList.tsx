/**
 * Invoice List Component
 * Displays list of invoices with download and view options
 * Phase 8.1 - Billing & Stripe Integration
 */

import { useInvoices } from '../../hooks/queries/useBilling';
import { Button } from '../ui/Button';
import { StatusBanner } from '../ui/StatusBanner';
import { DashboardSkeleton } from '../ui/DashboardSkeleton';
import { Download, ExternalLink, FileText } from 'lucide-react';
import type { BillingInvoice } from '../../lib/api';

export function InvoiceList() {
  const { data, isLoading, error } = useInvoices({ limit: 50 });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <StatusBanner
        status="error"
        message={error instanceof Error ? error.message : 'Failed to load invoices'}
      />
    );
  }

  const invoices = data?.data || [];
  const total = data?.pagination?.total || 0;

  if (invoices.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-[var(--brand-surface-contrast)]">
          Invoices
        </h2>
        <p className="text-sm text-[var(--brand-muted)]">No invoices found.</p>
      </div>
    );
  }

  // Memoize formatters to avoid recreating on every render
  const formatAmount = useCallback((cents?: number, currency = 'USD') => {
    if (!cents) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(cents / 100);
  }, []);

  const formatDate = useCallback((dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'text-green-500 bg-green-500/10';
      case 'open':
        return 'text-yellow-500 bg-yellow-500/10';
      case 'void':
        return 'text-gray-500 bg-gray-500/10';
      case 'uncollectible':
        return 'text-red-500 bg-red-500/10';
      default:
        return 'text-gray-500 bg-gray-500/10';
    }
  };

  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">Invoices</h2>
        <span className="text-sm text-[var(--brand-muted)]">{total} total</span>
      </div>

      <div className="space-y-2">
        {invoices.map((invoice: BillingInvoice) => (
          <div
            key={invoice.id}
            className="flex items-center justify-between p-4 rounded-lg border border-[var(--brand-border)] bg-black/10 hover:bg-black/20 transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <FileText className="h-4 w-4 text-[var(--brand-muted)]" />
                <span className="font-medium text-[var(--brand-surface-contrast)]">
                  {invoice.invoice_number}
                </span>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium capitalize ${getStatusColor(
                    invoice.status
                  )}`}
                >
                  {invoice.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-[var(--brand-muted)] ml-7">
                <span>{formatDate(invoice.due_date || invoice.created_at)}</span>
                <span className="font-medium text-[var(--brand-surface-contrast)]">
                  {formatAmount(invoice.amount_cents, invoice.currency)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {invoice.pdf_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(invoice.pdf_url!, '_blank')}
                  title="Download PDF"
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}
              {invoice.hosted_invoice_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(invoice.hosted_invoice_url!, '_blank')}
                  title="View Invoice"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
