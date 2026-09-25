import { BookOpen, CalendarRange, CircleCheck, Layers, School } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { Alert } from '../../../components/ui/Alert.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { TabPanel, Tabs } from '../../../components/ui/Tabs.jsx';
import { toast } from '../../../components/ui/toast.js';
import { TypeToConfirm } from '../../../components/ui/TypeToConfirm.jsx';
import { friendlyError } from '../../../lib/errorMessages.js';
import { formatSchoolDate } from '../../../utils/date.js';
import { formatNumber } from '../../../utils/format.js';
import { CrudList } from '../components/CrudList.jsx';
import {
  useActivateSession,
  useClasses,
  useCreateClass,
  useCreateSection,
  useCreateSession,
  useCreateSubject,
  useDeleteClass,
  useDeleteSection,
  useDeleteSession,
  useDeleteSubject,
  useSections,
  useSessions,
  useSubjects,
  useUpdateClass,
  useUpdateSection,
  useUpdateSession,
  useUpdateSubject,
} from '../hooks/useAdmin.js';

const TABS = [
  { value: 'classes', label: 'Classes', icon: School },
  { value: 'sections', label: 'Sections', icon: Layers },
  { value: 'subjects', label: 'Subjects', icon: BookOpen },
  { value: 'years', label: 'School years', icon: CalendarRange },
];

const numberOrUndefined = (v) => (v === '' || v == null ? undefined : Number(v));
const dateKeyOf = (v) => (v ? String(v).slice(0, 10) : '');

function ClassesTab() {
  const classes = useClasses();
  return (
    <CrudList
      title="Classes"
      noun="Class"
      rows={classes.data}
      loading={classes.isPending}
      columns={[
        { key: 'order', header: 'Order', align: 'right' },
        { key: 'name', header: 'Class', mobile: 'title', cell: (c) => <strong>{c.name}</strong> },
        { key: 'sectionCount', header: 'Sections', align: 'right' },
        {
          key: 'studentCount',
          header: 'Students',
          align: 'right',
          cell: (c) => formatNumber(c.studentCount),
        },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'order', label: 'Order', type: 'number', required: true, hint: 'Youngest first.' },
      ]}
      toValues={(c) => ({ name: c.name, order: String(c.order ?? '') })}
      toBody={(v) => ({ name: v.name, order: numberOrUndefined(v.order) })}
      create={useCreateClass()}
      update={useUpdateClass()}
      remove={useDeleteClass()}
    />
  );
}

function SectionsTab() {
  const sections = useSections();
  const classes = useClasses();
  return (
    <CrudList
      title="Sections"
      noun="Section"
      rows={sections.data?.map((s) => ({
        ...s,
        name: `${s.classId?.name}-${s.name}`,
        section: s.name,
      }))}
      loading={sections.isPending}
      columns={[
        { key: 'name', header: 'Section', mobile: 'title', cell: (s) => <strong>{s.name}</strong> },
        {
          key: 'capacity',
          header: 'Capacity',
          align: 'right',
          cell: (s) => s.capacity ?? '—',
        },
        { key: 'studentCount', header: 'Students', align: 'right' },
      ]}
      fields={[
        {
          name: 'classId',
          label: 'Class',
          type: 'select',
          required: true,
          editable: false,
          options: (classes.data ?? []).map((c) => ({ value: c._id, label: c.name })),
        },
        { name: 'name', label: 'Section', required: true, hint: 'e.g. "A".' },
        {
          name: 'capacity',
          label: 'Capacity',
          type: 'number',
          hint: 'Optional. Not below the current enrolment.',
        },
      ]}
      toValues={(s) => ({ name: s.section, capacity: String(s.capacity ?? '') })}
      toBody={(v, { editing }) => ({
        ...(!editing && { classId: v.classId }),
        name: v.name,
        capacity: numberOrUndefined(v.capacity),
      })}
      create={useCreateSection()}
      update={useUpdateSection()}
      remove={useDeleteSection()}
    />
  );
}

function SubjectsTab() {
  const subjects = useSubjects();
  return (
    <CrudList
      title="Subjects"
      noun="Subject"
      rows={subjects.data}
      loading={subjects.isPending}
      columns={[
        { key: 'name', header: 'Subject', mobile: 'title', cell: (s) => <strong>{s.name}</strong> },
        { key: 'code', header: 'Code' },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'code', label: 'Code', required: true, hint: '2–10 letters or digits, e.g. ENG.' },
      ]}
      toValues={(s) => ({ name: s.name, code: s.code })}
      create={useCreateSubject()}
      update={useUpdateSubject()}
      remove={useDeleteSubject()}
    />
  );
}

/**
 * School years (sessions). Activating another one moves everyone to it, so the server first
 * answers 409 with what will change, and the admin must type the year's name to confirm.
 */
function YearsTab() {
  const sessions = useSessions();
  const activate = useActivateSession();
  const [switching, setSwitching] = useState(null); // { session, summary }
  const [error, setError] = useState(null);

  const start = async (session) => {
    setError(null);
    try {
      await activate.mutateAsync({ id: session._id });
      toast.success(`${session.name} is now the active school year`);
    } catch (err) {
      if (err?.code === 'SESSION_SWITCH_CONFIRMATION_REQUIRED') {
        setSwitching({ session, details: err.details });
      } else {
        toast.error(friendlyError(err).message);
      }
    }
  };
  const confirm = async () => {
    try {
      await activate.mutateAsync({ id: switching.session._id, confirm: true });
      toast.success(`${switching.session.name} is now the active school year`);
      setSwitching(null);
    } catch (err) {
      setError(friendlyError(err).message);
    }
  };

  const details = switching?.details;
  return (
    <>
      <CrudList
        title="School years"
        noun="School year"
        rows={sessions.data}
        loading={sessions.isPending}
        columns={[
          {
            key: 'name',
            header: 'School year',
            mobile: 'title',
            cell: (s) => (
              <span className="inline-flex items-center gap-2">
                <strong>{s.name}</strong>
                {s.isActive && (
                  <Badge tone="present" icon={CircleCheck} size="sm">
                    Active
                  </Badge>
                )}
              </span>
            ),
          },
          {
            key: 'dates',
            header: 'Dates',
            cell: (s) => `${formatSchoolDate(s.startDate)} – ${formatSchoolDate(s.endDate)}`,
          },
          { key: 'studentCount', header: 'Students', align: 'right' },
        ]}
        fields={[
          { name: 'name', label: 'Name', required: true, hint: 'e.g. 2027' },
          { name: 'startDate', label: 'Starts', type: 'date', required: true },
          { name: 'endDate', label: 'Ends', type: 'date', required: true },
        ]}
        toValues={(s) => ({
          name: s.name,
          startDate: dateKeyOf(s.startDate),
          endDate: dateKeyOf(s.endDate),
        })}
        create={useCreateSession()}
        update={useUpdateSession()}
        remove={useDeleteSession()}
        extraActions={(s) =>
          !s.isActive && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => start(s)}
              loading={activate.isPending && !switching}
            >
              Make active
            </Button>
          )
        }
      />
      <TypeToConfirm
        open={Boolean(switching)}
        onClose={() => setSwitching(null)}
        title={`Switch to ${switching?.session.name}?`}
        phrase={switching?.session.name ?? ''}
        confirmLabel="Switch school year"
        loading={activate.isPending}
        error={error}
        onConfirm={confirm}
      >
        {details && (
          <>
            <Alert tone="warning" title="This changes every screen for everyone">
              Teachers and guardians will work in {details.target.name} from now on. Students not
              enrolled in {details.target.name} disappear from class lists.
            </Alert>
            <table className="w-full text-left">
              <thead className="text-sm text-muted">
                <tr>
                  <th className="py-1 font-semibold" scope="col">
                    School year
                  </th>
                  <th className="py-1 text-right font-semibold" scope="col">
                    Students
                  </th>
                  <th className="py-1 text-right font-semibold" scope="col">
                    Assignments
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {[
                  [details.current, 'now'],
                  [details.target, 'after the switch'],
                ].map(([row, note]) => (
                  <tr key={row.name} className="border-t border-line">
                    <td className="py-1.5">
                      <strong>{row.name}</strong> <span className="text-muted">({note})</span>
                    </td>
                    <td className="py-1.5 text-right">{row.students}</td>
                    <td className="py-1.5 text-right">{row.assignments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </TypeToConfirm>
    </>
  );
}

/** Classes, sections, subjects and school years (FR-ADM-03/04). */
export default function StructurePage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'classes';
  return (
    <>
      <PageHeader
        title="Classes and school years"
        description="The school's structure. Deleting is refused while anything still uses it."
      />
      <Tabs
        label="School structure"
        value={tab}
        onChange={(value) =>
          setParams(value === 'classes' ? {} : { tab: value }, { replace: true })
        }
        items={TABS}
      >
        <TabPanel value={tab} className="mt-4">
          {tab === 'classes' && <ClassesTab />}
          {tab === 'sections' && <SectionsTab />}
          {tab === 'subjects' && <SubjectsTab />}
          {tab === 'years' && <YearsTab />}
        </TabPanel>
      </Tabs>
    </>
  );
}
