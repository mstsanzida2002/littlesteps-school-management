import { Save } from 'lucide-react';
import { Controller } from 'react-hook-form';
import * as z from 'zod/mini';

import { Alert } from '../../../components/ui/Alert.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { FormField } from '../../../components/ui/FormField.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { RadioGroup } from '../../../components/ui/RadioGroup.jsx';
import { Textarea } from '../../../components/ui/Textarea.jsx';
import { toast } from '../../../components/ui/toast.js';
import { STATUS_GROUPS } from '../../../config/statuses.js';
import { useZodForm } from '../../../hooks/useZodForm.js';
import { useEditAttendanceDay, useEditAttendanceRecord } from '../hooks/useAttendance.js';

const STATUS_OPTIONS = Object.entries(STATUS_GROUPS.attendance).map(([value, meta]) => ({
  value,
  label: meta.label,
  icon: meta.icon,
  tone: meta.tone,
}));

const schema = z.object({
  status: z.enum(['present', 'absent', 'late', 'excused'], { error: 'Choose a status' }),
  reason: z
    .string()
    .check(
      z.trim(),
      z.minLength(3, 'Give a reason (at least 3 characters)'),
      z.maxLength(500, 'Keep it under 500 characters'),
    ),
});

/**
 * Change one attendance record, or a student's whole day (the teacher's own subjects), with the
 * reason the API requires. BACKDATE_LIMIT and other errors read as in lib/errorMessages.js.
 * `override` (admins): no backdate limit, a whole day covers every subject, and the change is
 * labelled and audited as an admin override.
 *
 * target: { kind: 'record', id, status, studentName, subjectName, dayLabel }
 *       | { kind: 'day', studentId, date, status, studentName, dayLabel }
 */
export function EditAttendanceDialog({ target, onClose, override = false }) {
  const editRecord = useEditAttendanceRecord();
  const editDay = useEditAttendanceDay();
  const form = useZodForm(schema, {
    defaultValues: { status: target?.status ?? 'present', reason: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.submit(async ({ status, reason }) => {
    const res =
      target.kind === 'record'
        ? await editRecord.mutateAsync({ id: target.id, status, reason })
        : await editDay.mutateAsync({
            studentId: target.studentId,
            date: target.date,
            status,
            reason,
          });
    toast.success(res.message || 'Attendance updated');
    onClose();
  });

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      dismissible={!isSubmitting}
      title={
        override
          ? target?.kind === 'day'
            ? 'Override the whole day'
            : 'Override attendance'
          : target?.kind === 'day'
            ? 'Change the whole day'
            : 'Change attendance'
      }
      description={
        target &&
        `${target.studentName} · ${target.kind === 'day' ? (override ? 'all subjects' : 'all your subjects') : target.subjectName} · ${target.dayLabel}`
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="edit-attendance" icon={Save} loading={isSubmitting}>
            Save change
          </Button>
        </>
      }
    >
      <form id="edit-attendance" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {override && (
          <Alert tone="warning" title="Admin override">
            Saved as an override in the audit log, with your reason. The guardian is told about
            corrections.
          </Alert>
        )}
        <Controller
          control={form.control}
          name="status"
          render={({ field }) => (
            <RadioGroup
              legend="New status"
              variant="segmented"
              options={STATUS_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.status?.message}
            />
          )}
        />
        <FormField
          label={override ? 'Reason for the override' : 'Reason for the change'}
          required
          hint="Saved in the history. The guardian is told about corrections."
          error={errors.reason?.message}
        >
          <Textarea rows={3} {...form.register('reason')} />
        </FormField>
        {form.formError && <Alert tone="error">{form.formError}</Alert>}
      </form>
    </Modal>
  );
}
