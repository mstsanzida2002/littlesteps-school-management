import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

import { cn } from '../../utils/cn.js';
import { IconButton } from './Button.jsx';

/**
 * Base for Modal and Drawer: a native <dialog> opened with showModal(), which gives a focus
 * trap, inert background, Esc to close and focus restoration for free.
 *
 * - Esc and a backdrop tap call onClose (unless `dismissible` is false, e.g. while saving).
 * - `initialFocusRef` chooses what gets focus; otherwise the browser focuses the first control.
 * - Content only renders while open, so forms inside start fresh each time.
 */
export function DialogShell({
  open,
  onClose,
  title,
  description,
  footer,
  dismissible = true,
  initialFocusRef,
  className,
  panelClassName,
  children,
}) {
  const ref = useRef(null);
  const pressStartedOnBackdrop = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      initialFocusRef?.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initialFocusRef]);

  // Close if the dialog is unmounted while open (route change).
  useEffect(() => {
    const dialog = ref.current;
    return () => dialog?.open && dialog.close();
  }, []);

  const requestClose = () => {
    if (dismissible) onClose?.();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault(); // React state decides; Esc only asks.
        requestClose();
      }}
      onPointerDown={(event) => {
        pressStartedOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressStartedOnBackdrop.current && event.target === event.currentTarget) requestClose();
      }}
      className={cn(
        'max-h-none max-w-none bg-transparent p-0 text-ink backdrop:animate-fade-in',
        className,
      )}
    >
      {open && (
        <div className={cn('flex flex-col bg-surface shadow-raised', panelClassName)}>
          <header className="flex items-start gap-3 border-b border-line py-3 pr-2 pl-5">
            <div className="min-w-0 flex-1 py-1.5">
              <h2 id={titleId} className="text-lg leading-tight font-bold">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-1 text-sm text-muted">
                  {description}
                </p>
              )}
            </div>
            {dismissible && <IconButton icon={X} label="Close" onClick={requestClose} />}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <footer className="flex flex-col-reverse gap-2 border-t border-line px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
