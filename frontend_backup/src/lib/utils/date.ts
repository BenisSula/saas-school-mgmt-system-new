/**
 * Shared date formatting utilities
 */

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    if (value.length >= 10) {
      return value.slice(0, 10);
    }
    return '—';
  }
  return parsed.toLocaleDateString();
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleString();
}

export function formatDateShort(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    if (value.length >= 10) {
      return value.slice(0, 10);
    }
    return '—';
  }
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function deriveDateRange(value: '7' | '30' | '90' | 'all'): { from: string; to: string } {
  if (value === 'all') {
    return { from: '', to: '' };
  }
  const days = Number(value);
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - days + 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10)
  };
}

export function defaultDate(): string {
  return new Date().toISOString().slice(0, 10);
}
