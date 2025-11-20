import { useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import { ProfileLayout, type ProfileSection } from '../../components/profile/ProfileLayout';
import { ProfileSection as Section } from '../../components/profile/ProfileSection';
import { ActivityHistory } from '../../components/profile/ActivityHistory';
import { AuditLogs } from '../../components/profile/AuditLogs';
import { FileUploads } from '../../components/profile/FileUploads';
import { useProfileData } from '../../hooks/useProfileData';
import { api, type TeacherProfileDetail } from '../../lib/api';

export default function TeacherProfilePage() {
  const [searchParams] = useSearchParams();
  const teacherId = searchParams.get('teacherId');

  const profileLoader = useMemo(
    () => async () => {
      if (teacherId) {
        const teacherData = await api.getTeacher(teacherId);
        // Convert TeacherProfile to TeacherProfileDetail format
        return {
          id: teacherData.id,
          name: teacherData.name,
          email: teacherData.email,
          subjects: teacherData.subjects,
          classes: teacherData.assigned_classes.map((className) => ({
            id: className,
            name: className,
            subjects: [],
            isClassTeacher: false
          }))
        } as TeacherProfileDetail;
      }
      return api.teacher.getProfile();
    },
    [teacherId]
  );

  const { profile, loading, error, activities, auditLogs, uploads, setUploads } =
    useProfileData<TeacherProfileDetail>({
      userId: teacherId || undefined,
      profileLoader,
      enabled: true
    });

  const sections: ProfileSection[] = useMemo(
    () => [
      {
        id: 'personal-info',
        title: 'Personal information',
        content: (
          <Section isEmpty={!profile}>
            {profile && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-medium text-[var(--brand-muted)]">Name</p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">{profile.name}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-[var(--brand-muted)]">Email</p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">
                    {profile.email || 'Not provided'}
                  </p>
                </div>
              </div>
            )}
          </Section>
        )
      },
      {
        id: 'subjects',
        title: 'Subject specializations',
        description: 'Subjects you are qualified to teach',
        content: (
          <Section
            isEmpty={!profile || profile.subjects.length === 0}
            emptyMessage="No subject specializations recorded"
          >
            {profile && profile.subjects.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {profile.subjects.map((subject) => (
                  <span
                    key={subject}
                    className="rounded-full border border-[var(--brand-border)] bg-[var(--brand-primary)]/20 px-3 py-1 text-sm text-[var(--brand-primary)]"
                  >
                    {subject}
                  </span>
                ))}
              </div>
            )}
          </Section>
        )
      },
      {
        id: 'classes',
        title: 'Assigned classes',
        description: 'Classes you are currently teaching',
        content: (
          <Section
            isEmpty={!profile || profile.classes.length === 0}
            emptyMessage="You are not currently assigned to any classes"
          >
            {profile && profile.classes.length > 0 && (
              <div className="space-y-3">
                {profile.classes.map((clazz) => (
                  <div
                    key={clazz.id}
                    className="rounded-lg border border-[var(--brand-border)] bg-slate-950/40 p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-semibold text-[var(--brand-surface-contrast)]">
                        {clazz.name}
                      </p>
                      {clazz.isClassTeacher && (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-200">
                          Classroom teacher
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                      Subjects
                    </p>
                    <p className="text-sm text-[var(--brand-muted)]">
                      {clazz.subjects.length > 0 ? clazz.subjects.join(', ') : 'Not specified'}
                    </p>
                  </div>
                ))}
              </div>
            )}
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
            onUpload={async (file) => {
              // TODO: Implement upload API when available
              console.log('Upload file:', file);
            }}
            onDelete={async (uploadId) => {
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
              // Refresh will be handled by the hook when we reload
              window.location.reload();
            }}
          />
        )
      }
    ],
    [profile, activities, auditLogs, uploads, setUploads]
  );

  return (
    <ProfileLayout
      title={profile?.name || 'Profile'}
      subtitle={profile?.email || undefined}
      loading={loading}
      error={error}
      sections={sections}
      showEditButton={false}
    />
  );
}
