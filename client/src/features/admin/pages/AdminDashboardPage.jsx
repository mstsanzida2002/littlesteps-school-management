import { Sprout } from 'lucide-react';

import { Card } from '../../../components/ui/Card.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { useAuth } from '../../auth/hooks/useAuth.js';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const firstName = user?.name?.split(/\s+/)[0];
  return (
    <>
      <PageHeader
        title="Dashboard"
        description={firstName ? `Welcome back, ${firstName}.` : undefined}
      />
      <Card>
        <EmptyState
          icon={Sprout}
          title="Your dashboard is on its way"
          description="School-wide attendance, approvals and meetings will appear here."
        />
      </Card>
    </>
  );
}
