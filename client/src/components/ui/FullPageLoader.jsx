import { LogoMark } from '../brand/Logo.jsx';
import { Spinner } from './Spinner.jsx';

/** Shown while the session is restored on app start (no image download: the mark is inline). */
export function FullPageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-1 bg-page">
      <LogoMark size={56} />
      <Spinner label={label} className="p-4" />
    </div>
  );
}
