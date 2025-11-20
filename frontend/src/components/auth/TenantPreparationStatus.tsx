import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from 'sonner';

interface TenantPreparationStatusProps {
  tenantId: string;
  onReady?: () => void;
  onFailed?: () => void;
}

type Status = 'pending' | 'preparing' | 'ready' | 'failed';

export function TenantPreparationStatus({ tenantId, onReady, onFailed }: TenantPreparationStatusProps) {
  const [status, setStatus] = useState<Status>('pending');
  const [error, setError] = useState<string | undefined>();
  const [isPolling, setIsPolling] = useState(true);

  useEffect(() => {
    if (!isPolling || !tenantId) return;

    const checkStatus = async () => {
      try {
        const result = await api.getTenantStatus(tenantId);
        setStatus(result.status);
        setError(result.error);

        if (result.status === 'ready') {
          setIsPolling(false);
          onReady?.();
          toast.success('Your school is ready! You can now log in.');
        } else if (result.status === 'failed') {
          setIsPolling(false);
          onFailed?.();
          toast.error('School setup failed. Please contact support.');
        }
      } catch (err) {
        console.error('Failed to check tenant status:', err);
        // Continue polling on error
      }
    };

    // Check immediately
    checkStatus();

    // Poll every 2 seconds while preparing
    const interval = setInterval(() => {
      if (isPolling && (status === 'pending' || status === 'preparing')) {
        checkStatus();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [tenantId, isPolling, status, onReady, onFailed]);

  if (status === 'ready') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-green-500/20 bg-green-500/10 p-6">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <div className="text-center">
          <h3 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
            School Setup Complete!
          </h3>
          <p className="mt-2 text-sm text-[var(--brand-muted)]">
            Your school is ready. You can now log in and start using the system.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-red-500/20 bg-red-500/10 p-6">
        <XCircle className="h-12 w-12 text-red-500" />
        <div className="text-center">
          <h3 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
            Setup Failed
          </h3>
          <p className="mt-2 text-sm text-[var(--brand-muted)]">
            {error || 'An error occurred during school setup. Please contact support.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-6">
      <div className="relative">
        <Loader2 className="h-12 w-12 animate-spin text-[var(--brand-primary)]" />
        <Clock className="absolute inset-0 m-auto h-6 w-6 text-[var(--brand-muted)]" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
          Setting Up Your School...
        </h3>
        <p className="mt-2 text-sm text-[var(--brand-muted)]">
          {status === 'pending'
            ? 'Initializing your school account...'
            : 'Creating database structure and preparing your environment...'}
        </p>
        <p className="mt-1 text-xs text-[var(--brand-muted)]">
          This usually takes a few seconds. Please wait...
        </p>
      </div>
    </div>
  );
}

