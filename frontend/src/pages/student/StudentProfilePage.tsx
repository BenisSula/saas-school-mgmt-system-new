import { type FormEvent, useEffect, useState } from 'react';
import RouteMeta from '../../components/layout/RouteMeta';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { api, type StudentProfileDetail, type StudentSubjectSummary } from '../../lib/api';
import { toast } from 'sonner';

type ContactField = { label: string; value: string };

export default function StudentProfilePage() {
  const [profile, setProfile] = useState<StudentProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ContactField[]>([]);
  const [promotionClassId, setPromotionClassId] = useState('');
  const [promotionNotes, setPromotionNotes] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [submittingPromotion, setSubmittingPromotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const detail = await api.student.getProfile();
        if (!cancelled) {
          setProfile(detail);
          setContacts(deriveContacts(detail.parentContacts));
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
      <RouteMeta title="Profile">
        <StatusBanner status="error" message={error} />
      </RouteMeta>
    );
  }

  if (loading || !profile) {
    return (
      <RouteMeta title="Profile">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-xl bg-[var(--brand-skeleton)]/40"
            />
          ))}
        </div>
      </RouteMeta>
    );
  }

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await api.student.updateProfile({
        firstName: profile.firstName,
        lastName: profile.lastName,
        parentContacts: contacts.map((entry) => entry.value)
      });
      setProfile(updated);
      toast.success('Profile updated successfully.');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePromotionSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!promotionClassId) {
      toast.error('Enter the target class identifier before submitting a request.');
      return;
    }
    setSubmittingPromotion(true);
    try {
      await api.student.requestPromotion({
        targetClassId: promotionClassId,
        notes: promotionNotes || undefined
      });
      toast.success('Promotion/class-change request submitted for review.');
      setPromotionClassId('');
      setPromotionNotes('');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmittingPromotion(false);
    }
  };

  return (
    <RouteMeta title="Profile">
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
            Personal profile
          </h1>
          <p className="text-sm text-[var(--brand-muted)]">
            Update your personal information and keep guardians or administrators informed about any
            change requests.
          </p>
        </header>

        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <form className="space-y-4" onSubmit={handleProfileSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="First name"
                value={profile.firstName}
                onChange={(event) => setProfile({ ...profile, firstName: event.target.value })}
              />
              <Input
                label="Last name"
                value={profile.lastName}
                onChange={(event) => setProfile({ ...profile, lastName: event.target.value })}
              />
              <Input label="Class" value={profile.className ?? 'Not assigned'} readOnly />
              <Input label="Admission number" value={profile.admissionNumber ?? '—'} readOnly />
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-muted)]">
                Parent / guardian contacts
              </h2>
              {contacts.map((contact, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Input
                    label={`Contact ${index + 1}`}
                    value={contact.value}
                    onChange={(event) =>
                      setContacts((current) =>
                        current.map((entry, i) =>
                          i === index ? { ...entry, value: event.target.value } : entry
                        )
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="self-end"
                    onClick={() =>
                      setContacts((current) =>
                        current.filter((_, contactIndex) => contactIndex !== index)
                      )
                    }
                    disabled={contacts.length === 1}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => setContacts((current) => [...current, { label: '', value: '' }])}
              >
                Add contact
              </Button>
            </div>

            <div className="flex justify-end">
              <Button type="submit" loading={savingProfile}>
                Save changes
              </Button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <header className="mb-3">
            <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
              Request class change or promotion
            </h2>
            <p className="text-sm text-[var(--brand-muted)]">
              Submit a request if you believe you should move to another class. Administrators will
              review the request before applying any changes.
            </p>
          </header>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handlePromotionSubmit}>
            <Input
              label="Target class ID"
              placeholder="e.g. class-uuid"
              value={promotionClassId}
              onChange={(event) => setPromotionClassId(event.target.value)}
              required
            />
            <label className="flex w-full flex-col gap-2 text-sm text-[var(--brand-muted)] sm:col-span-2">
              Reason / notes
              <textarea
                value={promotionNotes}
                onChange={(event) => setPromotionNotes(event.target.value)}
                rows={4}
                placeholder="Explain why you need a class change."
                className="rounded-md border border-[var(--brand-border)] bg-black/20 px-3 py-2 text-sm text-[var(--brand-surface-contrast)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/40"
              />
            </label>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" loading={submittingPromotion}>
                Submit request
              </Button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <header className="mb-3">
            <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
              Enrolled subjects
            </h2>
            <p className="text-sm text-[var(--brand-muted)]">
              Subject drop requests submitted from the results page will appear as pending below.
            </p>
          </header>
          {profile.subjects.length === 0 ? (
            <StatusBanner status="info" message="No subjects linked to your profile yet." />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {profile.subjects.map((subject) => (
                <SubjectChip key={subject.subjectId} subject={subject} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </RouteMeta>
  );
}

function deriveContacts(raw: unknown[]): ContactField[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ label: '', value: '' }];
  }
  return raw.map((value) => ({
    label: '',
    value: typeof value === 'string' ? value : JSON.stringify(value)
  }));
}

function SubjectChip({ subject }: { subject: StudentSubjectSummary }) {
  const status =
    subject.dropStatus === 'pending'
      ? 'Drop requested'
      : subject.dropStatus === 'approved'
        ? 'Drop approved'
        : subject.dropStatus === 'rejected'
          ? 'Drop rejected'
          : subject.dropRequested
            ? 'Drop requested'
            : 'Active';

  return (
    <li className="rounded-lg border border-[var(--brand-border)] bg-black/20 p-4">
      <p className="text-sm font-semibold text-[var(--brand-surface-contrast)]">
        {subject.name}
        {subject.code ? (
          <span className="text-xs text-[var(--brand-muted)]"> ({subject.code})</span>
        ) : null}
      </p>
      <p className="mt-2 text-xs uppercase tracking-wide text-[var(--brand-muted)]">{status}</p>
      {subject.dropRequestedAt ? (
        <p className="text-xs text-[var(--brand-muted)]">
          Requested {new Date(subject.dropRequestedAt).toLocaleString()}
        </p>
      ) : null}
    </li>
  );
}
