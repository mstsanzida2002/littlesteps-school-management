import { Suspense } from 'react';
import { Link, Outlet } from 'react-router';

import { Spinner } from '../components/ui/Spinner.jsx';
import { APP_NAME, ROUTES } from '../config/constants.js';

export default function AuthLayout() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-50 px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          to={ROUTES.HOME}
          className="mb-6 block text-center text-3xl font-extrabold text-brand-700"
        >
          {APP_NAME}
        </Link>
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
