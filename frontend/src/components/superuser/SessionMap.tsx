import { useMemo } from 'react';
import { Card } from '../ui/Card';
import { MapPin, Globe, Users } from 'lucide-react';
import type { UserSession } from '../../lib/api';

export interface SessionMapProps {
  sessions: UserSession[];
  className?: string;
}

interface IPLocation {
  ip: string;
  count: number;
  sessions: UserSession[];
  country?: string;
  city?: string;
}

export function SessionMap({ sessions, className = '' }: SessionMapProps) {
  const ipLocations = useMemo(() => {
    const ipMap = new Map<string, UserSession[]>();

    sessions.forEach((session) => {
      if (session.ipAddress) {
        const existing = ipMap.get(session.ipAddress) || [];
        ipMap.set(session.ipAddress, [...existing, session]);
      }
    });

    const locations: IPLocation[] = Array.from(ipMap.entries()).map(([ip, sessionList]) => ({
      ip,
      count: sessionList.length,
      sessions: sessionList,
      // In a real implementation, you'd use a geolocation API like MaxMind or ipapi.co
      // For now, we'll show IP addresses grouped
      country: undefined,
      city: undefined
    }));

    return locations.sort((a, b) => b.count - a.count);
  }, [sessions]);

  const totalIPs = ipLocations.length;
  const totalSessions = sessions.length;

  if (sessions.length === 0) {
    return (
      <Card padding="md" className={className}>
        <div className="text-center text-[var(--brand-text-secondary)]">
          <Globe className="mx-auto mb-4 h-12 w-12 text-[var(--brand-muted)]" />
          <p className="font-semibold">No Sessions</p>
          <p className="mt-1 text-sm">No active sessions to display on the map.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="md" className={className}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--brand-text-primary)]">
            Session Locations
          </h3>
          <div className="flex items-center gap-4 text-sm text-[var(--brand-text-secondary)]">
            <div className="flex items-center gap-1">
              <Globe className="h-4 w-4" />
              <span>{totalIPs} {totalIPs === 1 ? 'location' : 'locations'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{totalSessions} {totalSessions === 1 ? 'session' : 'sessions'}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {ipLocations.map((location) => (
            <div
              key={location.ip}
              className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-secondary)] p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[var(--brand-primary)]" />
                    <span className="font-mono font-semibold text-[var(--brand-text-primary)]">
                      {location.ip}
                    </span>
                    <span className="rounded-full bg-[var(--brand-primary)]/20 px-2 py-0.5 text-xs font-medium text-[var(--brand-primary)]">
                      {location.count} {location.count === 1 ? 'session' : 'sessions'}
                    </span>
                  </div>
                  {location.city && location.country && (
                    <p className="mt-1 text-sm text-[var(--brand-text-secondary)]">
                      {location.city}, {location.country}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {location.sessions.slice(0, 3).map((session) => {
                      const deviceInfo = (session.normalizedDeviceInfo || session.deviceInfo) as {
                        platform?: string;
                        browser?: string;
                        os?: string;
                      } | undefined;
                      const deviceLabel = deviceInfo?.platform || deviceInfo?.browser || 
                        (session.userAgent ? session.userAgent.split(' ')[0] : 'Unknown Device');
                      return (
                        <div
                          key={session.id}
                          className="rounded border border-[var(--brand-border)] bg-[var(--brand-surface)] px-2 py-1 text-xs text-[var(--brand-text-secondary)]"
                          title={session.userAgent || undefined}
                        >
                          {deviceLabel}
                        </div>
                      );
                    })}
                    {location.sessions.length > 3 && (
                      <div className="rounded border border-[var(--brand-border)] bg-[var(--brand-surface)] px-2 py-1 text-xs text-[var(--brand-text-secondary)]">
                        +{location.sessions.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {totalIPs > 10 && (
          <p className="text-center text-sm text-[var(--brand-text-secondary)]">
            Showing top 10 locations by session count
          </p>
        )}
      </div>
    </Card>
  );
}

