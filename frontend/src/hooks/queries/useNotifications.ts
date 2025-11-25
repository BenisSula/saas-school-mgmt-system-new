/**
 * Notifications React Query hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from 'sonner';

export function useNotifications(limit?: number) {
  return useQuery({
    queryKey: ['notifications', limit],
    queryFn: async () => {
      const response = await api.notifications.list(limit);
      return response.notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        timestamp: new Date(n.createdAt),
        read: n.read,
        type: n.type,
      }));
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => api.notifications.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.notifications.markAllAsRead(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success(`${data.marked} notification(s) marked as read`);
    },
  });
}
