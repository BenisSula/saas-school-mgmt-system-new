/**
 * Reusable timeline/stepper component for displaying chronological events
 */

import React from 'react';
import { CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react';

export interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  timestamp: string | Date;
  status?: 'completed' | 'pending' | 'active' | 'error';
  icon?: React.ReactNode;
}

export interface TimelineStepperProps {
  events: TimelineEvent[];
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}

const getStatusIcon = (status?: TimelineEvent['status'], customIcon?: React.ReactNode) => {
  if (customIcon) return customIcon;

  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'active':
      return <Clock className="h-5 w-5 text-blue-500" />;
    case 'error':
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    case 'pending':
    default:
      return <Circle className="h-5 w-5 text-[var(--brand-muted)]" />;
  }
};

const formatTimestamp = (timestamp: string | Date): string => {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleString();
};

export function TimelineStepper({
  events,
  orientation = 'vertical',
  className = '',
}: TimelineStepperProps) {
  if (events.length === 0) {
    return null;
  }

  if (orientation === 'horizontal') {
    return (
      <div className={`flex items-center gap-4 overflow-x-auto pb-4 ${className}`}>
        {events.map((event, index) => (
          <div key={event.id} className="flex items-center gap-2 flex-shrink-0">
            <div className="flex flex-col items-center gap-2">
              {getStatusIcon(event.status, event.icon)}
              <div className="text-xs text-[var(--brand-muted)] text-center max-w-[100px]">
                {formatTimestamp(event.timestamp)}
              </div>
            </div>
            <div className="flex-1 min-w-[100px]">
              <div className="text-sm font-medium text-[var(--brand-text-primary)]">
                {event.title}
              </div>
              {event.description && (
                <div className="text-xs text-[var(--brand-text-secondary)] mt-1">
                  {event.description}
                </div>
              )}
            </div>
            {index < events.length - 1 && (
              <div className="h-0.5 w-8 bg-[var(--brand-border)] flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    );
  }

  // Vertical orientation (default)
  return (
    <div className={`space-y-4 ${className}`}>
      {events.map((event, index) => (
        <div key={event.id} className="flex gap-4">
          {/* Timeline line */}
          <div className="flex flex-col items-center">
            {getStatusIcon(event.status, event.icon)}
            {index < events.length - 1 && (
              <div className="w-0.5 h-full min-h-[40px] bg-[var(--brand-border)] mt-2" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 pb-4">
            <div className="text-sm font-medium text-[var(--brand-text-primary)]">
              {event.title}
            </div>
            {event.description && (
              <div className="text-xs text-[var(--brand-text-secondary)] mt-1">
                {event.description}
              </div>
            )}
            <div className="text-xs text-[var(--brand-muted)] mt-1">
              {formatTimestamp(event.timestamp)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
