import type { ReactNode } from 'react';

export interface PlaceholderPageProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function PlaceholderPage({ title, description, children }: PlaceholderPageProps) {
  return (
    <section className="space-y-6 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-8 shadow-sm">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm text-[var(--brand-muted)]">{description}</p>
        ) : null}
      </header>
      {children ?? (
        <div className="rounded-lg border border-dashed border-[var(--brand-border)]/70 bg-black/5 p-6 text-sm text-[var(--brand-muted)]">
          Content for this section is coming soon. Check back after the next release cycle.
        </div>
      )}
    </section>
  );
}

export default PlaceholderPage;
