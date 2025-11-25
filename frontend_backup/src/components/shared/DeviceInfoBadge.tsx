/**
 * Reusable badge component for displaying device information
 */

import { Monitor, Smartphone, Tablet, Laptop } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { formatDeviceInfo, formatDevicePlatform, type NormalizedDeviceInfo } from '../../utils/formatters';

export interface DeviceInfoBadgeProps {
  deviceInfo?: NormalizedDeviceInfo | Record<string, unknown> | null;
  userAgent?: string | null;
  variant?: 'default' | 'compact' | 'detailed';
  className?: string;
}

const getDeviceIcon = (deviceType?: string) => {
  switch (deviceType?.toLowerCase()) {
    case 'mobile':
      return Smartphone;
    case 'tablet':
      return Tablet;
    case 'desktop':
      return Laptop;
    default:
      return Monitor;
  }
};

export function DeviceInfoBadge({
  deviceInfo,
  userAgent,
  variant = 'default',
  className = ''
}: DeviceInfoBadgeProps) {
  const normalized = deviceInfo as NormalizedDeviceInfo | undefined;
  
  if (!normalized && !userAgent) {
    return (
      <Badge variant="outline" className={className}>
        <Monitor className="h-3 w-3 mr-1" />
        Unknown
      </Badge>
    );
  }

  const DeviceIcon = getDeviceIcon(normalized?.deviceType);

  if (variant === 'compact') {
    const platform = formatDevicePlatform(normalized) || 'Unknown';
    return (
      <Badge variant="outline" className={className}>
        <DeviceIcon className="h-3 w-3 mr-1" />
        {platform}
      </Badge>
    );
  }

  if (variant === 'detailed' && normalized) {
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <Badge variant="outline" className="w-fit">
          <DeviceIcon className="h-3 w-3 mr-1" />
          {formatDevicePlatform(normalized)}
        </Badge>
        <div className="text-xs text-[var(--brand-muted)] space-y-0.5">
          {normalized.os && <div>OS: {normalized.os}</div>}
          {normalized.browser && <div>Browser: {normalized.browser}</div>}
          {normalized.deviceType && <div>Type: {normalized.deviceType}</div>}
        </div>
      </div>
    );
  }

  // Default variant
  const displayText = formatDeviceInfo(normalized) || userAgent || 'Unknown';
  
  return (
    <Badge variant="outline" className={className}>
      <DeviceIcon className="h-3 w-3 mr-1" />
      <span className="truncate max-w-xs" title={userAgent || displayText}>{displayText}</span>
    </Badge>
  );
}

