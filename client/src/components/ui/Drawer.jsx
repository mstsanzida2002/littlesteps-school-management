import { cn } from '../../utils/cn.js';
import { DialogShell } from './DialogShell.jsx';

const SIDES = {
  left: {
    dialog: 'm-0 mr-auto h-dvh max-h-dvh w-[min(22rem,88vw)]',
    panel: 'h-full animate-slide-left pt-[env(safe-area-inset-top)]',
  },
  right: {
    dialog: 'm-0 ml-auto h-dvh max-h-dvh w-[min(24rem,92vw)]',
    panel: 'h-full animate-slide-right pt-[env(safe-area-inset-top)]',
  },
  bottom: {
    dialog: 'm-0 mt-auto w-full',
    panel: 'max-h-[85dvh] rounded-t-card animate-sheet-up',
  },
};

/** Panel that slides in from an edge: filters, the mobile "More" menu, detail panes. */
export function Drawer({ side = 'right', ...props }) {
  const { dialog, panel } = SIDES[side];
  return <DialogShell {...props} className={cn(dialog)} panelClassName={panel} />;
}
