import { LogoMark } from '../brand/Logo.jsx';
import { Skeleton } from '../ui/Skeleton.jsx';

const Dot = () => <Skeleton className="size-10 rounded-full" />;

/**
 * The signed-in app's shape while the session is restored: header, sidebar (desktop), bottom bar
 * (phones), a title and three cards. It matches the static placeholder in index.html, so the
 * first paint, this and the real page line up without jumping.
 */
export function AppShellSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading LittleSteps" className="flex min-h-dvh bg-page">
      <div className="hidden w-64 shrink-0 flex-col gap-3 border-r border-line bg-surface px-3 py-5 lg:flex">
        <Skeleton className="h-[6.5rem] w-32" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-4/5" />
        <Skeleton className="h-11 w-[85%]" />
        <Skeleton className="h-11 w-3/4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-16 items-center gap-3 border-b-3 border-cerise-400 bg-surface px-3 lg:px-8">
          <LogoMark size={36} className="lg:hidden" />
          <span className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </span>
          <Dot />
          <Dot />
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:p-6 lg:px-8">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="mt-2.5 h-4 w-80 max-w-full" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[7.5rem] rounded-card border border-line bg-surface shadow-card"
              />
            ))}
          </div>
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 flex h-16 items-center justify-around border-t border-line bg-surface lg:hidden">
        <Dot />
        <Dot />
        <Dot />
        <Dot />
        <Dot />
      </div>
    </div>
  );
}
