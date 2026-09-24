import { Suspense } from 'react';
import { Link, Outlet } from 'react-router';

import { LogoLink } from '../components/brand/Logo.jsx';
import { buttonClasses } from '../components/ui/buttonStyles.js';
import { Spinner } from '../components/ui/Spinner.jsx';
import { ROLE_HOME, ROUTES } from '../config/constants.js';
import { useAuth } from '../features/auth/hooks/useAuth.js';

export default function PublicLayout() {
  const { user } = useAuth();
  const homeTo = user ? ROLE_HOME[user.role] : ROUTES.LOGIN;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b-3 border-cerise-400 bg-surface pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2">
          <LogoLink to={homeTo} width={84} />
          <Link to={homeTo} className={buttonClasses()}>
            {user ? 'My dashboard' : 'Log in'}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
