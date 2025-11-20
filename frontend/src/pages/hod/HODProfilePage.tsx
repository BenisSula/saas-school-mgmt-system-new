import { useMemo } from 'react';
import { ProfileLayout, type ProfileSection } from '../../components/profile/ProfileLayout';
import {
  AssignedClassesSection,
  AssignedSubjectsSection,
  DepartmentSection,
  ActivityHistorySection,
  FileUploadsSection,
  AuditLogsSection
} from '../../components/profile/sections';
import { useProfileData } from '../../hooks/useProfileData';
import { api, type TeacherProfileDetail, type TeacherProfile } from '../../lib/api';

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
        api.listTeachers()
      ]);

      if (profileData.status === 'fulfilled') {
        const teacherProfile = profileData.value;

        // Check if user has HOD role
        if (usersData.status === 'fulfilled') {
          const user = usersData.value.find((u) => u.email === teacherProfile.email);
          const isHOD = user?.additional_roles?.some((r) => r.role === 'hod');

          if (isHOD && user) {
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
              teachersUnderOversight
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
      enabled: true
    });

  const sections: ProfileSection[] = useMemo(
    () => [
      {
        id: 'personal-info',
        title: 'Personal information',
        content: (
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              {profile ? (
                <>
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
                      <p className="mb-1 text-xs font-medium text-[var(--brand-muted)]">
                        Department
                      </p>
                      <p className="text-sm text-[var(--brand-surface-contrast)]">
                        {profile.department}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-[var(--brand-muted)]">No personal information available</p>
              )}
            </div>
          </div>
        )
      },
      {
        id: 'department',
        title: 'Department assignment',
        description: 'Department you oversee as Head of Department',
        content: (
          <DepartmentSection
            department={profile?.department}
            teachersUnderOversight={profile?.teachersUnderOversight}
            emptyMessage="No department assigned"
          />
        )
      },
      {
        id: 'subjects',
        title: 'Subject specializations',
        description: 'Subjects you are qualified to teach',
        content: (
          <AssignedSubjectsSection
            subjects={
              profile?.subjects.map((subject) => ({
                id: subject,
                name: subject
              })) || []
            }
            emptyMessage="No subject specializations recorded"
            renderSubject={(subject) => (
              <span className="rounded-full border border-[var(--brand-border)] bg-[var(--brand-primary)]/20 px-3 py-1 text-sm text-[var(--brand-primary)]">
                {subject.name}
              </span>
            )}
          />
        )
      },
      {
        id: 'classes',
        title: 'Assigned classes',
        description: 'Classes you are currently teaching',
        content: (
          <AssignedClassesSection
            classes={profile?.classes || []}
            emptyMessage="You are not currently assigned to any classes"
          />
        )
      },
      {
        id: 'department-analytics',
        title: 'Department analytics',
        description: 'Overview of department performance and statistics',
        content: (
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <p className="text-sm text-[var(--brand-muted)]">
              Department analytics will be displayed here when available
            </p>
          </div>
        )
      },
      {
        id: 'activity-history',
        title: 'Activity history',
        description: 'Recent actions and events',
        content: <ActivityHistorySection activities={activities} />
      },
      {
        id: 'uploads',
        title: 'Uploads & attachments',
        description: 'Files and documents associated with your profile',
        content: (
          <FileUploadsSection
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
          <AuditLogsSection
            logs={auditLogs}
            onRefresh={async () => {
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
      subtitle={profile?.department ? `Head of ${profile.department}` : profile?.email || undefined}
      loading={loading}
      error={error}
      sections={sections}
      showEditButton={false}
    />
  );
}
