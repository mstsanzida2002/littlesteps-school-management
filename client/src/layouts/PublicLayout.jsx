import { Suspense } from 'react';
import { Link, Outlet } from 'react-router';

import { Spinner } from '../components/ui/Spinner.jsx';
import { APP_NAME, ROLE_HOME, ROUTES } from '../config/constants.js';
import { useAuth } from '../features/auth/hooks/useAuth.js';

export default function PublicLayout() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to={ROUTES.HOME} className="text-xl font-extrabold text-brand-700">
            {APP_NAME}
          </Link>
          <Link
            to={user ? ROLE_HOME[user.role] : ROUTES.LOGIN}
            className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700"
          >
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
