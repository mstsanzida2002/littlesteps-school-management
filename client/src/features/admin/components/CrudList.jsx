import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Alert } from '../../../components/ui/Alert.jsx';
import { Button, IconButton } from '../../../components/ui/Button.jsx';
import { Card } from '../../../components/ui/Card.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { DatePicker } from '../../../components/ui/DatePicker.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { FormField } from '../../../components/ui/FormField.jsx';
import { Input } from '../../../components/ui/Input.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Select } from '../../../components/ui/Select.jsx';
import { toast } from '../../../components/ui/toast.js';
import { friendlyError } from '../../../lib/errorMessages.js';

/**
 * A small admin list with add / edit / delete dialogs (classes, sections, subjects, school
 * years). A blocked delete (409 IN_USE) shows the server's counts message in the dialog.
 *
 * fields: [{ name, label, type?: 'text' | 'number' | 'date' | 'select', options?, required?,
 *            hint?, editable?: false }]
 * toBody(values, { editing }) → request body; toValues(item) → form values.
 */
export function CrudList({
  title,
  noun,
  rows,
  loading,
  columns,
  fields,
  toBody = (v) => v,
  toValues,
  create,
  update,
  remove,
  extraActions,
  emptyText,
}) {
  const [editing, setEditing] = useState(null); // item | 'new'
  const [values, setValues] = useState({});
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const open = (item) => {
    setEditing(item);
    setError(null);
    setValues(
      item === 'new'
        ? Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? '']))
        : toValues(item),
    );
  };
  const isNew = editing === 'new';
  const fieldError = (name) => error?.errors?.find((e) => e.field === name)?.message;

  const save = async (event) => {
    event.preventDefault();
    setError(null);
    try {
      if (isNew) await create.mutateAsync(toBody(values, { editing: false }));
      else await update.mutateAsync({ id: editing._id, ...toBody(values, { editing: true }) });
      toast.success(isNew ? `${noun} added` : `${noun} saved`);
      setEditing(null);
    } catch (err) {
      setError(err);
    }
  };
  const confirmDelete = async () => {
    setDeleteError(null);
    try {
      await remove.mutateAsync(deleting._id);
      toast.success(`${noun} deleted`);
      setDeleting(null);
    } catch (err) {
      setDeleteError(err);
    }
  };

  const allColumns = [
    ...columns,
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      mobile: 'actions',
      cell: (item) => (
        <div className="flex justify-end gap-1">
          {extraActions?.(item)}
          <IconButton icon={Pencil} label={`Edit ${item.name}`} onClick={() => open(item)} />
          <IconButton
            icon={Trash2}
            label={`Delete ${item.name}`}
            variant="danger-ghost"
            onClick={() => {
              setDeleteError(null);
              setDeleting(item);
            }}
          />
        </div>
      ),
    },
  ];

  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        <Button icon={Plus} onClick={() => open('new')}>
          Add {noun.toLowerCase()}
        </Button>
      </div>
      <DataTable
        caption={title}
        columns={allColumns}
        rows={rows ?? []}
        loading={loading}
        empty={
          <Card>
            <EmptyState compact title={emptyText ?? `No ${title.toLowerCase()} yet`} />
          </Card>
        }
      />

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={isNew ? `Add ${noun.toLowerCase()}` : `Edit ${editing?.name ?? noun.toLowerCase()}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" form="crud-form" loading={create.isPending || update.isPending}>
              {isNew ? 'Add' : 'Save'}
            </Button>
          </>
        }
      >
        <form id="crud-form" onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2">
          {fields
            .filter((f) => isNew || f.editable !== false)
            .map((f) => (
              <FormField
                key={f.name}
                label={f.label}
                required={f.required}
                hint={f.hint}
                error={fieldError(f.name)}
                className={f.wide ? 'sm:col-span-2' : undefined}
              >
                {f.type === 'select' ? (
                  <Select
                    value={values[f.name] ?? ''}
                    placeholder={f.placeholder ?? 'Choose'}
                    options={f.options}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  />
                ) : f.type === 'date' ? (
                  <DatePicker
                    value={values[f.name] ?? ''}
                    onChange={(value) => setValues({ ...values, [f.name]: value })}
                  />
                ) : (
                  <Input
                    type={f.type === 'number' ? 'number' : 'text'}
                    inputMode={f.type === 'number' ? 'numeric' : undefined}
                    value={values[f.name] ?? ''}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  />
                )}
              </FormField>
            ))}
          {error && !error.errors?.some((e) => fields.some((f) => f.name === e.field)) && (
            <Alert tone="error" className="sm:col-span-2">
              {friendlyError(error).message}
            </Alert>
          )}
        </form>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        size="sm"
        title={`Delete ${deleting?.name ?? ''}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              {deleteError ? 'Close' : 'Cancel'}
            </Button>
            {!deleteError && (
              <Button variant="danger" onClick={confirmDelete} loading={remove.isPending}>
                Delete
              </Button>
            )}
          </>
        }
      >
        {deleteError ? (
          <Alert tone="warning" title={friendlyError(deleteError).title}>
            {friendlyError(deleteError).message}
          </Alert>
        ) : (
          <p>This can&apos;t be undone. It is refused while anything still uses it.</p>
        )}
      </Modal>
    </section>
  );
}
