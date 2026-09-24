import { ConfirmDialog } from './ConfirmDialog.jsx';

/** Asks before leaving a page with unsaved changes (pairs with useUnsavedChanges). */
export function UnsavedChangesDialog({
  blocker,
  message = 'Your changes on this page have not been saved.',
}) {
  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onClose={() => blocker.reset?.()}
      onConfirm={() => blocker.proceed?.()}
      title="Leave without saving?"
      message={message}
      confirmLabel="Leave without saving"
      cancelLabel="Stay on this page"
    />
  );
}
