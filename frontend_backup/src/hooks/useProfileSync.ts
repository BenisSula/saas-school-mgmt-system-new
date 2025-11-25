import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

/**
 * Hook to sync profile data after login/registration
 * Ensures profile is created/refreshed when user state changes
 */
export function useProfileSync() {
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Only sync for students and teachers (they have profiles)
    if (user.role !== 'student' && user.role !== 'teacher') return;

    // Only sync if user is active (not pending)
    if (user.status !== 'active') return;

    // Sync profile data after a short delay to allow backend to process
    const syncProfile = async () => {
      try {
        if (user.role === 'student') {
          // Try to fetch profile - if it doesn't exist, backend will handle it
          await api.student.getProfile().catch(() => {
            // Profile might not exist yet (pending approval), that's okay
            console.log('Profile not yet available, will be created on approval');
          });
        } else if (user.role === 'teacher') {
          await api.teacher.getProfile().catch(() => {
            // Profile might not exist yet (pending approval), that's okay
            console.log('Profile not yet available, will be created on approval');
          });
        }
      } catch (error) {
        // Silently fail - profile will be available after approval
        console.debug('Profile sync:', error);
      }
    };

    // Delay sync to allow backend processing
    const timeoutId = setTimeout(syncProfile, 1000);
    return () => clearTimeout(timeoutId);
  }, [user, isAuthenticated]);
}
