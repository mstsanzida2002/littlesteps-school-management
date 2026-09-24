import { Award, BookOpen, ListOrdered } from 'lucide-react';
import { useSearchParams } from 'react-router';

import { Card } from '../../../components/ui/Card.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { SkeletonCard } from '../../../components/ui/Skeleton.jsx';
import { TabPanel, Tabs } from '../../../components/ui/Tabs.jsx';
import { ResultCard } from '../../results/components/GuardianResult.jsx';
import { useStudentResults } from '../../results/hooks/useResults.js';
import { text } from '../../results/text/index.js';
import { ChildQuery } from '../components/ChildNotFound.jsx';
import { useChild } from '../hooks/useStudent.js';

const VIEWS = [
  { value: 'subject', label: text.views.subject, icon: BookOpen },
  { value: 'test', label: text.views.test, icon: ListOrdered },
];

/** Results grouped by subject (A–Z), each subject's tests newest first. */
function bySubject(results) {
  const groups = new Map();
  for (const r of results) {
    const key = String(r.subjectId ?? r.subject);
    if (!groups.has(key)) groups.set(key, { key, subject: r.subject, results: [] });
    groups.get(key).results.push(r);
  }
  return [...groups.values()].sort((a, b) => a.subject.localeCompare(b.subject));
}

function Loading() {
  return (
    <div aria-busy="true" aria-label={text.loading} className="flex flex-col gap-3">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

/** Published results only (FR-STU-05): the server never returns drafts to anyone here. */
export default function ChildResultsPage() {
  const child = useChild();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'test' ? 'test' : 'subject';
  const results = useStudentResults(child.id, { limit: 100 });

  return (
    <>
      <PageHeader title={text.title} description={text.description(child.displayName)} />
      <ChildQuery query={results} loading={<Loading />}>
        {(rows) =>
          rows.length ? (
            <Tabs
              label={text.views.label}
              items={VIEWS}
              value={view}
              onChange={(v) => setParams({ view: v }, { replace: true })}
            >
              <TabPanel value="subject" className="mt-4 flex flex-col gap-6">
                {bySubject(rows).map((group) => (
                  <section key={group.key} aria-labelledby={`subject-${group.key}`}>
                    <h2
                      id={`subject-${group.key}`}
                      className="mb-2 flex items-baseline gap-2 text-lg font-bold"
                    >
                      {group.subject}
                      <span className="text-sm font-semibold text-muted">
                        {text.testsInSubject(group.results.length)}
                      </span>
                    </h2>
                    <ul className="grid gap-3 md:grid-cols-2">
                      {group.results.map((r) => (
                        <ResultCard key={r._id} result={r} showSubject={false} />
                      ))}
                    </ul>
                  </section>
                ))}
              </TabPanel>
              <TabPanel value="test" className="mt-4">
                <ul className="grid gap-3 md:grid-cols-2">
                  {rows.map((r) => (
                    <ResultCard key={r._id} result={r} />
                  ))}
                </ul>
              </TabPanel>
            </Tabs>
          ) : (
            <Card>
              <EmptyState
                icon={Award}
                title={text.empty.title}
                description={text.empty.description(child.displayName)}
              />
            </Card>
          )
        }
      </ChildQuery>
    </>
  );
}
