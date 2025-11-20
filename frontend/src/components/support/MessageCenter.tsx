import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface Message {
  id: string;
  subject: string;
  content: string;
  sender_email?: string;
  is_read: boolean;
  priority: string;
  created_at: string;
}

export const MessageCenter: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const result = await api.support.getMessages({ isArchived: false });
      setMessages(result.messages as Message[]);
      setUnreadCount(result.unreadCount);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (messageId: string) => {
    try {
      await api.support.markMessageRead(messageId);
      setMessages(
        messages.map((msg) => (msg.id === messageId ? { ...msg, is_read: true } : msg))
      );
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  };

  const handleArchive = async (messageId: string) => {
    try {
      await api.support.archiveMessage(messageId);
      setMessages(messages.filter((msg) => msg.id !== messageId));
    } catch (error) {
      console.error('Failed to archive message:', error);
    }
  };

  if (loading) {
    return <div className="p-4">Loading messages...</div>;
  }

  return (
    <div className="flex h-full">
      <div className="w-1/3 border-r p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">
          Messages {unreadCount > 0 && <span className="text-blue-600">({unreadCount})</span>}
        </h2>
        <div className="space-y-2">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                !message.is_read ? 'bg-blue-50 border-blue-200' : ''
              }`}
              onClick={() => {
                setSelectedMessage(message);
                if (!message.is_read) {
                  handleMarkRead(message.id);
                }
              }}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className={`font-medium ${!message.is_read ? 'font-bold' : ''}`}>
                    {message.subject}
                  </h3>
                  <p className="text-sm text-gray-600 truncate">{message.content}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {message.sender_email} • {new Date(message.created_at).toLocaleDateString()}
                  </p>
                </div>
                {message.priority === 'urgent' && (
                  <span className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                    Urgent
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        {selectedMessage ? (
          <div>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-semibold">{selectedMessage.subject}</h2>
              <button
                onClick={() => handleArchive(selectedMessage.id)}
                className="text-gray-500 hover:text-gray-700"
              >
                Archive
              </button>
            </div>
            <div className="text-sm text-gray-600 mb-4">
              From: {selectedMessage.sender_email} •{' '}
              {new Date(selectedMessage.created_at).toLocaleString()}
            </div>
            <div className="prose max-w-none">{selectedMessage.content}</div>
          </div>
        ) : (
          <div className="text-gray-500 text-center mt-8">Select a message to view</div>
        )}
      </div>
    </div>
  );
};

