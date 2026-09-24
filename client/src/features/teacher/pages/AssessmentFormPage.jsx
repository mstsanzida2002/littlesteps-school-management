import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import * as z from 'zod/mini';

import { Alert } from '../../../components/ui/Alert.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { buttonClasses } from '../../../components/ui/buttonStyles.js';
import { Card } from '../../../components/ui/Card.jsx';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.jsx';
import { DatePicker } from '../../../components/ui/DatePicker.jsx';
import { FormField } from '../../../components/ui/FormField.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { QueryState } from '../../../components/ui/QueryState.jsx';
import { RadioGroup } from '../../../components/ui/RadioGroup.jsx';
import { Select } from '../../../components/ui/Select.jsx';
import { Skeleton } from '../../../components/ui/Skeleton.jsx';
import { toast } from '../../../components/ui/toast.js';
import { UnsavedChangesDialog } from '../../../components/ui/UnsavedChangesDialog.jsx';
import { teacherPaths } from '../../../config/paths.js';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges.js';
import { useZodForm } from '../../../hooks/useZodForm.js';
import { errorMessage } from '../../../lib/errorMessages.js';
import {
  useAssessment,
  useCreateAssessment,
  useDeleteAssessment,
  useUpdateAssessment,
} from '../../results/hooks/useResults.js';
import { ASSESSMENT_MODES, ASSESSMENT_TYPES } from '../../results/labels.js';
import { useMyAssignments, useSchoolSettings } from '../../school/hooks/useSchool.js';
import { classSectionValue } from '../classSection.js';

const schema = z
  .object({
    classSection: z.string().check(z.minLength(1, 'Choose a class')),
    subjectId: z.string().check(z.minLength(1, 'Choose a subject')),
    name: z
      .string()
      .check(
        z.trim(),
        z.minLength(2, 'Give it a name (at least 2 characters)'),
        z.maxLength(100, 'Keep the name under 100 characters'),
      ),
    type: z.enum(['class_test', 'mid_term', 'final', 'other']),
    mode: z.enum(['marks', 'grade', 'remarks']),
    totalMarks: z.string(),
    date: z.string().check(z.minLength(1, 'Choose a date')),
  })
  .check(
    z.refine(
      (v) =>
        v.mode !== 'marks' ||
        (/^\d+$/.test(v.totalMarks.trim()) && +v.totalMarks >= 1 && +v.totalMarks <= 1000),
      { path: ['totalMarks'], message: 'Enter a whole number from 1 to 1000' },
    ),
  );

function AssessmentForm({ assessment, classSections, session, today }) {
  const navigate = useNavigate();
  const editing = Boolean(assessment);
  const create = useCreateAssessment();
  const update = useUpdateAssessment();
  const remove = useDeleteAssessment();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const form = useZodForm(schema, {
    defaultValues: assessment
      ? {
          classSection: `${assessment.classId._id}:${assessment.sectionId._id}`,
          subjectId: String(assessment.subjectId._id),
          name: assessment.name,
          type: assessment.type,
          mode: assessment.mode,
          totalMarks: assessment.totalMarks ? String(assessment.totalMarks) : '',
          date: assessment.date,
        }
      : {
          classSection: classSections.length === 1 ? classSectionValue(classSections[0]) : '',
          subjectId: '',
          name: '',
          type: 'class_test',
          mode: 'marks',
          totalMarks: '20',
          date: today,
        },
  });
  const { errors, isSubmitting, isDirty } = form.formState;
  const [classSection, mode] = useWatch({ control: form.control, name: ['classSection', 'mode'] });
  const subjects =
    classSections.find((cs) => classSectionValue(cs) === classSection)?.subjects ?? [];
  const { blocker, allowNavigation } = useUnsavedChanges(isDirty && !isSubmitting);

  const onSubmit = form.submit(async (values) => {
    const [classId, sectionId] = values.classSection.split(':');
    const fields = {
      name: values.name,
      type: values.type,
      mode: values.mode,
      date: values.date,
      ...(values.mode === 'marks' && { totalMarks: Number(values.totalMarks) }),
    };
    const saved = editing
      ? await update.mutateAsync({ id: assessment._id, ...fields })
      : await create.mutateAsync({ ...fields, classId, sectionId, subjectId: values.subjectId });
    allowNavigation();
    toast.success(editing ? 'Assessment updated' : 'Assessment created. Now enter the results.');
    navigate(teacherPaths.assessment(saved?._id ?? assessment._id), { replace: !editing });
  });

  const onDelete = async () => {
    try {
      await remove.mutateAsync(assessment._id);
      allowNavigation();
      toast.success('Draft deleted');
      navigate(teacherPaths.assessments(), { replace: true });
    } catch (error) {
      toast.error(errorMessage(error));
      setConfirmDelete(false);
    }
  };

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="grid gap-4 md:grid-cols-2">
        <FormField label="Class" required error={errors.classSection?.message}>
          <Select
            placeholder="Choose a class"
            disabled={editing}
            options={classSections.map((cs) => ({ value: classSectionValue(cs), label: cs.label }))}
            {...form.register('classSection', {
              onChange: () => form.setValue('subjectId', ''),
            })}
          />
        </FormField>
        <FormField label="Subject" required error={errors.subjectId?.message}>
          <Select
            placeholder={classSection ? 'Choose a subject' : 'Choose a class first'}
            disabled={editing || !classSection}
            options={subjects.map((s) => ({ value: String(s._id), label: s.name }))}
            {...form.register('subjectId')}
          />
        </FormField>
        <FormField
          label="Name"
          required
          hint='For example "Class Test 3" or "Term 1 drawing"'
          error={errors.name?.message}
          className="md:col-span-2"
        >
          <Input autoComplete="off" {...form.register('name')} />
        </FormField>
        <FormField label="Type" required error={errors.type?.message}>
          <Select options={ASSESSMENT_TYPES} {...form.register('type')} />
        </FormField>
        <Controller
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormField
              label="Date"
              required
              hint="Results can be entered from this day."
              error={errors.date?.message}
            >
              <DatePicker
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                min={session?.startDate}
                max={session?.endDate}
                showToday
              />
            </FormField>
          )}
        />
        <Controller
          control={form.control}
          name="mode"
          render={({ field }) => (
            <RadioGroup
              legend="How results are recorded"
              options={ASSESSMENT_MODES}
              value={field.value}
              onChange={field.onChange}
              error={errors.mode?.message}
              className="md:col-span-2"
            />
          )}
        />
        {mode === 'marks' && (
          <FormField label="Total marks" required error={errors.totalMarks?.message}>
            <Input inputMode="numeric" className="max-w-40" {...form.register('totalMarks')} />
          </FormField>
        )}
        {form.formError && (
          <Alert tone="error" className="md:col-span-2">
            {form.formError}
          </Alert>
        )}
        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row md:col-span-2">
          {editing && (
            <Button variant="danger-ghost" icon={Trash2} onClick={() => setConfirmDelete(true)}>
              Delete draft
            </Button>
          )}
          <Link
            to={editing ? teacherPaths.assessment(assessment._id) : teacherPaths.assessments()}
            className={buttonClasses({ variant: 'secondary', className: 'sm:ml-auto' })}
          >
            Cancel
          </Link>
          <Button type="submit" icon={Save} loading={isSubmitting}>
            {editing ? 'Save changes' : 'Create and enter results'}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        loading={remove.isPending}
        title="Delete this draft?"
        message="The assessment and any results entered for it will be removed. This cannot be undone."
        confirmLabel="Delete draft"
      />
      <UnsavedChangesDialog blocker={blocker} />
    </Card>
  );
}

export default function AssessmentFormPage() {
  const { assessmentId } = useParams();
  const editing = Boolean(assessmentId);
  const assessment = useAssessment(assessmentId);
  const mine = useMyAssignments();
  const settings = useSchoolSettings();

  const loading = <Skeleton className="h-96 rounded-card" />;
  const pending = [mine, settings, ...(editing ? [assessment] : [])];
  const blocking = pending.find((q) => q.isError) ?? pending.find((q) => q.isPending);

  return (
    <>
      <Link
        to={editing ? teacherPaths.assessment(assessmentId) : teacherPaths.assessments()}
        className={buttonClasses({ variant: 'ghost', size: 'sm', className: '-ml-2 mb-2' })}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back
      </Link>
      <PageHeader title={editing ? 'Edit assessment' : 'New assessment'} />
      {blocking ? (
        <QueryState query={blocking} loading={loading}>
          {() => null}
        </QueryState>
      ) : editing && assessment.data.status !== 'draft' ? (
        <Alert tone="info" title="Already published">
          Published assessments can no longer be changed. Change individual results from the results
          page, with a reason.
        </Alert>
      ) : (
        <AssessmentForm
          assessment={editing ? assessment.data : null}
          classSections={mine.data.classSections}
          session={settings.data.session}
          today={settings.data.today}
        />
      )}
    </>
  );
}
