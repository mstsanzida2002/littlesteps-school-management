import { CalendarCheck, CalendarClock } from 'lucide-react';
import { useSearchParams } from 'react-router';

import { Card } from '../../../components/ui/Card.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { QueryState } from '../../../components/ui/QueryState.jsx';
import { SkeletonCard } from '../../../components/ui/Skeleton.jsx';
import { TabPanel, Tabs } from '../../../components/ui/Tabs.jsx';
import { GuardianMeetingCard } from '../../meetings/components/GuardianMeeting.jsx';
import { useMeetings } from '../../meetings/hooks/useMeetings.js';
import { text } from '../../meetings/text/index.js';
import { useChild } from '../hooks/useStudent.js';

const TABS = [
  { value: 'upcoming', label: text.tabs.upcoming, icon: CalendarClock },
  { value: 'past', label: text.tabs.past, icon: CalendarCheck },
];

/** Invitations for the child (FR-STU-06): upcoming ones can be answered right from the list. */
export default function ChildMeetingsPage() {
  const child = useChild();
  const [params, setParams] = useSearchParams();
  const when = params.get('when') === 'past' ? 'past' : 'upcoming';
  const page = Number(params.get('page') ?? 1);
  const list = useMeetings({ when, page, limit: 10 });

  return (
    <>
      <PageHeader title={text.title} description={text.description(child.displayName)} />
      <Tabs
        label={text.tabs.label}
        value={when}
        onChange={(value) =>
          setParams(value === 'upcoming' ? {} : { when: value }, { replace: true })
        }
        items={TABS}
      >
        <TabPanel value={when} className="mt-4 flex flex-col gap-4">
          <QueryState
            query={list}
            loading={
              <div aria-busy="true" aria-label={text.loading} className="flex flex-col gap-3">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            }
          >
            {({ data, meta }) =>
              data.length ? (
                <>
                  <ul className="flex flex-col gap-3">
                    {data.map((m) => (
                      <GuardianMeetingCard
                        key={m._id}
                        meeting={m}
                        quickReply={when === 'upcoming'}
                      />
                    ))}
                  </ul>
                  <Pagination
                    meta={meta}
                    onPageChange={(p) =>
                      setParams({ ...(when === 'past' && { when }), page: String(p) })
                    }
                  />
                </>
              ) : (
                <Card>
                  <EmptyState
                    icon={when === 'past' ? CalendarCheck : CalendarClock}
                    title={when === 'past' ? text.empty.past : text.empty.upcoming}
                    description={when === 'past' ? text.empty.pastHint : text.empty.upcomingHint}
                  />
                </Card>
              )
            }
          </QueryState>
        </TabPanel>
      </Tabs>
    </>
  );
}
