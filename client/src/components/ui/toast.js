/**
 * Toast store. Call from anywhere (mutation callbacks included):
 *   toast.success('Attendance saved');  toast.error(error.message);  toast.info('Link copied');
 * <Toaster /> (mounted once in AppProviders) renders them.
 */
const MAX_VISIBLE = 3;
const DURATION = { success: 5000, info: 5000, error: 8000 };

let toasts = [];
let nextId = 1;
const listeners = new Set();

const emit = () => listeners.forEach((listener) => listener());

export const toastStore = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => toasts,
};

export function dismissToast(id) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function show(tone, message, { title, duration } = {}) {
  const id = nextId++;
  toasts = [...toasts, { id, tone, title, message, duration: duration ?? DURATION[tone] }].slice(
    -MAX_VISIBLE,
  );
  emit();
  return id;
}

export const toast = {
  success: (message, options) => show('success', message, options),
  error: (message, options) => show('error', message, options),
  info: (message, options) => show('info', message, options),
};
