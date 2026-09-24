import { cn } from '../../utils/cn.js';
import { DialogShell } from './DialogShell.jsx';

const WIDTHS = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };

/**
 * Dialog: a bottom sheet on phones (thumb-reachable), a centred card from `sm` up.
 *   <Modal open={open} onClose={close} title="Edit notice" footer={<Button …/>}>…</Modal>
 */
export function Modal({ size = 'md', ...props }) {
  return (
    <DialogShell
      {...props}
      className={cn('m-0 mt-auto w-full sm:m-auto', WIDTHS[size])}
      panelClassName="max-h-[90dvh] rounded-t-card animate-sheet-up sm:rounded-card sm:animate-fade-in"
    />
  );
}
