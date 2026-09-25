import { GraduationCap, Plus, ShieldCheck, UserRound, Users } from 'lucide-react';
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
import { SearchInput } from '../../../components/ui/SearchInput.jsx';
import { Select } from '../../../components/ui/Select.jsx';
import { adminPaths } from '../../../config/paths.js';
import { STATUS_GROUPS } from '../../../config/statuses.js';
import { formatDateTime } from '../../../utils/date.js';
import { useClasses, useSections, useUsers } from '../hooks/useAdmin.js';
import { text } from '../text/index.js';

const ROLE_ICONS = { admin: ShieldCheck, teacher: UserRound, student: GraduationCap };
const FILTER_KEYS = ['role', 'status', 'classId', 'sectionId', 'search', 'sort', 'page'];

function placementOf(user) {
  const p = user.profile;
  if (user.role !== 'student' || !p?.classId) return '—';
  return `${p.classId.name}-${p.sectionId?.name} · roll ${p.rollNo}`;
}

const columns = [
  {
    key: 'name',
    header: 'Name',
    sortable: true,
    mobile: 'title',
    cell: (u) => (
      <Link to={adminPaths.user(u._id)} className="font-semibold hover:underline">
        {u.name}
        <span className="block text-sm font-normal text-muted">{u.username}</span>
      </Link>
    ),
  },
  {
    key: 'role',
    header: 'Role',
    sortable: true,
    mobile: 'subtitle',
    cell: (u) => {
      const Icon = ROLE_ICONS[u.role];
      return (
        <span className="inline-flex items-center gap-1.5">
          {Icon && <Icon aria-hidden="true" className="size-4 text-brand-700" />}
          {text.roleShort[u.role] ?? u.role}
        </span>
      );
    },
  },
  { key: 'placement', header: 'Class', cell: placementOf },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    cell: (u) => <StatusBadge group="account" value={u.status} size="sm" />,
  },
  {
    key: 'lastLoginAt',
    header: 'Last login',
    sortable: true,
    cell: (u) => (u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'),
  },
];

/** Every account (FR-ADM-01): filters, search and sorting in the URL, 20 per page. */
export default function UsersPage() {
  const [params, setParams] = useSearchParams();
  const value = (key, fallback = '') => params.get(key) ?? fallback;
  const role = value('role');
  const classId = value('classId');
  const query = {
    role: role || undefined,
    status: value('status') || undefined,
    classId: classId || undefined,
    sectionId: value('sectionId') || undefined,
    search: value('search') || undefined,
    sort: value('sort', 'name'),
    page: Number(value('page', 1)),
    limit: 20,
  };
  const list = useUsers(query);
  const classes = useClasses();
  const sections = useSections(classId || undefined, { enabled: Boolean(classId) });

  const update = (next) => {
    const merged = { ...Object.fromEntries(params), page: '', ...next };
    setParams(
      Object.fromEntries(
        FILTER_KEYS.map((k) => [k, merged[k]]).filter(([, v]) => v !== '' && v != null),
      ),
      { replace: true },
    );
  };
  const activeFilters = ['role', 'status', 'classId'].filter((k) => params.get(k)).length;

  const newButtons = (
    <>
      <Link to={adminPaths.newUser({ role: 'student' })} className={buttonClasses()}>
        <Plus aria-hidden="true" className="size-5" />
        New student
      </Link>
      <Link
        to={adminPaths.newUser({ role: 'teacher' })}
        className={buttonClasses({ variant: 'secondary' })}
      >
        New teacher
      </Link>
      <Link
        to={adminPaths.newUser({ role: 'admin' })}
        className={buttonClasses({ variant: 'ghost' })}
      >
        New admin
      </Link>
    </>
  );

  return (
    <>
      <PageHeader
        title="Users"
        description="Students (used by guardians), teachers and administrators."
        actions={newButtons}
      />
      <div className="flex flex-col gap-4">
        <FilterBar
          activeCount={activeFilters}
          onReset={() => update({ role: '', status: '', classId: '', sectionId: '' })}
          search={
            <SearchInput
              value={value('search')}
              onSearch={(search) => update({ search })}
              label="Search users"
              placeholder="Name, username, email or phone"
            />
          }
        >
          <FormField label="Role" className="md:w-40">
            <Select
              value={role}
              placeholder="All roles"
              onChange={(e) =>
                update({
                  role: e.target.value,
                  ...(e.target.value !== 'student' && { classId: '', sectionId: '' }),
                })
              }
              options={Object.entries(text.roleShort).map(([v, label]) => ({ value: v, label }))}
            />
          </FormField>
          <FormField label="Status" className="md:w-40">
            <Select
              value={value('status')}
              placeholder="Any status"
              onChange={(e) => update({ status: e.target.value })}
              options={Object.entries(STATUS_GROUPS.account).map(([v, meta]) => ({
                value: v,
                label: meta.label,
              }))}
            />
          </FormField>
          <FormField label="Class" className="md:w-40">
            <Select
              value={classId}
              placeholder="All classes"
              onChange={(e) => update({ classId: e.target.value, sectionId: '', role: 'student' })}
              options={(classes.data ?? []).map((c) => ({ value: c._id, label: c.name }))}
            />
          </FormField>
          <FormField label="Section" className="md:w-36">
            <Select
              value={value('sectionId')}
              placeholder="All"
              disabled={!classId}
              onChange={(e) => update({ sectionId: e.target.value })}
              options={(sections.data ?? []).map((s) => ({ value: s._id, label: s.name }))}
            />
          </FormField>
        </FilterBar>

        {list.isError ? (
          <Card>
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          </Card>
        ) : (
          <>
            <DataTable
              caption="Users"
              columns={columns}
              rows={list.data?.data ?? []}
              loading={list.isPending}
              sort={query.sort}
              onSortChange={(sort) => update({ sort })}
              empty={
                <Card>
                  <EmptyState
                    icon={Users}
                    title="No users match"
                    description="Try another search or clear the filters."
                  />
                </Card>
              }
            />
            <Pagination
              meta={list.data?.meta}
              onPageChange={(page) => update({ page: String(page) })}
            />
          </>
        )}
      </div>
    </>
  );
}
