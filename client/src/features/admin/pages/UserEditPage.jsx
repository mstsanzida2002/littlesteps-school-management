import { ArrowLeft, Save } from 'lucide-react';
import { Controller, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';

import { Alert } from '../../../components/ui/Alert.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { buttonClasses } from '../../../components/ui/buttonStyles.js';
import { Card } from '../../../components/ui/Card.jsx';
import { DatePicker } from '../../../components/ui/DatePicker.jsx';
import { FormField } from '../../../components/ui/FormField.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { QueryState } from '../../../components/ui/QueryState.jsx';
import { Select } from '../../../components/ui/Select.jsx';
import { SkeletonCard } from '../../../components/ui/Skeleton.jsx';
import { Textarea } from '../../../components/ui/Textarea.jsx';
import { toast } from '../../../components/ui/toast.js';
import { UnsavedChangesDialog } from '../../../components/ui/UnsavedChangesDialog.jsx';
import { adminPaths } from '../../../config/paths.js';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges.js';
import { useZodForm } from '../../../hooks/useZodForm.js';
import { useClasses, useNextRoll, useSections, useUpdateUser, useUser } from '../hooks/useAdmin.js';
import { editSchemas } from '../schemas.js';
import { text } from '../text/index.js';

const optionsOf = (map) => Object.entries(map).map(([value, label]) => ({ value, label }));
const idOf = (v) => (v ? String(v._id ?? v) : '');
const dateOf = (v) => (v ? String(v).slice(0, 10) : '');

function defaultsFor(user) {
  const p = user.profile ?? {};
  const base = { name: user.name, username: user.username, email: user.email ?? '' };
  if (user.role === 'student') {
    const g = p.guardian ?? {};
    return {
      ...base,
      profile: {
        nickname: p.nickname ?? '',
        dateOfBirth: dateOf(p.dateOfBirth),
        gender: p.gender ?? '',
        classId: idOf(p.classId),
        sectionId: idOf(p.sectionId),
        rollNo: String(p.rollNo ?? ''),
        admissionDate: dateOf(p.admissionDate),
        guardian: {
          name: g.name ?? '',
          relation: g.relation ?? '',
          phone: g.phone ?? '',
          email: g.email ?? '',
          address: g.address ?? '',
        },
      },
    };
  }
  if (user.role === 'teacher') {
    return {
      ...base,
      phone: user.phone ?? '',
      profile: {
        employeeId: p.employeeId ?? '',
        qualification: p.qualification ?? '',
        joiningDate: dateOf(p.joiningDate),
      },
    };
  }
  return { ...base, phone: user.phone ?? '' };
}

/** Only what changed (the server diffs too, but a smaller PATCH says what the admin meant). */
function changesOf(values, defaults) {
  const out = {};
  for (const [key, value] of Object.entries(values)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = changesOf(value, defaults[key] ?? {});
      if (Object.keys(nested).length) out[key] = nested;
    } else if (value !== defaults[key]) {
      out[key] = value;
    }
  }
  return out;
}

function EditForm({ user }) {
  const navigate = useNavigate();
  const update = useUpdateUser();
  const defaults = defaultsFor(user);
  const form = useZodForm(editSchemas[user.role], { defaultValues: defaults });
  const { errors, isSubmitting, isDirty } = form.formState;
  const { blocker, allowNavigation } = useUnsavedChanges(isDirty && !isSubmitting);
  const student = user.role === 'student';
  const [classId, sectionId] = useWatch({
    control: form.control,
    name: ['profile.classId', 'profile.sectionId'],
  });
  const classes = useClasses({ enabled: student });
  const sections = useSections(classId || undefined, { enabled: student && Boolean(classId) });
  const moving =
    student && (classId !== defaults.profile.classId || sectionId !== defaults.profile.sectionId);
  const next = useNextRoll({ classId: moving ? classId : '', sectionId: moving ? sectionId : '' });
  const e = errors.profile ?? {};

  const onSubmit = form.submit(async (values) => {
    const changes = changesOf(values, defaults);
    if (changes.profile?.rollNo !== undefined)
      changes.profile.rollNo = Number(changes.profile.rollNo);
    // Moving class-section: keep the new section's section id with the class change.
    if (changes.profile?.classId) changes.profile.sectionId = values.profile.sectionId;
    if (!Object.keys(changes).length) {
      toast.info('Nothing changed');
      return;
    }
    await update.mutateAsync({ id: user._id, ...changes });
    allowNavigation();
    toast.success('Account updated');
    navigate(adminPaths.user(user._id));
  });

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="grid gap-4 md:grid-cols-2">
        <FormField label="Full name" required error={errors.name?.message}>
          <Input {...form.register('name')} />
        </FormField>
        <FormField label="Username" required error={errors.username?.message}>
          <Input autoCapitalize="none" spellCheck={false} {...form.register('username')} />
        </FormField>
        <FormField label="Email" optional error={errors.email?.message}>
          <Input type="email" {...form.register('email')} />
        </FormField>
        {!student && (
          <FormField label="Mobile" optional error={errors.phone?.message}>
            <Input type="tel" {...form.register('phone')} />
          </FormField>
        )}

        {student && (
          <>
            <FormField label="Nickname" optional error={e.nickname?.message}>
              <Input {...form.register('profile.nickname')} />
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
                    ref={field.ref}
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
            <FormField label="Class" required error={e.classId?.message}>
              <Select
                options={(classes.data ?? []).map((c) => ({ value: c._id, label: c.name }))}
                {...form.register('profile.classId', {
                  onChange: () => form.setValue('profile.sectionId', ''),
                })}
              />
            </FormField>
            <FormField label="Section" required error={e.sectionId?.message}>
              <Select
                placeholder="Choose a section"
                options={(sections.data ?? []).map((s) => ({ value: s._id, label: s.name }))}
                {...form.register('profile.sectionId')}
              />
            </FormField>
            <FormField
              label="Roll number"
              required
              hint={
                moving && next.data
                  ? `Moving: suggested ${next.data.suggestedRollNo}; taken ${next.data.taken.join(', ') || 'none'}.`
                  : undefined
              }
              error={e.rollNo?.message}
            >
              <Input inputMode="numeric" {...form.register('profile.rollNo')} />
            </FormField>
            {moving && (
              <Alert tone="info" className="md:col-span-2">
                Moving a student changes their meeting invitations: they join the new class&apos;s
                meetings and leave the old one&apos;s.
              </Alert>
            )}
            <h2 className="mt-2 text-lg font-bold md:col-span-2">Guardian</h2>
            <FormField label="Name" required error={e.guardian?.name?.message}>
              <Input {...form.register('profile.guardian.name')} />
            </FormField>
            <FormField label="Relation" required error={e.guardian?.relation?.message}>
              <Select
                options={optionsOf(text.relations)}
                {...form.register('profile.guardian.relation')}
              />
            </FormField>
            <FormField label="Mobile" required error={e.guardian?.phone?.message}>
              <Input type="tel" {...form.register('profile.guardian.phone')} />
            </FormField>
            <FormField label="Email" optional error={e.guardian?.email?.message}>
              <Input type="email" {...form.register('profile.guardian.email')} />
            </FormField>
            <FormField label="Address" optional className="md:col-span-2">
              <Textarea rows={2} {...form.register('profile.guardian.address')} />
            </FormField>
          </>
        )}

        {user.role === 'teacher' && (
          <>
            <FormField label="Employee ID" required error={e.employeeId?.message}>
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

        {form.formError && (
          <Alert tone="error" className="md:col-span-2">
            {form.formError}
          </Alert>
        )}
        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end md:col-span-2">
          <Link to={adminPaths.user(user._id)} className={buttonClasses({ variant: 'secondary' })}>
            Cancel
          </Link>
          <Button type="submit" icon={Save} loading={isSubmitting}>
            Save changes
          </Button>
        </div>
      </form>
      <UnsavedChangesDialog blocker={blocker} />
    </Card>
  );
}

export default function UserEditPage() {
  const { userId } = useParams();
  const query = useUser(userId);
  return (
    <>
      <Link
        to={adminPaths.user(userId)}
        className={buttonClasses({ variant: 'ghost', size: 'sm', className: '-ml-2 mb-2' })}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back
      </Link>
      <QueryState query={query} loading={<SkeletonCard className="h-96" />}>
        {(user) => (
          <>
            <PageHeader title={`Edit ${user.name}`} description={text.roles[user.role]} />
            <EditForm user={user} />
          </>
        )}
      </QueryState>
    </>
  );
}
