import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

import { ROUTES } from '../config/constants.js';

/** Router-level error boundary. */
export default function ErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error?.message || 'Something went wrong';

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">Oops, something went wrong</h1>
      <p className="text-slate-600">{message}</p>
      <Link to={ROUTES.HOME} className="font-semibold text-brand-700 underline">
        Go to home page
      </Link>
    </div>
  );
}
