/**
 * Subscription Card Component
 * Displays current subscription information with management options
 * Phase 8.1 - Billing & Stripe Integration
 */

import { useCallback } from 'react';
import { useSubscription, useCancelSubscription } from '../../hooks/queries/useBilling';
import { Button } from '../ui/Button';
import { StatusBanner } from '../ui/StatusBanner';
import { DashboardSkeleton } from '../ui/DashboardSkeleton';
import { Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export function SubscriptionCard() {
  const { data: subscription, isLoading, error } = useSubscription();
  const cancelMutation = useCancelSubscription();

  // Memoize formatter to avoid recreating on every render
  // Must be called before early returns per React Hooks rules
  const formatAmount = useCallback((cents?: number, currency = 'USD') => {
    if (!cents) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(cents / 100);
  }, []);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <StatusBanner
        status="error"
        message={error instanceof Error ? error.message : 'Failed to load subscription'}
      />
    );
  }

  if (!subscription) {
    return (
      <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 text-[var(--brand-surface-contrast)]">
          No Active Subscription
        </h2>
        <p className="text-sm text-[var(--brand-muted)] mb-4">
          You don&apos;t have an active subscription. Contact your administrator to set up billing.
        </p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    active: 'text-green-500',
    trialing: 'text-blue-500',
    past_due: 'text-yellow-500',
    canceled: 'text-gray-500',
    unpaid: 'text-red-500',
  };

  const statusIcons: Record<string, typeof CheckCircle2> = {
    active: CheckCircle2,
    trialing: Calendar,
    past_due: AlertCircle,
    canceled: AlertCircle,
    unpaid: AlertCircle,
  };

  const StatusIcon = statusIcons[subscription.status] || AlertCircle;
  const statusColor = statusColors[subscription.status] || 'text-gray-500';

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isActive = subscription.status === 'active' || subscription.status === 'trialing';

  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)] mb-2">
            Subscription Plan
          </h2>
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${statusColor}`} />
            <span className={`text-sm font-medium capitalize ${statusColor}`}>
              {subscription.status.replace('_', ' ')}
            </span>
          </div>
        </div>
        {subscription.plan_name && (
          <div className="text-right">
            <p className="text-2xl font-bold text-[var(--brand-surface-contrast)]">
              {formatAmount(subscription.price_cents, subscription.currency)}
            </p>
            <p className="text-xs text-[var(--brand-muted)]">
              /{subscription.billing_interval || subscription.billing_cycle || 'month'}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--brand-muted)]">Plan</span>
          <span className="font-medium text-[var(--brand-surface-contrast)]">
            {subscription.plan_name || subscription.plan_id}
          </span>
        </div>

        {subscription.current_period_end && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--brand-muted)] flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Next Billing Date
            </span>
            <span className="font-medium text-[var(--brand-surface-contrast)]">
              {formatDate(subscription.current_period_end)}
            </span>
          </div>
        )}

        {subscription.trial_end && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--brand-muted)]">Trial Ends</span>
            <span className="font-medium text-[var(--brand-surface-contrast)]">
              {formatDate(subscription.trial_end)}
            </span>
          </div>
        )}

        {subscription.cancel_at_period_end && (
          <div className="flex items-center gap-2 text-sm text-yellow-600">
            <AlertCircle className="h-4 w-4" />
            <span>Subscription will cancel at period end</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-4 border-t border-[var(--brand-border)]">
        {isActive && !subscription.cancel_at_period_end && (
          <Button
            variant="outline"
            onClick={() => {
              if (confirm('Are you sure you want to cancel your subscription?')) {
                cancelMutation.mutate({ cancelImmediately: false });
              }
            }}
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending ? 'Canceling...' : 'Cancel Subscription'}
          </Button>
        )}
        {subscription.cancel_at_period_end && (
          <Button
            variant="outline"
            onClick={() => {
              // TODO: Implement reactivate subscription
              toast.info('Subscription reactivation coming soon');
            }}
          >
            Reactivate Subscription
          </Button>
        )}
      </div>
    </div>
  );
}
