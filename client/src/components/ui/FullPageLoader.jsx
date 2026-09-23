import { APP_NAME } from '../../config/constants.js';
import { Spinner } from './Spinner.jsx';

export function FullPageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-brand-50">
      <p className="text-2xl font-extrabold text-brand-700">{APP_NAME}</p>
      <Spinner label={label} />
    </div>
  );
}
