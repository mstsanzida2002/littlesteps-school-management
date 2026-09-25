import {
  ArrowLeft,
  Ban,
  CalendarCheck,
  KeyRound,
  Pencil,
  Printer,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { Alert } from '../../../components/ui/Alert.jsx';
import { StatusBadge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { buttonClasses } from '../../../components/ui/buttonStyles.js';
import { Card } from '../../../components/ui/Card.jsx';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.jsx';
import { FormField } from '../../../components/ui/FormField.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { QueryState } from '../../../components/ui/QueryState.jsx';
import { SkeletonCard } from '../../../components/ui/Skeleton.jsx';
import { toast } from '../../../components/ui/toast.js';
import { adminPaths } from '../../../config/paths.js';
import { errorMessage } from '../../../lib/errorMessages.js';
import { formatDateTime, formatSchoolDate, todayDateKey } from '../../../utils/date.js';
import { generateTempPassword } from '../../../utils/tempPassword.js';
import { useAuth } from '../../auth/hooks/useAuth.js';
import { LoginSlipDialog } from '../components/LoginSlip.jsx';
import { TempPasswordField } from '../components/TempPasswordField.jsx';
import {
  useDeleteUser,
  useReactivateUser,
  useResetPassword,
  useSuspendUser,
  useUser,
} from '../hooks/useAdmin.js';
import { resetPasswordSchema } from '../schemas.js';
import { text } from '../text/index.js';

const BANGLA = /[ঀ-৿]/;

function Fields({ rows }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows
        .filter(([, value]) => value !== undefined)
        .map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-sm font-semibold text-muted">{label}</dt>
            <dd
              lang={typeof value === 'string' && BANGLA.test(value) ? 'bn' : undefined}
              className={value ? 'break-words' : 'text-muted'}
            >
              {value || '—'}
            </dd>
          </div>
        ))}
    </dl>
  );
}

const placementOf = (profile) =>
  profile?.classId ? `${profile.classId.name}-${profile.sectionId?.name}` : '';

/** Reset: generate (or type) a temporary password, then show it once, with the slip. */
function ResetPasswordDialog({ user, onClose }) {
  const reset = useResetPassword();
  const [password, setPassword] = useState(generateTempPassword);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [slip, setSlip] = useState(null);

  const submit = async () => {
    const check = resetPasswordSchema.safeParse({ newPassword: password });
    if (!check.success) {
      setError(check.error.issues[0].message);
      return;
    }
    try {
      await reset.mutateAsync({ id: user._id, newPassword: password });
      setDone(true);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        dismissible={!reset.isPending}
        title={done ? 'Password reset' : `Reset ${user.name}'s password`}
        description={
          done
            ? 'Their other sessions have ended. They must choose a new password at the next login.'
            : 'Every session of this account ends at once.'
        }
        footer={
          done ? (
            <>
              {user.role === 'student' && (
                <Button
                  icon={Printer}
                  onClick={() =>
                    setSlip({
                      name: user.name,
                      classSection: placementOf(user.profile),
                      username: user.username,
                      password,
                      date: formatSchoolDate(todayDateKey(), { weekday: true }),
                    })
                  }
                >
                  {text.slip.print}
                </Button>
              )}
              <Button variant="secondary" onClick={onClose}>
                Done
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose} disabled={reset.isPending}>
                Cancel
              </Button>
              <Button icon={KeyRound} onClick={submit} loading={reset.isPending}>
                Reset password
              </Button>
            </>
          )
        }
      >
        {done ? (
          <div className="flex flex-col gap-3">
            <p>
              Temporary password: <strong className="font-mono text-lg">{password}</strong>
            </p>
            <Alert tone="info">{text.tempPassword.shownOnce}</Alert>
          </div>
        ) : (
          <FormField label={text.tempPassword.label} error={error}>
            <TempPasswordField value={password} onChange={setPassword} />
          </FormField>
        )}
      </Modal>
      <LoginSlipDialog account={slip} onClose={() => setSlip(null)} />
    </>
  );
}

function Actions({ user, isSelf }) {
  const navigate = useNavigate();
  const suspend = useSuspendUser();
  const reactivate = useReactivateUser();
  const remove = useDeleteUser();
  const [dialog, setDialog] = useState(null); // 'suspend' | 'reactivate' | 'delete' | 'history' | 'reset'
  const [history, setHistory] = useState(null);
  const close = () => setDialog(null);

  const run = async (mutation, variables, message) => {
    try {
      await mutation.mutateAsync(variables);
      toast.success(message);
      close();
      return true;
    } catch (err) {
      if (err?.code === 'USER_HAS_HISTORY') {
        setHistory(err.message);
        setDialog('history');
        return false;
      }
      toast.error(errorMessage(err));
      return false;
    }
  };

  const active = user.status === 'active';
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Link
          to={adminPaths.editUser(user._id)}
          className={buttonClasses({ variant: 'secondary' })}
        >
          <Pencil aria-hidden="true" className="size-5" />
          Edit
        </Link>
        {['active', 'suspended'].includes(user.status) && (
          <Button variant="secondary" icon={KeyRound} onClick={() => setDialog('reset')}>
            Reset password
          </Button>
        )}
        {active && !isSelf && (
          <Button variant="secondary" icon={Ban} onClick={() => setDialog('suspend')}>
            Suspend
          </Button>
        )}
        {user.status === 'suspended' && (
          <Button variant="secondary" icon={RotateCcw} onClick={() => setDialog('reactivate')}>
            Reactivate
          </Button>
        )}
        {!isSelf && (
          <Button variant="danger-ghost" icon={Trash2} onClick={() => setDialog('delete')}>
            Delete
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={dialog === 'suspend'}
        onClose={close}
        title={`Suspend ${user.name}?`}
        message="They are signed out everywhere at once and can't log in until reactivated. Their records stay."
        confirmLabel="Suspend"
        reason={{ label: 'Reason', placeholder: 'e.g. Left the school' }}
        loading={suspend.isPending}
        onConfirm={(reason) =>
          run(suspend, { id: user._id, reason }, `${user.name} is suspended and signed out`)
        }
      />
      <ConfirmDialog
        open={dialog === 'reactivate'}
        onClose={close}
        tone="primary"
        title={`Reactivate ${user.name}?`}
        message="They can log in again with their password."
        confirmLabel="Reactivate"
        loading={reactivate.isPending}
        onConfirm={() => run(reactivate, user._id, `${user.name} is active again`)}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={close}
        title={`Delete ${user.name}?`}
        message="Only accounts without any history can be deleted. This can't be undone."
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={async () => {
          if (await run(remove, user._id, `${user.name} deleted`)) {
            navigate(adminPaths.users(), { replace: true });
          }
        }}
      />
      <ConfirmDialog
        open={dialog === 'history'}
        onClose={close}
        tone="primary"
        title="This account has history"
        message={
          <>
            <p>{history}</p>
            <p className="mt-2 text-muted">
              Suspending keeps the history and stops them from logging in.
            </p>
          </>
        }
        confirmLabel="Suspend instead"
        reason={{ label: 'Reason for suspending', placeholder: 'e.g. Left the school' }}
        loading={suspend.isPending}
        onConfirm={(reason) =>
          run(suspend, { id: user._id, reason }, `${user.name} is suspended and signed out`)
        }
      />
      {dialog === 'reset' && <ResetPasswordDialog user={user} onClose={close} />}
    </>
  );
}

function Detail({ user, isSelf }) {
  const p = user.profile;
  const reg = user.registration;
  return (
    <>
      <PageHeader
        title={user.name}
        description={`${text.roles[user.role] ?? user.role} · ${user.username}`}
        actions={<StatusBadge group="account" value={user.status} />}
      />
      <div className="mb-4">
        <Actions user={user} isSelf={isSelf} />
      </div>
      {user.status === 'pending' && (
        <Alert tone="warning" className="mb-4" title="Waiting for approval">
          Review this registration in <Link to={adminPaths.approvals()}>Approvals</Link>.
        </Alert>
      )}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card title="Account">
          <Fields
            rows={[
              ['Username', user.username],
              ['Email', user.email ?? ''],
              ['Mobile', user.phone ?? ''],
              ['Created', formatDateTime(user.createdAt)],
              ['Last login', user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'],
              [
                'Password',
                user.mustChangePassword ? 'Temporary (must change at login)' : 'Set by the user',
              ],
            ]}
          />
        </Card>

        {user.role === 'student' && p && (
          <Card
            title="Child and class"
            actions={
              <Link
                to={adminPaths.studentAttendance(user._id)}
                className={buttonClasses({ variant: 'ghost', size: 'sm' })}
              >
                <CalendarCheck aria-hidden="true" className="size-4" />
                Attendance
              </Link>
            }
          >
            <Fields
              rows={[
                ['Class', placementOf(p)],
                ['Roll', String(p.rollNo)],
                ['Nickname', p.nickname ?? ''],
                ['Date of birth', formatSchoolDate(p.dateOfBirth)],
                ['Gender', text.genders[p.gender] ?? ''],
                ['Admitted', formatSchoolDate(p.admissionDate)],
                ['School year', p.sessionId?.name],
              ]}
            />
          </Card>
        )}
        {user.role === 'student' && (p?.guardian || reg?.guardian) && (
          <Card title="Guardian">
            <Fields
              rows={[
                ['Name', (p?.guardian ?? reg.guardian).name],
                ['Relation', text.relations[(p?.guardian ?? reg.guardian).relation]],
                ['Mobile', (p?.guardian ?? reg.guardian).phone],
                ['Email', (p?.guardian ?? reg.guardian).email ?? ''],
                ['Address', (p?.guardian ?? reg.guardian).address ?? ''],
              ]}
            />
          </Card>
        )}
        {user.role === 'teacher' && p && (
          <Card
            title="Teacher"
            actions={
              <Link
                to={adminPaths.assignments({ view: 'teacher', teacherId: user._id })}
                className={buttonClasses({ variant: 'ghost', size: 'sm' })}
              >
                Assignments
              </Link>
            }
          >
            <Fields
              rows={[
                ['Employee ID', p.employeeId],
                ['Qualification', p.qualification ?? ''],
                ['Joined', formatSchoolDate(p.joiningDate)],
                ['Active assignments', String(user.activeAssignments ?? 0)],
              ]}
            />
          </Card>
        )}
        {reg?.review && (
          <Card title="Registration review">
            <Fields
              rows={[
                ['Decision', 'Rejected'],
                ['Reason', reg.review.reason],
                ['When', formatDateTime(reg.review.reviewedAt)],
              ]}
            />
          </Card>
        )}
      </div>
    </>
  );
}

/** One account and everything an admin can do with it (FR-ADM-01/02). */
export default function UserDetailPage() {
  const { userId } = useParams();
  const { user: me } = useAuth();
  const query = useUser(userId);
  return (
    <>
      <Link
        to={adminPaths.users()}
        className={buttonClasses({ variant: 'ghost', size: 'sm', className: '-ml-2 mb-2' })}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Users
      </Link>
      <QueryState query={query} loading={<SkeletonCard className="h-64" />}>
        {(user) => <Detail user={user} isSelf={String(user._id) === String(me?._id)} />}
      </QueryState>
    </>
  );
}
