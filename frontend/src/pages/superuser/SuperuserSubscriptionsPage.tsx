import { RouteMeta } from '../../components/layout/RouteMeta';
import PlaceholderPage from '../PlaceholderPage';

export function SuperuserSubscriptionsPage() {
  return (
    <RouteMeta title="Subscription & billing">
      <PlaceholderPage
        title="Subscription & billing"
        description="Manage platform-wide subscription tiers, billing contacts, and invoicing preferences. Integrate with your payment processor to automate renewals."
      />
    </RouteMeta>
  );
}

export default SuperuserSubscriptionsPage;
