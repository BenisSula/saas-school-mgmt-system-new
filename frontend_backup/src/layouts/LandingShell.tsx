import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';

export interface LandingShellProps {
  children?: ReactNode;
}

export function LandingShell({ children }: LandingShellProps) {
  return <AuthLayout>{children ?? <Outlet />}</AuthLayout>;
}

export default LandingShell;
