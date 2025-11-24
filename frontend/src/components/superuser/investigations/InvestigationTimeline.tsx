import { useMemo } from 'react';
import { Clock, CheckCircle2, AlertCircle, XCircle, FileText } from 'lucide-react';
import { formatDateTime } from '../../../lib/utils/date';
import type { InvestigationCase, CaseNote } from '../../../lib/api';

export interface InvestigationTimelineProps {
  case_: InvestigationCase;
  notes?: CaseNote[];
}

interface TimelineEvent {
  type: 'opened' | 'investigated' | 'resolved' | 'closed' | 'note';
  timestamp: string;
  label: string;
  description?: string;
  user?: string;
}

const eventIcons = {
  opened: Clock,
  investigated: AlertCircle,
  resolved: CheckCircle2,
  closed: XCircle,
  note: FileText,
};

const eventColors = {
  opened: 'text-blue-500',
  investigated: 'text-yellow-500',
  resolved: 'text-green-500',
  closed: 'text-gray-500',
  note: 'text-purple-500',
};

export function InvestigationTimeline({ case_, notes = [] }: InvestigationTimelineProps) {
  const timelineEvents = useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = [];

    // Case opened
    if (case_.openedAt) {
      events.push({
        type: 'opened',
        timestamp: case_.openedAt,
        label: 'Case Opened',
        user: case_.createdBy,
      });
    }

    // Case investigated
    if (case_.investigatedAt) {
      events.push({
        type: 'investigated',
        timestamp: case_.investigatedAt,
        label: 'Investigation Started',
        user: case_.assignedTo || undefined,
      });
    }

    // Case resolved
    if (case_.resolvedAt) {
      events.push({
        type: 'resolved',
        timestamp: case_.resolvedAt,
        label: 'Case Resolved',
        description: case_.resolution || undefined,
        user: case_.resolvedBy || undefined,
      });
    }

    // Case closed
    if (case_.closedAt) {
      events.push({
        type: 'closed',
        timestamp: case_.closedAt,
        label: 'Case Closed',
      });
    }

    // Add notes
    notes.forEach((note) => {
      events.push({
        type: 'note',
        timestamp: note.createdAt,
        label: `${note.noteType.charAt(0).toUpperCase() + note.noteType.slice(1)} Note`,
        description: note.note,
        user: note.createdBy,
      });
    });

    // Sort by timestamp
    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [case_, notes]);

  if (timelineEvents.length === 0) {
    return (
      <div className="card-base p-6">
        <p className="text-sm text-[var(--brand-muted)]">No timeline events available.</p>
      </div>
    );
  }

  return (
    <div className="card-base p-6">
      <h3 className="mb-4 text-lg font-semibold text-[var(--brand-text-primary)]">Timeline</h3>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-[var(--brand-border)]" />

        {/* Timeline events */}
        <div className="space-y-6">
          {timelineEvents.map((event, index) => {
            const Icon = eventIcons[event.type];
            const colorClass = eventColors[event.type];

            return (
              <div
                key={`${event.type}-${event.timestamp}-${index}`}
                className="relative flex items-start gap-4"
              >
                {/* Icon */}
                <div
                  className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-surface)] ${colorClass} border-2 border-[var(--brand-border)]`}
                >
                  <Icon className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="flex-1 pb-6">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-[var(--brand-text-primary)]">{event.label}</h4>
                    <span className="text-xs text-[var(--brand-text-secondary)]">
                      {formatDateTime(event.timestamp)}
                    </span>
                  </div>
                  {event.user && (
                    <p className="mt-1 text-xs text-[var(--brand-text-secondary)]">
                      By: <span className="font-mono">{event.user.slice(0, 8)}...</span>
                    </p>
                  )}
                  {event.description && (
                    <p className="mt-2 text-sm text-[var(--brand-text-secondary)]">
                      {event.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
