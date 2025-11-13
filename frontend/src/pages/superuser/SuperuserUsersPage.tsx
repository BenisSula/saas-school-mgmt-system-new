import { RouteMeta } from '../../components/layout/RouteMeta';
import PlaceholderPage from '../PlaceholderPage';

export function SuperuserUsersPage() {
  return (
    <RouteMeta title="User management">
      <PlaceholderPage
        title="User management"
        description="Audit all platform users, enforce password resets, and monitor pending approvals across tenant environments."
      />
    </RouteMeta>
  );
}

export default SuperuserUsersPage;
