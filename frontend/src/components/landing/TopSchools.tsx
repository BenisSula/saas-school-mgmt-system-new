import { useEffect, useState } from 'react';
import { api, type TopSchool } from '../../lib/api';
import { StatusBanner } from '../ui/StatusBanner';
import { Button } from '../ui/Button';

export function TopSchools({ limit = 5 }: { limit?: number }) {
  const [schools, setSchools] = useState<TopSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.getTopSchools(limit);
        if (mounted) {
          setSchools(result);
        }
      } catch (err) {
        if (mounted) {
          // Handle errors gracefully - suppress console errors for expected failures
          const error = err as Error & { apiError?: { status?: number } };
          if (error.apiError?.status === 401 || error.apiError?.status === 500) {
            // Expected errors: user not authenticated or server issue
            // Don't show error message, just show empty state
            setError(null);
            setSchools([]);
          } else {
            setError((err as Error).message);
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [limit]);

  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/70 p-6 text-sm text-[var(--brand-muted)]">
        Loading top schools…
      </div>
    );
  }

  if (error) {
    return (
      <StatusBanner
        status="error"
        message={`Unable to load top schools: ${error}`}
        onDismiss={() => setError(null)}
      />
    );
  }

  if (schools.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/70 p-6 text-sm text-[var(--brand-muted)]">
        No schools to display yet—check back soon.
      </div>
    );
  }

  const openCaseStudy = (url?: string | null) => {
    if (!url) return;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener');
    }
  };

  return (
    <div role="list" className="grid gap-6 md:grid-cols-2">
      {schools.map((school) => (
        <article
          key={school.id}
          role="listitem"
          className="flex flex-col gap-4 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-5 shadow-md"
        >
          <header className="flex items-center gap-4">
            {school.logo_url ? (
              <img
                src={school.logo_url}
                alt={`${school.name} logo`}
                className="h-14 w-14 rounded-full border border-[var(--brand-border)] object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-primary)]/20 text-sm font-semibold text-[var(--brand-primary)]">
                {school.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                {school.name}
              </h3>
              {school.metric_label ? (
                <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                  {school.metric_label}
                </p>
              ) : null}
            </div>
          </header>
          <p className="text-2xl font-bold text-[var(--brand-primary)]">
            {school.metric_value != null ? school.metric_value.toLocaleString() : '—'}
          </p>
          {school.case_study_url ? (
            <Button variant="outline" onClick={() => openCaseStudy(school.case_study_url)}>
              View case study
            </Button>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export default TopSchools;
