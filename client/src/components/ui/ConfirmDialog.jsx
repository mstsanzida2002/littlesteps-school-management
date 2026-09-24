import { useRef, useState } from 'react';

import { Button } from './Button.jsx';
import { FormField } from './FormField.jsx';
import { Modal } from './Modal.jsx';
import { Textarea } from './Textarea.jsx';

/**
 * Confirmation before a consequential action. Focus starts on Cancel (or the reason box), and
 * Esc/backdrop are disabled while `loading`.
 *
 * `reason` asks for a written reason first, as the API requires for edits of marked attendance,
 * published results and meeting cancellations: { label, minLength = 3, placeholder }.
 * onConfirm(reason) receives the trimmed text (or undefined without `reason`).
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
  reason,
}) {
  const cancelRef = useRef(null);
  const reasonRef = useRef(null);
  const [text, setText] = useState('');
  const minLength = reason?.minLength ?? 3;
  const reasonValid = !reason || text.trim().length >= minLength;

  const close = () => {
    setText('');
    onClose?.();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      size="sm"
      dismissible={!loading}
      initialFocusRef={reason ? reasonRef : cancelRef}
      footer={
        <>
          <Button ref={cancelRef} variant="secondary" onClick={close} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            loading={loading}
            disabled={!reasonValid}
            onClick={() => onConfirm?.(reason ? text.trim() : undefined)}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message && <div className="text-ink">{message}</div>}
      {reason && (
        <FormField
          label={reason.label ?? 'Reason'}
          hint={`At least ${minLength} characters. It is saved in the history.`}
          required
          className="mt-4"
        >
          <Textarea
            ref={reasonRef}
            rows={3}
            value={text}
            placeholder={reason.placeholder}
            onChange={(event) => setText(event.target.value)}
          />
        </FormField>
      )}
    </Modal>
  );
}
