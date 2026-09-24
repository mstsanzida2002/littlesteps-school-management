import { Construction } from 'lucide-react';

import { Card } from '../components/ui/Card.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';

/** Placeholder for navigation items whose feature is not built yet. */
export default function ComingSoonPage({ title }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <EmptyState
          icon={Construction}
          title="Coming soon"
          description={`The ${title.toLowerCase()} page is being built. Everything else keeps working.`}
        />
      </Card>
    </>
  );
}
