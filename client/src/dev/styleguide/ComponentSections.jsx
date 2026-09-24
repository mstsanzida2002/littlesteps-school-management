import { Award, CalendarCheck, Download, Pencil, Plus, Save, Trash2, Users } from 'lucide-react';
import { Controller } from 'react-hook-form';
import * as z from 'zod/mini';

import { Alert } from '../../components/ui/Alert.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Badge, StatusBadge } from '../../components/ui/Badge.jsx';
import { Button, IconButton } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Checkbox } from '../../components/ui/Checkbox.jsx';
import { DatePicker } from '../../components/ui/DatePicker.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { FormField } from '../../components/ui/FormField.jsx';
import { Input, PasswordInput } from '../../components/ui/Input.jsx';
import { NotificationBell } from '../../components/ui/NotificationBell.jsx';
import { ProgressRing } from '../../components/ui/ProgressRing.jsx';
import { RadioGroup } from '../../components/ui/RadioGroup.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { Skeleton, SkeletonCard, SkeletonText } from '../../components/ui/Skeleton.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { toast } from '../../components/ui/toast.js';
import { getStatus, STATUS_GROUPS } from '../../config/statuses.js';
import { useZodForm } from '../../hooks/useZodForm.js';
import { ApiClientError } from '../../lib/axios.js';
import { addDaysToKey, todayDateKey } from '../../utils/date.js';
import { CLASS_OPTIONS } from './sampleData.js';
import { Example, Section } from './Section.jsx';

const attendanceOptions = Object.entries(STATUS_GROUPS.attendance).map(([value, meta]) => ({
  value,
  label: meta.label,
  icon: meta.icon,
  tone: meta.tone,
}));

export function ButtonSection() {
  return (
    <Section
      id="buttons"
      title="Buttons"
      description="44px tall (small buttons grow to 44px on touch screens). Loading keeps the label and blocks double submits."
    >
      <Example title="Variants" className="flex flex-wrap gap-3">
        <Button icon={Save}>Save attendance</Button>
        <Button variant="secondary">Cancel</Button>
        <Button variant="ghost" icon={Plus}>
          Add student
        </Button>
        <Button variant="danger" icon={Trash2}>
          Delete
        </Button>
        <Button variant="danger-ghost">Suspend</Button>
      </Example>
      <Example title="States" className="flex flex-wrap gap-3">
        <Button disabled>Disabled</Button>
        <Button loading>Saving…</Button>
        <Button variant="secondary" loading>
          Loading
        </Button>
        <Button variant="secondary" disabled>
          Disabled
        </Button>
      </Example>
      <Example title="Sizes and icon buttons" className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="secondary" icon={Download}>
          Small
        </Button>
        <Button>Medium</Button>
        <Button size="lg">Large</Button>
        <IconButton icon={Pencil} label="Edit" />
        <IconButton icon={Trash2} label="Delete" variant="danger-ghost" />
        <Button fullWidth className="sm:w-auto">
          Full width on phones
        </Button>
      </Example>
    </Section>
  );
}

const demoSchema = z.object({
  name: z.string().check(z.trim(), z.minLength(3, 'Enter at least 3 characters')),
  email: z.union([z.literal(''), z.email('Enter a valid email')]),
  classId: z.string().check(z.minLength(1, 'Choose a class')),
  date: z.string({ error: 'Choose a date' }).check(z.minLength(1, 'Choose a date')),
  status: z.enum(['present', 'absent', 'late', 'excused'], { error: 'Choose a status' }),
  notes: z.string().check(z.maxLength(200, 'Keep it under 200 characters')),
  consent: z.literal(true, { error: 'Please confirm' }),
});

export function FormSection() {
  const today = todayDateKey();
  const form = useZodForm(demoSchema, {
    defaultValues: {
      name: '',
      email: '',
      classId: '',
      date: today,
      status: undefined,
      notes: '',
      consent: false,
    },
  });
  const { errors, isSubmitting } = form.formState;

  const simulate422 = () =>
    form.setServerError(
      new ApiClientError({
        status: 422,
        message: 'Validation failed',
        errors: [
          { field: 'email', message: 'Already exists', location: 'body' },
          { field: 'date', message: 'Date is outside the active session', location: 'body' },
        ],
      }),
    );
  const simulate409 = () =>
    form.setServerError(
      new ApiClientError({
        status: 409,
        message: 'Attendance for Playgroup-A on this date is already marked.',
      }),
    );

  return (
    <Section
      id="forms"
      title="Forms"
      description="react-hook-form + Zod. Errors appear on blur and on submit; server 422 errors land on the matching fields (try the buttons), anything else shows above the actions."
    >
      <Card>
        <form
          noValidate
          onSubmit={form.submit(async () => {
            await new Promise((resolve) => setTimeout(resolve, 600));
            toast.success('Saved (demo)');
          })}
          className="grid gap-4 md:grid-cols-2"
        >
          <FormField
            label="Student name"
            required
            hint="Bangla works: আয়ান রহমান"
            error={errors.name?.message}
          >
            <Input autoComplete="off" {...form.register('name')} />
          </FormField>
          <FormField label="Guardian email" optional error={errors.email?.message}>
            <Input type="email" inputMode="email" {...form.register('email')} />
          </FormField>
          <FormField label="Class" required error={errors.classId?.message}>
            <Select
              placeholder="Choose a class"
              options={CLASS_OPTIONS}
              {...form.register('classId')}
            />
          </FormField>
          {/* Controlled components: FormField goes inside the Controller so it wires the input. */}
          <Controller
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormField
                label="Date"
                required
                hint="School dates are Asia/Dhaka days."
                error={errors.date?.message}
              >
                <DatePicker
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  min={addDaysToKey(today, -7)}
                  max={today}
                  showToday
                />
              </FormField>
            )}
          />
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <RadioGroup
                legend="Attendance"
                variant="segmented"
                options={attendanceOptions}
                value={field.value}
                onChange={field.onChange}
                error={errors.status?.message}
                className="md:col-span-2"
              />
            )}
          />
          <FormField
            label="Remarks"
            optional
            error={errors.notes?.message}
            className="md:col-span-2"
          >
            <Textarea rows={3} placeholder="খুব সুন্দর ছবি এঁকেছে!" {...form.register('notes')} />
          </FormField>
          <Checkbox
            label="I have checked the details"
            description="Guardians will be notified."
            error={errors.consent?.message}
            className="md:col-span-2"
            {...form.register('consent')}
          />
          {form.formError && (
            <Alert tone="error" className="md:col-span-2">
              {form.formError}
            </Alert>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap md:col-span-2">
            <Button variant="ghost" onClick={() => form.reset()}>
              Reset
            </Button>
            <Button variant="secondary" onClick={simulate422}>
              Simulate server 422
            </Button>
            <Button variant="secondary" onClick={simulate409}>
              Simulate 409
            </Button>
            <Button type="submit" icon={Save} loading={isSubmitting} className="sm:ml-auto">
              Save
            </Button>
          </div>
        </form>
      </Card>

      <Example title="Field states" className="grid gap-4 md:grid-cols-3">
        <FormField label="Default" hint="A hint under the field">
          <Input placeholder="Placeholder" />
        </FormField>
        <FormField label="Invalid" error="Roll 6 is already taken in Playgroup-B. Next free: 7.">
          <Input defaultValue="6" inputMode="numeric" />
        </FormField>
        <FormField label="Disabled">
          <Input defaultValue="Playgroup-A" disabled />
        </FormField>
        <FormField label="Password">
          <PasswordInput defaultValue="Secret123" />
        </FormField>
        <FormField label="Select (disabled)">
          <Select options={CLASS_OPTIONS} disabled defaultValue="kg1" />
        </FormField>
        <RadioGroup
          legend="Meeting response"
          value="will_attend"
          onChange={() => {}}
          options={Object.entries(STATUS_GROUPS.rsvp)
            .filter(([value]) => value !== 'no_response')
            .map(([value, meta]) => ({ value, label: meta.label }))}
        />
      </Example>
    </Section>
  );
}

export function StatusSection() {
  return (
    <Section
      id="status"
      title="Status badges"
      description="Every status from config/statuses.js: icon + label, never colour alone. Unknown values still render, neutral."
    >
      {Object.entries(STATUS_GROUPS).map(([group, statuses]) => (
        <Example key={group} title={group} className="flex flex-wrap gap-2">
          {Object.keys(statuses).map((value) => (
            <StatusBadge key={value} group={group} value={value} />
          ))}
          {group === 'rsvp' && (
            <StatusBadge
              group="rsvp"
              value={null}
              label={`${getStatus('rsvp', null).label} (null)`}
            />
          )}
        </Example>
      ))}
      <Example title="Small, and a fallback for an unknown value" className="flex flex-wrap gap-2">
        <StatusBadge group="attendance" value="present" size="sm" />
        <StatusBadge group="attendance" value="absent" size="sm" />
        <StatusBadge group="account" value="on_leave" />
        <Badge tone="info" icon={Award}>
          Custom badge
        </Badge>
      </Example>
    </Section>
  );
}

export function CardSection() {
  return (
    <Section
      id="cards"
      title="Cards and stats"
      description="Stat hints say in words what the colour means."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Attendance this session"
          value="21 of 22 days"
          progress={95.5}
          tone="present"
          hint="Above the 75% requirement"
        />
        <StatCard
          label="Attendance this session"
          value="15 of 21 days"
          progress={71.4}
          tone="absent"
          hint="Below the 75% requirement"
        />
        <StatCard
          label="Attendance this session"
          value="No records yet"
          progress={null}
          tone="neutral"
        />
        <StatCard label="Students" value="40" icon={Users} tone="info" hint="4 need attention" />
        <StatCard
          label="Still to mark today"
          value="2 classes"
          icon={CalendarCheck}
          tone="late"
          hint="Playgroup-A, Nursery-B"
        />
        <StatCard label="Loading" loading />
      </div>
      <Example title="Progress rings" className="flex flex-wrap items-center gap-4">
        <ProgressRing value={100} tone="present" />
        <ProgressRing value={95.5} tone="present" />
        <ProgressRing value={74.9} tone="absent" />
        <ProgressRing value={45} tone="late" size={60} stroke={7} />
        <ProgressRing value={null} tone="neutral" />
      </Example>
      <Card
        title="Parent-teacher meeting"
        description="Thu, 1 Oct 2026, 10:00 am · School hall"
        actions={<StatusBadge group="rsvp" value="will_attend" />}
      >
        <p>Discuss progress for the first term. Please bring the reading diary.</p>
        <p lang="bn" className="mt-2 text-muted">
          প্রথম সাময়িকের অগ্রগতি নিয়ে আলোচনা।
        </p>
      </Card>
    </Section>
  );
}

export function FeedbackSection() {
  return (
    <Section
      id="feedback"
      title="Feedback"
      description="Alerts, empty and error states, loading and toasts."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Alert tone="info">Attendance can be edited for 7 days.</Alert>
        <Alert tone="success" title="Results published">
          24 guardians were notified.
        </Alert>
        <Alert tone="warning">Your password was set by the school. Please choose your own.</Alert>
        <Alert tone="error">Incorrect username or password.</Alert>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card padded={false}>
          <EmptyState
            title="No notices yet"
            description="New notices from the school will show here."
            compact
          />
        </Card>
        <Card padded={false}>
          <ErrorState error={{ status: 0 }} onRetry={() => toast.info('Retrying (demo)')} compact />
        </Card>
        <Card padded={false}>
          <ErrorState
            error={{ status: 403, message: 'This class is not assigned to you.' }}
            compact
          />
        </Card>
      </div>
      <Example title="Loading" className="grid gap-4 md:grid-cols-3">
        <SkeletonCard />
        <div className="rounded-card border border-line bg-surface p-4">
          <Skeleton className="mb-3 h-5 w-1/2" />
          <SkeletonText lines={3} />
        </div>
        <Spinner label="Loading attendance…" />
      </Example>
      <Example title="Toasts" className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          onClick={() => toast.success('Attendance saved for Playgroup-A')}
        >
          Success toast
        </Button>
        <Button
          variant="secondary"
          onClick={() => toast.error('Could not save. Check your connection.')}
        >
          Error toast
        </Button>
        <Button
          variant="secondary"
          onClick={() => toast.info('A new notice was published', { title: 'Notice' })}
        >
          Info toast
        </Button>
      </Example>
    </Section>
  );
}

export function IdentitySection() {
  return (
    <Section
      id="identity"
      title="Avatars and bell"
      description="Initials handle Bangla names; the bell's count is a label, not only a dot."
    >
      <Example title="Avatars" className="flex flex-wrap items-center gap-3">
        <Avatar name="Ayaan Rahman" size="lg" />
        <Avatar name="নুসরাত জাহান" size="lg" />
        <Avatar name="Farhana Akter" />
        <Avatar name="Rafi" />
        <Avatar name="সাদিয়া ইসলাম" size="sm" />
        <Avatar name="Mahir Ahmed" size="sm" label="Mahir Ahmed" />
      </Example>
      <Example title="Notification bell" className="flex flex-wrap items-center gap-3">
        <NotificationBell count={0} />
        <NotificationBell count={3} />
        <NotificationBell
          count={120}
          onClick={() => toast.info('The notification list comes with the student module.')}
        />
      </Example>
    </Section>
  );
}
