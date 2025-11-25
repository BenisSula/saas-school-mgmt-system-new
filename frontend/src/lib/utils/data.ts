/**
 * Shared data transformation utilities
 */

export function deriveContacts(raw: unknown[]): Array<{ label: string; value: string }> {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ label: '', value: '' }];
  }
  return raw.map((value) => ({
    label: '',
    value: typeof value === 'string' ? value : JSON.stringify(value),
  }));
}

export function calculatePercentage(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

export function formatCurrency(
  amount: number | null | undefined,
  currency: string = 'USD'
): string {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}
