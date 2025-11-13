import { RouteMeta } from '../../components/layout/RouteMeta';
import PlaceholderPage from '../PlaceholderPage';

export function SuperuserSettingsPage() {
  return (
    <RouteMeta title="Platform settings">
      <PlaceholderPage
        title="Platform settings"
        description="Configure global branding, authentication policies, feature flags, and integrations shared across every tenant."
      />
    </RouteMeta>
  );
}

export default SuperuserSettingsPage;
