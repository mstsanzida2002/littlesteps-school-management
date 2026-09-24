import { Suspense } from 'react';
import { Outlet } from 'react-router';

import { LogoLink } from '../components/brand/Logo.jsx';
import { LOGIN_LOGO_SIZES } from '../components/brand/logoAssets.js';
import { Spinner } from '../components/ui/Spinner.jsx';
import { ROLE_HOME, ROUTES } from '../config/constants.js';
import { useAuth } from '../features/auth/hooks/useAuth.js';

/**
 * Login and change-password: the full logo, large and centred, above a card. The logo's size is
 * reserved (width/height), and on /login it was preloaded while the session was checked.
 */
export default function AuthLayout() {
  const { user } = useAuth();
  const homeTo = user ? ROLE_HOME[user.role] : ROUTES.LOGIN;

  return (
    <div className="relative flex min-h-dvh flex-col items-center overflow-hidden bg-page px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:justify-center">
      {/* Soft guava glow behind the card. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 size-[38rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--color-blush-200),transparent)] opacity-60"
      />
      <div className="relative w-full max-w-md">
        <div className="mb-5 flex justify-center">
          <LogoLink
            to={homeTo}
            width={260}
            sizes={LOGIN_LOGO_SIZES}
            priority
            className="w-[200px] md:w-[260px]"
          />
        </div>
        <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-8">
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
