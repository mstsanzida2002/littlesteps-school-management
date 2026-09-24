import { ArrowLeft, LogOut, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate } from 'react-router';

import { Alert } from '../../../components/ui/Alert.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { buttonClasses } from '../../../components/ui/buttonStyles.js';
import { FormField } from '../../../components/ui/FormField.jsx';
import { PasswordInput } from '../../../components/ui/Input.jsx';
import { PageTitle } from '../../../components/ui/PageTitle.jsx';
import { ROLE_HOME } from '../../../config/constants.js';
import { useZodForm } from '../../../hooks/useZodForm.js';
import { useAuth } from '../hooks/useAuth.js';
import { useChangePassword } from '../hooks/useChangePassword.js';
import { changePasswordSchema } from '../schemas.js';

/**
 * Change password. Forced (and the only reachable page) while user.mustChangePassword is true,
 * e.g. after an admin created the account or reset its password.
 */
export default function ChangePasswordPage() {
  const { user, logout } = useAuth();
  const mutation = useChangePassword();
  const [done, setDone] = useState(false);
  const form = useZodForm(changePasswordSchema, {
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const { errors, isSubmitting } = form.formState;

  if (done && !user.mustChangePassword) return <Navigate to={ROLE_HOME[user.role]} replace />;

  const forced = user.mustChangePassword;

  return (
    <>
      <PageTitle title="Change password" />
      <h1 className="text-2xl font-bold">Change password</h1>
      {forced ? (
        <Alert tone="warning" className="mt-3">
          Your password was set by the school. Please choose your own password to continue.
        </Alert>
      ) : (
        <p className="mt-1 text-muted">Other devices will be signed out.</p>
      )}

      <form
        onSubmit={form.submit(async ({ currentPassword, newPassword }) => {
          await mutation.mutateAsync({ currentPassword, newPassword });
          setDone(true);
        })}
        className="mt-6 flex flex-col gap-4"
        noValidate
      >
        <FormField
          label={forced ? 'Password from the school' : 'Current password'}
          error={errors.currentPassword?.message}
        >
          <PasswordInput
            id="currentPassword"
            autoComplete="current-password"
            {...form.register('currentPassword')}
          />
        </FormField>
        <FormField
          label="New password"
          hint="At least 8 characters, with a letter and a number."
          error={errors.newPassword?.message}
        >
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            {...form.register('newPassword')}
          />
        </FormField>
        <FormField label="Repeat new password" error={errors.confirmPassword?.message}>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            {...form.register('confirmPassword')}
          />
        </FormField>

        {form.formError && <Alert tone="error">{form.formError}</Alert>}

        <Button type="submit" size="lg" icon={ShieldCheck} loading={isSubmitting} fullWidth>
          {isSubmitting ? 'Saving…' : 'Save new password'}
        </Button>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        {!forced && (
          <Link
            to={ROLE_HOME[user.role]}
            className={buttonClasses({ variant: 'ghost', size: 'sm' })}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to dashboard
          </Link>
        )}
        <Button variant="ghost" size="sm" icon={LogOut} onClick={logout} className="ml-auto">
          Log out
        </Button>
      </div>
    </>
  );
}
