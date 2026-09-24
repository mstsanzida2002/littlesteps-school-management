import { Save } from 'lucide-react';
import { Controller, useWatch } from 'react-hook-form';
import * as z from 'zod/mini';

import { Alert } from '../../../components/ui/Alert.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { FormField } from '../../../components/ui/FormField.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { RadioGroup } from '../../../components/ui/RadioGroup.jsx';
import { Select } from '../../../components/ui/Select.jsx';
import { Textarea } from '../../../components/ui/Textarea.jsx';
import { toast } from '../../../components/ui/toast.js';
import { useZodForm } from '../../../hooks/useZodForm.js';
import { gradeFor, parseMarks, percentOf } from '../../../utils/grading.js';
import { useEditPublishedResult } from '../hooks/useResults.js';
import { RESULT_ATTENDANCE_OPTIONS } from './resultAttendance.js';

/**
 * Change one published result, with the reason the API requires. Only the changed fields are
 * sent; the guardian is notified by the server.
 */
export function EditResultDialog({ assessment, student, scale, onClose }) {
  const result = student.result;
  const total = assessment.totalMarks;
  const schema = z
    .object({
      attendance: z.enum(['present', 'absent', 'excused']),
      marks: z.string(),
      grade: z.string(),
      remarks: z.string().check(z.maxLength(500, 'Keep remarks under 500 characters')),
      reason: z.string().check(z.trim(), z.minLength(3, 'Give a reason (at least 3 characters)')),
    })
    .check(
      z.refine(
        (v) =>
          assessment.mode !== 'marks' ||
          v.attendance !== 'present' ||
          !parseMarks(v.marks, total).error,
        { path: ['marks'], message: `Marks from 0 to ${total}, at most 2 decimals` },
      ),
    );
  const form = useZodForm(schema, {
    defaultValues: {
      attendance: result?.attendance ?? 'present',
      marks: result?.marksObtained != null ? String(result.marksObtained) : '',
      grade: result?.grade ?? '',
      remarks: result?.remarks ?? '',
      reason: '',
    },
  });
  const { errors, isSubmitting } = form.formState;
  const [attendance, marks] = useWatch({ control: form.control, name: ['attendance', 'marks'] });
  const present = attendance === 'present';
  const parsed = parseMarks(marks, total);
  const preview = parsed.value != null ? gradeFor(percentOf(parsed.value, total), scale) : null;
  const edit = useEditPublishedResult();

  const onSubmit = form.submit(async (values) => {
    const body = { resultId: result._id, reason: values.reason };
    if (values.attendance !== (result.attendance ?? 'present')) body.attendance = values.attendance;
    if (values.attendance === 'present') {
      if (assessment.mode === 'marks') {
        const next = parseMarks(values.marks, total).value;
        if (next !== (result.marksObtained ?? null)) body.marksObtained = next;
      }
      if (assessment.mode === 'grade' && values.grade !== (result.grade ?? '')) {
        body.grade = values.grade || null;
      }
    }
    if (values.remarks.trim() !== (result.remarks ?? '')) body.remarks = values.remarks.trim();
    if (Object.keys(body).length === 2) {
      form.setFormError('Nothing has changed yet.');
      return;
    }
    await edit.mutateAsync(body);
    toast.success(`Result updated for ${student.name}. The guardian is notified.`);
    onClose();
  });

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!isSubmitting}
      title={`Change ${student.name}'s result`}
      description={`${assessment.name} · published results change only with a reason`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="edit-result" icon={Save} loading={isSubmitting}>
            Save change
          </Button>
        </>
      }
    >
      <form id="edit-result" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Controller
          control={form.control}
          name="attendance"
          render={({ field }) => (
            <RadioGroup
              legend="Attendance"
              variant="segmented"
              options={RESULT_ATTENDANCE_OPTIONS}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        {present && assessment.mode === 'marks' && (
          <FormField
            label={`Marks (out of ${total})`}
            hint={preview ? `Grade: ${preview}` : undefined}
            error={errors.marks?.message}
          >
            <Input inputMode="decimal" className="max-w-40" {...form.register('marks')} />
          </FormField>
        )}
        {present && assessment.mode === 'grade' && (
          <FormField label="Grade" error={errors.grade?.message}>
            <Select
              placeholder="Choose a grade"
              options={scale.map((b) => ({ value: b.grade, label: b.grade }))}
              {...form.register('grade')}
            />
          </FormField>
        )}
        <FormField label="Remarks" optional error={errors.remarks?.message}>
          <Textarea rows={2} {...form.register('remarks')} />
        </FormField>
        <FormField label="Reason for the change" required error={errors.reason?.message}>
          <Textarea rows={2} {...form.register('reason')} />
        </FormField>
        {form.formError && <Alert tone="error">{form.formError}</Alert>}
      </form>
    </Modal>
  );
}
