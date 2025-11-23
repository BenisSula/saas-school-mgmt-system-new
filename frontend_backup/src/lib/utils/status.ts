/**
 * Shared status badge utilities
 */

export function getStatusBadgeClass(status: string): string {
  switch (status?.toLowerCase()) {
    case 'active':
    case 'present':
    case 'paid':
      return 'bg-emerald-500/20 text-emerald-200';
    case 'pending':
    case 'late':
      return 'bg-amber-500/20 text-amber-200';
    case 'suspended':
    case 'absent':
    case 'overdue':
    case 'inactive':
      return 'bg-red-500/20 text-red-200';
    default:
      return 'bg-slate-500/20 text-slate-200';
  }
}

export function formatStatus(status: string | null | undefined): string {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1);
}
