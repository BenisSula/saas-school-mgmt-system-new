import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ProfileLayout, type ProfileSection } from '../../components/profile/ProfileLayout';
import { ProfileSection as Section } from '../../components/profile/ProfileSection';
import { ActivityHistory } from '../../components/profile/ActivityHistory';
import { AuditLogs } from '../../components/profile/AuditLogs';
import { FileUploads } from '../../components/profile/FileUploads';
import { PasswordChangeSection } from '../../components/profile/PasswordChangeSection';
import { useProfileData } from '../../hooks/useProfileData';
import { useFileUpload } from '../../hooks/useFileUpload';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import {
  api,
  type StudentProfileDetail,
  type StudentSubjectSummary,
  type SchoolClass
} from '../../lib/api';
import { deriveContacts } from '../../lib/utils/data';
import { formatDateTime } from '../../lib/utils/date';

type ContactField = { label: string; value: string };

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
    <div className="rounded-lg border border-[var(--brand-border)] bg-slate-950/40 p-4">
      <p className="text-sm font-semibold text-[var(--brand-surface-contrast)]">
        {subject.name}
        {subject.code ? (
          <span className="text-xs text-[var(--brand-muted)]"> ({subject.code})</span>
        ) : null}
      </p>
      <p className="mt-2 text-xs uppercase tracking-wide text-[var(--brand-muted)]">{status}</p>
      {subject.dropRequestedAt ? (
        <p className="text-xs text-[var(--brand-muted)]">
          Requested {formatDateTime(subject.dropRequestedAt)}
        </p>
      ) : null}
    </div>
  );
}

export default function StudentProfilePage() {
  const [searchParams] = useSearchParams();
  const studentId = searchParams.get('studentId');
  const [localProfile, setLocalProfile] = useState<StudentProfileDetail | null>(null);
  const [contacts, setContacts] = useState<ContactField[]>([]);
  const [promotionClassId, setPromotionClassId] = useState('');
  const [promotionNotes, setPromotionNotes] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [submittingPromotion, setSubmittingPromotion] = useState(false);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  const profileLoader = useMemo(
    () => async () => {
      // Load classes in parallel
      const [detail, classesList] = await Promise.all([
        studentId
          ? api.getStudent(studentId).then((s) => ({
              id: s.id,
              firstName: s.first_name,
              lastName: s.last_name,
              classId: s.class_id,
              className: s.class_id,
              admissionNumber: s.admission_number,
              parentContacts: Array.isArray(s.parent_contacts) ? s.parent_contacts : [],
              subjects: []
            }))
          : api.student.getProfile(),
        api.listClasses()
      ]);

      // Set classes and contacts
      setClasses(classesList);
      if (detail) {
        setContacts(deriveContacts(detail.parentContacts));
      }

      return detail;
    },
    [studentId]
  );

  const { profile, loading, error, activities, auditLogs, uploads, setUploads } =
    useProfileData<StudentProfileDetail>({
      userId: studentId || undefined,
      profileLoader,
      enabled: true
    });

  const { uploadFile: handleFileUpload, deleteFile: handleFileDelete } = useFileUpload({
    entityType: 'student',
    entityId: profile?.id,
    onUploadSuccess: (upload) => {
      setUploads((prev) => [upload, ...prev]);
    }
  });

  // Sync profile to local state for editing
  useEffect(() => {
    if (profile && (!localProfile || localProfile.id !== profile.id)) {
      setLocalProfile(profile);
      setContacts(deriveContacts(profile.parentContacts));
    }
  }, [profile, localProfile]);

  const handleProfileSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!localProfile) return;

      setSavingProfile(true);
      try {
        const updated = await api.student.updateProfile({
          firstName: localProfile.firstName,
          lastName: localProfile.lastName,
          parentContacts: contacts.map((entry) => entry.value)
        });
        setLocalProfile(updated);
        setIsEditing(false);
        toast.success('Profile updated successfully.');
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setSavingProfile(false);
      }
    },
    [localProfile, contacts]
  );

  const handlePromotionSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
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
    },
    [promotionClassId, promotionNotes]
  );

  const displayProfile = localProfile || profile;

  const sections: ProfileSection[] = useMemo(
    () => [
      {
        id: 'personal-info',
        title: 'Personal information',
        content: (
          <Section isEmpty={!displayProfile}>
            {displayProfile && (
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="First name"
                    value={displayProfile.firstName}
                    onChange={(event) =>
                      setLocalProfile({ ...displayProfile, firstName: event.target.value })
                    }
                    disabled={!isEditing}
                  />
                  <Input
                    label="Last name"
                    value={displayProfile.lastName}
                    onChange={(event) =>
                      setLocalProfile({ ...displayProfile, lastName: event.target.value })
                    }
                    disabled={!isEditing}
                  />
                  <Input
                    label="Class"
                    value={displayProfile.className ?? 'Not assigned'}
                    readOnly
                  />
                  <Input
                    label="Admission number"
                    value={displayProfile.admissionNumber ?? '—'}
                    readOnly
                  />
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--brand-muted)]">
                    Parent / guardian contacts
                  </h3>
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
                        disabled={!isEditing}
                      />
                      {isEditing && (
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
                      )}
                    </div>
                  ))}
                  {isEditing && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setContacts((current) => [...current, { label: '', value: '' }])
                      }
                    >
                      Add contact
                    </Button>
                  )}
                </div>

                {isEditing && (
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" loading={savingProfile}>
                      Save changes
                    </Button>
                  </div>
                )}
              </form>
            )}
          </Section>
        )
      },
      {
        id: 'class-assignment',
        title: 'Class assignment',
        description: 'Current class and promotion requests',
        content: (
          <Section title="Current class" isEmpty={!displayProfile}>
            {displayProfile && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-[var(--brand-surface-contrast)]">
                    {displayProfile.className || 'Not assigned'}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--brand-border)]/60 bg-slate-950/40 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-[var(--brand-surface-contrast)]">
                    Request class change or promotion
                  </h3>
                  <p className="mb-4 text-xs text-[var(--brand-muted)]">
                    Submit a request if you believe you should move to another class. Administrators
                    will review the request before applying any changes.
                  </p>
                  <form onSubmit={handlePromotionSubmit} className="space-y-4">
                    <Select
                      label="Target class"
                      value={promotionClassId}
                      onChange={(event) => setPromotionClassId(event.target.value)}
                      options={classes.map((clazz) => ({
                        value: clazz.id,
                        label: clazz.name
                      }))}
                      required
                      disabled={classes.length === 0}
                    />
                    <label className="flex w-full flex-col gap-2 text-sm text-[var(--brand-muted)]">
                      Reason / notes
                      <textarea
                        value={promotionNotes}
                        onChange={(event) => setPromotionNotes(event.target.value)}
                        rows={4}
                        placeholder="Explain why you need a class change."
                        className="rounded-md border border-[var(--brand-border)] bg-black/20 px-3 py-2 text-sm text-[var(--brand-surface-contrast)] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/40"
                      />
                    </label>
                    <div className="flex justify-end">
                      <Button type="submit" loading={submittingPromotion}>
                        Submit request
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </Section>
        )
      },
      {
        id: 'subjects',
        title: 'Enrolled subjects',
        description:
          'Subject drop requests submitted from the results page will appear as pending below',
        content: (
          <Section
            isEmpty={!displayProfile || displayProfile.subjects.length === 0}
            emptyMessage="No subjects linked to your profile yet"
          >
            {displayProfile && displayProfile.subjects.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {displayProfile.subjects.map((subject) => (
                  <SubjectChip key={subject.subjectId} subject={subject} />
                ))}
              </div>
            )}
          </Section>
        )
      },
      {
        id: 'academic-history',
        title: 'Academic history',
        description: 'Past academic records and achievements',
        content: (
          <Section
            isEmpty={true}
            emptyMessage="Academic history will be displayed here when available"
          >
            {null}
          </Section>
        )
      },
      {
        id: 'activity-history',
        title: 'Activity history',
        description: 'Recent actions and events',
        content: <ActivityHistory activities={activities} />
      },
      {
        id: 'uploads',
        title: 'Uploads & attachments',
        description: 'Files and documents associated with your profile',
        content: (
          <FileUploads
            uploads={uploads}
            canUpload={true}
            canDelete={true}
            onUpload={async (file, description) => {
              await handleFileUpload(file, description);
            }}
            onDelete={async (uploadId) => {
              await handleFileDelete(uploadId);
              setUploads((prev) => prev.filter((u) => u.id !== uploadId));
            }}
          />
        )
      },
      {
        id: 'audit-logs',
        title: 'Audit logs',
        description: 'Detailed log of all actions performed on your account',
        content: (
          <AuditLogs
            logs={auditLogs}
            onRefresh={async () => {
              window.location.reload();
            }}
          />
        )
      },
      {
        id: 'password-change',
        title: 'Security',
        description: 'Change your account password',
        content: <PasswordChangeSection />
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      displayProfile,
      contacts,
      classes,
      promotionClassId,
      promotionNotes,
      isEditing,
      savingProfile,
      submittingPromotion,
      activities,
      auditLogs,
      uploads,
      setUploads,
      handleProfileSubmit,
      handlePromotionSubmit
    ]
  );

  return (
    <ProfileLayout
      title={displayProfile ? `${displayProfile.firstName} ${displayProfile.lastName}` : 'Profile'}
      subtitle={
        displayProfile?.admissionNumber ? `Admission: ${displayProfile.admissionNumber}` : undefined
      }
      loading={loading}
      error={error}
      sections={sections}
      showEditButton={true}
      onEdit={() => setIsEditing(true)}
    />
  );
}
