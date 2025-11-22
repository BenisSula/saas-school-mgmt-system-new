import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { ActivityItem } from '../components/profile/ActivityHistory';
import type { AuditLogEntry } from '../lib/api';
import type { FileUpload } from '../components/profile/FileUploads';

interface UseProfileDataOptions {
  userId?: string;
  profileLoader: () => Promise<unknown>;
  enabled?: boolean;
}

export function useProfileData<T>(options: UseProfileDataOptions) {
  const { userId, profileLoader, enabled = true } = options;
  const { user } = useAuth();
  const [profile, setProfile] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [uploads, setUploads] = useState<FileUpload[]>([]);

  // Refresh profile data when user state changes (after login/registration)
  const refreshProfile = useCallback(async () => {
    if (!enabled) return;

    let cancelled = false;
    try {
      const profileData = await profileLoader();
      if (!cancelled) {
        setProfile(profileData as T);
      }
    } catch (err) {
      if (!cancelled) {
        // If profile doesn't exist yet (pending approval), that's okay
        const errorMessage = (err as Error).message;
        if (errorMessage.includes('not found') || errorMessage.includes('404')) {
          setError(null); // Don't show error for missing profile (pending approval)
        } else {
          setError(errorMessage);
        }
      }
    }
    return () => {
      cancelled = true;
    };
  }, [profileLoader, enabled]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        // Load profile data
        const profileData = await profileLoader();
        if (!cancelled) {
          setProfile(profileData as T);
        }

        // Load activity history
        try {
          const activityData = await api.getActivityHistory(userId);
          if (!cancelled) {
            setActivities(activityData);
          }
        } catch (err) {
          console.warn('Failed to load activity history:', err);
          // Don't fail the whole load if activity history fails
        }

        // Load audit logs
        try {
          const auditData = await api.getAuditLogs(userId);
          if (!cancelled) {
            setAuditLogs(auditData);
          }
        } catch (err) {
          console.warn('Failed to load audit logs:', err);
          // Don't fail the whole load if audit logs fail
        }

        // Load file uploads
        try {
          const uploadsData = await api.listFileUploads();
          if (!cancelled) {
            // Convert to FileUpload format
            setUploads(
              uploadsData.map((u) => ({
                id: u.id,
                filename: u.filename,
                fileSize: u.fileSize,
                mimeType: u.mimeType,
                uploadedAt: typeof u.uploadedAt === 'string' ? u.uploadedAt : u.uploadedAt.toISOString(),
                uploadedBy: u.uploadedBy,
                description: null,
                downloadUrl: u.fileUrl
              }))
            );
          }
        } catch (err) {
          console.warn('Failed to load uploads:', err);
          // Don't fail the whole load if uploads fail
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, profileLoader, enabled]);

  // Refresh profile when user state changes (after login/registration)
  useEffect(() => {
    if (user && enabled) {
      // Small delay to allow backend to process profile creation
      const timeoutId = setTimeout(() => {
        refreshProfile();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.status, enabled, refreshProfile]);

  return {
    profile,
    loading,
    error,
    activities,
    auditLogs,
    uploads,
    setUploads
  };
}
