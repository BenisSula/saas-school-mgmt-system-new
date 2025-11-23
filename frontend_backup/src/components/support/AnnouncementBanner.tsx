import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'error' | 'maintenance';
  is_pinned: boolean;
  is_viewed: boolean;
}

export const AnnouncementBanner: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      const result = await api.support.getAnnouncements();
      setAnnouncements(result.announcements as Announcement[]);
    } catch (error) {
      console.error('Failed to load announcements:', error);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await api.support.markAnnouncementViewed(id);
      setDismissed(new Set([...dismissed, id]));
    } catch (error) {
      console.error('Failed to mark announcement as viewed:', error);
    }
  };

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'maintenance':
        return 'bg-purple-50 border-purple-200 text-purple-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const visibleAnnouncements = announcements.filter(
    (ann) => !dismissed.has(ann.id) && !ann.is_viewed
  );

  if (visibleAnnouncements.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {visibleAnnouncements.map((announcement) => (
        <div
          key={announcement.id}
          className={`border-l-4 p-4 rounded ${getTypeStyles(announcement.type)}`}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="font-semibold mb-1">{announcement.title}</h3>
              <p className="text-sm">{announcement.content}</p>
            </div>
            <button
              onClick={() => handleDismiss(announcement.id)}
              className="ml-4 text-gray-500 hover:text-gray-700"
              aria-label="Dismiss announcement"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

