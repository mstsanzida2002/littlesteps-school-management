import { useState } from 'react';
import { Link, Navigate } from 'react-router';

import { ROLE_HOME } from '../../../config/constants.js';
import { useAuth } from '../hooks/useAuth.js';
import { useChangePassword } from '../hooks/useChangePassword.js';

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base focus:border-brand-600 focus:ring-2 focus:ring-brand-100 focus:outline-none';

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' };

/**
 * Change password. Forced (and the only reachable page) while user.mustChangePassword is true,
 * e.g. after an admin created the account or reset its password.
 */
export default function ChangePasswordPage() {
  const { user, logout } = useAuth();
  const mutation = useChangePassword();
  const [form, setForm] = useState(EMPTY);
  const [done, setDone] = useState(false);

  if (done && !user.mustChangePassword) return <Navigate to={ROLE_HOME[user.role]} replace />;

  const forced = user.mustChangePassword;
  const mismatch = form.confirmPassword && form.confirmPassword !== form.newPassword;
  const fieldError = (field) => mutation.error?.errors?.find((e) => e.field === field)?.message;

  const onChange = (event) => setForm((f) => ({ ...f, [event.target.name]: event.target.value }));
  const onSubmit = (event) => {
    event.preventDefault();
    if (mismatch) return;
    mutation.mutate(
      { currentPassword: form.currentPassword, newPassword: form.newPassword },
      { onSuccess: () => setDone(true) },
    );
  };

  const field = (name, label, autoComplete) => (
    <div>
      <label htmlFor={name} className="mb-1 block font-semibold">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="password"
        autoComplete={autoComplete}
        required
        value={form[name]}
        onChange={onChange}
        className={inputClass}
      />
      {fieldError(name) && <p className="mt-1 text-sm text-absent">{fieldError(name)}</p>}
    </div>
  );

  return (
    <>
      <h1 className="text-2xl font-extrabold">Change password</h1>
      {forced ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-slate-700">
          Your password was set by the school. Please choose your own password to continue.
        </p>
      ) : (
        <p className="mt-1 text-slate-600">Other devices will be signed out.</p>
      )}

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        {field(
          'currentPassword',
          forced ? 'Password from the school' : 'Current password',
          'current-password',
        )}
        {field('newPassword', 'New password', 'new-password')}
        <p className="-mt-2 text-sm text-slate-500">
          At least 8 characters, with a letter and a number.
        </p>
        {field('confirmPassword', 'Repeat new password', 'new-password')}
        {mismatch && <p className="-mt-2 text-sm text-absent">The passwords do not match.</p>}

        {mutation.isError && !mutation.error.errors?.length && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 font-semibold text-absent">
            {mutation.error.message}
          </p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending || !form.currentPassword || !form.newPassword || mismatch}
          className="rounded-lg bg-brand-600 px-4 py-3 text-lg font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {mutation.isPending ? 'Saving…' : 'Save new password'}
        </button>
      </form>

      <div className="mt-6 flex justify-between text-sm">
        {!forced && (
          <Link to={ROLE_HOME[user.role]} className="font-semibold text-brand-700 underline">
            Back to dashboard
          </Link>
        )}
        <button
          type="button"
          onClick={logout}
          className="ml-auto font-semibold text-slate-600 underline"
        >
          Log out
        </button>
      </div>
    </>
  );
}
