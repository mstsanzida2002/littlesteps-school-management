import { ArrowLeft, Eye, FileText, Send } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

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
import { SkeletonCard } from '../../../components/ui/Skeleton.jsx';
import { Textarea } from '../../../components/ui/Textarea.jsx';
import { toast } from '../../../components/ui/toast.js';
import { UnsavedChangesDialog } from '../../../components/ui/UnsavedChangesDialog.jsx';
import { adminPaths } from '../../../config/paths.js';
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges.js';
import { friendlyError } from '../../../lib/errorMessages.js';
import { endOfSchoolDay, todayDateKey } from '../../../utils/date.js';
import { NoticeCard } from '../../notices/components/NoticeCard.jsx';
import { useCreateNotice, useNotice, useUpdateNotice } from '../../notices/hooks/useNotices.js';

const AUDIENCES = [
  { value: 'all', label: 'Everyone', description: 'Guardians and teachers.' },
  { value: 'students', label: 'Guardians', description: 'Every student account.' },
  { value: 'teachers', label: 'Teachers', description: 'Staff only.' },
];

const blank = { title: '', body: '', audience: 'all', isPinned: false, expiresOn: '' };

function NoticeForm({ notice }) {
  const navigate = useNavigate();
  const create = useCreateNotice();
  const update = useUpdateNotice();
  const editing = Boolean(notice);
  const initial = notice
    ? {
        title: notice.title,
        body: notice.body,
        audience: notice.audience,
        isPinned: notice.isPinned,
        expiresOn: notice.expiresAt ? String(notice.expiresAt).slice(0, 10) : '',
      }
    : blank;
  const [values, setValues] = useState(initial);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(null); // 'draft' | 'publish' | 'save'
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const { blocker, allowNavigation } = useUnsavedChanges(dirty && !saving);
  const set = (patch) => setValues({ ...values, ...patch });
  const fieldError = (name) => error?.errors?.find((e) => e.field === name)?.message;
  const clientErrors = {
    title: values.title.trim().length < 3 ? 'At least 3 characters' : null,
    body: values.body.trim().length < 3 ? 'Write the notice (at least 3 characters)' : null,
  };
  const [touched, setTouched] = useState(false);
  const show = (name) => (touched ? clientErrors[name] : null) ?? fieldError(name);

  const submit = async (mode) => {
    setTouched(true);
    if (clientErrors.title || clientErrors.body) return;
    setSaving(mode);
    setError(null);
    // Expiry is a school day: the notice disappears at the start of the next day (Dhaka).
    const expiresAt = values.expiresOn ? endOfSchoolDay(values.expiresOn) : null;
    const body = {
      title: values.title.trim(),
      body: values.body.trim(),
      audience: values.audience,
      isPinned: values.isPinned,
      expiresAt: expiresAt ?? (editing ? null : undefined),
    };
    try {
      const res = editing
        ? await update.mutateAsync({ id: notice._id, ...body })
        : await create.mutateAsync({ ...body, publish: mode === 'publish' });
      allowNavigation();
      toast.success(res.message);
      navigate(adminPaths.notices());
    } catch (err) {
      setError(err);
    } finally {
      setSaving(null);
    }
  };

  const preview = {
    title: values.title || 'Your title',
    body: values.body || 'The notice text appears here.',
    audience: values.audience,
    isPinned: values.isPinned,
    publishedAt: notice?.publishedAt,
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[3fr_2fr] lg:items-start">
      <Card>
        <form onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-4">
          <FormField label="Title" required error={show('title')}>
            <Input value={values.title} onChange={(e) => set({ title: e.target.value })} />
          </FormField>
          <FormField
            label="Notice"
            required
            hint="Plain text. Bangla is fine."
            error={show('body')}
          >
            <Textarea
              rows={8}
              value={values.body}
              onChange={(e) => set({ body: e.target.value })}
            />
          </FormField>
          <RadioGroup
            legend="Who sees it"
            options={AUDIENCES}
            value={values.audience}
            onChange={(audience) => set({ audience })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Checkbox
              label="Pin to the top"
              description="Pinned notices come first and show on guardians' home page."
              checked={values.isPinned}
              onChange={(e) => set({ isPinned: e.target.checked })}
            />
            <FormField
              label="Show until"
              optional
              hint="Last day it is shown."
              error={fieldError('expiresAt')}
            >
              <DatePicker
                value={values.expiresOn}
                onChange={(expiresOn) => set({ expiresOn: expiresOn ?? '' })}
                min={todayDateKey()}
              />
            </FormField>
          </div>
          {error &&
            !error.errors?.some((e) => ['title', 'body', 'expiresAt'].includes(e.field)) && (
              <Alert tone="error">{friendlyError(error).message}</Alert>
            )}
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Link to={adminPaths.notices()} className={buttonClasses({ variant: 'secondary' })}>
              Cancel
            </Link>
            {editing ? (
              <Button onClick={() => submit('save')} loading={saving === 'save'}>
                Save changes
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  icon={FileText}
                  onClick={() => submit('draft')}
                  loading={saving === 'draft'}
                >
                  Save as draft
                </Button>
                <Button
                  icon={Send}
                  onClick={() => submit('publish')}
                  loading={saving === 'publish'}
                >
                  Publish now
                </Button>
              </>
            )}
          </div>
          {editing && notice.status === 'published' && (
            <p className="text-sm text-muted">
              Edits to a published notice don&apos;t notify again.
            </p>
          )}
        </form>
      </Card>
      <section aria-labelledby="preview-title" className="flex flex-col gap-2 lg:sticky lg:top-24">
        <h2 id="preview-title" className="flex items-center gap-2 font-bold">
          <Eye aria-hidden="true" className="size-5 text-brand-700" />
          How guardians will see it
        </h2>
        {values.audience === 'teachers' ? (
          <Alert tone="info">Guardians won&apos;t see this notice; it is for teachers only.</Alert>
        ) : null}
        <div className={values.audience === 'teachers' ? 'opacity-60' : undefined}>
          <NoticeCard notice={preview} guardian as="div" />
        </div>
      </section>
      <UnsavedChangesDialog blocker={blocker} />
    </div>
  );
}

export default function NoticeFormPage() {
  const { noticeId } = useParams();
  const notice = useNotice(noticeId);
  return (
    <>
      <Link
        to={adminPaths.notices()}
        className={buttonClasses({ variant: 'ghost', size: 'sm', className: '-ml-2 mb-2' })}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Notices
      </Link>
      <PageHeader title={noticeId ? 'Edit notice' : 'New notice'} />
      {noticeId ? (
        <QueryState query={notice} loading={<SkeletonCard className="h-96" />}>
          {(data) => <NoticeForm notice={data} />}
        </QueryState>
      ) : (
        <NoticeForm />
      )}
    </>
  );
}
