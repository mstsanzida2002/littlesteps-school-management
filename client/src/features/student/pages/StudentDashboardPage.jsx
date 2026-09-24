import { Sprout } from 'lucide-react';

import { Card } from '../../../components/ui/Card.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { useAuth } from '../../auth/hooks/useAuth.js';

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const firstName = user?.name?.split(/\s+/)[0];
  return (
    <>
      <PageHeader
        title="Home"
        description={firstName ? `How ${firstName} is doing at LittleSteps.` : undefined}
      />
      <Card>
        <EmptyState
          icon={Sprout}
          title="Your dashboard is on its way"
          description="Attendance, results, meetings and notices for your child will appear here."
        />
      </Card>
    </>
  );
}
