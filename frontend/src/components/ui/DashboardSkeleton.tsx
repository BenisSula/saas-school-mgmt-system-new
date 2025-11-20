export function DashboardSkeleton() {
  return (
    <div
      className="space-y-5 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/60 p-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="h-6 w-48 animate-pulse rounded bg-white/10" />
      <div className="space-y-3">
        <div className="h-4 w-full animate-pulse rounded bg-white/5" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-white/5" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-white/5" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-24 animate-pulse rounded-lg border border-[var(--brand-border)] bg-white/5" />
        <div className="h-24 animate-pulse rounded-lg border border-[var(--brand-border)] bg-white/5" />
      </div>
    </div>
  );
}

export default DashboardSkeleton;
