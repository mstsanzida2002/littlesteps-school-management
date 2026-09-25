import { CircleCheck, CircleX, Inbox, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { Alert } from '../../../components/ui/Alert.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.jsx';
import { DatePicker } from '../../../components/ui/DatePicker.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { FormField } from '../../../components/ui/FormField.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { QueryState } from '../../../components/ui/QueryState.jsx';
import { Select } from '../../../components/ui/Select.jsx';
import { SkeletonCard } from '../../../components/ui/Skeleton.jsx';
import { TabPanel, Tabs } from '../../../components/ui/Tabs.jsx';
import { toast } from '../../../components/ui/toast.js';
import { friendlyError } from '../../../lib/errorMessages.js';
import { formatDateTime, formatSchoolDate, todayDateKey } from '../../../utils/date.js';
import {
  useApproveRegistration,
  useClasses,
  useNextRoll,
  useRejectRegistration,
  useSections,
  useUsers,
} from '../hooks/useAdmin.js';
import { text } from '../text/index.js';

const TABS = [
  { value: 'pending', label: 'Waiting', icon: Inbox },
  { value: 'rejected', label: 'Rejected', icon: UserX },
];

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className="break-words">{children || '—'}</dd>
    </div>
  );
}

/** Approve: place the child (class, section, roll) and create their profile, in one step. */
function ApproveDialog({ user, classes, onClose }) {
  const approve = useApproveRegistration();
  const reg = user.registration ?? {};
  const [classId, setClassId] = useState(
    String(reg.requestedClassId?._id ?? reg.requestedClassId ?? ''),
  );
  // The first section and the suggested roll are defaults; the admin can change both.
  const [sectionChoice, setSectionChoice] = useState('');
  const [rollTyped, setRollTyped] = useState(null);
  const [dateOfBirth, setDateOfBirth] = useState(
    reg.dateOfBirth ? String(reg.dateOfBirth).slice(0, 10) : '',
  );
  const [admissionDate, setAdmissionDate] = useState(todayDateKey());
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState(null);
  const sections = useSections(classId || undefined, { enabled: Boolean(classId) });
  const sectionId = sectionChoice || sections.data?.[0]?._id || '';
  const next = useNextRoll({ classId, sectionId });
  const suggested = next.data?.suggestedRollNo;
  const rollNo = rollTyped ?? (suggested ? String(suggested) : '');

  const fieldError = (name) => error?.errors?.find((e) => e.field === name)?.message;
  const submit = async () => {
    setError(null);
    try {
      await approve.mutateAsync({
        id: user._id,
        classId,
        sectionId,
        ...(rollNo && { rollNo: Number(rollNo) }),
        ...(dateOfBirth && { dateOfBirth }),
        ...(admissionDate && { admissionDate }),
        ...(nickname.trim() && { nickname: nickname.trim() }),
      });
      toast.success(`${user.name} approved and placed`);
      onClose();
    } catch (err) {
      setError(err);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!approve.isPending}
      title={`Approve ${user.name}`}
      description="Placing the child creates their profile; the guardian can log in straight away."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={approve.isPending}>
            Cancel
          </Button>
          <Button
            icon={UserCheck}
            onClick={submit}
            loading={approve.isPending}
            disabled={!classId || !sectionId || (!reg.dateOfBirth && !dateOfBirth)}
          >
            Approve
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Class" required error={fieldError('classId')}>
          <Select
            value={classId}
            placeholder="Choose a class"
            onChange={(e) => {
              setClassId(e.target.value);
              setSectionChoice('');
              setRollTyped(null);
            }}
            options={classes.map((c) => ({ value: c._id, label: c.name }))}
          />
        </FormField>
        <FormField label="Section" required error={fieldError('sectionId')}>
          <Select
            value={sectionId}
            placeholder="Choose a section"
            disabled={!classId}
            onChange={(e) => {
              setSectionChoice(e.target.value);
              setRollTyped(null);
            }}
            options={(sections.data ?? []).map((s) => ({ value: s._id, label: s.name }))}
          />
        </FormField>
        <FormField
          label="Roll number"
          hint={
            next.data
              ? `Suggested ${suggested}. Taken: ${next.data.taken.join(', ') || 'none'}.`
              : undefined
          }
          error={fieldError('rollNo')}
        >
          <Input
            inputMode="numeric"
            value={rollNo}
            onChange={(e) => setRollTyped(e.target.value)}
          />
        </FormField>
        <FormField label="Nickname" optional>
          <Input value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </FormField>
        <FormField
          label="Date of birth"
          required={!reg.dateOfBirth}
          hint={reg.dateOfBirth ? 'From the registration.' : 'Not given in the registration.'}
          error={fieldError('dateOfBirth')}
        >
          <DatePicker value={dateOfBirth} onChange={setDateOfBirth} max={todayDateKey()} />
        </FormField>
        <FormField label="Admission date" error={fieldError('admissionDate')}>
          <DatePicker value={admissionDate} onChange={setAdmissionDate} />
        </FormField>
      </div>
      {error && !error.errors?.some((e) => e.field) && (
        <Alert tone="error" className="mt-4">
          {friendlyError(error).message}
        </Alert>
      )}
    </Modal>
  );
}

function RegistrationCard({ user, classNameOf, onApprove, onReject }) {
  const reg = user.registration ?? {};
  const g = reg.guardian ?? {};
  const rejected = user.status === 'rejected';
  return (
    <Card as="article" aria-label={`Registration: ${user.name}`}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">{user.name}</h2>
          <p className="text-sm text-muted">
            {user.username} · signed up {formatDateTime(reg.submittedAt ?? user.createdAt)}
          </p>
        </div>
        {!rejected && (
          <div className="flex w-full gap-2 sm:w-auto">
            <Button icon={CircleCheck} onClick={onApprove} className="flex-1 sm:flex-none">
              Approve
            </Button>
            <Button
              variant="danger-ghost"
              icon={CircleX}
              onClick={onReject}
              className="flex-1 sm:flex-none"
            >
              Reject
            </Button>
          </div>
        )}
      </header>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Requested class">{classNameOf(reg.requestedClassId)}</Field>
        <Field label="Date of birth">{reg.dateOfBirth && formatSchoolDate(reg.dateOfBirth)}</Field>
        <Field label="Gender">{text.genders[reg.gender]}</Field>
        <Field label="Guardian">
          {g.name}
          {g.relation && <span className="text-muted"> · {text.relations[g.relation]}</span>}
        </Field>
        <Field label="Mobile">{g.phone}</Field>
        <Field label="Email">{g.email}</Field>
        {g.address && <Field label="Address">{g.address}</Field>}
        {reg.note && <Field label="Note">{reg.note}</Field>}
      </dl>
      {rejected && reg.review && (
        <Alert tone="error" className="mt-3" title="Rejected">
          {reg.review.reason} · {formatDateTime(reg.review.reviewedAt)}
        </Alert>
      )}
    </Card>
  );
}

/** Self-registrations waiting for an admin (FR-ADM-02/05). */
export default function ApprovalsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') === 'rejected' ? 'rejected' : 'pending';
  const page = Number(params.get('page') ?? 1);
  const list = useUsers({ role: 'student', status, sort: '-createdAt', page, limit: 10 });
  const classes = useClasses();
  const reject = useRejectRegistration();
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const classNameOf = (id) =>
    classes.data?.find((c) => String(c._id) === String(id?._id ?? id))?.name;

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Guardians who registered a child themselves. Approve to place the child in a class."
      />
      <Tabs
        label="Registrations"
        value={status}
        onChange={(value) => setParams(value === 'pending' ? {} : { status: value })}
        items={TABS.map((t) => ({
          ...t,
          count: t.value === status ? list.data?.meta?.total : undefined,
        }))}
      >
        <TabPanel value={status} className="mt-4 flex flex-col gap-3">
          <QueryState
            query={list}
            loading={
              <div
                aria-busy="true"
                aria-label="Loading registrations"
                className="flex flex-col gap-3"
              >
                <SkeletonCard />
                <SkeletonCard />
              </div>
            }
          >
            {({ data, meta }) =>
              data.length ? (
                <>
                  {data.map((user) => (
                    <RegistrationCard
                      key={user._id}
                      user={user}
                      classNameOf={classNameOf}
                      onApprove={() => setApproving(user)}
                      onReject={() => setRejecting(user)}
                    />
                  ))}
                  <Pagination
                    meta={meta}
                    onPageChange={(p) =>
                      setParams({ ...(status === 'rejected' && { status }), page: String(p) })
                    }
                  />
                </>
              ) : (
                <Card>
                  <EmptyState
                    icon={status === 'pending' ? CircleCheck : Inbox}
                    title={status === 'pending' ? 'No registrations waiting' : 'Nothing rejected'}
                    description={
                      status === 'pending'
                        ? 'New sign-ups appear here straight away.'
                        : 'Rejected registrations are kept here for reference.'
                    }
                  />
                </Card>
              )
            }
          </QueryState>
        </TabPanel>
      </Tabs>

      {approving && (
        <ApproveDialog
          user={approving}
          classes={classes.data ?? []}
          onClose={() => setApproving(null)}
        />
      )}
      <ConfirmDialog
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={rejecting ? `Reject ${rejecting.name}?` : ''}
        message="The guardian can't log in; the login page tells them the registration was not approved."
        confirmLabel="Reject"
        reason={{ label: 'Reason (kept in the record)', placeholder: 'e.g. The class is full' }}
        loading={reject.isPending}
        onConfirm={async (reason) => {
          try {
            await reject.mutateAsync({ id: rejecting._id, reason });
            toast.success(`${rejecting.name}'s registration was rejected`);
            setRejecting(null);
          } catch (err) {
            toast.error(friendlyError(err).message);
          }
        }}
      />
    </>
  );
}
