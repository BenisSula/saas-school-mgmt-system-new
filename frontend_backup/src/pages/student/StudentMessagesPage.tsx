import { useEffect, useState } from 'react';
import RouteMeta from '../../components/layout/RouteMeta';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { Button } from '../../components/ui/Button';
import { api, type StudentMessage } from '../../lib/api';
import { toast } from 'sonner';

export default function StudentMessagesPage() {
  const [messages, setMessages] = useState<StudentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.student.listMessages();
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
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <RouteMeta title="Messages">
        <StatusBanner status="error" message={error} />
      </RouteMeta>
    );
  }

  return (
    <RouteMeta title="Messages">
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
            Messages & alerts
          </h1>
          <p className="text-sm text-[var(--brand-muted)]">
            Announcements from your teachers and school administrators appear here. Keep an eye on
            unread items for important deadlines.
          </p>
        </header>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-24 animate-pulse rounded-xl bg-[var(--brand-skeleton)]/40"
              />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <StatusBanner status="info" message="No messages right now. Check back later." />
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <article
                key={message.id}
                className="space-y-3 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-5 shadow-sm"
              >
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                      {message.title}
                    </h2>
                    <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                      {message.className ?? 'All classes'} ·{' '}
                      {new Date(message.sentAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase ${
                      message.status === 'unread'
                        ? 'bg-[var(--brand-primary)]/20 text-[var(--brand-primary-contrast)]'
                        : message.status === 'info'
                          ? 'bg-amber-500/20 text-amber-200'
                          : 'bg-white/10 text-[var(--brand-muted)]'
                    }`}
                  >
                    {message.status}
                  </span>
                </header>
                <p className="text-sm leading-relaxed text-[var(--brand-muted)]">{message.body}</p>
                {message.status === 'unread' ? (
                  <footer className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          await api.student.markMessageAsRead(message.id);
                          setMessages((current) =>
                            current.map((msg) =>
                              msg.id === message.id ? { ...msg, status: 'read' } : msg
                            )
                          );
                          toast.success('Message marked as read.');
                        } catch (err) {
                          toast.error((err as Error).message);
                        }
                      }}
                    >
                      Mark as read
                    </Button>
                  </footer>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </RouteMeta>
  );
}
