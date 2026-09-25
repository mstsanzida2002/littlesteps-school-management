import { useRef, useState } from 'react';

import { Alert } from './Alert.jsx';
import { Button } from './Button.jsx';
import { FormField } from './FormField.jsx';
import { Input } from './Input.jsx';
import { Modal } from './Modal.jsx';

/**
 * For changes that affect everyone (switching the active school year): the confirm button stays
 * disabled until the exact `phrase` is typed. `children` explains what will happen (e.g. the
 * server's 409 summary); `error` shows a failure in words.
 */
export function TypeToConfirm({
  open,
  onClose,
  onConfirm,
  title,
  phrase,
  confirmLabel = 'Confirm',
  loading = false,
  error,
  children,
}) {
  const inputRef = useRef(null);
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === phrase;
  const close = () => {
    setTyped('');
    onClose?.();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      size="md"
      dismissible={!loading}
      initialFocusRef={inputRef}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" loading={loading} disabled={!matches} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {children}
        <FormField
          label={
            <>
              Type <strong className="font-mono">{phrase}</strong> to confirm
            </>
          }
        >
          <Input
            ref={inputRef}
            value={typed}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setTyped(e.target.value)}
          />
        </FormField>
        {error && <Alert tone="error">{error}</Alert>}
      </div>
    </Modal>
  );
}
