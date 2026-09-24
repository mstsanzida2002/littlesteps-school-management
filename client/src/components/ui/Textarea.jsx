import { cn } from '../../utils/cn.js';
import { fieldClasses } from './fieldStyles.js';

/** Multi-line text. Use inside <FormField>. */
export function Textarea({ invalid = false, rows = 4, className, ...props }) {
  return (
    <textarea
      rows={rows}
      className={fieldClasses(invalid, cn('resize-y py-2.5', className))}
      {...props}
    />
  );
}
