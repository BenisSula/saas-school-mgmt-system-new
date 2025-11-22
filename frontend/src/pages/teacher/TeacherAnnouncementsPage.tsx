/**
 * Teacher Announcements Page
 * Allows teachers to post announcements to their classes
 */

import { useState } from 'react';
import RouteMeta from '../../components/layout/RouteMeta';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { useTeacherClasses } from '../../hooks/queries/useTeachers';
import { usePostAnnouncement } from '../../hooks/queries/useTeacherPhase7';
import { MessageSquare, Send } from 'lucide-react';

export default function TeacherAnnouncementsPage() {
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data: classes, isLoading: loadingClasses } = useTeacherClasses();
  const postMutation = usePostAnnouncement();

  const handleSubmit = async () => {
    if (!selectedClassId || !message.trim()) {
      return;
    }

    await postMutation.mutateAsync({
      classId: selectedClassId,
      message: message.trim()
    });
    setMessage('');
    setShowForm(false);
  };

  return (
    <RouteMeta title="Class Announcements">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Class Announcements</h1>
          {selectedClassId && (
            <Button onClick={() => setShowForm(true)}>
              <MessageSquare className="mr-2 h-4 w-4" />
              New Announcement
            </Button>
          )}
        </div>

        <div className="flex gap-4">
          <Select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-64"
          >
            <option value="">Select a class</option>
            {classes?.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </Select>
        </div>

        {loadingClasses && <StatusBanner status="loading" message="Loading classes..." />}

        {showForm && selectedClassId && (
          <div className="border border-gray-200 rounded-lg p-6 bg-white">
            <h2 className="text-lg font-semibold mb-4">Post Announcement</h2>
            <div className="space-y-4">
              <Input
                label="Message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                multiline
                rows={5}
                placeholder="Enter your announcement message..."
                required
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!message.trim() || postMutation.isPending}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {postMutation.isPending ? 'Posting...' : 'Post Announcement'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {selectedClassId && !showForm && (
          <div className="text-center text-gray-500 py-8">
            Click "New Announcement" to post a message to your class
          </div>
        )}
      </div>
    </RouteMeta>
  );
}

