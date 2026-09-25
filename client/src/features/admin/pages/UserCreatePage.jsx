import { ArrowLeft, ArrowRight, Check, CircleCheck, Printer, UserPlus } from 'lucide-react';
import { useEffect, useEffectEvent, useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';

import { Alert } from '../../../components/ui/Alert.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { buttonClasses } from '../../../components/ui/buttonStyles.js';
import { Card } from '../../../components/ui/Card.jsx';
import { DatePicker } from '../../../components/ui/DatePicker.jsx';
import { FormField } from '../../../components/ui/FormField.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Select } from '../../../components/ui/Select.jsx';
import { Textarea } from '../../../components/ui/Textarea.jsx';
import { UnsavedChangesDialog } from '../../../components/ui/UnsavedChangesDialog.jsx';
import { adminPaths } from '../../../config/paths.js';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges.js';
import { useZodForm } from '../../../hooks/useZodForm.js';
import { cn } from '../../../utils/cn.js';
import { formatSchoolDate, todayDateKey } from '../../../utils/date.js';
import { generateTempPassword } from '../../../utils/tempPassword.js';
import { LoginSlipDialog } from '../components/LoginSlip.jsx';
import { TempPasswordField } from '../components/TempPasswordField.jsx';
import { useClasses, useCreateUser, useNextRoll, useSections } from '../hooks/useAdmin.js';
import {
  adminSchema,
  STUDENT_STEPS,
  stepOfField,
  studentSchema,
  suggestStudentUsername,
  teacherSchema,
} from '../schemas.js';
import { text } from '../text/index.js';

const optionsOf = (map) => Object.entries(map).map(([value, label]) => ({ value, label }));
const blankToUndefined = (value) => (value === '' ? undefined : value);

/** "Step 2 of 4 · Class and roll", with the finished steps ticked. */
function Steps({ current }) {
  return (
    <ol aria-label="Steps" className="mb-5 grid grid-cols-4 gap-2">
      {STUDENT_STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={step.id}
            aria-current={active ? 'step' : undefined}
            className={cn(
              'flex flex-col gap-1.5 border-t-4 pt-2 text-sm font-semibold',
              active
                ? 'border-brand-800 text-ink'
                : done
                  ? 'border-citron-500 text-ink'
                  : 'border-line text-muted',
            )}
          >
            <span className="flex items-center gap-1.5">
              {done ? (
                <Check aria-hidden="true" className="size-4 text-citron-700" />
              ) : (
                <span aria-hidden="true">{i + 1}</span>
              )}
              <span className={active ? '' : 'sr-only sm:not-sr-only'}>{step.title}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Suggested roll and the numbers already taken in the chosen class-section. */
function RollHint({ classId, sectionId, onSuggest }) {
  const next = useNextRoll({ classId, sectionId });
  const suggested = next.data?.suggestedRollNo;
  const suggest = useEffectEvent((n) => onSuggest(n));
  useEffect(() => {
    if (suggested) suggest(suggested);
  }, [suggested]);
  if (!next.data) return null;
  const taken = next.data.taken;
  return (
    <p className="text-sm text-muted">
      Suggested: <strong className="text-ink">{suggested}</strong>
      {taken.length ? ` · Taken: ${taken.join(', ')}` : ' · No rolls taken yet'}
    </p>
  );
}

function CreatedCard({ result, onAnother }) {
  const [slip, setSlip] = useState(null);
  const { user, password, placement } = result;
  return (
    <Card className="flex flex-col items-start gap-4">
      <p className="flex items-center gap-2 text-lg font-bold">
        <CircleCheck aria-hidden="true" className="size-6 text-citron-700" />
        {user.name}&apos;s account is ready
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted">Username</dt>
        <dd className="font-mono font-bold">{user.username}</dd>
        <dt className="text-muted">{text.tempPassword.label}</dt>
        <dd className="font-mono font-bold">{password}</dd>
        {placement && (
          <>
            <dt className="text-muted">Class</dt>
            <dd>{placement}</dd>
          </>
        )}
      </dl>
      <Alert tone="info">{text.tempPassword.shownOnce}</Alert>
      <div className="flex flex-wrap gap-2">
        {user.role === 'student' && (
          <Button
            icon={Printer}
            onClick={() =>
              setSlip({
                name: user.name,
                classSection: placement,
                username: user.username,
                password,
                date: formatSchoolDate(todayDateKey(), { weekday: true }),
              })
            }
          >
            {text.slip.print}
          </Button>
        )}
        <Link to={adminPaths.user(user._id)} className={buttonClasses({ variant: 'secondary' })}>
          View account
        </Link>
        <Button variant="ghost" icon={UserPlus} onClick={onAnother}>
          Create another
        </Button>
      </div>
      <LoginSlipDialog account={slip} onClose={() => setSlip(null)} />
    </Card>
  );
}

function StudentForm({ onCreated }) {
  const create = useCreateUser();
  const [step, setStep] = useState(0);
  const classes = useClasses();
  const form = useZodForm(studentSchema, {
    // Steps are checked with trigger(), which does not mark fields as touched: re-check on every
    // change so a fixed field clears at once (clearing on blur would move Next under the pointer).
    mode: 'onChange',
    defaultValues: {
      name: '',
      username: '',
      email: '',
      password: generateTempPassword(),
      profile: {
        nickname: '',
        dateOfBirth: '',
        gender: '',
        classId: '',
        sectionId: '',
        rollNo: '',
        admissionDate: todayDateKey(),
        guardian: { name: '', relation: '', phone: '', email: '', address: '' },
      },
    },
  });
  const { errors, isSubmitting, isDirty, dirtyFields } = form.formState;
  const { blocker, allowNavigation } = useUnsavedChanges(isDirty && !isSubmitting);
  const [classId, sectionId, rollNo] = useWatch({
    control: form.control,
    name: ['profile.classId', 'profile.sectionId', 'profile.rollNo'],
  });
  const sections = useSections(classId || undefined, { enabled: Boolean(classId) });
  const className = classes.data?.find((c) => c._id === classId)?.name;
  const sectionName = sections.data?.find((s) => s._id === sectionId)?.name;
  const e = errors.profile ?? {};

  // Suggestions until the admin types their own.
  const suggestRoll = (n) => {
    if (!dirtyFields.profile?.rollNo) form.setValue('profile.rollNo', String(n));
  };
  const { setValue } = form;
  const usernameTyped = Boolean(dirtyFields.username);
  useEffect(() => {
    if (!usernameTyped && className && sectionName && rollNo) {
      setValue('username', suggestStudentUsername(className, sectionName, rollNo));
    }
  }, [className, sectionName, rollNo, usernameTyped, setValue]);

  const next = async () => {
    if (await form.trigger(STUDENT_STEPS[step].fields)) setStep(step + 1);
  };
  const onSubmit = form.submit(async (v) => {
    try {
      const user = await create.mutateAsync({
        role: 'student',
        name: v.name,
        username: v.username,
        email: v.email,
        password: v.password,
        profile: {
          classId: v.profile.classId,
          sectionId: v.profile.sectionId,
          rollNo: Number(v.profile.rollNo),
          dateOfBirth: v.profile.dateOfBirth,
          gender: blankToUndefined(v.profile.gender),
          admissionDate: blankToUndefined(v.profile.admissionDate),
          nickname: v.profile.nickname,
          guardian: {
            name: v.profile.guardian.name,
            relation: v.profile.guardian.relation,
            phone: v.profile.guardian.phone,
            email: v.profile.guardian.email,
            address: blankToUndefined(v.profile.guardian.address),
          },
        },
      });
      allowNavigation();
      onCreated({ user, password: v.password, placement: `${className}-${sectionName}` });
    } catch (error) {
      // Go back to the step that holds the first field the server complained about.
      const field = error?.errors?.find((x) => x.field)?.field;
      if (field) setStep(stepOfField(field));
      throw error;
    }
  });

  const last = step === STUDENT_STEPS.length - 1;
  return (
    <Card>
      <Steps current={step} />
      <form onSubmit={last ? onSubmit : (event) => (event.preventDefault(), next())} noValidate>
        <h2 className="mb-4 text-lg font-bold">
          <span className="text-muted">
            Step {step + 1} of {STUDENT_STEPS.length}:
          </span>{' '}
          {STUDENT_STEPS[step].title}
        </h2>

        <div className={cn('grid gap-4 md:grid-cols-2', step !== 0 && 'hidden')}>
          <FormField label="Full name" required error={errors.name?.message}>
            <Input autoComplete="off" {...form.register('name')} />
          </FormField>
          <FormField
            label="Nickname"
            optional
            hint="What the child is called at home; guardians see it."
            error={e.nickname?.message}
          >
            <Input autoComplete="off" {...form.register('profile.nickname')} />
          </FormField>
          <Controller
            control={form.control}
            name="profile.dateOfBirth"
            render={({ field }) => (
              <FormField label="Date of birth" required error={e.dateOfBirth?.message}>
                <DatePicker
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  max={todayDateKey()}
                />
              </FormField>
            )}
          />
          <FormField label="Gender" optional>
            <Select
              placeholder="Not given"
              options={optionsOf(text.genders)}
              {...form.register('profile.gender')}
            />
          </FormField>
        </div>

        <div className={cn('grid gap-4 md:grid-cols-2', step !== 1 && 'hidden')}>
          <FormField label="Class" required error={e.classId?.message}>
            <Select
              placeholder="Choose a class"
              options={(classes.data ?? []).map((c) => ({ value: c._id, label: c.name }))}
              {...form.register('profile.classId', {
                onChange: () => form.setValue('profile.sectionId', ''),
              })}
            />
          </FormField>
          <FormField label="Section" required error={e.sectionId?.message}>
            <Select
              placeholder={classId ? 'Choose a section' : 'Choose a class first'}
              disabled={!classId}
              options={(sections.data ?? []).map((s) => ({ value: s._id, label: s.name }))}
              {...form.register('profile.sectionId')}
            />
          </FormField>
          <div className="flex flex-col gap-1">
            <FormField label="Roll number" required error={e.rollNo?.message}>
              <Input inputMode="numeric" {...form.register('profile.rollNo')} />
            </FormField>
            {classId && sectionId && (
              <RollHint classId={classId} sectionId={sectionId} onSuggest={suggestRoll} />
            )}
          </div>
          <Controller
            control={form.control}
            name="profile.admissionDate"
            render={({ field }) => (
              <FormField label="Admission date" hint="Attendance counts from this day.">
                <DatePicker
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              </FormField>
            )}
          />
        </div>

        <div className={cn('grid gap-4 md:grid-cols-2', step !== 2 && 'hidden')}>
          <FormField label="Guardian's name" required error={e.guardian?.name?.message}>
            <Input autoComplete="off" {...form.register('profile.guardian.name')} />
          </FormField>
          <FormField label="Relation" required error={e.guardian?.relation?.message}>
            <Select
              placeholder="Choose"
              options={optionsOf(text.relations)}
              {...form.register('profile.guardian.relation')}
            />
          </FormField>
          <FormField label="Mobile" required error={e.guardian?.phone?.message}>
            <Input
              type="tel"
              inputMode="tel"
              placeholder="01XXXXXXXXX"
              {...form.register('profile.guardian.phone')}
            />
          </FormField>
          <FormField
            label="Email"
            optional
            hint="Absence alerts are emailed here when set."
            error={e.guardian?.email?.message}
          >
            <Input type="email" {...form.register('profile.guardian.email')} />
          </FormField>
          <FormField
            label="Address"
            optional
            error={e.guardian?.address?.message}
            className="md:col-span-2"
          >
            <Textarea rows={2} {...form.register('profile.guardian.address')} />
          </FormField>
        </div>

        <div className={cn('grid gap-4 md:grid-cols-2', step !== 3 && 'hidden')}>
          <FormField
            label="Username"
            required
            hint="The guardian logs in with this."
            error={errors.username?.message}
          >
            <Input autoCapitalize="none" spellCheck={false} {...form.register('username')} />
          </FormField>
          <FormField label="Account email" optional error={errors.email?.message}>
            <Input type="email" {...form.register('email')} />
          </FormField>
          <Controller
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormField
                label={text.tempPassword.label}
                required
                hint="They must change it at first login."
                error={errors.password?.message}
                className="md:col-span-2"
              >
                <TempPasswordField value={field.value} onChange={field.onChange} />
              </FormField>
            )}
          />
        </div>

        {form.formError && (
          <Alert tone="error" className="mt-4">
            {form.formError}
          </Alert>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-between">
          {step > 0 ? (
            <Button variant="secondary" icon={ArrowLeft} onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : (
            <Link to={adminPaths.users()} className={buttonClasses({ variant: 'secondary' })}>
              Cancel
            </Link>
          )}
          {last ? (
            <Button type="submit" icon={UserPlus} loading={isSubmitting}>
              Create account
            </Button>
          ) : (
            <Button type="submit" iconRight={ArrowRight}>
              Next
            </Button>
          )}
        </div>
      </form>
      <UnsavedChangesDialog blocker={blocker} />
    </Card>
  );
}

/** Teachers and administrators: one short form. */
function StaffForm({ role, onCreated }) {
  const create = useCreateUser();
  const teacher = role === 'teacher';
  const form = useZodForm(teacher ? teacherSchema : adminSchema, {
    defaultValues: {
      name: '',
      username: '',
      email: '',
      phone: '',
      password: generateTempPassword(),
      ...(teacher && {
        profile: { employeeId: '', qualification: '', joiningDate: todayDateKey() },
      }),
    },
  });
  const { errors, isSubmitting, isDirty } = form.formState;
  const { blocker, allowNavigation } = useUnsavedChanges(isDirty && !isSubmitting);
  const onSubmit = form.submit(async (v) => {
    const user = await create.mutateAsync({
      role,
      name: v.name,
      username: v.username,
      email: v.email,
      phone: blankToUndefined(v.phone),
      password: v.password,
      ...(teacher && {
        profile: {
          employeeId: v.profile.employeeId,
          qualification: blankToUndefined(v.profile.qualification),
          joiningDate: blankToUndefined(v.profile.joiningDate),
        },
      }),
    });
    allowNavigation();
    onCreated({ user, password: v.password });
  });
  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="grid gap-4 md:grid-cols-2">
        <FormField label="Full name" required error={errors.name?.message}>
          <Input autoComplete="off" {...form.register('name')} />
        </FormField>
        <FormField label="Username" required error={errors.username?.message}>
          <Input
            autoCapitalize="none"
            spellCheck={false}
            placeholder="first.last"
            {...form.register('username')}
          />
        </FormField>
        <FormField label="Email" optional error={errors.email?.message}>
          <Input type="email" {...form.register('email')} />
        </FormField>
        <FormField label="Mobile" optional error={errors.phone?.message}>
          <Input type="tel" inputMode="tel" {...form.register('phone')} />
        </FormField>
        {teacher && (
          <>
            <FormField label="Employee ID" required error={errors.profile?.employeeId?.message}>
              <Input {...form.register('profile.employeeId')} />
            </FormField>
            <Controller
              control={form.control}
              name="profile.joiningDate"
              render={({ field }) => (
                <FormField label="Joining date" optional>
                  <DatePicker
                    name={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    ref={field.ref}
                  />
                </FormField>
              )}
            />
            <FormField label="Qualification" optional className="md:col-span-2">
              <Input {...form.register('profile.qualification')} />
            </FormField>
          </>
        )}
        <Controller
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormField
              label={text.tempPassword.label}
              required
              hint="They must change it at first login."
              error={errors.password?.message}
              className="md:col-span-2"
            >
              <TempPasswordField value={field.value} onChange={field.onChange} />
            </FormField>
          )}
        />
        {form.formError && (
          <Alert tone="error" className="md:col-span-2">
            {form.formError}
          </Alert>
        )}
        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end md:col-span-2">
          <Link to={adminPaths.users()} className={buttonClasses({ variant: 'secondary' })}>
            Cancel
          </Link>
          <Button type="submit" icon={UserPlus} loading={isSubmitting}>
            Create account
          </Button>
        </div>
      </form>
      <UnsavedChangesDialog blocker={blocker} />
    </Card>
  );
}

const TITLES = { student: 'New student', teacher: 'New teacher', admin: 'New administrator' };

/** /admin/users/new?role=student|teacher|admin (FR-ADM-01). */
export default function UserCreatePage() {
  const [params] = useSearchParams();
  const role = ['student', 'teacher', 'admin'].includes(params.get('role'))
    ? params.get('role')
    : 'student';
  const [created, setCreated] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const another = () => {
    setCreated(null);
    setFormKey((k) => k + 1);
  };

  return (
    <>
      <Link
        to={adminPaths.users()}
        className={buttonClasses({ variant: 'ghost', size: 'sm', className: '-ml-2 mb-2' })}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Users
      </Link>
      <PageHeader
        title={TITLES[role]}
        description={
          role === 'student'
            ? 'Four short steps. The guardian logs in with the account and changes the password.'
            : 'The account is active at once; the user changes the password at first login.'
        }
      />
      {created ? (
        <CreatedCard result={created} onAnother={another} />
      ) : role === 'student' ? (
        <StudentForm key={formKey} onCreated={setCreated} />
      ) : (
        <StaffForm key={`${role}-${formKey}`} role={role} onCreated={setCreated} />
      )}
    </>
  );
}
