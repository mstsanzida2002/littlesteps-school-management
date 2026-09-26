import { LogoMark } from '../brand/Logo.jsx';

/** Shared footer for every layout: the mark, the name, and the year. Deliberately plain. */
export function Footer() {
  return (
    <footer className="border-t border-line px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-1 text-sm text-muted sm:flex-row">
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
          <LogoMark size={16} />
          LittleSteps
        </span>
        <span>© {new Date().getFullYear()} LittleSteps</span>
      </div>
    </footer>
  );
}
