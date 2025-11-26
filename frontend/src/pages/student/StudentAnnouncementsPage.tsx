/**
 * Student Announcements Page
 * Allows students to view class announcements
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import RouteMeta from '../../components/layout/RouteMeta';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { useStudentAnnouncements } from '../../hooks/queries/useStudentPhase7';
import { api } from '../../lib/api';
import { MessageSquare, User } from 'lucide-react';
import { formatDate } from '../../lib/utils/date';

export default function StudentAnnouncementsPage() {
  // Get student profile to get classId
  const { data: profile } = useQuery({
    queryKey: ['student', 'profile'],
    queryFn: () => api.student.getProfile(),
  });

  const classId = useMemo(() => {
    if (!profile) return undefined;
    // Profile has classId or className field
    return (
      (profile as { classId?: string; className?: string }).classId ||
      (profile as { classId?: string; className?: string }).className
    );
  }, [profile]);

  const { data: announcements, isLoading } = useStudentAnnouncements(classId);

  return (
    <RouteMeta title="Class Announcements">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Class Announcements</h1>

        {isLoading && <StatusBanner status="info" message="Loading announcements..." />}

        {announcements && (
          <div className="space-y-4">
            {announcements.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No announcements available</div>
            ) : (
              announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  className="border border-gray-200 rounded-lg p-6 bg-white hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    <MessageSquare className="h-6 w-6 text-blue-500 mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {announcement.teacher_name && (
                            <>
                              <User className="h-4 w-4 text-gray-500" />
                              <span className="text-sm text-gray-600">
                                {announcement.teacher_name}
                              </span>
                            </>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatDate(announcement.created_at)}
                        </span>
                      </div>
                      <p className="text-gray-800 whitespace-pre-wrap">{announcement.message}</p>
                      {announcement.attachments && announcement.attachments.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-sm font-medium text-gray-700 mb-2">Attachments:</p>
                          <div className="space-y-1">
                            {announcement.attachments.map((attachment, idx) => (
                              <a
                                key={idx}
                                href={attachment.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline block"
                              >
                                {attachment.filename}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </RouteMeta>
  );
}
