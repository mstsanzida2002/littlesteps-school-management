import { useState } from 'react';
import { Navigate, useLocation } from 'react-router';

import { ROLE_HOME } from '../../../config/constants.js';
import { useAuth } from '../hooks/useAuth.js';
import { useLogin } from '../hooks/useLogin.js';

/** Where to go after sign-in: the page they wanted, if their role may see it; else their home. */
function destinationFor(user, from) {
  const home = ROLE_HOME[user.role];
  const wanted = from?.pathname;
  return wanted && (wanted === home || wanted.startsWith(`${home}/`))
    ? `${wanted}${from.search ?? ''}`
    : home;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-brand-600 focus:ring-2 focus:ring-brand-100 focus:outline-none';

export default function LoginPage() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const loginMutation = useLogin();
  const [form, setForm] = useState({ identifier: '', password: '' });

  if (isAuthenticated) {
    return <Navigate to={destinationFor(user, location.state?.from)} replace />;
  }

  const onChange = (event) => setForm((f) => ({ ...f, [event.target.name]: event.target.value }));
  const onSubmit = (event) => {
    event.preventDefault();
    loginMutation.mutate(form);
  };

  return (
    <>
      <h1 className="text-2xl font-extrabold">Log in</h1>
      <p className="mt-1 text-slate-600">Parents and guardians use the student&apos;s account.</p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        <div>
          <label htmlFor="identifier" className="mb-1 block font-semibold">
            Username or email
          </label>
          <input
            id="identifier"
            name="identifier"
            autoComplete="username"
            autoCapitalize="none"
            required
            value={form.identifier}
            onChange={onChange}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block font-semibold">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={onChange}
            className={inputClass}
          />
        </div>

        {loginMutation.isError && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 font-semibold text-absent">
            {loginMutation.error.message}
          </p>
        )}

        <button
          type="submit"
          disabled={loginMutation.isPending || !form.identifier || !form.password}
          className="rounded-lg bg-brand-600 px-4 py-3 text-lg font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loginMutation.isPending ? 'Signing in…' : 'Log in'}
        </button>
      </form>
    </>
  );
}
