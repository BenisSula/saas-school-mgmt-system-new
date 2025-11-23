import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';
import type { AuthUser } from '../lib/api';

export interface AdminShellProps {
  children?: ReactNode;
  user: AuthUser | null;
  onLogout: () => void;
}

export function AdminShell({ children, user, onLogout }: AdminShellProps) {
  const content = children ?? <Outlet />;

  return (
    <DashboardLayout user={user} onLogout={onLogout} storageKey={user?.id}>
      {content}
    </DashboardLayout>
  );
}

export default AdminShell;
