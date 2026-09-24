import { Award, CalendarCheck, Megaphone, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';

import { CalendarHeatmap } from '../../components/charts/CalendarHeatmap.jsx';
import { ComparisonBarChart } from '../../components/charts/ComparisonBarChart.jsx';
import { TrendLineChart } from '../../components/charts/TrendLineChart.jsx';
import { StatusBadge } from '../../components/ui/Badge.jsx';
import { Button, IconButton } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Drawer } from '../../components/ui/Drawer.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { FilterBar } from '../../components/ui/FilterBar.jsx';
import { FormField } from '../../components/ui/FormField.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SearchInput } from '../../components/ui/SearchInput.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { TabPanel, Tabs } from '../../components/ui/Tabs.jsx';
import { toast } from '../../components/ui/toast.js';
import { formatPercent } from '../../utils/format.js';
import { calendarDays, classComparison, students, trendData } from './sampleData.js';
import { Example, Section } from './Section.jsx';

export function OverlaySection() {
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const fakeSave = (message) => {
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setConfirm(null);
      toast.success(message);
    }, 700);
  };

  return (
    <Section
      id="overlays"
      title="Modal, drawer, confirm"
      description="Native <dialog>: focus is trapped and restored, Esc and the backdrop close it. Modals are bottom sheets on phones."
    >
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => setModal(true)}>
          Open modal
        </Button>
        <Button variant="secondary" onClick={() => setDrawer('right')}>
          Drawer (right)
        </Button>
        <Button variant="secondary" onClick={() => setDrawer('left')}>
          Drawer (left)
        </Button>
        <Button variant="secondary" onClick={() => setDrawer('bottom')}>
          Bottom sheet
        </Button>
        <Button variant="danger-ghost" onClick={() => setConfirm('delete')}>
          Confirm (danger)
        </Button>
        <Button variant="secondary" onClick={() => setConfirm('reason')}>
          Confirm with reason
        </Button>
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Edit notice"
        description="Changes are visible to guardians immediately."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => setModal(false)}>Save</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="Title">
            <Input defaultValue="Sports day on Thursday" />
          </FormField>
          <p lang="bn">বৃহস্পতিবার ক্রীড়া দিবস। সাদা পোশাক পরে আসবে।</p>
        </div>
      </Modal>

      <Drawer
        open={drawer != null}
        side={drawer ?? 'right'}
        onClose={() => setDrawer(null)}
        title="Ayaan Rahman"
      >
        <div className="flex flex-col gap-3">
          <p className="text-muted">Playgroup-A · Roll 1</p>
          <StatusBadge group="attendance" value="present" />
          <p>Drawers hold details and filters without leaving the page.</p>
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={() => fakeSave('Draft deleted')}
        loading={busy}
        title="Delete this draft?"
        message="The entered marks will be lost. This cannot be undone."
        confirmLabel="Delete draft"
      />
      <ConfirmDialog
        open={confirm === 'reason'}
        onClose={() => setConfirm(null)}
        onConfirm={(reason) => fakeSave(`Changed to Present — “${reason}”`)}
        loading={busy}
        tone="primary"
        title="Change Ayaan's attendance?"
        message="Absent → Present on Thu, 24 Sep 2026. The guardian is notified of the correction."
        confirmLabel="Save change"
        reason={{
          label: 'Reason for the change',
          placeholder: 'Arrived after the register was taken',
        }}
      />
    </Section>
  );
}

export function NavigationSection() {
  const [tab, setTab] = useState('drafts');
  const [page, setPage] = useState(3);
  return (
    <Section
      id="navigation"
      title="Tabs and pagination"
      description="Tabs: arrow keys, Home and End. Pagination collapses to Previous / Page x of y / Next on phones."
    >
      <Tabs
        label="Results"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'drafts', label: 'Drafts', icon: Pencil, count: 2 },
          { value: 'published', label: 'Published', icon: Award, count: 14 },
          { value: 'attendance', label: 'Attendance', icon: CalendarCheck },
          { value: 'notices', label: 'Notices', icon: Megaphone, disabled: true },
        ]}
      >
        <TabPanel value="drafts">
          Two draft assessments need marks before they can be published.
        </TabPanel>
        <TabPanel value="published">Fourteen published assessments this term.</TabPanel>
        <TabPanel value="attendance">Attendance summaries per subject.</TabPanel>
      </Tabs>
      <Pagination meta={{ page, limit: 20, total: 243, totalPages: 13 }} onPageChange={setPage} />
    </Section>
  );
}

const columns = [
  { key: 'rollNo', header: 'Roll', sortable: true, mobile: 'hidden', align: 'right' },
  {
    key: 'name',
    header: 'Name',
    sortable: true,
    mobile: 'title',
    cell: (s) => (
      <span lang={/[ঀ-৿]/.test(s.name) ? 'bn' : undefined} className="font-semibold">
        {s.name}
      </span>
    ),
  },
  {
    key: 'section',
    header: 'Class',
    mobile: 'subtitle',
    cell: (s) => `${s.section} · Roll ${s.rollNo}`,
  },
  {
    key: 'attendance',
    header: 'Attendance',
    sortable: true,
    align: 'right',
    cell: (s) => (
      <span
        className={
          s.attendance != null && s.attendance < 75 ? 'font-bold text-absent-ink' : 'tabular-nums'
        }
      >
        {formatPercent(s.attendance)}
        {s.attendance != null && s.attendance < 75 && ' (low)'}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    cell: (s) => <StatusBadge group="account" value={s.status} size="sm" />,
  },
  {
    key: 'actions',
    header: <span className="sr-only">Actions</span>,
    mobile: 'actions',
    align: 'right',
    cell: (s) => (
      <IconButton
        icon={Pencil}
        label={`Edit ${s.name}`}
        onClick={() => toast.info(`Edit ${s.name} (demo)`)}
      />
    ),
  },
];

export function DataSection() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('rollNo');
  const [loading, setLoading] = useState(false);

  const rows = useMemo(() => {
    const field = sort.replace(/^-/, '');
    const dir = sort.startsWith('-') ? -1 : 1;
    return students
      .filter(
        (s) =>
          (!search || s.name.toLowerCase().includes(search.toLowerCase())) &&
          (!status || s.status === status),
      )
      .sort((a, b) => ((a[field] ?? -1) > (b[field] ?? -1) ? dir : -dir));
  }, [search, status, sort]);

  return (
    <Section
      id="data"
      title="Filters and table"
      description="A table on wide screens and cards on phones (resize to compare). Sorting uses the API's format ('name' / '-name')."
    >
      <FilterBar
        search={
          <SearchInput
            value={search}
            onSearch={setSearch}
            label="Search students"
            placeholder="Search by name"
          />
        }
        activeCount={status ? 1 : 0}
        onReset={() => setStatus('')}
      >
        <FormField label="Status" className="md:w-48">
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            placeholder="All statuses"
            options={[
              { value: 'active', label: 'Active' },
              { value: 'pending', label: 'Pending' },
              { value: 'suspended', label: 'Suspended' },
            ]}
          />
        </FormField>
      </FilterBar>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setLoading((v) => !v)}>
          {loading ? 'Show data' : 'Show loading state'}
        </Button>
      </div>
      <DataTable
        caption="Students"
        columns={columns}
        rows={rows}
        loading={loading}
        sort={sort}
        onSortChange={setSort}
        empty={
          <Card padded={false}>
            <EmptyState
              title="No students match"
              description="Try another name or clear the filters."
              compact
            />
          </Card>
        }
      />
    </Section>
  );
}

export function ChartSection() {
  return (
    <Section
      id="charts"
      title="Charts"
      description="Each chart has a written summary (also its accessible name) and a table of the numbers. Line and bar use Recharts; the calendar is plain CSS."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <TrendLineChart title="Attendance, last 30 days" data={trendData} threshold={75} />
        </Card>
        <Card>
          <ComparisonBarChart title="Attendance by class" data={classComparison} threshold={75} />
        </Card>
      </div>
      <Card className="max-w-xl">
        <CalendarHeatmap title="Ayaan's attendance" days={calendarDays} />
      </Card>
      <Example title="No data">
        <Card className="max-w-xl">
          <TrendLineChart title="Attendance, last 30 days" data={[]} threshold={75} />
        </Card>
      </Example>
    </Section>
  );
}
