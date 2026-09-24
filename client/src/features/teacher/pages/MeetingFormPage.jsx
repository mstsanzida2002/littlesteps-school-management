import { ArrowLeft, Save } from 'lucide-react';
import { Controller, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import * as z from 'zod/mini';

import { Alert } from '../../../components/ui/Alert.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { buttonClasses } from '../../../components/ui/buttonStyles.js';
import { Card } from '../../../components/ui/Card.jsx';
import { Checkbox } from '../../../components/ui/Checkbox.jsx';
import { DatePicker } from '../../../components/ui/DatePicker.jsx';
import { FormField } from '../../../components/ui/FormField.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { QueryState } from '../../../components/ui/QueryState.jsx';
import { RadioGroup } from '../../../components/ui/RadioGroup.jsx';
import { Select } from '../../../components/ui/Select.jsx';
import { Skeleton } from '../../../components/ui/Skeleton.jsx';
import { Textarea } from '../../../components/ui/Textarea.jsx';
import { toast } from '../../../components/ui/toast.js';
import { UnsavedChangesDialog } from '../../../components/ui/UnsavedChangesDialog.jsx';
import { teacherPaths } from '../../../config/paths.js';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges.js';
import { useZodForm } from '../../../hooks/useZodForm.js';
import { schoolDateTimeParts } from '../../../utils/date.js';
import { useClassAttendanceSummary } from '../../attendance/hooks/useAttendance.js';
import {
  useCreateMeeting,
  useMeeting,
  useUpdateMeeting,
} from '../../meetings/hooks/useMeetings.js';
import { DURATIONS, MEETING_TYPES } from '../../meetings/labels.js';
import { useMyAssignments, useSchoolSettings } from '../../school/hooks/useSchool.js';
import { classSectionValue } from '../classSection.js';

const schema = z
  .object({
    title: z.string().check(z.trim(), z.minLength(3, 'At least 3 characters'), z.maxLength(150)),
    type: z.enum(['parent_teacher', 'orientation', 'event', 'other']),
    date: z.string().check(z.minLength(1, 'Choose a date')),
    time: z.string().check(z.regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a time')),
    durationMinutes: z.string(),
    where: z.enum(['venue', 'online']),
    venue: z.string(),
    onlineLink: z.string(),
    agenda: z.string().check(z.maxLength(2000, 'Keep the agenda under 2000 characters')),
    target: z.enum(['sections', 'classes', 'students']),
    sectionIds: z.array(z.string()),
    classIds: z.array(z.string()),
    rosterSection: z.string(),
    studentIds: z.array(z.string()),
  })
  .check(
    z.refine((v) => v.where !== 'venue' || v.venue.trim().length >= 2, {
      path: ['venue'],
      message: 'Where will you meet?',
    }),
    z.refine((v) => v.where !== 'online' || /^https:\/\/\S+$/.test(v.onlineLink.trim()), {
      path: ['onlineLink'],
      message: 'Paste the https:// meeting link',
    }),
    z.refine((v) => v.target !== 'sections' || v.sectionIds.length > 0, {
      path: ['sectionIds'],
      message: 'Choose at least one class',
    }),
    z.refine((v) => v.target !== 'classes' || v.classIds.length > 0, {
      path: ['classIds'],
      message: 'Choose at least one class',
    }),
    z.refine((v) => v.target !== 'students' || v.studentIds.length > 0, {
      path: ['studentIds'],
      message: 'Choose at least one student',
    }),
  );

/** Checkbox list bound to an array field. */
function CheckboxList({ legend, options, value, onChange, error }) {
  return (
    <fieldset>
      <legend className="mb-1 font-semibold">{legend}</legend>
      <div className="grid gap-x-4 sm:grid-cols-2">
        {options.map((o) => (
          <Checkbox
            key={o.value}
            label={o.label}
            description={o.description}
            checked={value.includes(o.value)}
            onChange={(event) =>
              onChange(
                event.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value),
              )
            }
          />
        ))}
      </div>
      {error && <p className="text-sm font-semibold text-absent-ink">{error}</p>}
    </fieldset>
  );
}

function StudentPicker({ classSection, value, onChange, error }) {
  const [classId, sectionId] = classSection.split(':');
  const roster = useClassAttendanceSummary({ classId, sectionId });
  if (!classSection) return null;
  return (
    <QueryState query={roster} compact loading={<Skeleton className="h-32 rounded-card" />}>
      {(data) => (
        <CheckboxList
          legend="Students (their guardians are invited)"
          options={data.students.map((s) => ({
            value: s.studentId,
            label: `${s.name}`,
            description: `Roll ${s.rollNo}`,
          }))}
          value={value}
          onChange={onChange}
          error={error}
        />
      )}
    </QueryState>
  );
}

function MeetingForm({ meeting, assignments, today }) {
  const navigate = useNavigate();
  const create = useCreateMeeting();
  const update = useUpdateMeeting();
  const editing = Boolean(meeting);
  const { classSections, wholeClasses } = assignments;
  const parts = meeting ? schoolDateTimeParts(meeting.dateTime) : null;
  const invite = meeting?.invite;

  const form = useZodForm(schema, {
    defaultValues: {
      title: meeting?.title ?? '',
      type: meeting?.type ?? 'parent_teacher',
      date: parts?.date ?? today,
      time: parts?.time ?? '10:00',
      durationMinutes: String(meeting?.durationMinutes ?? 30),
      where: meeting?.onlineLink ? 'online' : 'venue',
      venue: meeting?.venue ?? '',
      onlineLink: meeting?.onlineLink ?? '',
      agenda: meeting?.agenda ?? '',
      target: ['sections', 'classes', 'students'].includes(invite?.target)
        ? invite.target
        : 'sections',
      sectionIds: (
        invite?.sectionIds ??
        (classSections.length === 1 ? [String(classSections[0].sectionId)] : [])
      ).map(String),
      classIds: (invite?.classIds ?? []).map(String),
      rosterSection: classSections.length === 1 ? classSectionValue(classSections[0]) : '',
      studentIds: (invite?.studentIds ?? []).map(String),
    },
  });
  const { errors, isSubmitting, isDirty } = form.formState;
  const [where, target, rosterSection] = useWatch({
    control: form.control,
    name: ['where', 'target', 'rosterSection'],
  });
  const { blocker, allowNavigation } = useUnsavedChanges(isDirty && !isSubmitting);

  const targets = [
    {
      value: 'sections',
      label: 'My classes',
      description: 'Guardians of every student in the classes you choose.',
    },
    ...(wholeClasses.length
      ? [
          {
            value: 'classes',
            label: 'A whole class',
            description: 'Both sections, for classes you teach entirely.',
          },
        ]
      : []),
    {
      value: 'students',
      label: 'Chosen students',
      description: 'Only the guardians of the students you pick.',
    },
  ];

  const onSubmit = form.submit(async (v) => {
    const body = {
      title: v.title,
      type: v.type,
      date: v.date,
      time: v.time,
      durationMinutes: Number(v.durationMinutes),
      agenda: v.agenda.trim() || undefined,
      ...(v.where === 'venue' ? { venue: v.venue.trim() } : { onlineLink: v.onlineLink.trim() }),
      invite: {
        target: v.target,
        ...(v.target === 'sections' && { sectionIds: v.sectionIds }),
        ...(v.target === 'classes' && { classIds: v.classIds }),
        ...(v.target === 'students' && { studentIds: v.studentIds }),
      },
    };
    const saved = editing
      ? await update.mutateAsync({ id: meeting._id, ...body })
      : await create.mutateAsync(body);
    allowNavigation();
    toast.success(
      editing
        ? 'Meeting updated. Invitees are notified.'
        : 'Meeting created. Guardians are invited.',
    );
    navigate(teacherPaths.meeting(saved?._id ?? meeting._id), { replace: !editing });
  });

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="grid gap-4 md:grid-cols-2">
        <FormField label="Title" required error={errors.title?.message} className="md:col-span-2">
          <Input autoComplete="off" {...form.register('title')} />
        </FormField>
        <FormField label="Type" required>
          <Select options={MEETING_TYPES} {...form.register('type')} />
        </FormField>
        <FormField label="Length">
          <Select
            options={DURATIONS.map((m) => ({ value: String(m), label: `${m} minutes` }))}
            {...form.register('durationMinutes')}
          />
        </FormField>
        <Controller
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormField label="Date" required error={errors.date?.message}>
              <DatePicker
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                min={today}
              />
            </FormField>
          )}
        />
        <FormField label="Time" required hint="Bangladesh time" error={errors.time?.message}>
          <Input type="time" {...form.register('time')} />
        </FormField>

        <Controller
          control={form.control}
          name="where"
          render={({ field }) => (
            <RadioGroup
              legend="Where"
              variant="segmented"
              options={[
                { value: 'venue', label: 'In person' },
                { value: 'online', label: 'Online' },
              ]}
              value={field.value}
              onChange={field.onChange}
              className="md:col-span-2"
            />
          )}
        />
        {where === 'venue' ? (
          <FormField label="Venue" required error={errors.venue?.message} className="md:col-span-2">
            <Input placeholder="e.g. Playgroup classroom" {...form.register('venue')} />
          </FormField>
        ) : (
          <FormField
            label="Meeting link"
            required
            error={errors.onlineLink?.message}
            className="md:col-span-2"
          >
            <Input
              type="url"
              inputMode="url"
              placeholder="https://"
              {...form.register('onlineLink')}
            />
          </FormField>
        )}
        <FormField label="Agenda" optional error={errors.agenda?.message} className="md:col-span-2">
          <Textarea rows={3} {...form.register('agenda')} />
        </FormField>

        <div className="flex flex-col gap-4 rounded-card bg-blush-50 p-4 md:col-span-2">
          <Controller
            control={form.control}
            name="target"
            render={({ field }) => (
              <RadioGroup
                legend="Who is invited"
                options={targets}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          {target === 'sections' && (
            <Controller
              control={form.control}
              name="sectionIds"
              render={({ field }) => (
                <CheckboxList
                  legend="Classes"
                  options={classSections.map((cs) => ({
                    value: String(cs.sectionId),
                    label: cs.label,
                  }))}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.sectionIds?.message}
                />
              )}
            />
          )}
          {target === 'classes' && (
            <Controller
              control={form.control}
              name="classIds"
              render={({ field }) => (
                <CheckboxList
                  legend="Whole classes"
                  options={wholeClasses.map((c) => ({ value: String(c.classId), label: c.name }))}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.classIds?.message}
                />
              )}
            />
          )}
          {target === 'students' && (
            <>
              <FormField label="From class">
                <Select
                  placeholder="Choose a class"
                  options={classSections.map((cs) => ({
                    value: classSectionValue(cs),
                    label: cs.label,
                  }))}
                  {...form.register('rosterSection')}
                />
              </FormField>
              <Controller
                control={form.control}
                name="studentIds"
                render={({ field }) => (
                  <StudentPicker
                    classSection={rosterSection}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.studentIds?.message}
                  />
                )}
              />
            </>
          )}
        </div>

        {form.formError && (
          <Alert tone="error" className="md:col-span-2">
            {form.formError}
          </Alert>
        )}
        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end md:col-span-2">
          <Link
            to={editing ? teacherPaths.meeting(meeting._id) : teacherPaths.meetings()}
            className={buttonClasses({ variant: 'secondary' })}
          >
            Cancel
          </Link>
          <Button type="submit" icon={Save} loading={isSubmitting}>
            {editing ? 'Save and notify' : 'Create and invite'}
          </Button>
        </div>
      </form>
      <UnsavedChangesDialog blocker={blocker} />
    </Card>
  );
}

export default function MeetingFormPage() {
  const { meetingId } = useParams();
  const editing = Boolean(meetingId);
  const meeting = useMeeting(meetingId);
  const mine = useMyAssignments();
  const settings = useSchoolSettings();
  const queries = [mine, settings, ...(editing ? [meeting] : [])];
  const blocking = queries.find((q) => q.isError) ?? queries.find((q) => q.isPending);

  return (
    <>
      <Link
        to={editing ? teacherPaths.meeting(meetingId) : teacherPaths.meetings()}
        className={buttonClasses({ variant: 'ghost', size: 'sm', className: '-ml-2 mb-2' })}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back
      </Link>
      <PageHeader title={editing ? 'Edit meeting' : 'New meeting'} />
      {blocking ? (
        <QueryState query={blocking} loading={<Skeleton className="h-[32rem] rounded-card" />}>
          {() => null}
        </QueryState>
      ) : (
        <MeetingForm
          meeting={editing ? meeting.data : null}
          assignments={mine.data}
          today={settings.data.today}
        />
      )}
    </>
  );
}
