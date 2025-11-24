/**
 * Announcement Card Component
 * Displays a class announcement
 */

import { Card } from '../ui/Card';
import { MessageSquare, User } from 'lucide-react';
import { formatDate } from '../../lib/utils/date';

interface AnnouncementCardProps {
  id: string;
  message: string;
  teacherName?: string | null;
  createdAt: string;
  attachments?: Array<{ filename: string; url: string }> | null;
}

export function AnnouncementCard({
  message,
  teacherName,
  createdAt,
  attachments,
}: AnnouncementCardProps) {
  return (
    <Card className="p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <div className="p-2 bg-blue-100 rounded-lg">
          <MessageSquare className="h-6 w-6 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {teacherName && (
                <>
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">{teacherName}</span>
                </>
              )}
            </div>
            <span className="text-xs text-gray-500">{formatDate(createdAt)}</span>
          </div>
          <p className="text-gray-800 whitespace-pre-wrap mb-3">{message}</p>
          {attachments && attachments.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">Attachments:</p>
              <div className="space-y-1">
                {attachments.map((attachment, idx) => (
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
    </Card>
  );
}
