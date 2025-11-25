import { useMemo } from 'react';
import { ProfileLayout, type ProfileSection } from '../../components/profile/ProfileLayout';
import { ProfileSection as Section } from '../../components/profile/ProfileSection';
import { ActivityHistory } from '../../components/profile/ActivityHistory';
import { AuditLogs } from '../../components/profile/AuditLogs';
import { FileUploads } from '../../components/profile/FileUploads';
import { useProfileData } from '../../hooks/useProfileData';
import { useFileUpload } from '../../hooks/useFileUpload';
import { api, type TeacherProfileDetail, type TeacherProfile } from '../../lib/api';
import { isHOD } from '../../lib/utils/userHelpers';

interface HODProfileData extends TeacherProfileDetail {
  department?: string;
  teachersUnderOversight?: TeacherProfile[];
}

export default function HODProfilePage() {
  const profileLoader = useMemo(
    () => async () => {
      // Load teacher profile (HODs are teachers with additional role)
      const [profileData, usersData, teachersData] = await Promise.allSettled([
        api.teacher.getProfile(),
        api.listUsers(),
        api.listTeachers(),
      ]);

      if (profileData.status === 'fulfilled') {
        const teacherProfile = profileData.value;

        // Check if user has HOD role
        if (usersData.status === 'fulfilled') {
          const user = usersData.value.find((u) => u.email === teacherProfile.email);

          if (user && isHOD(user)) {
            // Extract department from metadata
            const hodRole = user.additional_roles?.find((r) => r.role === 'hod');
            const department =
              (hodRole?.metadata as { department?: string })?.department ||
              teacherProfile.subjects[0] ||
              'General';

            // Find teachers under oversight (teachers with same subjects)
            const teachersUnderOversight =
              teachersData.status === 'fulfilled'
                ? teachersData.value.filter(
                    (t) =>
                      t.id !== teacherProfile.id &&
                      t.subjects.some((subject) => teacherProfile.subjects.includes(subject))
                  )
                : [];

            return {
              ...teacherProfile,
              department,
              teachersUnderOversight,
            } as HODProfileData;
          }
        }

        return teacherProfile as HODProfileData;
      }

      throw new Error('Failed to load profile');
    },
    []
  );

  const { profile, loading, error, activities, auditLogs, uploads, setUploads } =
    useProfileData<HODProfileData>({
      profileLoader,
      enabled: true,
    });

  const { uploadFile: handleFileUpload, deleteFile: handleFileDelete } = useFileUpload({
    entityType: 'hod',
    entityId: profile?.id,
    onUploadSuccess: (upload) => {
      setUploads((prev) => [upload, ...prev]);
    },
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
                {profile.department && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-[var(--brand-muted)]">Department</p>
                    <p className="text-sm text-[var(--brand-surface-contrast)]">
                      {profile.department}
                    </p>
                  </div>
                )}
              </div>
            )}
          </Section>
        ),
      },
      {
        id: 'department',
        title: 'Department assignment',
        description: 'Department you oversee as Head of Department',
        content: (
          <Section isEmpty={!profile?.department} emptyMessage="No department assigned">
            {profile?.department && (
              <div className="rounded-lg border border-[var(--brand-border)] bg-slate-950/40 p-4">
                <p className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
                  {profile.department}
                </p>
              </div>
            )}
          </Section>
        ),
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
        ),
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
        ),
      },
      {
        id: 'teacher-oversight',
        title: 'Teacher oversight',
        description: 'Teachers under your department oversight',
        content: (
          <Section
            isEmpty={
              !profile?.teachersUnderOversight || profile.teachersUnderOversight.length === 0
            }
            emptyMessage="No teachers currently under your oversight"
          >
            {profile?.teachersUnderOversight && profile.teachersUnderOversight.length > 0 && (
              <div className="space-y-2">
                {profile.teachersUnderOversight.map((teacher) => (
                  <div
                    key={teacher.id}
                    className="rounded-lg border border-[var(--brand-border)]/60 bg-slate-950/40 p-3"
                  >
                    <p className="text-sm font-medium text-[var(--brand-surface-contrast)]">
                      {teacher.name}
                    </p>
                    <p className="text-xs text-[var(--brand-muted)]">{teacher.email}</p>
                    {teacher.subjects.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {teacher.subjects.map((subject) => (
                          <span
                            key={subject}
                            className="rounded-full bg-[var(--brand-accent)]/20 px-2 py-1 text-xs text-[var(--brand-accent)]"
                          >
                            {subject}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        ),
      },
      {
        id: 'department-analytics',
        title: 'Department analytics',
        description: 'Overview of department performance and statistics',
        content: (
          <Section
            isEmpty={true}
            emptyMessage="Department analytics will be displayed here when available"
          >
            {null}
          </Section>
        ),
      },
      {
        id: 'activity-history',
        title: 'Activity history',
        description: 'Recent actions and events',
        content: <ActivityHistory activities={activities} />,
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
        ),
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
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, activities, auditLogs, uploads, setUploads]
  );

  return (
    <ProfileLayout
      title={profile?.name || 'Profile'}
      subtitle={profile?.department ? `Head of ${profile.department}` : profile?.email || undefined}
      loading={loading}
      error={error}
      sections={sections}
      showEditButton={false}
    />
  );
}
