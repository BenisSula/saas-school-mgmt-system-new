import { RouteMeta } from '../../components/layout/RouteMeta';
import PlaceholderPage from '../PlaceholderPage';

export function SuperuserReportsPage() {
  return (
    <RouteMeta title="Platform reports">
      <PlaceholderPage
        title="Platform reports"
        description="Surface platform-wide analytics, audit events, and exportable summaries for finance or compliance."
      />
    </RouteMeta>
  );
}

export default SuperuserReportsPage;
