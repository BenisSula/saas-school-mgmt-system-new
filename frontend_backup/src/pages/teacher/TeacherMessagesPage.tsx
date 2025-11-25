import { useEffect, useState } from 'react';
import RouteMeta from '../../components/layout/RouteMeta';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { api, type TeacherMessage } from '../../lib/api';

function MessageCard({ message }: { message: TeacherMessage }) {
  const isUnread = message.status === 'unread';
  return (
    <article className="space-y-2 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-5 shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
            {message.title}
          </h3>
          <p className="text-xs text-[var(--brand-muted)]">
            {new Date(message.timestamp).toLocaleString()}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
            isUnread
              ? 'bg-[var(--brand-primary)]/20 text-[var(--brand-primary-contrast)]'
              : 'bg-white/10 text-[var(--brand-muted)]'
          }`}
        >
          {isUnread ? 'Unread' : 'Info'}
        </span>
      </header>
      <p className="text-sm leading-relaxed text-[var(--brand-muted)]">{message.body}</p>
      {message.className ? (
        <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
          Class: {message.className}
        </p>
      ) : null}
    </article>
  );
}

export default function TeacherMessagesPage() {
  const [messages, setMessages] = useState<TeacherMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.teacher.getMessages();
        if (!cancelled) {
          setMessages(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <RouteMeta title="Messages">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  if (error) {
    return (
      <RouteMeta title="Messages">
        <StatusBanner status="error" message={error} />
      </RouteMeta>
    );
  }

  if (messages.length === 0) {
    return (
      <RouteMeta title="Messages">
        <StatusBanner status="info" message="No messages right now. Check back later." />
      </RouteMeta>
    );
  }

  return (
    <RouteMeta title="Messages">
      <div className="space-y-4">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
            Staff communications
          </h1>
          <p className="text-sm text-[var(--brand-muted)]">
            Stay up to date with announcements and class-specific reminders from school leadership.
          </p>
        </header>
        <div className="space-y-4">
          {messages.map((message) => (
            <MessageCard key={message.id} message={message} />
          ))}
        </div>
      </div>
    </RouteMeta>
  );
}

