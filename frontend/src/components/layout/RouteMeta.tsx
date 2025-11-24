import { useEffect, type ReactNode } from 'react';
import {
  useDashboardRouteContext,
  type DashboardRouteMeta,
} from '../../context/DashboardRouteContext';

export interface RouteMetaProps extends DashboardRouteMeta {
  children: ReactNode;
}

export function RouteMeta({ children, title, description }: RouteMetaProps) {
  const { setMeta, resetMeta } = useDashboardRouteContext();

  useEffect(() => {
    setMeta({ title, description });
    return () => {
      resetMeta();
    };
  }, [title, description, setMeta, resetMeta]);

  return <>{children}</>;
}

export default RouteMeta;
