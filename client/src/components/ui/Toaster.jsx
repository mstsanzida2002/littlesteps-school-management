import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { cn } from '../../utils/cn.js';
import { dismissToast, toastStore } from './toast.js';

const TONES = {
  success: { icon: CircleCheck, classes: 'border-citron-300 text-present-ink', role: 'status' },
  info: { icon: Info, classes: 'border-brand-200 text-brand-800', role: 'status' },
  error: { icon: CircleAlert, classes: 'border-cerise-200 text-absent-ink', role: 'alert' },
};

/**
 * Renders toasts: above the bottom navigation on phones, top-right on wider screens.
 * Each auto-dismisses (paused while hovered or focused) and has a close button.
 */
export function Toaster() {
  const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot);
  return (
    <section
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:top-4 md:right-4 md:bottom-auto md:left-auto md:items-end md:px-0"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </section>
  );
}

function ToastItem({ toast }) {
  const [paused, setPaused] = useState(false);
  const { icon: Icon, classes, role } = TONES[toast.tone];

  useEffect(() => {
    if (paused) return undefined;
    const timer = setTimeout(() => dismissToast(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [paused, toast.id, toast.duration]);

  return (
    <div
      role={role}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        'pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-control border-2 bg-surface py-2 pr-1 pl-4 shadow-raised',
        classes,
      )}
    >
      <Icon aria-hidden="true" className="mt-2.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1 py-2 text-ink">
        {toast.title && <p className="font-bold">{toast.title}</p>}
        <p className={cn(!toast.title && 'font-semibold')}>{toast.message}</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismissToast(toast.id)}
        className="grid size-11 shrink-0 place-items-center rounded-control text-sand-600 hover:text-ink"
      >
        <X className="size-5" />
      </button>
    </div>
  );
}
