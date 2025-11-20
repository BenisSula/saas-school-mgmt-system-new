import { useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import { ProfileLayout, type ProfileSection } from '../../components/profile/ProfileLayout';
import {
  AssignedClassesSection,
  AssignedSubjectsSection,
  ActivityHistorySection,
  FileUploadsSection,
  AuditLogsSection
} from '../../components/profile/sections';
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
                </>
              ) : (
                <p className="text-sm text-[var(--brand-muted)]">No personal information available</p>
              )}
            </div>
          </div>
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
      subtitle={profile?.email || undefined}
      loading={loading}
      error={error}
      sections={sections}
      showEditButton={false}
    />
  );
}
