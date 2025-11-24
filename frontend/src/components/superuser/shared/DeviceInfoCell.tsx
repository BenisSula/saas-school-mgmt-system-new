/**
 * Shared component for displaying device information in tables
 */

import { Monitor } from 'lucide-react';
import {
  formatDeviceInfo,
  formatDevicePlatform,
  type NormalizedDeviceInfo,
} from '../../../utils/formatters';

export interface DeviceInfoCellProps {
  deviceInfo?: NormalizedDeviceInfo | Record<string, unknown> | null;
  userAgent?: string | null;
  showFull?: boolean;
}

export function DeviceInfoCell({ deviceInfo, userAgent, showFull = false }: DeviceInfoCellProps) {
  const normalized = deviceInfo as NormalizedDeviceInfo | undefined;

  if (showFull && normalized) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-[var(--brand-muted)]" />
          <span className="text-[var(--brand-text-primary)] text-sm font-medium">
            {formatDevicePlatform(normalized)}
          </span>
        </div>
        <div className="text-xs text-[var(--brand-text-secondary)] space-y-0.5">
          {normalized.os && <div>OS: {normalized.os}</div>}
          {normalized.browser && <div>Browser: {normalized.browser}</div>}
          {normalized.deviceType && <div>Type: {normalized.deviceType}</div>}
        </div>
      </div>
    );
  }

  const displayText = formatDeviceInfo(normalized) || userAgent || '—';

  return (
    <div className="flex items-center gap-2">
      <Monitor className="h-4 w-4 text-[var(--brand-muted)] flex-shrink-0" />
      <span
        className="text-[var(--brand-text-secondary)] text-sm truncate max-w-xs"
        title={userAgent || displayText}
      >
        {displayText}
      </span>
    </div>
  );
}
