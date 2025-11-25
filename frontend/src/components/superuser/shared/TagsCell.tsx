/**
 * Shared component for displaying tags as chips
 */

export interface TagsCellProps {
  tags?: string[] | null;
  maxDisplay?: number;
}

export function TagsCell({ tags, maxDisplay = 3 }: TagsCellProps) {
  if (!tags || tags.length === 0) {
    return <span className="text-[var(--brand-text-secondary)] text-sm">—</span>;
  }

  const displayTags = tags.slice(0, maxDisplay);
  const remaining = tags.length - maxDisplay;

  return (
    <div className="flex flex-wrap gap-1">
      {displayTags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--brand-text-secondary)]"
        >
          {tag}
        </span>
      ))}
      {remaining > 0 && (
        <span className="inline-flex items-center rounded-full border border-[var(--brand-border)] bg-[var(--brand-surface-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--brand-text-secondary)]">
          +{remaining}
        </span>
      )}
    </div>
  );
}
