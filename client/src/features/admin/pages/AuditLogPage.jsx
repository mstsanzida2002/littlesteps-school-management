import { ScrollText, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { DatePicker } from '../../../components/ui/DatePicker.jsx';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../../components/ui/ErrorState.jsx';
import { FilterBar } from '../../../components/ui/FilterBar.jsx';
import { FormField } from '../../../components/ui/FormField.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { Select } from '../../../components/ui/Select.jsx';
import { formatDateTime } from '../../../utils/date.js';
import {
  ACTION_LABELS,
  ENTITY_TYPES,
  actionLabel,
  changeRows,
  entityLabel,
  isCritical,
} from '../auditLabels.js';
import { useAuditLog, useUsers } from '../hooks/useAdmin.js';
import { text } from '../text/index.js';

const FILTERS = ['action', 'actorId', 'entityType', 'from', 'to', 'page'];

function EntryDrawer({ entry, onClose }) {
  const rows = entry ? changeRows(entry.changes?.before, entry.changes?.after) : [];
  const meta = Object.fromEntries(
    Object.entries({ ip: entry?.ip, device: entry?.userAgent }).filter(([, v]) => v),
  );
  return (
    <Drawer open={Boolean(entry)} onClose={onClose} title={entry ? actionLabel(entry.action) : ''}>
      {entry && (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">When</dt>
            <dd>{formatDateTime(entry.createdAt, { weekday: true })}</dd>
            <dt className="text-muted">Who</dt>
            <dd>
              {entry.actorId?.name ?? 'System'}
              {entry.actorId?.role && (
                <span className="text-muted"> · {text.roleShort[entry.actorId.role]}</span>
              )}
            </dd>
            <dt className="text-muted">What</dt>
            <dd>
              {entityLabel(entry.entityType)}{' '}
              <span className="font-mono text-xs text-muted">{entry.entityId}</span>
            </dd>
            <dt className="text-muted">Action</dt>
            <dd className="font-mono text-xs">{entry.action}</dd>
          </dl>
          {rows.length ? (
            <table className="w-full table-fixed text-left text-sm">
              <caption className="mb-1 text-left font-bold">Changes</caption>
              <thead className="bg-blush-50">
                <tr>
                  <th scope="col" className="w-1/4 px-2 py-1.5 font-semibold">
                    Field
                  </th>
                  <th scope="col" className="px-2 py-1.5 font-semibold">
                    Before
                  </th>
                  <th scope="col" className="px-2 py-1.5 font-semibold">
                    After
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.field} className="border-t border-line align-top">
                    <th scope="row" className="px-2 py-1.5 font-semibold">
                      {r.field}
                    </th>
                    <td className="px-2 py-1.5 break-words whitespace-pre-line text-absent-ink">
                      {r.before}
                    </td>
                    <td className="px-2 py-1.5 break-words whitespace-pre-line text-present-ink">
                      {r.after}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted">No field changes recorded.</p>
          )}
          {Object.keys(meta).length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold text-brand-700">
                Request details
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-control bg-sand-50 p-2 text-xs">
                {JSON.stringify(meta, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </Drawer>
  );
}

/** Everything admins and teachers changed (FR-ADM-11), newest first, with before/after. */
export default function AuditLogPage() {
  const [params, setParams] = useSearchParams();
  const value = (key) => params.get(key) ?? '';
  const [open, setOpen] = useState(null);
  const query = {
    action: value('action') || undefined,
    actorId: value('actorId') || undefined,
    entityType: value('entityType') || undefined,
    from: value('from') || undefined,
    to: value('to') || undefined,
    page: Number(value('page') || 1),
    limit: 25,
  };
  const list = useAuditLog(query);
  const admins = useUsers({ role: 'admin', limit: 100, sort: 'name' });
  const teachers = useUsers({ role: 'teacher', limit: 100, sort: 'name' });
  const staff = [...(admins.data?.data ?? []), ...(teachers.data?.data ?? [])];

  const update = (next) => {
    const merged = { ...Object.fromEntries(params), page: '', ...next };
    setParams(Object.fromEntries(FILTERS.map((k) => [k, merged[k]]).filter(([, v]) => v)), {
      replace: true,
    });
  };
  const active = ['action', 'actorId', 'entityType', 'from', 'to'].filter((k) => value(k)).length;

  const columns = [
    {
      key: 'createdAt',
      header: 'When',
      mobile: 'subtitle',
      cell: (e) => <span className="whitespace-nowrap">{formatDateTime(e.createdAt)}</span>,
    },
    {
      key: 'action',
      header: 'What happened',
      mobile: 'title',
      cell: (e) => (
        <span className="inline-flex flex-wrap items-center gap-2 font-semibold">
          {actionLabel(e.action)}
          {isCritical(e.action) && (
            <Badge tone="absent" icon={TriangleAlert} size="sm">
              Critical
            </Badge>
          )}
        </span>
      ),
    },
    { key: 'actor', header: 'Who', cell: (e) => e.actorId?.name ?? 'System' },
    { key: 'entityType', header: 'On', cell: (e) => entityLabel(e.entityType) },
    {
      key: 'details',
      header: <span className="sr-only">Details</span>,
      align: 'right',
      mobile: 'actions',
      cell: (e) => (
        <Button variant="ghost" size="sm" onClick={() => setOpen(e)}>
          Before / after
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every change to accounts, structure, settings, attendance, results, meetings and notices."
      />
      <div className="flex flex-col gap-4">
        <FilterBar
          activeCount={active}
          onReset={() => update({ action: '', actorId: '', entityType: '', from: '', to: '' })}
        >
          <FormField label="Action" className="md:w-60">
            <Select
              value={value('action')}
              placeholder="Any action"
              onChange={(e) => update({ action: e.target.value })}
              options={Object.entries(ACTION_LABELS).map(([v, label]) => ({ value: v, label }))}
            />
          </FormField>
          <FormField label="Who" className="md:w-52">
            <Select
              value={value('actorId')}
              placeholder="Anyone"
              onChange={(e) => update({ actorId: e.target.value })}
              options={staff.map((u) => ({ value: u._id, label: u.name }))}
            />
          </FormField>
          <FormField label="On" className="md:w-44">
            <Select
              value={value('entityType')}
              placeholder="Anything"
              onChange={(e) => update({ entityType: e.target.value })}
              options={ENTITY_TYPES.map((t) => ({ value: t, label: entityLabel(t) }))}
            />
          </FormField>
          <FormField label="From" className="md:w-44">
            <DatePicker value={value('from')} onChange={(from) => update({ from: from ?? '' })} />
          </FormField>
          <FormField label="To" className="md:w-44">
            <DatePicker value={value('to')} onChange={(to) => update({ to: to ?? '' })} />
          </FormField>
        </FilterBar>
        {list.isError ? (
          <Card>
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          </Card>
        ) : (
          <>
            <DataTable
              caption="Audit log"
              columns={columns}
              rows={list.data?.data ?? []}
              loading={list.isPending}
              rowClassName={(e) => (isCritical(e.action) ? 'bg-absent-soft/40' : undefined)}
              empty={
                <Card>
                  <EmptyState icon={ScrollText} title="Nothing matches these filters" />
                </Card>
              }
            />
            <Pagination meta={list.data?.meta} onPageChange={(p) => update({ page: String(p) })} />
          </>
        )}
      </div>
      <EntryDrawer entry={open} onClose={() => setOpen(null)} />
    </>
  );
}
