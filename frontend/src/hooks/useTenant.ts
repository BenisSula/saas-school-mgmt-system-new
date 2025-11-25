import { useAuth } from '../context/AuthContext';

/**
 * Hook to get the current tenant ID from auth context
 * @returns The tenant ID string or null if not available
 */
export function useTenant(): string | null {
  const { user } = useAuth();
  return user?.tenantId ?? null;
}
