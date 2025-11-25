/**
 * Announcement Form Component
 * Reusable form for posting class announcements
 */

import { useState } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { usePostAnnouncement } from '../../hooks/queries/useTeacherPhase7';
import { Send } from 'lucide-react';

interface AnnouncementFormProps {
  classId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AnnouncementForm({ classId, onSuccess, onCancel }: AnnouncementFormProps) {
  const [message, setMessage] = useState('');
  const postMutation = usePostAnnouncement();

  const handleSubmit = async () => {
    if (!message.trim()) {
      return;
    }

    await postMutation.mutateAsync({
      classId,
      message: message.trim()
    });
    
    setMessage('');
    onSuccess?.();
  };

  return (
    <div className="space-y-4">
      <Input
        label="Message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Enter your announcement message..."
        multiline
        rows={5}
        required
      />
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={!message.trim() || postMutation.isPending}
        >
          <Send className="mr-2 h-4 w-4" />
          {postMutation.isPending ? 'Posting...' : 'Post Announcement'}
        </Button>
      </div>
    </div>
  );
}

