import { Award, FileCheck, PencilLine, Plus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';

import { StatusBadge } from '../../../components/ui/Badge.jsx';
import { buttonClasses } from '../../../components/ui/buttonStyles.js';
import { Card } from '../../../components/ui/Card.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { FilterBar } from '../../../components/ui/FilterBar.jsx';
import { FormField } from '../../../components/ui/FormField.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { Select } from '../../../components/ui/Select.jsx';
import { TabPanel, Tabs } from '../../../components/ui/Tabs.jsx';
import { formatSchoolDate } from '../../../utils/date.js';
import { classSectionLabel, modeLabel, typeLabel } from '../../results/labels.js';
import { useAssessments } from '../../results/hooks/useResults.js';
import { useClassSectionScope, useRolePaths } from '../../school/hooks/useScope.js';
import { classSectionValue } from '../classSection.js';

const TABS = [
  { value: 'all', label: 'All', icon: Award },
  { value: 'draft', label: 'Drafts', icon: PencilLine },
  { value: 'published', label: 'Published', icon: FileCheck },
];

const columnsFor = (paths) => [
  {
    key: 'name',
    header: 'Assessment',
    sortable: true,
    mobile: 'title',
    cell: (a) => (
      <Link to={paths.assessment(a._id)} className="font-semibold hover:underline">
        {a.name}
      </Link>
    ),
  },
  {
    key: 'where',
    header: 'Class',
    mobile: 'subtitle',
    cell: (a) => `${a.subjectId?.name} · ${classSectionLabel(a)}`,
  },
  { key: 'date', header: 'Date', sortable: true, cell: (a) => formatSchoolDate(a.date) },
  { key: 'type', header: 'Type', cell: (a) => `${typeLabel(a.type)} · ${modeLabel(a)}` },
  { key: 'entries', header: 'Entries', align: 'right' },
  {
    key: 'status',
    header: 'Status',
    cell: (a) => <StatusBadge group="publication" value={a.status} size="sm" />,
  },
];

export default function AssessmentsPage() {
  const [params, setParams] = useSearchParams();
  const paths = useRolePaths();
  const mine = useClassSectionScope();
  const columns = columnsFor(paths);
  const status = params.get('status') ?? 'all';
  const page = Number(params.get('page') ?? 1);
  const sort = params.get('sort') ?? '-date';
  const classId = params.get('classId') ?? '';
  const sectionId = params.get('sectionId') ?? '';
  const subjectId = params.get('subjectId') ?? '';

  const list = useAssessments({
    status: status === 'all' ? undefined : status,
    classId: classId || undefined,
    sectionId: sectionId || undefined,
    subjectId: subjectId || undefined,
    sort,
    page,
    limit: 20,
  });

  const update = (next) =>
    setParams(
      Object.fromEntries(
        Object.entries({ status, classId, sectionId, subjectId, sort, page: 1, ...next }).filter(
          ([key, v]) => v && !(key === 'status' && v === 'all') && !(key === 'page' && v === 1),
        ),
      ),
      { replace: true },
    );

  const current = mine.data?.classSections.find(
    (cs) => String(cs.classId) === classId && String(cs.sectionId) === sectionId,
  );
  const activeFilters = [classId, subjectId].filter(Boolean).length;
  const newButton = (
    <Link to={paths.newAssessment()} className={buttonClasses()}>
      <Plus aria-hidden="true" className="size-5" />
      New assessment
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Results"
        description="Assessments you manage, drafts first to finish."
        actions={newButton}
      />
      <Tabs
        label="Assessments"
        value={status}
        onChange={(value) => update({ status: value })}
        items={TABS}
      >
        <TabPanel value={status} className="flex flex-col gap-4">
          <FilterBar
            activeCount={activeFilters}
            onReset={() => update({ classId: '', sectionId: '', subjectId: '' })}
          >
            <FormField label="Class" className="md:w-52">
              <Select
                value={classSectionValue(current)}
                placeholder="All classes"
                onChange={(event) => {
                  const [c = '', s = ''] = event.target.value.split(':');
                  update({ classId: c, sectionId: s, subjectId: '' });
                }}
                options={(mine.data?.classSections ?? []).map((cs) => ({
                  value: classSectionValue(cs),
                  label: cs.label,
                }))}
              />
            </FormField>
            <FormField label="Subject" className="md:w-52">
              <Select
                value={subjectId}
                placeholder="All subjects"
                onChange={(event) => update({ subjectId: event.target.value })}
                options={[
                  ...new Map(
                    (current ? [current] : (mine.data?.classSections ?? []))
                      .flatMap((cs) => cs.subjects)
                      .map((s) => [String(s._id), { value: String(s._id), label: s.name }]),
                  ).values(),
                ]}
              />
            </FormField>
          </FilterBar>

          {list.isError ? (
            <Card>
              <ErrorState
                error={list.error}
                onRetry={() => list.refetch()}
                retrying={list.isFetching}
              />
            </Card>
          ) : (
            <>
              <DataTable
                caption="Assessments"
                columns={columns}
                rows={list.data?.data ?? []}
                loading={list.isPending}
                sort={sort}
                onSortChange={(value) => update({ sort: value })}
                empty={
                  <Card>
                    <EmptyState
                      icon={Award}
                      title={
                        status === 'draft'
                          ? 'No drafts'
                          : status === 'published'
                            ? 'Nothing published yet'
                            : 'No assessments yet'
                      }
                      description="Create an assessment, enter the results as a draft, then publish them to guardians."
                      action={newButton}
                    />
                  </Card>
                }
              />
              <Pagination meta={list.data?.meta} onPageChange={(p) => update({ page: p })} />
            </>
          )}
        </TabPanel>
      </Tabs>
    </>
  );
}
