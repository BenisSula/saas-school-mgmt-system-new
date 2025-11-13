import { useEffect, useState } from 'react';
import RouteMeta from '../../components/layout/RouteMeta';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { api, type TeacherProfileDetail } from '../../lib/api';

export default function TeacherProfilePage() {
  const [profile, setProfile] = useState<TeacherProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.teacher.getProfile();
        if (!cancelled) {
          setProfile(data);
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
      <RouteMeta title="Profile">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  if (error) {
    return (
      <RouteMeta title="Profile">
        <StatusBanner status="error" message={error} />
      </RouteMeta>
    );
  }

  if (!profile) {
    return (
      <RouteMeta title="Profile">
        <StatusBanner status="info" message="Profile data not available." />
      </RouteMeta>
    );
  }

  return (
    <RouteMeta title="Profile">
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
            {profile.name}
          </h1>
          <p className="text-sm text-[var(--brand-muted)]">{profile.email ?? 'No email on file'}</p>
        </header>

        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">Subjects</h2>
          {profile.subjects.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--brand-muted)]">
              No subject specialisations recorded.
            </p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2 text-sm text-[var(--brand-surface-contrast)]">
              {profile.subjects.map((subject) => (
                <li
                  key={subject}
                  className="rounded-full border border-[var(--brand-border)] bg-black/15 px-3 py-1"
                >
                  {subject}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
            Active classes
          </h2>
          {profile.classes.length === 0 ? (
            <p className="text-sm text-[var(--brand-muted)]">
              You are not currently assigned to any classes.
            </p>
          ) : (
            <ul className="space-y-3">
              {profile.classes.map((clazz) => (
                <li
                  key={clazz.id}
                  className="rounded-lg border border-[var(--brand-border)] bg-black/15 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--brand-surface-contrast)]">
                      {clazz.name}
                    </p>
                    {clazz.isClassTeacher ? (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-200">
                        Classroom teacher
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                    Subjects
                  </p>
                  <p className="text-sm text-[var(--brand-muted)]">
                    {clazz.subjects.length > 0 ? clazz.subjects.join(', ') : 'Not specified'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </RouteMeta>
  );
}
